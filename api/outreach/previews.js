/**
 * Sends the draft preview chain: the first letter on request, the rest on a
 * schedule.
 *
 * The draft preview chain is one of the four outreach chains (lawsuit, new
 * business, draft preview, cold intro). A business enters it only when it has
 * an address and a built draft with its four letters written, and only when
 * nothing has been sent to it before, since a business never moves from one
 * chain to another. Its draft is the first letter; the three after it go a
 * fixed number of days after that one (PREVIEW_FIRST_DAYS), and the last of
 * them says the draft comes down, after which the business is taken off the
 * list.
 *
 * A POST naming a `slug` sends that preview's first letter. It is what the
 * preview routine calls once a site is built and live, under the scheduler
 * secret, and what an admin can call from a session. A preview already sent
 * is refused rather than sent twice, and so is one whose site does not yet
 * answer on its own subdomain: a letter pointing at a site that is not there
 * is worse than a letter a day late.
 *
 * A GET is the schedule's: every preview whose next letter has come due is
 * sent it, threaded under the first. A business that has replied,
 * unsubscribed or bounced since is skipped and its letters closed, since a
 * nudge to somebody who already answered is the one letter worse than none.
 *
 * Every letter goes out as a note from Trenton: under his name, with no
 * unsubscribe link in the letter and no list header on the envelope, since it
 * is one person writing to one business rather than a list being sent.
 *
 * The view figures on the row are reset at the moment the first letter goes,
 * because every view before it was the studio checking its own work.
 *
 * The letters ride the cold letter's switches: nothing reaches the transport
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
 */

import { randomUUID } from 'node:crypto'
import { servedHereOr404 } from '../../lib/http/guard.js'
import { runJob } from '../../lib/outreach/runtime.js'
import { suppressed } from '../../lib/outreach/sending/queue.js'
import { sendsOn } from '../../lib/outreach/sending/schedule.js'
import { catchUpOf, endCatchUp } from '../../lib/outreach/sending/catch-up.js'
import { Undeliverable } from '../../lib/outreach/prospects/address.js'
import {
  MailboxClosed,
  assertMailboxOpen,
  mailboxStopOf,
  readMailbox,
} from '../../lib/outreach/sending/mailbox.js'
import {
  PREVIEW_FIRST_DAYS,
  PREVIEW_FIRST_SENDER,
  PREVIEW_LIFETIME_DAYS,
  isPreviewFirst,
  previewFirstLetter,
  previewUrl,
} from '../../lib/outreach/previews.js'
import { proofNow } from '../../lib/outreach/proof.js'
import { LAWSUIT_SOURCE } from '../../lib/outreach/prospects/lawsuits.js'
import { deliver, readRoster } from './send.js'
import {
  noteSent,
  pickSender,
  hasOwnSenders,
  senderFor,
  studioSender,
} from '../../lib/outreach/sending/senders.js'

export const config = { maxDuration: 300 }

const ARMED = process.env.OUTREACH_SEND_ARMED === 'true'
const DAY_MS = 24 * 60 * 60 * 1000

/** The stages after which a business is written to no further. */
const CLOSED = new Set(['replied', 'unsubscribed', 'bounced', 'undeliverable'])

const SITE_COLUMNS =
  'id, slug, name, prospect_id, letter, shot_url, message_id, sent_at, follow_up_due_at, follow_up_sent_at, follow_ups, expires_at'

