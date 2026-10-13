/**
 * The text line's other end: what Twilio says back, and the follow-ups.
 *
 * A POST carrying X-Twilio-Signature is Twilio, and it is one of two things.
 * A status report on a text the line sent: delivered is stamped on the row, and
 * a text the carrier could not hand to the number closes that number, since a
 * landline or a dead number refuses the next text the same way. Or a text a
 * business sent to the line: it is filed against the business by its number,
 * and it ends every text still owed to it, because a reply is the thing the
 * texts were for and a nudge after one reads as nobody listening. A STOP, or a
 * reply that asks for no more, closes the number and the business in every
 * chain; anything else is a reply, and the business is marked replied. Every
 * message from a business is put in front of a person at the studio's inbox
 * with its words, the business and its preview, and answered with an empty
 * TwiML response so Twilio sends nothing on the studio's behalf. A START puts
 * a number closed by STOP back on the line.
 *
 * A signature that does not match is refused before anything is read, so a
 * stranger posting here can neither close a number nor write into the inbox.
 *
 * A GET is the schedule's, inside the outreach door and ledger: every text
 * preview whose next follow-up has come due is sent it, while the line is open
 * and the day's cap has room. A business closed since is skipped and its
 * follow-ups ended, and the last follow-up closes the number for good.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { connect } from '../../lib/db/clients.js'
import { notice, sendNotice } from '../../lib/mail/notice.js'
import { runJob } from '../../lib/outreach/runtime.js'
import { previewUrl } from '../../lib/outreach/previews.js'
import {
  PREVIEW_TEXT_DAYS,
  closeNumber,
  sendPreviewText,
  textBarred,
} from '../../lib/outreach/preview-texts.js'
import { readOptOut } from '../../lib/outreach/sending/replies.js'
import {
  TEXT_HOOK,
  signedByTwilio,
  textLineOf,
  textsSentToday,
  usPhone,
} from '../../lib/outreach/sending/texts.js'

export const config = { maxDuration: 120 }

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const DAY_MS = 24 * 60 * 60 * 1000

/** The stages after which a business is texted no further. */
const CLOSED = new Set(['replied', 'unsubscribed', 'bounced', 'undeliverable', 'skipped'])

// The words a carrier treats as a request to stop, and the ones that take it
// back, as Twilio's own opt-out handling reads them.
const STOP_WORDS = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'optout',
  'revoke',
])
const START_WORDS = new Set(['start', 'unstop'])

// Delivery failures that are about the number rather than the moment: a
// number that cannot be reached, does not exist, is a landline, or has opted
// out with the carrier. Any other failure leaves the number open.
const DEAD_NUMBER_CODES = new Set(['30003', '30005', '30006', '21610'])

const SITE_COLUMNS =
  'id, slug, name, prospect_id, shot_url, sent_at, follow_up_due_at, follow_ups, expires_at, channel'

/** The empty answer that tells Twilio to send nothing back. */
function twiml(response) {
  response.setHeader('Content-Type', 'text/xml')
  response.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
}

/** The business and preview a number was texted about, newest first. */
async function threadOf(db, phone) {
  const { data, error } = await db
    .from('outreach_texts')
    .select('prospect_id, site_id')
    .eq('phone', phone)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const last = data?.[0]
  if (!last) return { prospect: null, site: null }
  const [prospect, site] = await Promise.all([
    db
      .from('outreach_prospects')
      .select('id, name, website, stage')
      .eq('id', last.prospect_id)
      .maybeSingle(),
    last.site_id
      ? db.from('preview_sites').select('id, slug').eq('id', last.site_id).maybeSingle()
      : { data: null },
  ])
  return { prospect: prospect.data ?? null, site: site.data ?? null }
}

/**
 * The notice one text from a business becomes.
 *
 * Exported so the mail console can draw it from the code that sends it.
 *
 * @param {{from: string, body: string, closes: boolean}} text
 * @param {object|null} prospect
 * @param {object|null} site
 */
export function textNotice({ from, body, closes }, prospect, site) {
  return notice({
    label: 'Text reply',
    subject: prospect?.name ? `Text reply from ${prospect.name}` : `Text from ${from}`,
    rows: [
      ['From', from],
      ['Business', prospect?.name || 'Not matched to a business'],
      ['Site', prospect?.website || 'Not given'],
      ['Preview', site?.slug ? previewUrl(site.slug) : 'None'],
      ['Standing', closes ? 'Asked for no more texts' : 'Replied'],
    ],
    body,
    link: site?.slug ? { label: 'Open the preview', url: previewUrl(site.slug) } : undefined,
  })
}

/** A status report on a text the line sent. */
async function statusReport(db, params) {
  const providerId = String(params.MessageSid || '')
  const status = String(params.MessageStatus || '')
  if (!providerId) return
  if (status === 'delivered') {
    await db
      .from('outreach_texts')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('provider_id', providerId)
    return
  }
  if (status !== 'undelivered' && status !== 'failed') return
  const code = String(params.ErrorCode || '')
  const { data: row } = await db
    .from('outreach_texts')
    .update({ status, error: `twilio ${status}${code ? ` (${code})` : ''}` })
    .eq('provider_id', providerId)
    .select('phone, site_id, prospect_id')
    .maybeSingle()
  if (!row || !DEAD_NUMBER_CODES.has(code)) return
  await closeNumber(db, row.phone, 'undeliverable', `twilio ${status} (${code})`)
  if (row.site_id) {
    await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', row.site_id)
  }
}

