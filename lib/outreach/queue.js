/**
 * Who the send job writes to next, and in what order.
 *
 * The queue is worked out rather than stored. There is no table of pending
 * messages and no column holding a position: every run reads the prospects
 * that are eligible, drops the ones it may not write to, and sorts what is
 * left. That answer is the same one twice in a row given the same rows, which
 * is what lets the console show the queue without the sender having to write
 * it down first.
 *
 * It sits here rather than in the send route because two callers need it. The
 * sender takes the queue and delivers it; the console takes the same queue and
 * shows it. A second implementation of the order behind the console would be a
 * list of businesses nobody is actually about to write to.
 *
 * Nothing here reaches a mail server or writes a row. The transport, the
 * composition and the stage writes stay with the route, so a page that only
 * wants to read the queue does not pull a mail client in behind it.
 */

import { shapeOf } from './address.js'
import { rowRuleOf } from './exclusions.js'
import { columnMissing, tableMissing } from '../db/rows.js'
import { FOLLOW_UP_LIMIT } from './limits.js'
import { dayStartsAt, sendsOn } from './schedule.js'
import { ZONE } from '../time/zone.js'

// The hours a message may leave, in the recipients' own time. A cold email
// arriving at two in the morning is read as spam whatever it says, and the
// timestamp is the first thing a reader sees.
//
// Saturday is a sending day and Sunday is not. The trades this writes to are
// owner-run, and an owner reads mail on a Saturday morning as readily as on a
// Tuesday; Sunday is the one day of the week that is nobody's working day.
export const SEND_ZONE = ZONE
export const SEND_OPENS_HOUR = 8
export const SEND_CLOSES_HOUR = 17

/**
 * Prospects read before the queue is filtered down to the day's allowance.
 *
 * It has to clear the day's cap with room to spare, because what is read is
 * not what is sendable: the address rules, the held domains and the one-message
 * -per-address dedupe all cut into a batch after the database has handed it
 * over. A read that came back level with the cap would leave the day short by
 * however many the rules refused, and the console reports the length of this
 * same list as the queue, so a short read reads as a queue that has run dry.
 *
 * Well past DAILY_CAP_MAX for that reason, and no further: this is one read per
 * send run and one per console load, and every row on it carries the stored
 * PageSpeed report.
 */
export const CANDIDATE_LIMIT = 400
/** Where a prospect with no reading sorts, which is behind every real score. */
const DEFAULT_RANK = 101
/** Where a business with no site of its own sorts, which is ahead of every score. */
const SOCIAL_RANK = -1
// How long a claim on a prospect stands before a later run may take it back. A
// run lives for minutes at the outside, so an hour is past any invocation that
// could still be holding one and short of making a stranded row wait.
const CLAIM_HOLDS_MS = 60 * 60 * 1000

/**
 * What a candidate carries, which is everything the order and the message need.
 * `variant_id` is the message a business was already given, which the sender
 * reads before it chooses one, so a second message opens the way the first did.
 */
export const CANDIDATE_COLUMNS =
  'id, name, town, trade, website, email, audit_score, accessibility_score, ' +
  'best_practices_score, seo_score, audit_raw, site_kind, stage, unsub_token, variant_id'

/**
 * Whether a message may leave right now, and the reason when it may not.
 *
 * The hour is read in `SEND_ZONE` rather than in the server's own, since a
 * function runs in UTC and the window belongs to the people receiving the mail.
 * The day is settled by `sendsOn` in lib/outreach/schedule.js rather than again
 * here, so the weekday read out of these parts is only the one a run record
 * reports itself under.
 *
 * @param {Date} [now]
 * @returns {{open: boolean, reason: string, hour: number, weekday: string}}
 */
export function sendWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SEND_ZONE,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now)

  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const weekday = parts.find(part => part.type === 'weekday')?.value ?? ''

  if (!sendsOn(now)) {
    return {
      open: false,
      reason: 'it is Sunday in Texas and messages go out Monday to Saturday',
      hour,
      weekday,
    }
  }
  if (hour < SEND_OPENS_HOUR || hour >= SEND_CLOSES_HOUR) {
    return {
      open: false,
      reason: `it is ${hour}:00 in Texas and messages go out between ${SEND_OPENS_HOUR}:00 and ${SEND_CLOSES_HOUR}:00`,
      hour,
      weekday,
    }
  }
  return { open: true, reason: '', hour, weekday }
}

