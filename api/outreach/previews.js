/**
 * Sends the preview letters: the first one on request, the follow-up on a
 * schedule.
 *
 * A POST naming a `slug` sends that preview's first letter. It is what the
 * preview routine calls once a site is built and live, under the scheduler
 * secret, and what an admin can call from a session. A preview already sent
 * is refused rather than sent twice.
 *
 * A GET is the schedule's: every preview whose next follow-up has come due is
 * sent it, threaded under the first letter. The follow-ups go a week apart,
 * each a different one, until the business has been sent ten letters in all,
 * cold ones included; the letter that makes ten is the last, and the business
 * is then taken off the list. A business that has replied, unsubscribed or
 * bounced since is skipped and its follow-ups closed, since a nudge to
 * somebody who already answered is the one letter worse than none.
 *
 * The first letter goes only to a business whose third letter is due - two
 * letters sent, the second at least five days ago - and only once its site
 * answers on its own subdomain. The routine checks both before it asks, and
 * they are checked again here because this is the one place the letter can
 * leave from: a letter pointing at a site that is not there yet is worse than
 * a letter a day late.
 *
 * Sending a preview also takes the prospect out of the cold letter's own
 * follow-up chain by clearing `next_due_at`. The preview letter replaces
 * whatever that chain had left to say, and two chains writing to one business
 * in the same week reads as nobody keeping track.
 *
 * The view figures on the row are reset at the moment the first letter goes,
 * because every view before it was the studio checking its own work.
 *
 * Both letters ride the cold letter's switches: nothing reaches the transport
 * unless `sending_enabled` and OUTREACH_SEND_ARMED are both on.
 *
 * They ride the cold letter's mailbox too. While Gmail has it resting, or it
 * has carried its day's worth across every sender, a request is answered 503
 * with the reason and nothing is drafted, and a refusal of the mailbox partway
 * through a run stops the run there with the same answer. A preview the
 * mailbox turned away keeps no draft and no failed row, so the routine asks
 * for it again once the mailbox opens; see lib/outreach/sending/mailbox.js.
 *
 * Every letter is drafted with the reviews postscript lib/outreach/proof.js
 * writes, from a reading of Trustpilot and the Google listing taken here
 * (GOOGLE_PLACES_API_KEY) and kept for an hour, so a run sending thirty letters
 * reads each network once. A network that does not answer costs the line its
 * figure, never the letter.
 *
 * A preview filed with channel 'text' is a business the studio holds a phone
 * number for and no address. Its first text goes from here on the same POST,
 * which carries `channel: 'text'`, through lib/outreach/preview-texts.js, and
 * never touches the mailbox: it is held instead by the text line's own
 * switches, hours and daily cap in lib/outreach/sending/texts.js, and answered
 * 503 with the reason when the line is closed, so the routine asks again
 * later. Its two follow-ups go from api/outreach/texts.js.
 */

import { randomUUID } from 'node:crypto'
import { servedHereOr404 } from '../../lib/http/guard.js'
import { runJob } from '../../lib/outreach/runtime.js'
import { suppressed } from '../../lib/outreach/sending/queue.js'
import { catchUpOf, endCatchUp } from '../../lib/outreach/sending/catch-up.js'
import { Undeliverable } from '../../lib/outreach/prospects/address.js'
import {
  MailboxClosed,
  assertMailboxOpen,
  mailboxStopOf,
  readMailbox,
} from '../../lib/outreach/sending/mailbox.js'
import {
  FOLLOW_UP_COUNT,
  LETTERS_BEFORE_PREVIEW,
  LETTERS_IN_ALL,
  PREVIEW_FOLLOW_UP_DAYS,
  PREVIEW_FIRST_DAYS,
  PREVIEW_FIRST_SENDER,
  PREVIEW_LIFETIME_DAYS,
  PREVIEW_WAIT_DAYS,
  isPreviewFirst,
  previewFirstLetter,
  previewLetter,
  previewUrl,
} from '../../lib/outreach/previews.js'
import { proofNow } from '../../lib/outreach/proof.js'
import {
  PREVIEW_TEXT_DAYS,
  PREVIEW_TEXT_LIFETIME_DAYS,
  sendPreviewText,
  textBarred,
} from '../../lib/outreach/preview-texts.js'
import { textLineOf, textsSentToday, usPhone } from '../../lib/outreach/sending/texts.js'
import { deliver, readRoster, unsubscribeUrl } from './send.js'
import { noteSent, pickSender, senderFor } from '../../lib/outreach/sending/senders.js'

