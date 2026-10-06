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
 */

import { randomUUID } from 'node:crypto'
import { servedHereOr404 } from '../../lib/http/guard.js'
import { runJob } from '../../lib/outreach/runtime.js'
import { suppressed } from '../../lib/outreach/sending/queue.js'
import {
  FOLLOW_UP_COUNT,
  LETTERS_BEFORE_PREVIEW,
  LETTERS_IN_ALL,
  PREVIEW_FOLLOW_UP_DAYS,
  PREVIEW_WAIT_DAYS,
  previewLetter,
  previewUrl,
} from '../../lib/outreach/previews.js'
import { deliver, sender, unsubscribeUrl } from './send.js'

export const config = { maxDuration: 300 }

const ARMED = process.env.OUTREACH_SEND_ARMED === 'true'
const DAY_MS = 24 * 60 * 60 * 1000

/** The stages after which a business is written to no further. */
const CLOSED = new Set(['replied', 'unsubscribed', 'bounced', 'undeliverable'])

const SITE_COLUMNS =
  'id, slug, name, prospect_id, letter, shot_url, message_id, sent_at, follow_up_due_at, follow_up_sent_at'

async function prospectOf(db, id) {
  const { data, error } = await db
    .from('outreach_prospects')
    .select('id, name, email, stage, replied_at, bounced_at, unsub_token, contacted_at')
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
 */
async function sendOne(db, settings, site, prospect, kind, thread = null, nth = 0) {
  const from = sender(settings)
  const track = randomUUID()
  const unsubscribe = prospect.unsub_token ? unsubscribeUrl(prospect.unsub_token) : null
  const letter = previewLetter({ ...site, email: prospect.email }, kind, {
    track,
    unsubscribe,
    prior: thread,
    nth,
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
    await db
      .from('outreach_messages')
      .update({ status: 'failed', error: String(cause?.message || cause).slice(0, 500) })
      .eq('id', message.id)
    throw cause
  }
  const at = new Date().toISOString()
  const marked = await db
    .from('outreach_messages')
    .update({ status: 'sent', sent_at: at, provider_id: providerId, error: null })
    .eq('id', message.id)
  if (marked.error) throw new Error(marked.error.message)
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
  if (site.sent_at) return { note: `${slug} was already sent on ${site.sent_at}` }
  if (!site.prospect_id) return { error: `${slug} names no prospect to write to` }

  const prospect = await prospectOf(db, site.prospect_id)
  counts.examined = 1
  const bar = await barred(db, prospect)
  if (bar) return { note: `${slug} was not sent: ${bar}` }

  const early = await notDueYet(db, prospect.id)
  if (early) return { note: `${slug} was not sent: ${early}` }
  const missing = await siteMissing(slug)
  if (missing) return { note: `${slug} was not sent: ${missing}` }

  const sent = await sendOne(db, settings, site, prospect, 'first')
  const due = new Date(Date.parse(sent.at) + PREVIEW_FOLLOW_UP_DAYS * DAY_MS).toISOString()
  const filed = await db
    .from('preview_sites')
    .update({
      message_id: sent.id,
      sent_at: sent.at,
      follow_up_due_at: due,
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
    const nth = site.follow_ups ?? 0
    const before = await lettersSent(db, prospect.id)
    if (before >= LETTERS_IN_ALL || nth >= FOLLOW_UP_COUNT) {
      await finish(db, site, prospect)
      done.push(`${site.slug} finished after ${before} letters`)
      continue
    }
    const { data: first, error: read } = await db
      .from('outreach_messages')
      .select('subject, provider_id')
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
  return { note: done.length ? done.join('; ') : 'no preview follow-up is due' }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({
    request,
    response,
    job: 'previews',
    work: async ({ db, settings, counts }) => {
      if (!settings.sending_enabled || !ARMED) {
        return { note: 'sending is switched off, so this run sent no preview letter' }
      }
      if (request.method === 'POST') {
        const slug = String(request.body?.slug ?? '')
          .trim()
          .toLowerCase()
        if (!/^[a-z0-9-]{2,63}$/.test(slug)) return { error: 'name a preview by its slug' }
        return sendFirst(db, settings, slug, counts)
      }
      return followUps(db, settings, counts)
    },
  })
}