async function prospectOf(db, id) {
  const { data, error } = await db
    .from('outreach_prospects')
    .select('id, name, email, town, stage, source, replied_at, bounced_at, contacted_at')
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
 * Drafts, delivers and records one letter of the chain: the first where
 * `nth` is -1, otherwise the follow-up of that number, threaded under the
 * first. The row is written before the transport is reached, so a crash leaves
 * a draft rather than a second copy.
 */
async function sendOne(db, settings, site, prospect, nth = -1, thread = null) {
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
  // The studio's mailbox is asked before the draft is written, so a letter it
  // would turn away leaves nothing behind. An address of its own is not held
  // to it; the roster has already shut the studio's while it rests.
  if (studioSender(picked)) await assertMailboxOpen(db)
  const from = { ...picked, name: PREVIEW_FIRST_SENDER }
  const track = randomUUID()
  const letter = previewFirstLetter(site, nth, {
    track,
    prior: thread,
    proof: await proofNow(),
    origin: from.origin,
    email: prospect.email,
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
    providerId = await deliver(db, message, from, null, undefined, {
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
  if (site.sent_at) return { note: `${slug} was already sent on ${site.sent_at}` }
  if (!site.prospect_id) return { error: `${slug} names no prospect to write to` }

  const prospect = await prospectOf(db, site.prospect_id)
  counts.examined = 1
  const bar = await barred(db, prospect)
  if (bar) return { note: `${slug} was not sent: ${bar}` }

  // A business enters this chain only on its first letter from the studio, and
  // only once all four of its letters are written; one already written to is
  // on another chain and stays there.
  if (prospect.source === LAWSUIT_SOURCE) {
    return { note: `${slug} was not sent: it is on the lawsuit chain` }
  }
  const before = await lettersSent(db, prospect.id)
  if (before) return { note: `${slug} was not sent: it is already on another chain` }
  if (!isPreviewFirst(site)) {
    return { note: `${slug} was not sent: its four letters are not written yet` }
  }
  const missing = await siteMissing(slug)
  if (missing) return { note: `${slug} was not sent: ${missing}` }

  const sent = await sendOne(db, settings, site, prospect)
  const after = days => new Date(Date.parse(sent.at) + days * DAY_MS).toISOString()
  const filed = await db
    .from('preview_sites')
    .update({
      message_id: sent.id,
      sent_at: sent.at,
      follow_up_due_at: after(PREVIEW_FIRST_DAYS[0]),
      follow_ups: 0,
      expires_at: after(PREVIEW_LIFETIME_DAYS),
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
 * One follow-up on the chain: the next of the three written for this
 * business, each owed a fixed number of days after the first letter. The last
 * one says the draft comes down, so the business is then taken off the list.
 */
async function followUp(db, settings, site, prospect, counts) {
  const nth = site.follow_ups ?? 0
  if (nth >= PREVIEW_FIRST_DAYS.length) {
    await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', site.id)
    return `${site.slug} closed: every letter has gone`
  }
  const { data: first, error: read } = await db
    .from('outreach_messages')
    .select('subject, from_address, provider_id')
    .eq('id', site.message_id)
    .maybeSingle()
  if (read) throw new Error(read.message)
  const sent = await sendOne(db, settings, site, prospect, nth, first)
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
  if (!last) return `${site.slug} sent follow-up ${nth + 1}`
  const { error } = await db.from('suppression').upsert(
    {
      email: prospect.email.toLowerCase(),
      reason: 'manual',
      note: `Sent every draft preview letter about ${site.slug}`,
    },
    { onConflict: 'email', ignoreDuplicates: true }
  )
  if (error) throw new Error(error.message)
  return `${site.slug} sent its last letter`
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
      // A preview sent under the old crossover, before the chains were split,
      // has no letters of its own left to send, so it is closed, not written to.
      if (!site.expires_at || !isPreviewFirst(site)) {
        await db.from('preview_sites').update({ follow_up_due_at: null }).eq('id', site.id)
        done.push(`${site.slug} closed: it is not on the draft preview chain`)
        continue
      }
      done.push(await followUp(db, settings, site, prospect, counts))
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
  if (!settings.sending_enabled || !ARMED) {
    return { note: 'sending is switched off, so this run sent no preview letter' }
  }
  // Outreach is a weekday thing; see lib/outreach/sending/schedule.js.
  if (!sendsOn(new Date())) {
    return { note: 'it is the weekend in Texas, so this run sent no preview letter' }
  }
  // The mailbox, asked before anything is read for the run. A request it
  // cannot carry now is answered as one to make again, not as a failure. A
  // first letter can still leave from an address of its own while the studio's
  // rests, so a named preview goes on to the roster, which says whether any
  // address has room.
  const mailbox = await readMailbox(db, new Date(), settings)
  if (!mailbox.open && !(request.method === 'POST' && mailbox.resting && hasOwnSenders())) {
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