export const config = { maxDuration: 300 }

const ARMED = process.env.OUTREACH_SEND_ARMED === 'true'
const DAY_MS = 24 * 60 * 60 * 1000

/** The stages after which a business is written to no further. */
const CLOSED = new Set(['replied', 'unsubscribed', 'bounced', 'undeliverable'])

const SITE_COLUMNS =
  'id, slug, name, prospect_id, letter, shot_url, message_id, sent_at, follow_up_due_at, follow_up_sent_at, follow_ups, expires_at, channel'

async function prospectOf(db, id) {
  const { data, error } = await db
    .from('outreach_prospects')
    .select(
      'id, name, email, town, stage, replied_at, bounced_at, unsub_token, contacted_at, rating_count'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Why this business is not to be written to, or null when it may be. */
async function barred(db, prospect) {
  if (!prospect?.email) return 'it has no address'
  if (prospect.replied_at) return 'it has replied'
  if (prospect.bounced_at || CLOSED.has(prospect.stage)) return `it is ${prospect.stage}`
  const held = await suppressed(db, [prospect.email.toLowerCase()])
  return held.size ? 'it is suppressed' : null
}

/**
 * Drafts, delivers and records one letter. The row is written before the
 * transport is reached, so a crash leaves a draft rather than a second copy.
 *
 * A preview-first letter goes out as a note from Trenton: under his name, with
 * no unsubscribe link in the letter and no list header on the envelope, since
 * it is one person writing to one business rather than a list being sent.
 */
async function sendOne(
  db,
  settings,
  site,
  prospect,
  kind,
  thread = null,
  nth = 0,
  personal = false
) {
  // The mailbox is asked before the draft is written, so a letter it would
  // turn away leaves nothing behind.
  await assertMailboxOpen(db)
  // The address it leaves from: the one the thread began on, so a follow-up
  // threads under it, or for a first letter whichever address has room; see
  // lib/outreach/sending/senders.js. None with room is a letter put off, the
  // way a closed mailbox puts one off.
  const roster = await readRoster(db, settings)
  const picked = thread
    ? (senderFor(roster.senders, thread.from_address) ?? roster.senders[0])
    : pickSender(roster.senders, prospect)
  if (!picked) {
    throw new MailboxClosed({ reason: 'no sending address has room left today' })
  }
  const from = personal ? { ...picked, name: PREVIEW_FIRST_SENDER } : picked
  const track = randomUUID()
  const unsubscribe =
    !personal && prospect.unsub_token ? unsubscribeUrl(prospect.unsub_token, from.origin) : null
  const proof = await proofNow()
  const letter = personal
    ? previewFirstLetter(site, kind === 'first' ? -1 : nth, {
        track,
        prior: thread,
        proof,
        origin: from.origin,
      })
    : previewLetter({ ...site, email: prospect.email, rating_count: prospect.rating_count }, kind, {
        track,
        origin: from.origin,
        unsubscribe,
        prior: thread,
        nth,
        proof,
      })
  const { data: message, error } = await db
    .from('outreach_messages')
    .insert({
      prospect_id: prospect.id,
      direction: 'outbound',
      status: 'drafted',
      subject: letter.subject,
      body_text: letter.text,
      body_html: letter.html,
      from_address: from.address,
      to_address: prospect.email,
      track_token: track,
    })
    .select('id, to_address, subject, body_text, body_html')
    .single()
  if (error) throw new Error(error.message)

  let providerId
  try {
    providerId = await deliver(db, message, from, unsubscribe, undefined, {
      inReplyTo: thread?.provider_id ?? null,
    })
  } catch (cause) {
    // A letter the mailbox turned away never reached the mail server, so its
    // draft is taken back rather than filed as a refusal. Left at 'drafted', a
    // preview letter for a business never written to would read to the cold
    // queue as that business's own reviewed draft.
    if (cause instanceof MailboxClosed) {
      await db.from('outreach_messages').delete().eq('id', message.id).eq('status', 'drafted')
      throw cause
    }
    await db
      .from('outreach_messages')
      .update({ status: 'failed', error: String(cause?.message || cause).slice(0, 500) })
      .eq('id', message.id)
    // A refusal from the mail server while the outreach catch-up is open ends
    // it for every sender; see lib/outreach/sending/catch-up.js.
    if (!(cause instanceof Undeliverable) && catchUpOf(settings).active) {
      await endCatchUp(db, String(cause?.message || cause).slice(0, 300))
    }
    throw cause
  }
  const at = new Date().toISOString()
  const marked = await db
    .from('outreach_messages')
    .update({ status: 'sent', sent_at: at, provider_id: providerId, error: null })
    .eq('id', message.id)
  if (marked.error) throw new Error(marked.error.message)
  if (!thread) noteSent(picked)
  return { id: message.id, at, subject: letter.subject, providerId }
}

/**
 * Why the preview is not yet this business's letter, or null when it is: the
 * two letters before it have gone, the last of them five days or more ago.
 */
async function notDueYet(db, prospectId) {
  const { data, error } = await db
    .from('outreach_messages')
    .select('sent_at')
    .eq('prospect_id', prospectId)
    .eq('direction', 'outbound')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
  if (error) throw new Error(error.message)
  const sent = data ?? []
  if (sent.length >= LETTERS_IN_ALL) return `it has had all ${LETTERS_IN_ALL} letters`
  if (sent.length < LETTERS_BEFORE_PREVIEW) {
    return `it has had ${sent.length} of the ${LETTERS_BEFORE_PREVIEW} letters that come first`
  }
  const due = Date.parse(sent[0].sent_at) + PREVIEW_WAIT_DAYS * DAY_MS
  return due > Date.now() ? `its last letter went less than ${PREVIEW_WAIT_DAYS} days ago` : null
}

/** Why the site is not there to point at, or null when it serves its own page. */
async function siteMissing(slug) {
  const url = `${previewUrl(slug)}/`
  try {
    const answer = await fetch(url, {
      headers: { 'User-Agent': 'preview-letter-check' },
      signal: AbortSignal.timeout(20000),
    })
    const page = await answer.text()
    if (answer.ok && page.includes(`__SLUG__ = ${JSON.stringify(slug)}`)) return null
    return `${url} answered ${answer.status} without its preview`
  } catch (cause) {
    return `${url} did not answer: ${cause?.message || cause}`
  }
}

async function sendFirst(db, settings, slug, counts) {
  const { data: site, error } = await db
    .from('preview_sites')
    .select(SITE_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!site) return { error: `no preview is filed as ${slug}` }
  if (site.channel === 'text') return { error: `${slug} is filed to go by text` }
  if (site.sent_at) return { note: `${slug} was already sent on ${site.sent_at}` }
  if (!site.prospect_id) return { error: `${slug} names no prospect to write to` }

  const prospect = await prospectOf(db, site.prospect_id)
  counts.examined = 1
  const bar = await barred(db, prospect)
  if (bar) return { note: `${slug} was not sent: ${bar}` }

  // A business never written to opens on its preview, and only on the letters
  // written for it; one already on the older chain gets the third letter when
  // that is due.
  const personal = (await lettersSent(db, prospect.id)) === 0
  if (personal && !isPreviewFirst(site)) {
    return { note: `${slug} was not sent: its preview-first letters are not written yet` }
  }
  const early = personal ? null : await notDueYet(db, prospect.id)
  if (early) return { note: `${slug} was not sent: ${early}` }
  const missing = await siteMissing(slug)
  if (missing) return { note: `${slug} was not sent: ${missing}` }

  const sent = await sendOne(db, settings, site, prospect, 'first', null, 0, personal)
  const after = days => new Date(Date.parse(sent.at) + days * DAY_MS).toISOString()
  const filed = await db
    .from('preview_sites')
    .update({
      message_id: sent.id,
      sent_at: sent.at,
      follow_up_due_at: after(personal ? PREVIEW_FIRST_DAYS[0] : PREVIEW_FOLLOW_UP_DAYS),
      expires_at: personal ? after(PREVIEW_LIFETIME_DAYS) : null,
      first_viewed_at: null,
      last_viewed_at: null,
      view_count: 0,
    })
    .eq('id', site.id)
  if (filed.error) throw new Error(filed.error.message)
  const moved = await db
    .from('outreach_prospects')
    .update({
      stage: 'contacted',
      contacted_at: prospect.contacted_at ?? sent.at,
      next_due_at: null,
      updated_at: sent.at,
    })
    .eq('id', prospect.id)
  if (moved.error) throw new Error(moved.error.message)
  counts.changed = 1
  return { note: `${slug} sent to ${prospect.email}`, message: sent.id }
}

/**
 * Sets a business aside from the text previews for good, with the reason, so
 * the routine stops offering its site to a line that will never carry it.
 */
async function setAside(db, prospect, slug, reason) {
  const { error } = await db
    .from('outreach_prospects')
    .update({
      preview_skipped_at: new Date().toISOString(),
      preview_skip_reason: reason.slice(0, 300),
    })
    .eq('id', prospect.id)
  if (error) throw new Error(error.message)
  return { note: `${slug} was not sent: ${reason}` }
}

/**
 * The first text of a preview filed for a business the studio can only text.
 *
 * The same refusals as a letter, read for a number rather than an address: a
 * preview already sent, a business that has replied or been closed, a number
 * closed to texts or already texted, a site not yet serving its own page. A
 * refusal about the business sets it aside, since nothing later changes it. The
 * line is asked last, for its switches, its hours and the day's cap, so a
 * refusal that is about this business is never reported as one about the line.
 */
async function sendFirstText(db, settings, site, counts) {
  if (site.sent_at) return { note: `${site.slug} was already sent on ${site.sent_at}` }
  if (!site.prospect_id) return { error: `${site.slug} names no prospect to text` }
  const { data: prospect, error } = await db
    .from('outreach_prospects')
    .select('id, name, phone, stage, replied_at, contacted_at')
    .eq('id', site.prospect_id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!prospect) return { error: `${site.slug} names a prospect that is not filed` }
  counts.examined = 1
  const phone = usPhone(prospect.phone)
  if (!phone) return setAside(db, prospect, site.slug, 'it has no number that takes a text')
  if (prospect.replied_at || CLOSED.has(prospect.stage)) {
    return setAside(db, prospect, site.slug, `it is ${prospect.stage}`)
  }
  const bar = await textBarred(db, phone)
  if (bar) return setAside(db, prospect, site.slug, bar)
  const texted = await db
    .from('outreach_texts')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('direction', 'outbound')
    .not('sent_at', 'is', null)
  if (texted.error) throw new Error(texted.error.message)
  if (texted.count) return setAside(db, prospect, site.slug, 'its number has been texted before')
  const missing = await siteMissing(site.slug)
  if (missing) return { note: `${site.slug} was not sent: ${missing}` }

  const line = textLineOf(settings)
  if (!line.open)
    return { ...resting(line.reason), note: `${site.slug} was not sent: ${line.reason}` }
  const spent = await textsSentToday(db)
  if (spent >= (settings.text_daily_cap ?? 0)) {
    const reason = `the day's ${settings.text_daily_cap ?? 0} texts have gone`
    return { ...resting(reason), note: `${site.slug} was not sent: ${reason}` }
  }

  const sent = await sendPreviewText(db, { site, prospect, phone, step: 0, service: line.service })
  if (sent.refused) return setAside(db, prospect, site.slug, sent.refused)
  const after = days => new Date(Date.parse(sent.at) + days * DAY_MS).toISOString()
  const filed = await db
    .from('preview_sites')
    .update({
      sent_at: sent.at,
      follow_up_due_at: after(PREVIEW_TEXT_DAYS[0]),
      expires_at: after(PREVIEW_TEXT_LIFETIME_DAYS),
      follow_ups: 0,
      first_viewed_at: null,
      last_viewed_at: null,
      view_count: 0,
    })
    .eq('id', site.id)
  if (filed.error) throw new Error(filed.error.message)
  const moved = await db
    .from('outreach_prospects')
    .update({
      stage: 'contacted',
      contacted_at: prospect.contacted_at ?? sent.at,
      updated_at: sent.at,
    })
    .eq('id', prospect.id)
  if (moved.error) throw new Error(moved.error.message)
  counts.changed = 1
  return { note: `${site.slug} texted to ${phone.slice(0, -4)}****`, text: sent.id }
}

/** How many letters this studio has sent a business, of every kind. */
async function lettersSent(db, prospectId) {
  const { count, error } = await db
    .from('outreach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('prospect_id', prospectId)
    .eq('direction', 'outbound')
    .eq('status', 'sent')
  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Takes a business off the list once it has been sent every letter it will
 * be. The suppression row is what every sender reads before writing, so
 * nothing else can reach it afterwards either.
 */
async function finish(db, site, prospect) {
  await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', site.id)
  const { error } = await db.from('suppression').upsert(
    {
      email: prospect.email.toLowerCase(),
      reason: 'manual',
      note: `Sent all ${LETTERS_IN_ALL} outreach letters, the last about ${site.slug}`,
    },
    { onConflict: 'email', ignoreDuplicates: true }
  )
  if (error) throw new Error(error.message)
  const closed = await db
    .from('outreach_prospects')
    .update({ next_due_at: null, updated_at: new Date().toISOString() })
    .eq('id', prospect.id)
  if (closed.error) throw new Error(closed.error.message)
}

/**
 * One follow-up on the preview-first chain: the next of the three written for
 * this business, each owed a fixed number of days after the first letter. The
 * last one says the draft comes down, so the business is then taken off the
 * list the way a finished older chain is.
 */
async function personalFollowUp(db, settings, site, prospect, counts) {
  const nth = site.follow_ups ?? 0
  if (nth >= PREVIEW_FIRST_DAYS.length) {
    await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', site.id)
    return `${site.slug} closed: every preview-first letter has gone`
  }
  const { data: first, error: read } = await db
    .from('outreach_messages')
    .select('subject, from_address, provider_id')
    .eq('id', site.message_id)
    .maybeSingle()
  if (read) throw new Error(read.message)
  const sent = await sendOne(db, settings, site, prospect, 'follow_up', first, nth, true)
  const last = nth + 1 >= PREVIEW_FIRST_DAYS.length
  const filed = await db
    .from('preview_sites')
    .update({
      follow_up_message_id: sent.id,
      follow_up_sent_at: sent.at,
      follow_ups: nth + 1,
      follow_up_due_at: last
        ? null
        : new Date(Date.parse(site.sent_at) + PREVIEW_FIRST_DAYS[nth + 1] * DAY_MS).toISOString(),
    })
    .eq('id', site.id)
  if (filed.error) throw new Error(filed.error.message)
  counts.changed += 1
  if (!last) return `${site.slug} sent preview-first follow-up ${nth + 1}`
  const { error } = await db.from('suppression').upsert(
    {
      email: prospect.email.toLowerCase(),
      reason: 'manual',
      note: `Sent every preview-first letter about ${site.slug}`,
    },
    { onConflict: 'email', ignoreDuplicates: true }
  )
  if (error) throw new Error(error.message)
  return `${site.slug} sent its last preview-first letter`
}

async function followUps(db, settings, counts) {
  const { data: due, error } = await db
    .from('preview_sites')
    .select(SITE_COLUMNS)
    .not('message_id', 'is', null)
    .not('follow_up_due_at', 'is', null)
    .lte('follow_up_due_at', new Date().toISOString())
    .order('follow_up_due_at', { ascending: true })
    .limit(20)
  if (error) throw new Error(error.message)

  const done = []
  try {
    for (const site of due ?? []) {
      counts.examined += 1
      const prospect = await prospectOf(db, site.prospect_id)
      const bar = await barred(db, prospect)
      if (bar) {
        // Closed rather than left due, so the row stops being offered and the
        // console says the follow-up is not coming.
        await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', site.id)
        done.push(`${site.slug} closed: ${bar}`)
        continue
      }
      if (site.expires_at && isPreviewFirst(site)) {
        done.push(await personalFollowUp(db, settings, site, prospect, counts))
        continue
      }
      const nth = site.follow_ups ?? 0
      const before = await lettersSent(db, prospect.id)
      if (before >= LETTERS_IN_ALL || nth >= FOLLOW_UP_COUNT) {
        await finish(db, site, prospect)
        done.push(`${site.slug} finished after ${before} letters`)
        continue
      }
      const { data: first, error: read } = await db
        .from('outreach_messages')
        .select('subject, from_address, provider_id')
        .eq('id', site.message_id)
        .maybeSingle()
      if (read) throw new Error(read.message)
      // The letter that makes ten is the last one, so it is the closing note
      // whichever follow-up it would otherwise have been.
      const last = before + 1 >= LETTERS_IN_ALL || nth + 1 >= FOLLOW_UP_COUNT
      const which = last ? FOLLOW_UP_COUNT - 1 : nth
      const sent = await sendOne(db, settings, site, prospect, 'follow_up', first, which)
      const filed = await db
        .from('preview_sites')
        .update({
          follow_up_message_id: sent.id,
          follow_up_sent_at: sent.at,
          follow_ups: nth + 1,
          follow_up_due_at: last
            ? null
            : new Date(Date.parse(sent.at) + PREVIEW_FOLLOW_UP_DAYS * DAY_MS).toISOString(),
        })
        .eq('id', site.id)
      if (filed.error) throw new Error(filed.error.message)
      counts.changed += 1
      if (last) {
        await finish(db, site, prospect)
        done.push(`${site.slug} sent its last letter`)
      } else {
        done.push(`${site.slug} sent follow-up ${nth + 1}`)
      }
    }
  } catch (cause) {
    // The mailbox turned a letter away, or Gmail refused it. Every letter
    // behind this one would meet the same, so the run stops here and the
    // rest stay due for the run after the mailbox opens.
    const stop = mailboxStopOf(cause)
    if (!stop) throw cause
    return { ...resting(stop), note: [...done, `stopped: ${stop}`].join('; ') }
  }
  return { note: done.length ? done.join('; ') : 'no preview follow-up is due' }
}

/**
 * The answer to a run the mailbox stopped: a 503, since the letters are not
 * refused but put off, with the reason in words. The routine reads the status
 * and asks again later rather than filing the preview as broken.
 */
const resting = reason => ({ status: 503, skipped: reason })

/** The preview a POST names, or null when it names none that could exist. */
function slugOf(request) {
  const slug = String(request.body?.slug ?? '')
    .trim()
    .toLowerCase()
  return /^[a-z0-9-]{2,63}$/.test(slug) ? slug : null
}

/**
 * One run of the job, for the request that started it: the first letter of the
 * preview a POST names, or every follow-up that has come due.
 */
export async function work({ db, settings, counts, request }) {
  // A preview that goes by text says so in the POST, and is answered before the
  // mailbox is read, since the mailbox has no say over a text. A letter's POST
  // reads nothing until the mailbox has opened.
  if (request.method === 'POST' && request.body?.channel === 'text') {
    const slug = slugOf(request)
    if (!slug) return { error: 'name a preview by its slug' }
    const { data: site, error } = await db
      .from('preview_sites')
      .select(SITE_COLUMNS)
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!site) return { error: `no preview is filed as ${slug}` }
    if (site.channel !== 'text') return { error: `${slug} is filed to go by letter` }
    return sendFirstText(db, settings, site, counts)
  }
  if (!settings.sending_enabled || !ARMED) {
    return { note: 'sending is switched off, so this run sent no preview letter' }
  }
  // The mailbox, asked before anything is read for the run. A request it
  // cannot carry now is answered as one to make again, not as a failure.
  const mailbox = await readMailbox(db, new Date(), settings)
  if (!mailbox.open) {
    const reason = `the mailbox is closed: ${mailbox.reason}`
    return { ...resting(reason), note: `No preview letter was sent: ${reason}` }
  }
  if (request.method === 'POST') {
    const slug = slugOf(request)
    try {
      return await sendFirst(db, settings, slug, counts)
    } catch (cause) {
      const stop = mailboxStopOf(cause)
      if (!stop) throw cause
      return { ...resting(stop), note: `${slug} was not sent: ${stop}` }
    }
  }
  return followUps(db, settings, counts)
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({
    request,
    response,
    job: 'previews',
    work: context => work({ ...context, request }),
  })
}