/**
 * The stage a prospect waits at when it is not in flight.
 *
 * A business with no site of its own, and one nothing has managed to measure,
 * both wait at 'enriched', which is where the audit looks for work. A measured
 * one waits at 'audited', where it was. Either way the send queue reads it
 * again, so a message that failed is one the next run offers rather than a
 * business quietly leaving the list.
 */
export const homeStage = prospect =>
  prospect.site_kind === 'social' ||
  prospect.audit_score === null ||
  prospect.audit_score === undefined
    ? 'enriched'
    : 'audited'

/**
 * The prospects eligible for a message, in the order the database hands them
 * over.
 *
 * Anything the pipeline has an address for and has not written to. An address
 * is the whole of the test: every stage that can hold one is read, and the
 * rows with none are dropped by the query rather than by a rule.
 *
 * That is a shorter list of conditions than it used to be, because the letter
 * is an introduction. It quotes no reading, names no score and carries no
 * capture, so there is nothing about a business that has to be known before it
 * can be written to. A measured site, a business with no site of its own, one
 * whose site refused to answer Google's test, and one nothing has looked at
 * yet all read the same words.
 *
 * So a business waits here for an address and for nothing else. A row at
 * 'enriched' is one the enricher found an address for, and it is eligible on
 * that alone: holding it back for a measurement the message never mentions
 * would put the PageSpeed job in front of the send queue and let a day run dry
 * behind it. 'unreachable' is here for the same reason, since a site that
 * would not answer a speed test is not the least likely of them to want a new
 * one. 'queued' is a claim left behind by a run that never came back.
 *
 * The read takes the measured sites first, worst score first, and lets the
 * unmeasured fill whatever is left. That is the order the queue sends in, so
 * the two agree; and since opening the gate the unmeasured are the larger
 * population by far, a read that took them first would fill itself with them
 * and never reach a scored row at all.
 */
export async function candidates(db) {
  const { data, error } = await db
    .from('outreach_prospects')
    .select(CANDIDATE_COLUMNS)
    .in('stage', ['enriched', 'audited', 'queued', 'unreachable'])
    .not('email', 'is', null)
    .is('contacted_at', null)
    .order('audit_score', { ascending: true, nullsFirst: false })
    .limit(CANDIDATE_LIMIT)
  if (error) throw new Error(error.message)
  return data
}

/** What a stored variant row carries. */
export const VARIANT_COLUMNS = 'id, status, weight, updated_at'

/**
 * What the console has set each variant to, which is laid over the registry
 * before a message is chosen.
 *
 * A database without the table yet answers with nothing, and the code's own
 * defaults stand: the sender is meant to keep sending under them until the
 * migration lands, and a run stopped by a missing settings table would be a
 * queue stopped over a column nobody has read yet. Any other refusal is one.
 */
