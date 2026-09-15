/**
 * Takes a reply written to a lead from any mailbox, files it, and passes it on.
 *
 * What it does: Resend delivers every message that reaches the relay domain
 * here as an `email.received` event. A message whose recipients name a lead
 * and whose sender is one of the studio's own addresses is a reply to that
 * lead: it is filed in the lead's record, the lead is marked answered with the
 * time it was written, and the message is sent on to the lead's real address
 * from the studio's domain, with the writer on Reply-To so the lead's answer
 * comes straight back to the person. Attachments travel with it.
 *
 * Why: the console's own send button was the only answer the record could
 * see, and almost every answer is written in a mailbox instead. The notice
 * about a lead now carries the site's own address on Reply-To, in
 * lib/leads/relay.js, so pressing Reply anywhere writes here first.
 *
 * The record is claimed before the transport is touched. A row is written
 * under the reply's Message-ID and the send happens after it; a send that
 * fails takes the row back out and answers 502, which is what makes Resend
 * try again, and a repeat delivery of a reply already filed sends nothing.
 * The other order would forward the same reply twice on a retry, and a lead
 * written to twice is a worse outcome than a record a run behind.
 *
 * A reply to somebody who has unsubscribed or is on the suppression list is
 * still passed on. Those lists hold the studio's own mail off an address; a
 * person answering an enquiry that person sent is not that, and a reply
 * quietly dropped is one the writer believes went.
 *
 * What it reads: LEAD_REPLY_WEBHOOK_SECRET, the signing secret of the
 * receiving webhook, and RESEND_API_KEY to fetch the message and send it on.
 *
 * What it writes: a `lead_messages` row per reply and `contacted_at` on the
 * lead where it has none.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { rawBody } from '../lib/http/body.js'
import { timedFetch } from '../lib/http/timed.js'
import { signedByResend } from '../lib/mail/webhook.js'
import { connect } from '../lib/db/clients.js'
import { tableMissing } from '../lib/db/rows.js'
import { SPINE, ownAddress } from '../lib/leads/spine.js'
import { usableEmail } from '../lib/leads/record.js'
import { forwardFrom, leadIdFrom, senderNameFrom } from '../lib/leads/relay.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const SIGNING_SECRET = process.env.LEAD_REPLY_WEBHOOK_SECRET || ''
const RESEND = 'https://api.resend.com'
const MESSAGES = 'lead_messages'
/** What the two `lead_messages` columns take, which their checks hold. */
const LIMITS = { subject: 200, body: 5000 }
const NO_SUBJECT = 'No subject'
const NO_TEXT = 'The message carried no text.'
const FETCH_TIMEOUT_MS = 15_000
const SEND_TIMEOUT_MS = 20_000

// The body is read as bytes rather than as an object, because a signature is
// over what was sent and not over what a parser made of it.
export const config = { api: { bodyParser: false } }

/** A trimmed field held to what its column takes, or the fallback. */
function clip(value, limit, fallback) {
  const text = typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : ''
  return text ? text.slice(0, limit) : fallback
}

