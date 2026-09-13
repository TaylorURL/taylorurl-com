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
 * The order itself is not decided here either. lib/outreach/sending/rank.js holds the
 * axis, because the sort is only half of what leans on it: the read below
 * decides which rows get sorted at all, and a read that does not know what the
 * comparator is about to promote hands over a page with the strongest leads
 * missing from it. Both ends take the same function, so neither can be edited
 * into quietly disagreeing with the other.
 *
 * That disagreement is what the two reads are for. The rows that beat a score -
 * a business that asked for the reading itself, a listing young enough to still
 * be choosing, a business with no site at all - carry nothing in the column the
 * read is ordered by, so a single read ordered on the score sorts every one of
 * them past its own limit and cuts them off the end. They are read separately
 * instead, on the columns that identify them, and merged with the scored read
 * before anything is filtered. A truncated read looks exactly like a healthy one
 * from every side, which is why the answer is a second read rather than a larger
 * number.
 *
 * Nothing here reaches a mail server or writes a row. The transport, the
 * composition and the stage writes stay with the route, so a page that only
 * wants to read the queue does not pull a mail client in behind it.
 */

import { shapeOf } from '../prospects/address.js'
import { rowRuleOf } from '../prospects/exclusions.js'
import { columnMissing, tableMissing } from '../../db/rows.js'
import { FOLLOW_UP_LIMIT } from './limits.js'
import { ASKED_SOURCE, rankOf, ranksAhead } from './rank.js'
import { CLOSES, OPENS, dayStartsAt, sendsOn } from './schedule.js'
import { YOUNG_REVIEW_CEILING } from '../prospects/youth.js'
import { clockIn } from '../../time/zone.js'

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
 * Four hundred for that reason, and no further: this is one read per send run
 * and one per console load, and every row on it carries the stored PageSpeed
 * report. Nothing caps the day's setting, so this is the figure the cap has to
 * stay under to be fed - comfortably, since a day's runs carry two hundred and
 * seventy between them whatever the cap says.
 */
const CANDIDATE_LIMIT = 400

/**
 * Rows read on the priority pass, which is the one that carries the leads that
 * beat a score.
 *
 * Its own number rather than a share of `CANDIDATE_LIMIT`, and that is the whole
 * of why the two passes hold each other up. However far the scored population
 * grows it cannot crowd a business that asked, a young listing or a business
 * with no site out of the batch, because the two are not competing for the same
 * room. One limit covering both reads would only put a date on the day the
 * strongest leads fall off the end.
 *
 * Six hundred, which is above the entire eligible table as it
 * stands and several times over the band this pass selects out of it. That is
 * the state the number is meant to hold: high enough to read the band whole
 * rather than to ration it, since a rationed band is the same silent loss a
 * single read makes, only a smaller one. It is not high enough to stop
 * mattering, though, because a row here weighs what a row on the scored read
 * weighs - most of these have been measured and carry the stored PageSpeed
 * report with them - so this is a second read of the same cost rather than a
 * cheap one.
 *
 * `candidates` says so out loud when the pass comes back full, since a limit
 * that has started to bind is otherwise exactly the silence this file exists to
 * keep out.
 */
const PRIORITY_LIMIT = 600

// How long a claim on a prospect stands before a later run may take it back. A
// run lives for minutes at the outside, so an hour is past any invocation that
// could still be holding one and short of making a stranded row wait.
const CLAIM_HOLDS_MS = 60 * 60 * 1000

/**
 * What a candidate carries, which is everything the order and the message need.
 * `variant_id` is the message a business was already given, which the sender
 * reads before it chooses one, so a second message opens the way the first did.
 *
 * `source`, `rating_count` and `business_status` are the three columns the rank
 * is read off. They are selected on both reads rather than on the priority one
 * alone, because `rankOf` is asked of the whole merged batch: a young listing
 * that arrived on the scored read without its review count would answer as a row
 * nobody has read, which is a different rung of the ladder from the one it
 * belongs on, and the batch would sort into an order neither read intended.
 * `business_status` is read a second time by `rowRuleOf`, which is what keeps a
 * permanently closed listing out of the queue.
 */