export async function variantSettings(db) {
  const { data, error } = await db.from('outreach_variants').select(VARIANT_COLUMNS)
  if (error && tableMissing(error)) return []
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Every address the pipeline has already written to, out of the ones about to
 * be written to.
 *
 * A business is kept out of the queue by its own row: the stage moves and
 * `contacted_at` is set, and neither is read again. That is one row's memory,
 * and an address is not one row. A trade with two branches, a firm listed
 * under two spellings of its name, and two businesses sharing an office
 * mailbox all arrive as separate prospects carrying the same address, and each
 * of them is a first letter as far as its own row knows.
 *
 * `queueFor` drops the second of them, but only inside one batch, which is one
 * run of a job that runs every ten minutes all day. Two such rows a page apart
 * are two letters to the same person, and the pair that prompted this arrived
 * ten minutes apart with the same words in both.
 *
 * So the address is asked about as well as the row. This is the same shape as
 * `suppressed` and sits beside it for that reason: both answer whether this
 * address may be written to, over a table that is not the prospect's.
 *
 * Stored addresses are written lowercase by the sender, so the comparison is
 * on the lowercase form and needs no folding in the database.
 *
 * @param {object} db A service-role client.
 * @param {string[]} emails The addresses about to be written to, lowercased.
 * @returns {Promise<Set<string>>}
 */
export async function writtenTo(db, emails) {
  if (!emails.length) return new Set()
  const { data, error } = await db
    .from('outreach_messages')
    .select('to_address')
    .eq('direction', 'outbound')
    .eq('status', 'sent')
    .in('to_address', emails)
  if (error) throw new Error(error.message)
  return new Set(data.map(row => String(row.to_address).toLowerCase()))
}

/** Every address held off outreach, out of the ones about to be written to. */
export async function suppressed(db, emails) {
  if (!emails.length) return new Set()
  const { data, error } = await db.from('suppression').select('email').in('email', emails)
  if (error) throw new Error(error.message)
  return new Set(data.map(row => String(row.email).toLowerCase()))
}

/**
 * The outbound message already on file for each of these prospects. A row that
 * failed is not counted, because a failed send is one to try again rather than
 * one already made.
 */
export async function existingMessages(db, prospectIds) {
  if (!prospectIds.length) return new Map()
  const { data, error } = await db
    .from('outreach_messages')
    .select(
      'id, prospect_id, subject, body_text, body_html, to_address, status, variant_id, created_at, sent_at'
    )
    .eq('direction', 'outbound')
    .in('prospect_id', prospectIds)
    .in('status', ['drafted', 'sent'])
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const held = new Map()
  for (const row of data) {
    if (!held.has(row.prospect_id)) held.set(row.prospect_id, row)
  }
  return held
}

/**
 * Messages already sent since midnight, which is what the day's cap counts.
 *
 * A follow-up is outside the cap, so where the chain's columns exist the count
 * is of first letters alone. A message from before the columns carries no
 * step and counts as a first letter, which it was.
 *
 * @param {object} db A service-role client.
 * @param {{firstOnly?: boolean}} [what] Whether to leave follow-ups out, which
 *   is only possible once the column that marks them exists.
 */
export async function sentToday(db, { firstOnly = false } = {}) {
  let query = db
    .from('outreach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .eq('status', 'sent')
    .gte('sent_at', dayStartsAt())
  if (firstOnly) query = query.or('step.is.null,step.eq.1')
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** What a business due a follow-up carries: the candidate's columns and the chain's. */
export const FOLLOW_UP_COLUMNS = `${CANDIDATE_COLUMNS}, step, next_due_at, contacted_at`

/**
 * Whether the chain's columns are in the database yet.
 *
 * The sender is meant to keep sending first letters until the migration
 * lands, and to skip the chain without complaint rather than stop the run
 * over a column nobody has read yet. Any other refusal is one.
 */
export async function followUpColumns(db) {
  const { error } = await db.from('outreach_prospects').select('step, next_due_at').limit(1)
  if (!error) return true
  if (columnMissing(error)) return false
  throw new Error(error.message)
}

/**
 * The businesses owed a follow-up now, longest waiting first.
 *
 * A business is on the chain while it stands at 'contacted' with a due date:
 * a reply, an opt-out or a bounce moves it to another stage, and the end of
 * its chain takes the date away, so neither is ever read here again.
 */
export async function dueFollowUps(db, now = new Date(), limit = FOLLOW_UP_LIMIT) {
  const { data, error } = await db
    .from('outreach_prospects')
    .select(FOLLOW_UP_COLUMNS)
    .eq('stage', 'contacted')
    .not('email', 'is', null)
    .not('next_due_at', 'is', null)
    .lte('next_due_at', now.toISOString())
    .order('next_due_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * The first letter each of these businesses was sent, which a follow-up
 * threads under: its subject and the id the mail server gave it.
 */
export async function firstMessages(db, prospectIds) {
  if (!prospectIds.length) return new Map()
  const { data, error } = await db
    .from('outreach_messages')
    .select('id, prospect_id, subject, provider_id, sent_at')
    .eq('direction', 'outbound')
    .eq('status', 'sent')
    .in('prospect_id', prospectIds)
    .order('sent_at', { ascending: true })
  if (error) throw new Error(error.message)
  const first = new Map()
  for (const row of data ?? []) {
    if (!first.has(row.prospect_id)) first.set(row.prospect_id, row)
  }
  return first
}

/**
 * The prospects a run may write to, in the order they go out.
 *
 * A reviewed draft goes before a fresh composition, since what was read is
 * what should arrive. Among the rest a business with no site of its own goes
 * first: nothing measured it, and having no website at all is the strongest
 * reason on the list to be hearing from a studio. The scored businesses follow
 * in the order of how slowly they load, and the ones nothing has measured come
 * last, which is where an unknown belongs rather than at a score it was never
 * given.
 *
 * A claim at 'queued' is released only once no live run could still be holding
 * it, so two runs overlapping cannot both carry the same prospect to the
 * transport.
 */
export function queueFor({
  candidates,
  held,
  messages,
  sending,
  written = new Set(),
  at = Date.now(),
}) {
  const claimedBefore = at - CLAIM_HOLDS_MS

  const queue = candidates.filter(prospect => {
    const address = String(prospect.email ?? '').toLowerCase()
    if (held.has(address)) return false

    // An address already written to is finished with, whatever this row says
    // about itself. The stage and `contacted_at` remember one prospect, and a
    // business listed twice is two prospects holding one mailbox, so without
    // this the second listing reads as somebody who has never heard from the
    // studio. The letter promises one email a month; two of it in ten minutes
    // is the one thing that promise cannot survive.
    if (written.has(address)) return false

    // Everything about an address that can be settled without asking the
    // network: whether it parses, whether the mailbox reaches a person, whether
    // the domain is a throwaway or belongs to a booking platform rather than to
    // the business the listing is about. A row stored before the enricher
    // learned any of that is still on file, and the console reads this queue,
    // so a business the sender would refuse never appears as one about to hear
    // from the studio. The mail-server reading is the sender's, since it is the
    // one that costs a round trip.
    if (shapeOf(address)) return false

    // A business the rules put out of reach, by its domain being held, by its
    // name or by its size, is skipped by the enricher's sweep on its next run.
    // Until then the queue reads the same rules, so a row that got as far as
    // an audit before a rule was written is not shown as about to hear from
    // the studio.
    if (rowRuleOf(prospect)) return false

    const existing = messages.get(prospect.id)

    if (prospect.stage === 'queued') {
      if (!sending || existing?.status !== 'drafted') return false
      return new Date(existing.created_at).getTime() < claimedBefore
    }

    if (!existing) return true
    // A message already sent is finished with. A draft is work waiting for the
    // switches, so it is picked up only by a run that can act on it.
    return existing.status === 'drafted' && sending
  })

  const rank = prospect =>
    prospect.site_kind === 'social' ? SOCIAL_RANK : (prospect.audit_score ?? DEFAULT_RANK)
  queue.sort((first, second) => {
    const drafted = Number(messages.has(second.id)) - Number(messages.has(first.id))
    if (drafted) return drafted
    return rank(first) - rank(second)
  })

  // One message per address, however many listings carry it. A directory
  // holding the same firm under two spellings of its name is ordinary, and
  // writing to both is the one mistake a reader definitely notices. The dedupe
  // happens after the sort, so the row that survives is the one that would have
  // gone first anyway.
  //
  // This is the half of it that holds inside one batch. `written` above is the
  // half that holds across runs and across days, and both are needed: one run
  // cannot see yesterday, and a set built from the database cannot see the row
  // this same run is about to write to.
  const seen = new Set()
  return queue.filter(prospect => {
    const address = String(prospect.email ?? '').toLowerCase()
    if (seen.has(address)) return false
    seen.add(address)
    return true
  })
}

/**
 * The whole queue as it stands, read rather than acted on.
 *
 * This is the sender's own three reads and its own sort, with the repair pass
 * and the transport left out. A run repairs a stranded claim before it sorts,
 * which can move one row; showing the queue does not, because a reader looking
 * at the list is not the thing that should be writing to the table.
 *
 * `sending` decides which rows qualify, so it is passed rather than read here:
 * a queue shown as if the switches were open would list businesses that are
 * not going anywhere.
 *
 * @param {object} db A service-role client.
 * @param {boolean} sending Whether a run right now would reach the transport.
 * @returns {Promise<{queue: object[], messages: Map<string, object>}>}
 */
export async function plannedQueue(db, sending) {
  const rows = await candidates(db)
  if (!rows.length) return { queue: [], messages: new Map() }

  const addresses = rows.map(row => String(row.email).toLowerCase())
  const [held, written, messages] = await Promise.all([
    suppressed(db, addresses),
    writtenTo(db, addresses),
    existingMessages(
      db,
      rows.map(row => row.id)
    ),
  ])

  return { queue: queueFor({ candidates: rows, held, written, messages, sending }), messages }
}