/** The words of an HTML body, for a record of a reply that carried no text part. */
function wordsOf(html) {
  if (typeof html !== 'string') return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

/** One call to Resend, with the key scrubbed out of whatever it says back. */
async function resend(path, init = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const answer = await timedFetch(
    `${RESEND}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    },
    timeoutMs
  )
  const said = await answer.text().catch(() => '')
  if (!answer.ok) {
    throw new Error(
      `resend answered ${answer.status} on ${path}: ${said.replaceAll(RESEND_API_KEY, '[redacted]').slice(0, 300)}`
    )
  }
  try {
    return JSON.parse(said)
  } catch {
    return {}
  }
}

/** Every file on the received message, as a URL Resend will send from. */
async function attachmentsOn(emailId, listed) {
  const carried = []
  for (const entry of Array.isArray(listed) ? listed : []) {
    if (!entry?.id) continue
    const file = await resend(
      `/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(entry.id)}`
    )
    if (!file?.download_url) continue
    carried.push({
      filename: file.filename || entry.filename || 'attachment',
      path: file.download_url,
      ...(file.content_type ? { content_type: file.content_type } : {}),
      ...(file.content_id ? { content_id: String(file.content_id).replace(/^<|>$/g, '') } : {}),
    })
  }
  return carried
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'POST only' })
  }
  response.setHeader('Cache-Control', 'private, no-store')

  const body = await rawBody(request)
  if (!signedByResend(request.headers, body, SIGNING_SECRET)) {
    return response.status(401).json({ error: 'not authorized' })
  }

  let event = null
  try {
    event = JSON.parse(body)
  } catch {
    return response.status(400).json({ error: 'body is not JSON' })
  }
  if (event?.type !== 'email.received') return response.status(200).json({ ignored: 'type' })

  const data = event.data || {}
  const reached = [...(data.to || []), ...(data.cc || []), ...(data.received_for || [])]
  const leadId = leadIdFrom(reached)
  if (!leadId) return response.status(200).json({ ignored: 'no lead on the address' })

  // Only the studio answers a lead through here. A stranger who writes to a
  // relay address - a bounce, a scanner, a reply that looped - is not a reply
  // to pass on to a lead under the studio's name.
  const sender = usableEmail(data.from)
  if (!sender || !ownAddress(sender)) {
    console.error(
      'lead-reply: %s wrote to a relay address and was not passed on',
      sender || 'no sender'
    )
    return response.status(200).json({ ignored: 'sender' })
  }
  if (!RESEND_API_KEY) return response.status(503).json({ error: 'Mail is not configured here.' })

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })
  const db = wired.db

  try {
    const { data: lead, error: whoFault } = await db
      .from(SPINE)
      .select('id, email, name, contacted_at')
      .eq('id', leadId)
      .maybeSingle()
    if (whoFault) {
      if (tableMissing(whoFault)) return response.status(200).json({ ignored: 'no leads table' })
      throw whoFault
    }
    if (!lead) return response.status(200).json({ ignored: 'no such lead' })

    const messageId =
      typeof data.message_id === 'string' && data.message_id ? data.message_id : null
    if (messageId) {
      const { data: filed, error: filedFault } = await db
        .from(MESSAGES)
        .select('id')
        .eq('lead_id', lead.id)
        .eq('provider_id', messageId)
        .limit(1)
      if (filedFault && !tableMissing(filedFault)) throw filedFault
      if (filed?.length) return response.status(200).json({ repeat: true })
    }

    const full = await resend(
      `/emails/receiving/${encodeURIComponent(data.email_id)}?html_format=cid`
    )
    const text = typeof full.text === 'string' && full.text.trim() ? full.text : ''
    const html = typeof full.html === 'string' && full.html.trim() ? full.html : ''
    const subject = clip(full.subject ?? data.subject, LIMITS.subject, NO_SUBJECT)
    const record = clip(text || wordsOf(html), LIMITS.body, NO_TEXT)
    const at = data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString()

    // The claim, before the transport.
    const { data: claim, error: claimFault } = await db
      .from(MESSAGES)
      .insert({
        lead_id: lead.id,
        sent_to: lead.email || sender,
        subject,
        body: record,
        sent_by: sender,
        provider_id: messageId,
        sent_at: at,
      })
      .select('id')
      .single()
    if (claimFault && !tableMissing(claimFault)) throw claimFault

    const to = usableEmail(lead.email)
    // A writer who put the lead's own address on the line as well has already
    // reached them; sending it again would hand them the same message twice.
    const reachedDirectly = to && reached.some(value => usableEmail(value) === to)
    let forwarded = false

    if (to && !reachedDirectly) {
      try {
        await resend(
          '/emails',
          {
            method: 'POST',
            body: JSON.stringify({
              from: forwardFrom(sender, senderNameFrom(full.headers)),
              to: [to],
              reply_to: sender,
              subject: full.subject || subject,
              ...(text ? { text } : {}),
              ...(html ? { html } : {}),
              ...(!text && !html ? { text: record } : {}),
              attachments: await attachmentsOn(data.email_id, full.attachments),
            }),
          },
          SEND_TIMEOUT_MS
        )
        forwarded = true
      } catch (cause) {
        // The claim comes back out, so the retry Resend makes on a 502 files
        // and sends the reply as if this delivery had never arrived.
        if (claim?.id) await db.from(MESSAGES).delete().eq('id', claim.id)
        throw cause
      }
    }

    if (!lead.contacted_at) {
      const { error: stampFault } = await db
        .from(SPINE)
        .update({ contacted_at: at, updated_at: new Date().toISOString() })
        .eq('id', lead.id)
        .is('contacted_at', null)
      if (stampFault)
        console.error('lead-reply: the answer was not stamped: %s', stampFault.message)
    }

    return response.status(200).json({ lead: lead.id, filed: true, forwarded })
  } catch (cause) {
    console.error('lead-reply: %s', cause.message)
    return response.status(502).json({ error: 'The reply was not passed on.' })
  }
}