export const CANDIDATE_COLUMNS =
  'id, name, town, trade, website, email, audit_score, accessibility_score, ' +
  'best_practices_score, seo_score, audit_raw, site_kind, stage, unsub_token, variant_id, ' +
  'source, rating_count, business_status'

/**
 * Whether a message may leave right now, and the reason when it may not.
 *
 * The hour is read off `clockIn`, in Central rather than in the server's own
 * zone, since a function runs in UTC and the window belongs to the people
 * receiving the mail. The hours it opens and closes on are `OPENS` and `CLOSES`
 * in lib/outreach/sending/schedule.js, and the day is settled by `sendsOn` there
 * rather than again here, so the weekday read off the clock is only the one a
 * run record reports itself under.
 *
 * @param {Date} [now]
 * @returns {{open: boolean, reason: string, hour: number, weekday: string}}
 */
export function sendWindow(now = new Date()) {
  const { hour, minutes, weekday } = clockIn(now)

  if (!sendsOn(now)) {
    return {
      open: false,
      reason: 'it is Sunday in Texas and messages go out Monday to Saturday',
      hour,
      weekday,
    }
  }
  if (minutes < OPENS || minutes >= CLOSES) {
    return {
      open: false,
      reason: `it is ${hour}:00 in Texas and messages go out between ${OPENS / 60}:00 and ${CLOSES / 60}:00`,
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
 * Which rows beat a score, written as columns the database can filter on.
 *
 * `rankOf` settles that question in JavaScript over a row already read, which is
 * no help to the read itself, so the same three reasons are spelled out here as
 * a predicate: the business asked, the listing is under the review ceiling, or
 * there is no site of its own to argue with. The source string and the ceiling
 * come from the modules that own them rather than being written out again, so a
 * ceiling moved in lib/outreach/prospects/youth.js moves this read with it.
 *
 * It is deliberately a wider net than the ranking. `isYoung` refuses a listing
 * Google has closed and this does not, so a closed listing under the ceiling is
 * read here and then ranked as ordinary rather than young - and a permanently
 * closed one is dropped on top of that by the row rules every candidate is put
 * through. That is the safe direction to be wrong in. A row read and then ranked
 * ordinary costs one row of the limit and nothing else, where a row that ranks
 * ahead and was never read is the failure this pass exists to prevent, and that
 * one leaves nothing behind to notice.
 */
const AHEAD_OF_SCORE_FILTER = [
  'site_kind.eq.social',
  `source.eq.${ASKED_SOURCE}`,
  `rating_count.lt.${YOUNG_REVIEW_CEILING}`,
].join(',')

/**
 * The rows a message may go to at all, before any order or limit is put on them.
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
 * It is a builder rather than a read because both passes below want exactly
 * these conditions and only these. Written out twice they would drift apart,
 * and the drift would show as rows the priority pass promotes that the scored
 * pass would never have offered in the first place.
 */
const eligible = db =>
  db
    .from('outreach_prospects')
    .select(CANDIDATE_COLUMNS)
    .in('stage', ['enriched', 'audited', 'queued', 'unreachable'])
    .not('email', 'is', null)
    .is('contacted_at', null)

/**
 * The prospects eligible for a message, read in two passes and handed over as
 * one list.
 *
 * The scored pass takes the measured sites first, worst score first, and lets
 * the unmeasured fill whatever is left. That is the order the queue sends in
 * among scored rows, so the two agree; and since opening the gate the unmeasured
 * are the larger population by far, a read that took them first would fill
 * itself with them and never reach a scored row at all.
 *
 * What that pass cannot do is hold the rows that beat a score. A business that
 * asked, a young listing and a business with no site of its own have nothing in
 * `audit_score`, so `nullsFirst: false` sorts every one of them behind every
 * measured row and the limit then takes them off the end. The read drops exactly
 * the leads the comparator was about to put first, and it drops them without a
 * symptom: the queue that comes back is full, the send job runs, every message
 * goes out, and the strongest rows on the table were never among the ones
 * anybody looked at.
 *
 * So they are read on their own columns with their own limit, and the two
 * results are merged and deduped by id before anything filters them. A row can
 * answer both passes - a young listing that also carries a score - and the
 * priority copy is the one kept, which changes nothing but the arithmetic, since
 * the two are one row read twice.
 *
 * The priority pass is ordered on `created_at`, newest first, which matters on
 * no day except the one where its limit binds and something has to be left off.
 * The rung that spoils with time is the business that asked: somebody ran the
 * check on their own site and the reason they would answer is that it is still
 * on their mind. `created_at` is when the row was filed, which on a check that
 * made its own row is that same moment, and on a check that matched a map
 * listing already on the table is when the sweep filed the listing - Google's
 * rotation surfacing it rather than anybody asking. So the order is the one the
 * asking rung wants and an arbitrary one for the rest, and the rest are the
 * rungs that do not spoil: a young listing and a business with no site are the
 * same lead next week as today.
 */
export async function candidates(db) {
  const [ahead, scored] = await Promise.all([
    eligible(db)
      .or(AHEAD_OF_SCORE_FILTER)
      .order('created_at', { ascending: false })
      .limit(PRIORITY_LIMIT),
    eligible(db)
      .order('audit_score', { ascending: true, nullsFirst: false })
      .limit(CANDIDATE_LIMIT),
  ])
  if (ahead.error) throw new Error(ahead.error.message)
  if (scored.error) throw new Error(scored.error.message)

  const priority = ahead.data ?? []
  // The one way the invariant can fail, said out loud rather than left to be
  // inferred. A full priority read is one the limit ended rather than the
  // table, so there may be leads sitting behind it that belong at the head of
  // the queue. The count that actually ranks ahead is the honest half of the
  // reading: the filter is a wider net than the ranking, so a read can fill with
  // rows none of which needed protecting, and the two figures together say
  // whether the limit is nearing the point where it binds for a real reason.
  if (priority.length >= PRIORITY_LIMIT) {
    console.warn(
      'outreach queue: the priority read came back full at %d rows, %d of them ranking ahead of every score; leads that belong at the head of the queue may be sitting behind it',
      priority.length,
      priority.filter(ranksAhead).length
    )
  }

  const seen = new Set()
  const merged = []
  for (const row of priority.concat(scored.data ?? [])) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return merged
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
 * what should arrive. Everything under that is `rankOf`, and the ladder it
 * reads is in lib/outreach/sending/rank.js rather than restated here: a business that
 * asked for the reading itself, then a listing young enough to still be
 * choosing what to buy, then a business with no site of its own to argue with,
 * then the measured sites in the order of how slowly they load, and last the
 * ones nothing has measured, which is where an unknown belongs rather than at a
 * score it was never given.
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
    // name, by its size or by having shut for good, is skipped by the
    // enricher's sweep on its next run. Until then the queue reads the same
    // rules, so a row that got as far as an audit before a rule was written is
    // not shown as about to hear from the studio.
    //
    // Trading status is settled there and nowhere else. The rules in
    // lib/outreach/prospects/exclusions.js drop a listing Google has closed for good and
    // deliberately keep one closed for a refit, since that business reopens and
    // is worth writing to when it does, and api/outreach/enrich.js records the
    // same verdict as the reason a row was skipped. What this function decides
    // is who gets a letter out of the businesses that rule leaves standing:
    // whether the address is reachable, whether it has already been written to,
    // and whether a claim or a draft is in the way.
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

  // The draft is the first key and stays the first key. Everything below it is
  // a judgement about which lead is worth the most, and a draft is not a lead -
  // it is a letter a person has already read and approved. Letting a stronger
  // lead reorder around it would mean the thing that was reviewed is not the
  // thing that goes out, which is the one ordering mistake nobody can see from
  // the console.
  queue.sort((first, second) => {
    const drafted = Number(messages.has(second.id)) - Number(messages.has(first.id))
    if (drafted) return drafted
    return rankOf(first) - rankOf(second)
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