/** A text a business sent to the line. */
async function inbound(db, params) {
  const phone = usPhone(params.From)
  const body = String(params.Body || '').slice(0, 2000)
  if (!phone) return
  const word = body.trim().toLowerCase()
  const { prospect, site } = await threadOf(db, phone)

  const written = await db.from('outreach_texts').insert({
    prospect_id: prospect?.id ?? null,
    site_id: site?.id ?? null,
    direction: 'inbound',
    status: 'received',
    phone,
    body,
    provider_id: params.MessageSid ? String(params.MessageSid) : null,
    sent_at: new Date().toISOString(),
  })
  // Twilio posts a message again when its first post is not answered in time;
  // the provider id is unique, so the second is the same message and is done.
  if (written.error?.code === '23505') return
  if (written.error) throw new Error(written.error.message)

  if (START_WORDS.has(word) || params.OptOutType === 'START') {
    await db.from('text_suppression').delete().eq('phone', phone).eq('reason', 'stop')
    return
  }

  const closes = STOP_WORDS.has(word) || params.OptOutType === 'STOP' || readOptOut(body).optOut
  await closeNumber(db, phone, closes ? 'stop' : 'replied', body.slice(0, 200) || 'empty text')
  if (site) await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', site.id)
  if (prospect && !CLOSED.has(prospect.stage)) {
    const at = new Date().toISOString()
    await db
      .from('outreach_prospects')
      .update(
        closes
          ? { stage: 'unsubscribed', updated_at: at }
          : { stage: 'replied', replied_at: at, updated_at: at }
      )
      .eq('id', prospect.id)
  }

  // A HELP is answered by Twilio itself and is nobody's reply.
  if (params.OptOutType === 'HELP' || !RESEND_API_KEY) return
  try {
    await sendNotice(textNotice({ from: phone, body, closes }, prospect, site), RESEND_API_KEY)
  } catch (cause) {
    console.error('outreach texts: forwarding a text: %s', cause.message)
  }
}

/** Every text preview whose next follow-up has come due, while the line is open. */
export async function work({ db, settings, counts }) {
  const line = textLineOf(settings)
  if (!line.open) return { note: `no follow-up text went: ${line.reason}` }
  let room = (settings.text_daily_cap ?? 0) - (await textsSentToday(db))
  if (room <= 0) return { note: "no follow-up text went: the day's texts have gone" }

  const { data: due, error } = await db
    .from('preview_sites')
    .select(SITE_COLUMNS)
    .eq('channel', 'text')
    .not('sent_at', 'is', null)
    .not('follow_up_due_at', 'is', null)
    .lte('follow_up_due_at', new Date().toISOString())
    .order('follow_up_due_at', { ascending: true })
    .limit(20)
  if (error) throw new Error(error.message)

  const done = []
  for (const site of due ?? []) {
    if (room <= 0) break
    counts.examined += 1
    const { data: prospect, error: read } = await db
      .from('outreach_prospects')
      .select('id, name, phone, stage, replied_at')
      .eq('id', site.prospect_id)
      .maybeSingle()
    if (read) throw new Error(read.message)
    const phone = usPhone(prospect?.phone)
    const nth = (site.follow_ups ?? 0) + 1
    const bar =
      !phone || !prospect
        ? 'it has no number'
        : prospect.replied_at || CLOSED.has(prospect.stage)
          ? `it is ${prospect.stage}`
          : nth > PREVIEW_TEXT_DAYS.length
            ? 'every text has gone'
            : await textBarred(db, phone)
    if (bar) {
      await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', site.id)
      done.push(`${site.slug} closed: ${bar}`)
      continue
    }
    const sent = await sendPreviewText(db, {
      site,
      prospect,
      phone,
      step: nth,
      service: line.service,
    })
    if (sent.refused) {
      await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', site.id)
      done.push(`${site.slug} closed: ${sent.refused}`)
      continue
    }
    room -= 1
    const last = nth >= PREVIEW_TEXT_DAYS.length
    const filed = await db
      .from('preview_sites')
      .update({
        follow_up_sent_at: sent.at,
        follow_ups: nth,
        follow_up_due_at: last
          ? null
          : new Date(Date.parse(site.sent_at) + PREVIEW_TEXT_DAYS[nth] * DAY_MS).toISOString(),
      })
      .eq('id', site.id)
    if (filed.error) throw new Error(filed.error.message)
    counts.changed += 1
    if (last) await closeNumber(db, phone, 'finished', `every preview text about ${site.slug}`)
    done.push(`${site.slug} sent text ${nth + 1}`)
  }
  return { note: done.length ? done.join('; ') : 'no follow-up text is due' }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const signature = request.headers['x-twilio-signature']
  if (request.method === 'POST' && signature) {
    const params = request.body && typeof request.body === 'object' ? request.body : {}
    const query = (request.url || '').includes('?')
      ? request.url.slice(request.url.indexOf('?'))
      : ''
    if (!signedByTwilio(TEXT_HOOK + query, params, signature)) {
      response.status(403).json({ error: 'That signature is not Twilio’s.' })
      return
    }
    const connected = connect()
    if (!connected) {
      response.status(503).json({ error: 'The text line has no database keys.' })
      return
    }
    try {
      if (params.Body !== undefined && params.SmsStatus === 'received') {
        await inbound(connected.db, params)
      } else {
        await statusReport(connected.db, params)
      }
    } catch (cause) {
      // Twilio retries a webhook that fails, which is the right thing for a
      // reply this could not file, so the failure is answered as one.
      console.error('outreach texts: %s', cause?.message || cause)
      response.status(500).json({ error: 'The text could not be filed.' })
      return
    }
    twiml(response)
    return
  }
  await runJob({ request, response, job: 'texts', work })
}
