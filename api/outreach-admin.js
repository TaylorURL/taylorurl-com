/**
 * The cold email engine's endpoint: the businesses it found, what was sent to
 * each of them, what came back, and the switches that decide whether any of it
 * runs.
 *
 * All four outreach tables carry row-level security with no public policy, so
 * every read and every write in here is made with the service role and the
 * service role never leaves this function. The console holds a session and
 * nothing else.
 *
 * The session is verified against the project before anything else happens,
 * the account behind it is resolved from `profiles`, and any role other than
 * admin is refused. That is the same pair of steps the audience endpoint
 * takes.
 *
 * GET answers one of three views:
 *
 *   ?view=board    the stage counts, the day's sending against the cap, the
 *                  settings, the recent runs of each job, and one page of the
 *                  prospect list under the filter and ordering given
 *   ?view=prospect&id=<uuid>
 *                  one business in full, with every message to and from it
 *   ?view=mail     who the next messages go to and when, and who the last ones
 *                  went to, and what went out under each letter
 *   ?view=preview&variant=<id>
 *                  one variant rendered by the real composer against a real
 *                  business, so what is shown is what would be sent
 *
 * The mail view works the queue out the same way the send job does, from the
 * same module, rather than reading a list of pending messages: there is no
 * such list. Nothing is written to, and the day's schedule says when each of
 * the businesses in it is due to hear from the studio.
 *
 * The board is one read rather than four because the strip, the jobs, the
 * controls and the table are looked at together: a stage count that disagrees
 * with the rows under it is worse than either figure alone.
 *
 * POST carries one action:
 *
 *   { action: 'settings', ...fields }   the switches, the cap, the lists
 *   { action: 'skip', id, reason }      one business taken out of the pipeline
 *   { action: 'add', ...fields }        one business put into it by hand
 *   { action: 'variant', id, status, weight }
 *                                       whether one variant is sent and how
 *                                       much of its segment it takes
 *   { action: 'proof', id }             one variant sent to the studio's own
 *                                       inbox, as it would go
 *
 * A variant write carries its status and its weight and nothing else. The
 * words a variant opens with are code, in lib/outreach/variants.js, and a
 * message edited from a form would be one nothing had checked; what the
 * console decides is whether a variant is being sent and how often, which is
 * the whole of what `outreach_variants` holds. The last variant a segment can
 * still send under is refused a pause, since a segment with nothing live is a
 * queue that empties without saying so.
 *
 * The preview is the sender's own `compose`, given the variant and the next
 * business in the queue that it is written for, or failing that any business
 * on file that reads as its segment. Nothing is written and nothing is sent;
 * the capture, where one is already on file, is read rather than rendered.
 * A proof is the same message handed to the sender's own mail server and
 * delivered to the studio's inbox, since a mail client is the only place a
 * letter can be judged; it too writes nothing, and it goes nowhere else.
 *
 * A settings write carries only the fields it changes, so a toggle is one
 * field and the form is several, and neither overwrites what the other holds.
 *
 * An added business enters at 'found', which is where the sweep leaves one, and
 * every job downstream then treats it as a row like any other. The form carries
 * the fields a map result carries and no more: what a business's site scores,
 * whether its address can receive mail, and what platform its listing points at
 * are readings, and a reading nobody took is left for the job that takes it.
 *
 * The tables are the pipeline's, not this endpoint's. A database without them
 * answers with the sentence that says so rather than a driver error, because
 * the console reads that sentence out to whoever opened the section.
 */
import { servedHereOr404 } from '../lib/http/guard.js'
import { countOf, readAll } from '../lib/db/rows.js'
import { bounceRecord } from '../lib/outreach/sending/bounces.js'
import { hostOf } from '../lib/outreach/prospects/platforms.js'
import {
  CANDIDATE_COLUMNS,
  candidates,
  dueFollowUps,
  firstMessages,
  plannedQueue,
  sendWindow,
  sentToday,
  suppressed,
  VARIANT_COLUMNS,
  followUpColumns,
  variantSettings,
} from '../lib/outreach/sending/queue.js'
import { loadHeldDomains } from '../lib/outreach/prospects/exclusions.js'
import {
  HOLDOUTS,
  VARIANTS,
  VARIANT_STATUSES,
  WEIGHT_MAX,
  familyHeld,
  fits,
  isHoldoutId,
  liveAhead,
  withSettings,
  wouldEmptySegment,
} from '../lib/outreach/variants.js'
import { segmentOf } from '../lib/outreach/segments.js'
import { isYoung } from '../lib/outreach/prospects/youth.js'
import { ranksAhead } from '../lib/outreach/sending/rank.js'
import { storedShot } from '../lib/outreach/audit/shot.js'
import { compose, deliverProof, sender } from './outreach/send.js'
import { STUDIO_INBOX } from '../lib/outreach/message.js'
import { dayStartsAt, reachesMore, slotsAt } from '../lib/outreach/sending/schedule.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { field, uuid } from '../lib/db/fields.js'
import {
  OPPORTUNITY_BANDS,
  opportunityBand,
  opportunityRank,
} from '../src/app/utils/outreachOpportunity.js'

/** Prospects in one page of the table. */
const PAGE_SIZE = 50
/** Pages a request may skip past, so an out-of-range page cannot scan the table. */
const PAGE_MAX = 400
// Rows the stage counts, the bands and the town and trade lists are taken
// over. It is a ceiling on a read that pages up to it rather than a limit on
// one request, which stops at a thousand rows and says nothing about the rest.
// The prospect total beside those figures is counted exactly whatever this is,
// so a table past the ceiling reports a true total and a breakdown that says
// what it was taken over.
const SUMMARY_LIMIT = 10_000
/** Runs kept per job, which is enough to see whether one is still going. */
const RUNS_PER_JOB = 5
/** Entries one town or trade list may carry. */
const LIST_MAX = 100
// What a business added by hand may carry in each field. The columns are
// unbounded text, so these are the lengths a business is actually written down
// in rather than anything the database asks for: past them the value is a
// paste rather than a name.
const NAME_MAX = 200
const POSTAL_MAX = 500
const PHONE_MAX = 60
const SITE_MAX = 500
/** Rows one read for an existing business looks at before it gives up. */
const MATCH_LIMIT = 200
/** Leading characters of a name that read is narrowed on. */
const PREFIX_MAX = 12
/** How far down the send queue the mail view looks. */
const MAIL_AHEAD = 25
/** Messages the mail view shows behind the last one, newest first. */
const MAIL_BEHIND = 25
/**
 * A message's place in the list of what has already gone.
 *
 * The moment it left, which is not the moment it was written. A draft whose
 * claim did not land waits at 'drafted' until a later run picks the same text
 * up, so writing order and sending order come apart, and it is the sending
 * order a reader of this list is after. A message that never left has only the
 * moment it was written, which is the time the row shows and so the time it
 * sorts on.
 */
const wentAt = row => Date.parse(row.sent_at || row.created_at) || 0
// The second sending switch, which is set on the deployment rather than in the
// console. The send job reads the same variable and stops at the transport
// while it is off, so the queue is only a queue of messages actually leaving
// when both it and the console's switch are open.
const ARMED = process.env.OUTREACH_SEND_ARMED === 'true'

const STAGES = [
  'found',
  'enriched',
  'audited',
  'queued',
  'contacted',
  'replied',
  'unsubscribed',
  'bounced',
  'unreachable',
  'undeliverable',
  'skipped',
]
const JOBS = ['source', 'enrich', 'audit', 'send', 'watch', 'ramp']

// The stages a business stands at while it is still owed a first letter, which
// is the same four the send queue's own read takes.
//
// That read asks for an address as well, and this cannot: the summary carries
// no email column, and adding one would put every address on file through a
// count that only ever needed a stage. So the two figures below are the shape
// of the table waiting to be written to rather than the length of the queue
// itself, and they read high by however many of those rows the enricher has
// not found an address for yet. Said here rather than left to be worked out
// from a figure that looks exact.
const WAITING_STAGES = new Set(['enriched', 'audited', 'queued', 'unreachable'])

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX = 254

// Whether a business has a site of its own is what its audit score means and
// what its missing audit score means, so site_kind rides on the table row as
// well as the profile. The website travels with it, because a row written
// before that column existed is read by the host it listed instead.
//
// source, rating_count and business_status travel for the same reason one step
// on. What puts a business in front of the send queue is no longer its score
// alone: a business that ran the speed check on its own site asked for the
// reading itself, and a listing carrying almost no reviews is one that has not
// been trading long or has never been seen. Both of those are read off the row
// rather than stored as a verdict on it, so a table handed the score and
// nothing else can only draw every row as an ordinary one, and the strongest
// leads on the page would be the ones it drew flattest.
const PROSPECT_ROW =
  'id, name, town, trade, stage, audit_score, website, site_kind, contacted_at, replied_at, ' +
  'source, rating_count, business_status'
// The letter the business holds rides on the profile, since the profile is
// where what has been sent to one business is read. Without it that panel
// reports every business as having been given no letter, however many it has
// been sent.
const PROSPECT_FULL =
  'id, place_id, source, source_ref, name, address, phone, website, site_kind, town, trade, email, ' +
  'email_source, email_verdict, email_check_reason, email_checked_at, audit_score, ' +
  'audit_at, stage, contacted_at, replied_at, bounced_at, skip_reason, created_at, updated_at, ' +
  'rating, rating_count, business_status, variant_id'
// intent and intent_phrase are the whole account of why an address was
// suppressed, so they are read with the message rather than left in the table
// where nothing looks at them.
const MESSAGE_COLUMNS =
  'id, direction, subject, body_text, from_address, to_address, status, intent, variant_id, ' +
  'intent_phrase, provider_id, error, sent_at, created_at, ' +
  'opened_at, last_open_at, open_count, clicked_at, last_click_at, click_count, ' +
  'enquired_at, last_enquiry_at, enquiry_count'
// What a message looks like in a list of them across every business. The
// bodies are left out: the mail view says who is being written to and when,
// and the wording of one message is read on that business's own profile.
const OUTBOX_COLUMNS =
  'id, prospect_id, subject, from_address, to_address, status, error, sent_at, created_at, ' +
  'variant_id, opened_at, last_open_at, open_count, clicked_at, last_click_at, click_count, ' +
  'enquired_at, last_enquiry_at, enquiry_count'
// The chain's own column, read with a message only once it is there to read.
const withStep = (columns, ready) => (ready ? `${columns}, step` : columns)
const SETTINGS_COLUMNS =
  'id, sourcing_enabled, sending_enabled, daily_cap, towns, trades, from_name, ' +
  'from_address, updated_at, ramp_enabled, ramp_floor, ramp_stepped_on, ramp_halted_at, ' +
  'ramp_halted_reason'
// note is what a run says about itself where the counts cannot. The ramp holds
// on most days and a hold with no sentence beside it is indistinguishable from
// a job that did nothing.
const RUN_COLUMNS = 'id, job, started_at, finished_at, examined, changed, error, note'

/**
 * What the controls read as before anything has been saved. Both switches are
 * off, so a database with no settings row sends nothing and sources nothing.
 */
const SETTINGS_DEFAULT = {
  id: 1,
  sourcing_enabled: false,
  sending_enabled: false,
  daily_cap: 5,
  towns: [],
  trades: [],
  from_name: '',
  from_address: '',
  updated_at: null,
  ramp_enabled: true,
  ramp_floor: 0,
  ramp_stepped_on: null,
  ramp_halted_at: null,
  ramp_halted_reason: null,
}

const NO_TABLES =
  'The outreach tables are not in this database yet. Apply the outreach migration to the ' +
  'project, then reload this section.'

/** Postgres and PostgREST each have their own way of saying a table is absent. */
function absent(error) {
  const code = error?.code || ''
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST106') return true
  return /does not exist|could not find the table/i.test(error?.message || '')
}

/** What is said when the board itself will not come back. */
const BOARD_UNREAD = 'The outreach board could not be read. Try again in a moment.'

/** What is said when taking a business off the list does not go through. */
const SKIP_FAILED = 'That prospect could not be skipped. Try again in a moment.'

/** What is said when a business typed in by hand does not go on. */
const ADD_FAILED = 'That business could not be added. Try again in a moment.'

/** What is said when a change to a letter does not stick. */
const VARIANT_FAILED = 'That letter could not be saved. Try again in a moment.'

/**
 * The answer a failed read becomes: a missing table names itself, the rest report.
 *
 * The missing table is the one fault worth naming outright, because the repair
 * is a migration and nothing in a general sentence points at one. Everything
 * else Postgres says names columns and constraints and goes to the log, where
 * it is what we need to find the cause; `said` names whichever thing on the
 * board did not happen.
 */
function refusal(error, said = BOARD_UNREAD) {
  if (absent(error)) return { status: 503, body: { error: NO_TABLES } }
  console.error('outreach-admin: %s', error?.message || error)
  return { status: 500, body: { error: said } }
}

/** The address as it is stored: trimmed and lowercased, or null if it is not one. */
function address(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email.length <= EMAIL_MAX && EMAIL.test(email) ? email : null
}

/**
 * The characters a name search is worth running on.
 *
 * The rest are dropped rather than escaped, because the search reaches
 * PostgREST as one `or` expression and a comma or a bracket inside the term
 * would be read as part of that expression rather than as part of the name.
 */
function term(value) {
  const search = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return search.replace(/[^a-z0-9 &.'/-]/g, '').slice(0, 120) || null
}

/** A page number, floored at the first page and capped short of a full scan. */
function pageOf(value) {
  const page = Number.parseInt(value, 10)
  if (!Number.isFinite(page) || page < 0) return 0
  return Math.min(page, PAGE_MAX)
}

/** A boolean as sent, or undefined where the field is not part of this write. */
function flag(value) {
  return typeof value === 'boolean' ? value : undefined
}

/**
 * A whole number of sends a day.
 *
 * There is no ceiling. What a mailbox can carry is a judgement about the
 * receiving side rather than a fact this route knows, so it is taken in the
 * console and this only checks the figure is a number of messages: a whole one,
 * and not a negative. The integer check is what refuses the text and the
 * fractions a number field will still hand over.
 */
function capOf(value) {
  if (value === undefined || value === null || value === '') return undefined
  const cap = Number(value)
  if (!Number.isInteger(cap) || cap < 0) return null
  return cap
}

/** A text[] column as a list of distinct, trimmed, capped entries. */
function listOf(value) {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) return null
  const entries = []
  for (const item of value) {
    const name = field(item, 120)
    if (name && !entries.includes(name)) entries.push(name)
  }
  return entries.length > LIST_MAX ? null : entries
}

/** The settings row, or the defaults a database with no row behaves as. */
async function settings(db) {
  const { data, error } = await db
    .from('outreach_settings')
    .select(SETTINGS_COLUMNS)
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  if (!data) return { ...SETTINGS_DEFAULT }
  return {
    ...SETTINGS_DEFAULT,
    ...data,
    towns: data.towns || [],
    trades: data.trades || [],
  }
}

/**
 * The recent runs of every job, read one job at a time.
 *
 * A single read over the whole table ordered by time would answer with the
 * busiest job's runs and nothing else, which hides the job that stopped -
 * which is the one worth seeing.
 */
async function runs(db) {
  const reads = await Promise.all(
    JOBS.map(job =>
      db
        .from('outreach_runs')
        .select(RUN_COLUMNS)
        .eq('job', job)
        .order('started_at', { ascending: false })
        .limit(RUNS_PER_JOB)
    )
  )
  const history = {}
  for (let index = 0; index < JOBS.length; index += 1) {
    if (reads[index].error) throw reads[index].error
    history[JOBS[index]] = reads[index].data
  }
  return history
}

/** The stage, town, trade and name filters, applied to whichever read is being built. */
function narrow(rows, query) {
  const stage = STAGES.includes(query.stage) ? query.stage : null
  const town = field(query.town, 120)
  const trade = field(query.trade, 120)
  const search = term(query.search)
  if (stage) rows = rows.eq('stage', stage)
  if (town) rows = rows.eq('town', town)
  if (trade) rows = rows.eq('trade', trade)
  if (search) rows = rows.or(`name.ilike.%${search}%,address.ilike.%${search}%`)
  return rows
}

/**
 * One page of prospects ordered best lead first, or narrowed to one band.
 *
 * Neither the band nor that ordering is a column. A business whose only
 * presence is a social profile carries no score and is the strongest lead
 * there is, so both are worked out from the row rather than read off it, which
 * means the database cannot do the ordering or the narrowing. The keys are
 * read under the same filters the page is, ranked here, and the page's rows
 * fetched by id.
 *
 * The key read is capped where the summary is, and pages up to that cap
 * rather than taking whatever one answer carries. A filter selecting more than
 * the cap is ranked over the newest SUMMARY_LIMIT of it, and `matching` is
 * what was ranked rather than what the filter selects, so the last page holds
 * rows rather than nothing.
 */
async function byOpportunity(db, query, { band, sort, page }) {
  const keys = await readAll(
    () =>
      narrow(
        db
          .from('outreach_prospects')
          .select('id, audit_score, website, site_kind, created_at')
          .order('created_at', { ascending: false }),
        query
      ),
    { max: SUMMARY_LIMIT }
  )

  const ranked = band ? keys.rows.filter(row => opportunityBand(row) === band) : [...keys.rows]
  // The key read already arrives newest first, so that ordering is what is
  // left alone and the other is sorted for. Two prospects in the same shape
  // are still ordered by when they were found.
  if (sort === 'opportunity') {
    ranked.sort(
      (one, other) =>
        opportunityRank(one) - opportunityRank(other) ||
        new Date(other.created_at) - new Date(one.created_at)
    )
  }

  const from = page * PAGE_SIZE
  const ids = ranked.slice(from, from + PAGE_SIZE).map(row => row.id)
  if (!ids.length) return { rows: [], matching: ranked.length, page, size: PAGE_SIZE }

  const rows = await db.from('outreach_prospects').select(PROSPECT_ROW).in('id', ids)
  if (rows.error) throw rows.error
  const found = new Map(rows.data.map(row => [row.id, row]))
  return {
    rows: ids.map(id => found.get(id)).filter(Boolean),
    matching: ranked.length,
    page,
    size: PAGE_SIZE,
  }
}

/** One page of prospects under the filter, and how many the filter selects. */
async function prospects(db, query) {
  const page = pageOf(query.page)
  const band = OPPORTUNITY_BANDS.includes(query.band) ? query.band : null
  const sort = query.sort === 'opportunity' ? 'opportunity' : 'newest'
  if (band || sort === 'opportunity') return byOpportunity(db, query, { band, sort, page })

  const from = page * PAGE_SIZE
  const rows = await narrow(
    db
      .from('outreach_prospects')
      .select(PROSPECT_ROW, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    query
  )
  if (rows.error) throw rows.error
  return { rows: rows.data, matching: rows.count ?? 0, page, size: PAGE_SIZE }
}

/**
 * Everything above the table: the stage counts, the day's sending against the
 * cap, how many have replied, the settings, and each job's recent runs.
 *
 * The counts are read over the whole table rather than over the filter,
 * because how many prospects are queued is the same figure whatever the table
 * below happens to be showing.
 *
 * Every figure that can be a count is one: a count is exact however large the
 * table is and no rows travel for it. The breakdown cannot be, because which
 * band a prospect sits in is worked out from the row rather than stored on it,
 * so that read pages the table up to the ceiling and reports how far it got.
 */
async function board(db, query) {
  // The same midnight the sender counts its cap against. Counted from a UTC
  // one instead, the board and the job disagree for the six hours either side
  // of it: the board reports a day's sending that has not happened yet, or
  // none of the sending that has.
  const since = dayStartsAt()
  const [page, summary, total, today, contacted, replied, rotation, saved, history, stored] =
    await Promise.all([
      prospects(db, query),
      readAll(
        () =>
          db
            .from('outreach_prospects')
            .select(
              'stage, town, trade, audit_score, website, site_kind, source, rating_count, ' +
                'business_status'
            ),
        { max: SUMMARY_LIMIT }
      ),
      countOf(db.from('outreach_prospects').select('id', { count: 'exact', head: true })),
      countOf(
        db
          .from('outreach_prospects')
          .select('id', { count: 'exact', head: true })
          .gte('contacted_at', since)
      ),
      countOf(
        db
          .from('outreach_prospects')
          .select('id', { count: 'exact', head: true })
          .not('contacted_at', 'is', null)
      ),
      countOf(
        db
          .from('outreach_prospects')
          .select('id', { count: 'exact', head: true })
          .not('replied_at', 'is', null)
      ),
      // The rotation: every business standing at 'contacted' with a date to
      // hear from the studio again. A reply, an opt-out or a bounce moves the
      // stage, and the end of a chain takes the date away, so this counts the
      // businesses actually due another letter rather than everyone ever
      // written to.
      countOf(
        db
          .from('outreach_prospects')
          .select('id', { count: 'exact', head: true })
          .eq('stage', 'contacted')
          .not('next_due_at', 'is', null)
      ),
      settings(db),
      runs(db),
      variantSettings(db),
    ])

  const counts = Object.fromEntries(STAGES.map(name => [name, 0]))
  // Prospects that have been scored and not yet written to, whose sites are
  // slow enough to be worth writing about. It is counted at the audited stage
  // alone because a strong lead already queued or contacted is work that has
  // been done rather than work waiting to be done.
  let strong = 0
  // How much of the waiting table would be sent ahead of every measured site,
  // and how much of it reads as a business that has not been trading long.
  //
  // Both are counted off the row rather than stored on it, the same way the
  // strong figure above is, and both are counted over the businesses still owed
  // a first letter for the same reason: a lead already written to is work that
  // has been done. The ahead figure is `ranksAhead` rather than a second list
  // of the reasons a row jumps the queue, so the console cannot end up
  // reporting a promotion the sender does not make, or missing one it does.
  let ahead = 0
  let young = 0
  for (const row of summary.rows) {
    if (row.stage in counts) counts[row.stage] += 1
    if (row.stage === 'audited' && opportunityBand(row) === 'strong') strong += 1
    if (!WAITING_STAGES.has(row.stage)) continue
    if (ranksAhead(row)) ahead += 1
    if (isYoung(row)) young += 1
  }
  const towns = [...new Set(summary.rows.map(row => row.town).filter(Boolean))].sort()
  const trades = [...new Set(summary.rows.map(row => row.trade).filter(Boolean))].sort()

  return {
    status: 200,
    body: {
      generated_at: new Date().toISOString(),
      total,
      // How many rows the breakdown above was taken over, which is every row
      // unless the table is past the ceiling. A console comparing it against
      // the total is what tells a reader the stages are a sample.
      summarised: summary.rows.length,
      counts,
      strong_leads: strong,
      ahead_leads: ahead,
      young_leads: young,
      towns,
      trades,
      contacted_today: today,
      contacted_ever: contacted,
      rotation,
      replied,
      reply_rate: contacted ? (replied / contacted) * 100 : null,
      day_started_at: since,
      settings: saved,
      runs: history,
      variants: describeVariants(stored),
      prospects: page.rows,
      matching: page.matching,
      page: page.page,
      size: page.size,
    },
  }
}

/** One business in full, with every message to and from it, oldest first. */
async function prospect(db, query) {
  const id = uuid(query.id)
  if (!id) return { status: 400, body: { error: 'Pick a prospect to open.' } }

  // The chain's own columns are read with the business only once they are
  // there to read, the same way the messages under it are.
  const ready = await followUpColumns(db)
  const found = await db
    .from('outreach_prospects')
    .select(ready ? `${PROSPECT_FULL}, step, next_due_at` : PROSPECT_FULL)
    .eq('id', id)
    .maybeSingle()
  if (found.error) throw found.error
  if (!found.data) return { status: 404, body: { error: 'That prospect is no longer on file.' } }

  const messages = await db
    .from('outreach_messages')
    .select(withStep(MESSAGE_COLUMNS, ready))
    .eq('prospect_id', id)
    .order('created_at', { ascending: true })
  if (messages.error) throw messages.error

  return {
    status: 200,
    body: {
      generated_at: new Date().toISOString(),
      prospect: found.data,
      messages: messages.data,
    },
  }
}

/** The businesses behind a set of messages, by id. */
async function namesFor(db, prospectIds) {
  if (!prospectIds.length) return new Map()
  const { data, error } = await db
    .from('outreach_prospects')
    .select('id, name, town, trade')
    .in('id', prospectIds)
  if (error) throw error
  return new Map(data.map(row => [row.id, row]))
}

/**
 * Who hears from the studio next, and who heard from it last.
 *
 * The queue ahead is worked out rather than read: nothing stores a pending
 * message, and a prospect at the 'queued' stage is a claim left by a run that
 * did not come back rather than a message waiting to go. So the order comes
 * from the same module the send job takes it from, and what this view adds is
 * the clock - the day's cap is spread across the sending window, so each place
 * in the queue has a time attached to it.
 *
 * A slot already past is one the next run catches up on, which is why the time
 * is given as the moment it was due rather than as a countdown. That holds only
 * while a next run is still coming; once the window's last run has fired, the
 * day has no time left to give and none is given.
 *
 * Only the head of the queue carries a time. Beyond the day's cap there is no
 * schedule to give: what goes tomorrow depends on what is found today.
 */
async function mail(db) {
  const saved = await settings(db)
  const cap = saved.daily_cap ?? 0
  const window = sendWindow()
  // Whether the chain's columns are in the database yet. Until they are, every
  // message is a first letter and the view says nothing about the chain
  // rather than nought.
  const ready = await followUpColumns(db)
  const outbox = withStep(OUTBOX_COLUMNS, ready)
  const now = new Date()

  // The line is worked out as though the switches were open. A reader asking
  // who hears from the studio next is asking about the order of the line, and
  // a line computed with sending closed drops every business whose message is
  // already written - which are the ones nearest the front of it. Whether
  // anything is actually leaving right now is said beside the list instead.
  const [
    planned,
    already,
    everySent,
    bounces,
    gone,
    written,
    stored,
    followUpsDue,
    owed,
    went,
    given,
  ] = await Promise.all([
    plannedQueue(db, true),
    // What the cap has been spent on today: first letters alone, since the
    // follow-ups run outside it.
    sentToday(db, { firstOnly: ready }),
    sentToday(db),
    bounceRecord(db),
    db
      .from('outreach_messages')
      .select(outbox)
      .eq('direction', 'outbound')
      .in('status', ['sent', 'failed', 'bounced'])
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(MAIL_BEHIND),
    db
      .from('outreach_messages')
      .select(outbox)
      .eq('direction', 'outbound')
      .in('status', ['sent', 'failed', 'bounced'])
      .order('created_at', { ascending: false })
      .limit(MAIL_BEHIND),
    variantSettings(db),
    // Businesses owed a follow-up now, and the head of that line.
    ready
      ? countOf(
          db
            .from('outreach_prospects')
            .select('id', { count: 'exact', head: true })
            .eq('stage', 'contacted')
            .not('next_due_at', 'is', null)
            .lte('next_due_at', now.toISOString())
        )
      : null,
    ready ? dueFollowUps(db, now, MAIL_AHEAD) : [],
    // Every message that left, with the id it was written under and what came
    // back, read whole rather than counted per variant: one paged read against
    // a dozen counts, and the tally is a few lines over it. An inquiry is on
    // the message because it is matched on the tag the message's link carried.
    readAll(
      () =>
        db
          .from('outreach_messages')
          .select('variant_id, opened_at, clicked_at, enquired_at')
          .eq('direction', 'outbound')
          .eq('status', 'sent'),
      { max: SUMMARY_LIMIT }
    ),
    // Every business holding an id, with whether it wrote back. A reply is on
    // the business because the mailbox matches one on the address it came
    // from. A holdout has no messages to count, so this is the whole of its
    // row, and beside a variant it says how many were given the message
    // against how many it reached.
    readAll(
      () =>
        db
          .from('outreach_prospects')
          .select('variant_id, replied_at')
          .not('variant_id', 'is', null),
      { max: SUMMARY_LIMIT }
    ),
  ])
  if (gone.error) throw gone.error
  if (written.error) throw written.error

  // Two windows rather than one, because the two orders disagree. The last
  // messages to leave are not the last to have been written, and a message
  // that failed has no sending time at all, so a single window on either
  // column drops rows the other one holds. Merged and cut to one window, the
  // page is the last MAIL_BEHIND messages by the time each of them shows.
  const behind = new Map()
  for (const row of [...gone.data, ...written.data]) behind.set(row.id, row)
  const recent = [...behind.values()]
    .sort((one, two) => wentAt(two) - wentAt(one))
    .slice(0, MAIL_BEHIND)

  // A slot is the moment a message is actually going out at, so one is only
  // given while the day can still reach it. After the last run of the window
  // every remaining slot is a time that has been and gone, and handing those
  // over draws a queue of businesses all marked due now against a day that will
  // send none of them. Past the cap there was never a time to give either, and
  // an empty grid says the same thing here for the same reason: the list is the
  // order these are heard from in, and tomorrow is when.
  const slots = reachesMore() ? slotsAt(cap) : []
  const ahead = planned.queue.slice(0, MAIL_AHEAD).map((prospect, place) => {
    const written = planned.messages.get(prospect.id)
    return {
      prospect_id: prospect.id,
      name: prospect.name,
      town: prospect.town,
      trade: prospect.trade,
      to_address: String(prospect.email ?? '').toLowerCase(),
      subject: written?.subject ?? null,
      status: written?.status ?? null,
      audit_score: prospect.audit_score,
      site_kind: prospect.site_kind,
      segment: segmentOf(prospect),
      // The letter, where one has been settled: a draft names the one it was
      // written under, and a business holding one keeps it. A draft written
      // before the letters existed names none and is written again under one
      // when it goes, so it says so rather than naming the old opener.
      variant_id: written?.variant_id ?? prospect.variant_id ?? null,
      step: 1,
      due_at: slots[already + place] ?? null,
    }
  })

  // The businesses owed a follow-up now, longest waiting first, with the step
  // each is owed and whether the chain has a letter for it. The letter itself
  // is drawn by the shares when it goes, so none is named here.
  const registry = withSettings(VARIANTS, stored)
  const firsts = await firstMessages(
    db,
    owed.map(row => row.id)
  )
  const chain = owed.map(prospect => {
    const step = (prospect.step ?? 1) + 1
    const segment = segmentOf(prospect)
    return {
      prospect_id: prospect.id,
      name: prospect.name,
      town: prospect.town,
      trade: prospect.trade,
      to_address: String(prospect.email ?? '').toLowerCase(),
      audit_score: prospect.audit_score,
      site_kind: prospect.site_kind,
      segment,
      step,
      due_at: prospect.next_due_at,
      first_subject: firsts.get(prospect.id)?.subject ?? null,
      // What the console shows as the end of a chain is the same question the
      // run asks: whether anything live is left, not whether words exist.
      ends: !liveAhead(registry, segment, step, familyHeld(prospect, registry)),
    }
  })

  const names = await namesFor(db, [...new Set(recent.map(row => row.prospect_id))])

  // What went out under each letter, and the same counts summed per family.
  const letters = variantResults(everything(stored), went.rows, given.rows)

  // What has been read and followed, over every message that ever went out
  // rather than over the page of them shown. A rate taken across the last
  // twenty-five is a rate that swings on one reader.
  const [delivered, opened, clicked, enquired] = await Promise.all([
    countOf(
      db
        .from('outreach_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .eq('status', 'sent')
    ),
    countOf(
      db
        .from('outreach_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .not('opened_at', 'is', null)
    ),
    countOf(
      db
        .from('outreach_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .not('clicked_at', 'is', null)
    ),
    countOf(
      db
        .from('outreach_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .not('enquired_at', 'is', null)
    ),
  ])

  return {
    status: 200,
    body: {
      generated_at: new Date().toISOString(),
      sending: {
        enabled: Boolean(saved.sending_enabled),
        armed: ARMED,
        open: window.open,
        reason: window.reason,
        // Whether a run is still coming today. `open` answers for this moment
        // and turns false every evening whether or not the day finished its
        // list, so it cannot tell a queue waiting for the next run from one
        // waiting for the morning. This is the half the list is drawn against.
        reaches: reachesMore(),
      },
      cap,
      sent_today: already,
      // What left today beyond the cap: the follow-ups, once the chain runs.
      follow_ups_today: ready ? Math.max(everySent - already, 0) : null,
      bounces,
      reach: {
        sent: delivered,
        opened,
        clicked,
        enquired,
        open_rate: delivered ? (opened / delivered) * 100 : null,
        click_rate: delivered ? (clicked / delivered) * 100 : null,
        enquiry_rate: delivered ? (enquired / delivered) * 100 : null,
      },
      next: ahead,
      next_total: planned.queue.length,
      follow_ups: chain,
      follow_ups_due: followUpsDue,
      // One row per letter rather than one per registration. The ledger is
      // kept per id because an id is what a message stores, and read per
      // letter because a letter is what a person is looking at.
      results: lettersByName(letters),
      past: recent.map(row => ({
        ...row,
        name: names.get(row.prospect_id)?.name ?? null,
        town: names.get(row.prospect_id)?.town ?? null,
      })),
    },
  }
}

/**
 * A variant as the console reads it: what the registry says it is, what the
 * console has set it to, and never the opener itself.
 */
function describeVariant(variant, stored) {
  return {
    id: variant.id,
    name: variant.name,
    about: variant.about ?? null,
    segment: variant.segment,
    family: variant.holdout ? null : (variant.family ?? null),
    plain: Boolean(variant.plain),
    step: variant.step ?? 1,
    // Whether the letter stands at every step from its own onwards. The letter
    // that sends does, and without this the console reads `step` as the one
    // step it is registered at and reports every reminder in the queue as
    // having no letter switched on for it.
    repeats: Boolean(variant.repeats),
    status: variant.status,
    weight: variant.weight,
    needs: [...variant.needs],
    condition: variant.condition ?? null,
    holdout: Boolean(variant.holdout),
    updated_at: stored?.updated_at ?? null,
  }
}

/**
 * Every variant and every holdout as the console reads them, with what is
 * stored laid over the registry.
 */
function describeVariants(rows) {
  const stored = new Map(rows.map(row => [row.id, row]))
  return [...withSettings(VARIANTS, rows), ...withSettings(HOLDOUTS, rows)].map(variant =>
    describeVariant(variant, stored.get(variant.id))
  )
}

/** The variants and the holdouts together, as the console has set them. */
const everything = rows => [...withSettings(VARIANTS, rows), ...withSettings(HOLDOUTS, rows)]

/**
 * What went out under each variant, and what came back.
 *
 * One row per variant and per holdout in the registry's order, counted over
 * every message that actually left and every business given the id, followed
 * by a row for each id the registry no longer knows and one for the messages
 * sent before any id was recorded, each only where it has something to count.
 * A holdout's row is the businesses held out and nothing else, since nothing
 * was sent to them: that is the floor.
 *
 * Four things come back. An open and a click are on the message, read off its
 * own picture and its own link. An inquiry is on the message too, matched on
 * the tag the link carried into the site. A reply is on the business, matched
 * by the mailbox on the address it came from. The last two are the ones a
 * decision would turn on, and the rates are all against what was sent, so a
 * row reads the same way across.
 *
 * The counts are the whole of it: no row is named the better one, because
 * under the daily cap the volume that would settle that is months away and a
 * verdict here would invite a decision the numbers cannot carry.
 *
 * This is the ledger, keyed on the id a message actually stores. What the
 * console shows is `lettersByName` over it, since a letter registered once per
 * segment is one letter and not five.
 *
 * @param {ReadonlyArray<object>} variants The variants and the holdouts, as
 *   the console has set them.
 * @param {Array<{variant_id: string|null, opened_at: string|null, clicked_at: string|null, enquired_at?: string|null}>} messages
 *   Every outbound message that was sent.
 * @param {Array<{variant_id: string, replied_at?: string|null}>} [prospects]
 *   Every business holding an id, whatever became of it after.
 */
export function variantResults(variants, messages, prospects = []) {
  const buckets = new Map()
  const bucket = id => {
    const key = id ?? ''
    if (!buckets.has(key)) {
      buckets.set(key, { assigned: 0, sent: 0, opened: 0, clicked: 0, replied: 0, enquired: 0 })
    }
    return buckets.get(key)
  }
  for (const row of prospects) {
    if (!row.variant_id) continue
    const counts = bucket(row.variant_id)
    counts.assigned += 1
    if (row.replied_at) counts.replied += 1
  }
  for (const row of messages) {
    const counts = bucket(row.variant_id)
    counts.sent += 1
    if (row.opened_at) counts.opened += 1
    if (row.clicked_at) counts.clicked += 1
    if (row.enquired_at) counts.enquired += 1
  }

  const rate = (part, whole) => (whole && part !== null ? (part / whole) * 100 : null)
  const result = (about, counts) => ({
    ...about,
    ...counts,
    open_rate: rate(counts.opened, counts.sent),
    click_rate: rate(counts.clicked, counts.sent),
    reply_rate: rate(counts.replied, counts.sent),
    enquiry_rate: rate(counts.enquired, counts.sent),
  })

  const rows = variants.map(variant => result(describeVariant(variant), bucket(variant.id)))
  const known = new Set(variants.map(variant => variant.id))
  const gone = id => ({
    id,
    name: null,
    about: null,
    segment: null,
    // A letter the registry has forgotten belongs to no family it can name,
    // so its counts stand in their own row and join neither side's total.
    family: null,
    plain: false,
    step: null,
    repeats: false,
    status: null,
    weight: null,
    needs: [],
    condition: null,
    holdout: isHoldoutId(id),
  })
  for (const [id, counts] of buckets) {
    if (id === '' || known.has(id) || !(counts.sent || counts.assigned)) continue
    rows.push(result(gone(id), counts))
  }
  // Nothing was assigned before ids were, so the row for the messages sent
  // then has no count of businesses to show, and no count of replies, which
  // are read off the business.
  const before = buckets.get('')
  if (before?.sent) rows.push(result(gone(null), { ...before, assigned: null, replied: null }))
  return rows
}

/** The counts one letter's row carries, which are the ones that sum. */
const COUNTED = ['assigned', 'sent', 'opened', 'clicked', 'replied', 'enquired']

/**
 * The per-variant ledger rolled up to one row per letter.
 *
 * The registry holds one entry per letter per segment, and the letter that
 * sends says the same thing to every segment, so five rows under one name are
 * five ways of reading one letter - each of them a fifth of what it actually
 * did. The Letters view lists one row per name for that reason; this is the
 * same list with the counts summed, so a figure here is the whole of it.
 *
 * The row keeps the first registration's id, which is what a name opens on,
 * and names the rest in `ids` and the kinds they were registered against in
 * `segments`, so nothing about what it covers is lost. A row the registry no
 * longer knows has no name to roll under and stands on its own, as does the
 * row for the messages sent before any id was recorded.
 *
 * @param {ReadonlyArray<object>} rows The per-variant rows.
 * @returns {Array<object>} One row per letter, in the order the names first
 *   appear.
 */
export function lettersByName(rows) {
  const under = new Map()
  const order = []
  for (const row of rows) {
    // An id nothing knows, and the row for the messages sent before ids were,
    // both arrive without a name and are carried through as they stand.
    if (!row.name) {
      order.push({
        ...row,
        ids: row.id ? [row.id] : [],
        segments: row.segment ? [row.segment] : [],
      })
      continue
    }
    const held = under.get(row.name)
    if (!held) {
      const first = { ...row, ids: [row.id], segments: row.segment ? [row.segment] : [] }
      under.set(row.name, first)
      order.push(first)
      continue
    }
    held.ids.push(row.id)
    // The kinds the letter was registered against. A row covering every one of
    // them is a letter written for everybody, which is what the letter that
    // sends is, and one covering a single kind still names that kind.
    if (row.segment && !held.segments.includes(row.segment)) held.segments.push(row.segment)
    for (const column of COUNTED) held[column] = (held[column] ?? 0) + (row[column] ?? 0)
  }

  const rate = (part, whole) => (whole && part !== null ? (part / whole) * 100 : null)
  return order.map(row => ({
    ...row,
    open_rate: rate(row.opened, row.sent),
    click_rate: rate(row.clicked, row.sent),
    reply_rate: rate(row.replied, row.sent),
    enquiry_rate: rate(row.enquired, row.sent),
  }))
}

/**
 * The business a variant is rendered against, which is a real one.
 *
 * The queue's own order is read first, and the first business in it that this
 * variant is written for, and that either holds this variant or holds none, is
 * the one the sender would actually give it to next. Where nothing is waiting,
 * the whole table is read newest first for any business that reads as the
 * segment, so a variant can be looked at before the pipeline has reached its
 * kind. A segment nobody on file is in answers with nothing rather than an
 * invented business.
 *
 * @returns {Promise<{prospect: object, queued: boolean}|null>}
 */
async function sampleFor(db, variant) {
  const waiting = await candidates(db)
  const next =
    waiting.find(row => fits(variant, row) && (!row.variant_id || row.variant_id === variant.id)) ??
    waiting.find(row => fits(variant, row)) ??
    null
  if (next) return { prospect: next, queued: true }

  const filed = await readAll(
    () =>
      db
        .from('outreach_prospects')
        .select(CANDIDATE_COLUMNS)
        .order('created_at', { ascending: false }),
    { max: SUMMARY_LIMIT }
  )
  const prospect = filed.rows.find(row => fits(variant, row)) ?? null
  return prospect ? { prospect, queued: false } : null
}

/** The answer when no business on file reads as a variant's segment. */
const NOBODY = {
  status: 404,
  body: {
    error: 'No business on file reads as that segment, so there is nothing to render it against.',
  },
}

/**
 * What a letter after the first is handed: the first letter the business
 * holds, or would be given, composed far enough to have a subject to thread
 * under. A first letter is handed nothing.
 */
function priorFor(prospect, shot, variant, registry = VARIANTS) {
  if ((variant.step ?? 1) === 1) return {}
  const first =
    registry.find(entry => entry.id === prospect.variant_id && (entry.step ?? 1) === 1) ??
    registry.find(entry => (entry.step ?? 1) === 1 && fits(entry, prospect)) ??
    null
  if (!first) return {}
  return { prior: { subject: compose(prospect, shot, null, first).subject } }
}

/**
 * One variant, rendered as it would be sent, against the business the sender
 * would give it to next.
 */
export async function preview(db, query) {
  const asked = String(query.variant ?? '')
  if (isHoldoutId(asked)) {
    return { status: 400, body: { error: 'A holdout sends nothing, so there is nothing to show.' } }
  }
  const variant = VARIANTS.find(entry => entry.id === asked)
  if (!variant) return { status: 400, body: { error: 'Pick a variant to preview.' } }

  const sample = await sampleFor(db, variant)
  if (!sample) return NOBODY
  const { prospect, queued } = sample

  const shot = await storedShot(db, prospect)
  const message = compose(prospect, shot, null, variant, priorFor(prospect, shot, variant))
  return {
    status: 200,
    body: {
      generated_at: new Date().toISOString(),
      variant: variant.id,
      prospect: {
        id: prospect.id,
        name: prospect.name,
        town: prospect.town,
        trade: prospect.trade,
        segment: segmentOf(prospect),
        queued,
      },
      subject: message.subject,
      html: message.html,
      text: message.text,
    },
  }
}

// The reads a GET may ask for by name. Anything else is the board, which is
// what the console opens the section on.
const VIEWS = { prospect, mail, preview }

/**
 * The switches, the cap and the lists, written one field at a time.
 *
 * A write carries only what it changes. The row is upserted rather than
 * updated so a database whose settings row has never been written still takes
 * the first change made to it.
 */
async function saveSettings(db, body) {
  const patch = {}

  const sourcing = flag(body.sourcing_enabled)
  if (sourcing !== undefined) patch.sourcing_enabled = sourcing
  const sending = flag(body.sending_enabled)
  if (sending !== undefined) patch.sending_enabled = sending

  // Switching the ramp back on is the only way past a rollback, which is the
  // point of a rollback: it records that the climb stopped and why, and every
  // run after it holds against that record rather than starting again on its
  // own. So turning it on clears the halt, and turning it off leaves the halt
  // where it is - a person switching the ramp off is not saying the bounces
  // were fine.
  const ramp = flag(body.ramp_enabled)
  if (ramp !== undefined) {
    patch.ramp_enabled = ramp
    if (ramp) {
      patch.ramp_halted_at = null
      patch.ramp_halted_reason = null
    }
  }

  const cap = capOf(body.daily_cap)
  if (cap === null) {
    return { status: 400, body: { error: 'Set the daily cap to a whole number of 0 or more.' } }
  }
  // The cap lands on the day it is typed on, whichever direction it moves.
  //
  // A raise used to be held for the morning, because a cap is the spacing as
  // much as the ceiling: the day's slots are the window divided by it, so
  // raising it once the window has opened relays the whole grid over a morning
  // already spent and the slots that land behind the clock come out at the
  // speed of a run rather than at the speed of the schedule. That is a real
  // effect and it is still what happens. It is not worth a field that refuses
  // the number typed into it - somebody raising the cap at noon is asking for
  // more mail today, and the catch-up is bounded by SEND_PER_RUN_MAX either
  // way.
  if (cap !== undefined) patch.daily_cap = cap

  for (const name of ['towns', 'trades']) {
    const entries = listOf(body[name])
    if (entries === null) {
      return {
        status: 400,
        body: { error: `Give up to ${LIST_MAX} ${name}, one per line.` },
      }
    }
    if (entries !== undefined) patch[name] = entries
  }

  if (body.from_name !== undefined) patch.from_name = field(body.from_name, 200)

  if (body.from_address !== undefined) {
    const from = field(body.from_address, EMAIL_MAX)
    if (from && !address(from)) {
      return {
        status: 400,
        body: { error: 'Enter a sending address in the form name@example.com.' },
      }
    }
    patch.from_address = from ? address(from) : null
  }

  if (!Object.keys(patch).length) {
    return { status: 400, body: { error: 'Nothing in that change was a setting.' } }
  }

  const saved = await db
    .from('outreach_settings')
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select(SETTINGS_COLUMNS)
    .maybeSingle()
  if (saved.error) {
    return refusal(saved.error, 'Those settings could not be saved. Try again in a moment.')
  }

  return { status: 200, body: { ok: true, settings: saved.data } }
}

/**
 * One business taken out of the pipeline by hand, with the reason on the row.
 *
 * An unsubscribed prospect is one a person asked to be left alone, and its
 * stage is the record of that request. Moving it to skipped would overwrite
 * that record with a reason somebody here typed, so the write refuses rather
 * than the console merely not offering it: the console is one caller of this
 * endpoint and not the only one it has to hold against.
 */
async function skip(db, body) {
  const id = uuid(body.id)
  if (!id) return { status: 400, body: { error: 'Pick the prospect to skip.' } }

  const skipped = await db
    .from('outreach_prospects')
    .update({
      stage: 'skipped',
      skip_reason: field(body.reason, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .neq('stage', 'unsubscribed')
    .select('id')
  if (skipped.error) return refusal(skipped.error, SKIP_FAILED)
  if (!skipped.data.length) {
    // Nothing was written, which is either a row that has gone or the one row
    // this refuses to touch. The second read only runs on that failure.
    const found = await db.from('outreach_prospects').select('stage').eq('id', id).maybeSingle()
    if (found.error) return refusal(found.error, SKIP_FAILED)
    if (!found.data) return { status: 404, body: { error: 'That prospect is no longer on file.' } }
    return {
      status: 409,
      body: {
        error: 'That business asked for no further contact. It stays at the unsubscribed stage.',
      },
    }
  }
  return { status: 200, body: { ok: true, skipped: id } }
}

/** A name or a town flattened to what two spellings of it have in common. */
function plain(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * The endings a business registers under and a person writing it down leaves
 * off.
 *
 * They are read as the whole of what one name has over the other rather than
 * trimmed off both. Trimming would take the last two letters off 'Baytown
 * Tobacco' on the way to comparing it with anything; this way a name only ever
 * loses an ending that is the entire difference between it and the name it is
 * being held against.
 */
const SUFFIXES = new Set([
  'co',
  'company',
  'corp',
  'corporation',
  'inc',
  'incorporated',
  'lc',
  'llc',
  'llp',
  'lp',
  'ltd',
  'limited',
  'pa',
  'plc',
  'pllc',
])

/** Whether two flattened names are one business. */
function sameName(one, other) {
  if (one === other) return one.length > 0
  const [longer, shorter] = one.length > other.length ? [one, other] : [other, one]
  if (!shorter) return false
  return longer.startsWith(shorter) && SUFFIXES.has(longer.slice(shorter.length))
}

/**
 * A typed website as the pipeline files one, or null where it is not a site.
 *
 * A person writes a site down the way it is said out loud, so a bare host is
 * read as one and given the scheme every row off the sweep already carries.
 * Anything no host can be read out of is refused rather than stored, because a
 * website that will not resolve reaches the enrichment job as a site that does
 * not load and stops the row there.
 */
function siteOf(value) {
  const typed = field(value, SITE_MAX)
  if (!typed) return undefined
  if (!hostOf(typed)) return null
  return /^https?:\/\//i.test(typed) ? typed : `https://${typed}`
}

/** What a business is recognised by, and enough of the row to say where it stands. */
const MATCH_ROW = 'id, name, town, website, stage'

/**
 * What a row put in by hand says it came from. The sweep files under 'places'
 * with the place id as its reference, and a roster would file under its own
 * name with the roster's reference; a person's row has the source and no
 * reference, because nothing typed in here is a key.
 */
const CONSOLE_SOURCE = 'console'

/**
 * The row a business being added by hand is already on file as, or null.
 *
 * Every source files its rows under a reference of its own, and a person has
 * none: a place id comes off a map result and nobody types one in. So a
 * business is looked for the three ways a person recognises one - the mailbox
 * it answers on, the site it publishes, and its name in its town - and any of
 * the three is enough.
 *
 * Each read is narrowed by something the database can match exactly, and the
 * comparison that decides is made here. It has to be: there is no normalised
 * column to match a name against, and a name is typed rather than copied off a
 * map result, so the two spellings that have to meet differ by their
 * punctuation, their case, and whether either of them carries the ending the
 * business is registered under. A name is also the one value in this request
 * that could hold a character PostgREST reads as a pattern of its own, which
 * is why what reaches the filter is the leading run of letters and digits and
 * never the name.
 *
 * A name opening on punctuation leaves the town to narrow the read by itself,
 * and a business with neither is not looked for by name at all - that read
 * would be the whole table. It is still looked for by mailbox and by site.
 */
async function alreadyOnFile(db, { email, host, name, town }) {
  if (email) {
    const seen = await db.from('outreach_prospects').select(MATCH_ROW).eq('email', email).limit(1)
    if (seen.error) throw seen.error
    if (seen.data.length) return seen.data[0]
  }

  // A host off `hostOf` is a hostname rather than anything typed, but it is
  // held to the characters one is spelled in before it is read as a pattern.
  if (host && /^[a-z0-9.-]+$/.test(host)) {
    const seen = await db
      .from('outreach_prospects')
      .select(MATCH_ROW)
      .ilike('website', `%${host}%`)
      .limit(MATCH_LIMIT)
    if (seen.error) throw seen.error
    const same = seen.data.find(row => hostOf(row.website) === host)
    if (same) return same
  }

  const prefix = (name.match(/[A-Za-z0-9]+/)?.[0] ?? '').slice(0, PREFIX_MAX)
  if (!prefix && !town) return null

  let rows = db.from('outreach_prospects').select(MATCH_ROW).limit(MATCH_LIMIT)
  if (prefix) rows = rows.ilike('name', `${prefix}%`)
  else rows = rows.eq('town', town)
  const seen = await rows
  if (seen.error) throw seen.error

  const wanted = plain(name)
  const where = plain(town)
  // A town missing on either side is not a business somewhere else. The sweep
  // fills the column from the search that produced the row, so a name added
  // without one is the same business as the row that carries one.
  const nearby = row => !where || !plain(row.town) || plain(row.town) === where
  return seen.data.find(row => sameName(plain(row.name), wanted) && nearby(row)) ?? null
}

/**
 * One business put into the pipeline by hand, at the stage the sweep leaves one.
 *
 * A referral, or a business worth writing to that no search returned, has no
 * other way in. It enters at 'found' carrying the fields a map result carries,
 * and enrichment, the address check and the audit then take it exactly as they
 * take a row the sweep filed. Nothing here stands in for any of them: the
 * verdict on a mailbox and the score on a site are readings, and a reading
 * nobody took is left null for the job that takes it.
 *
 * A business already on file is answered with the row it is already on file as,
 * and that is the whole of what a repeat add does. A row further along than
 * this form knows may have been written to, or asked to be left alone, or been
 * ruled out by the chain sweep, and none of those is a state a form with a name
 * in it should be able to undo.
 *
 * An address on the suppression list is refused outright. That list is the
 * record of somebody asking to be left alone and it is kept across every list
 * the studio holds rather than this one, so a name typed in here is exactly the
 * way back in that it exists to close.
 */
export async function addProspect(db, body) {
  const name = field(body.name, NAME_MAX)
  if (!name) return { status: 400, body: { error: 'Enter the business name.' } }

  const website = siteOf(body.website)
  if (website === null) {
    return { status: 400, body: { error: 'Enter the website as an address, like example.com.' } }
  }

  const typed = field(body.email, EMAIL_MAX)
  const email = typed ? address(typed) : null
  if (typed && !email) {
    return {
      status: 400,
      body: { error: 'Enter the contact address in the form name@example.com.' },
    }
  }

  const town = field(body.town, 120)
  const trade = field(body.trade, 120)

  try {
    if (email && (await suppressed(db, [email])).has(email)) {
      return {
        status: 409,
        body: {
          error: 'That address asked to be left alone. It stays off every list the studio holds.',
        },
      }
    }

    const already = await alreadyOnFile(db, {
      email,
      host: website ? hostOf(website) : null,
      name,
      town,
    })
    if (already) {
      return {
        status: 409,
        body: {
          error: `${already.name} is already on file at the ${already.stage} stage.`,
          prospect: { id: already.id, name: already.name, stage: already.stage },
        },
      }
    }

    const added = await db
      .from('outreach_prospects')
      .insert({
        source: CONSOLE_SOURCE,
        name,
        address: field(body.address, POSTAL_MAX),
        phone: field(body.phone, PHONE_MAX),
        website: website ?? null,
        town,
        trade,
        email,
        stage: 'found',
      })
      .select(PROSPECT_ROW)
      .maybeSingle()
    if (added.error) return refusal(added.error, ADD_FAILED)

    return { status: 200, body: { ok: true, prospect: added.data } }
  } catch (cause) {
    return refusal(cause, ADD_FAILED)
  }
}

/**
 * One variant sent to the studio's own inbox, as it would go.
 *
 * The preview shows a letter in the console; a proof puts it in a mail
 * client, which is the only place a message can be judged, with the pictures
 * fetched, the button drawn and the subject in a list. It is the same
 * composer against the same business the preview would choose, handed to the
 * same mail server the sender uses, from the same address. Nothing is
 * written: no message row, no stamp on the business, no address on any list.
 * It goes to the studio's inbox and nowhere else, whatever the body asks.
 *
 * @param {object} db A service-role client.
 * @param {{id?: string}} body
 * @param {ReadonlyArray<object>} [registry] The variants, which a check hands in.
 * @param {Function} [post] The delivery, which a check replaces.
 */
export async function proof(db, body, registry = VARIANTS, post = deliverProof) {
  const id = String(body.id ?? '')
  if (isHoldoutId(id)) {
    return { status: 400, body: { error: 'A holdout sends nothing, so there is nothing to send.' } }
  }
  const variant = registry.find(entry => entry.id === id)
  if (!variant) return { status: 400, body: { error: 'That variant is not one the sender knows.' } }

  const sample = await sampleFor(db, variant)
  if (!sample) return NOBODY
  const { prospect, queued } = sample
  const [saved, shot] = await Promise.all([settings(db), storedShot(db, prospect)])
  const message = compose(
    prospect,
    shot,
    null,
    variant,
    priorFor(prospect, shot, variant, registry)
  )
  const subject = `[Proof] ${message.subject}`

  try {
    await post({
      from: sender(saved),
      to: STUDIO_INBOX,
      subject,
      text: message.text,
      html: message.html,
    })
  } catch (cause) {
    // A proof is a diagnostic rather than a delivery. Nobody sends one except
    // to find out whether this mailbox can send at all, so what the provider
    // said - the address it would not take, the rule it broke - is the answer
    // being asked for rather than noise to be spared. It is carried here and
    // logged, and the console draws its own sentence from the status.
    //
    // It does not say to try again. A transport refusing a proof refuses the
    // next one identically until something is changed, and an instruction that
    // cannot work is worse than none.
    const said = cause?.message || String(cause)
    console.error('outreach-admin: the proof did not leave: %s', said)
    return {
      status: 502,
      body: { error: `The proof did not leave. The mail server said: ${said}` },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      variant: variant.id,
      to: STUDIO_INBOX,
      subject,
      prospect: {
        id: prospect.id,
        name: prospect.name,
        town: prospect.town,
        segment: segmentOf(prospect),
        queued,
      },
    },
  }
}

/**
 * One variant's status and weight, written and nothing else.
 *
 * The id has to be one the registry knows, because a row for a variant that
 * does not exist is a setting nothing reads. A weight is a whole number from
 * nought to WEIGHT_MAX; nought leaves a variant registered and never chosen.
 * The last variant a segment can still send under is refused a pause and a
 * weight of nought, since either empties the segment's queue without a word.
 *
 * The write is an upsert carrying only what changed, so a status alone leaves
 * the stored weight where it is and a row written for the first time takes the
 * column's own default for whatever it was not given.
 *
 * A holdout is set the same way, under its own id. It sends nothing, so it is
 * never the last thing a segment can send under and no change to it is
 * refused on that ground.
 *
 * @param {object} db A service-role client.
 * @param {object} body The request body.
 * @param {ReadonlyArray<object>} [registry] The variants, which a check hands in.
 * @param {ReadonlyArray<object>} [holdouts] The holdouts, likewise.
 */
export async function setVariant(db, body, registry = VARIANTS, holdouts = HOLDOUTS) {
  const id = String(body.id ?? '')
  const known = registry.find(entry => entry.id === id) ?? holdouts.find(entry => entry.id === id)
  if (!known) return { status: 400, body: { error: 'That variant is not one the sender knows.' } }
  // A holdout is a record of businesses that were once given no letter. The
  // sender draws nobody into one now, so a weight set here would be a switch
  // that reads as holding people back and does nothing at all.
  if (known.holdout) {
    return {
      status: 409,
      body: { error: 'Nobody is held out any more. Every business gets the introduction.' },
    }
  }

  const patch = {}
  if (body.status !== undefined) {
    if (!VARIANT_STATUSES.includes(body.status)) {
      return { status: 400, body: { error: 'Set the status to live, paused or draft.' } }
    }
    patch.status = body.status
  }
  if (body.weight !== undefined && body.weight !== null && body.weight !== '') {
    const weight = Number(body.weight)
    if (!Number.isInteger(weight) || weight < 0 || weight > WEIGHT_MAX) {
      return {
        status: 400,
        body: { error: `Set the weight to a whole number between 0 and ${WEIGHT_MAX}.` },
      }
    }
    patch.weight = weight
  }
  if (!Object.keys(patch).length) {
    return { status: 400, body: { error: 'Nothing in that change was a status or a weight.' } }
  }

  try {
    const current = withSettings(registry, await variantSettings(db))
    if (wouldEmptySegment(current, id, patch)) {
      return {
        status: 409,
        body: {
          error: `That would leave nothing live for ${known.segment} businesses, which would be skipped rather than written to. Switch Sending off in Settings to stop outreach; this switch is for taking one letter out while another still sends.`,
        },
      }
    }

    const saved = await db
      .from('outreach_variants')
      .upsert({ id, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select(VARIANT_COLUMNS)
      .maybeSingle()
    if (saved.error) return refusal(saved.error, VARIANT_FAILED)

    const row = saved.data ?? { id, ...patch }
    const variant = withSettings(known.holdout ? holdouts : registry, [row]).find(
      entry => entry.id === id
    )
    return { status: 200, body: { ok: true, variant: describeVariant(variant, row) } }
  } catch (cause) {
    return refusal(cause, VARIANT_FAILED)
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'GET or POST only' })
    return
  }

  const connected = connect()
  if (!connected) {
    response.status(500).json({
      error:
        'The outreach endpoint has no database keys. Set SUPABASE_ANON_KEY and ' +
        'SUPABASE_SERVICE_ROLE_KEY on the deployment.',
    })
    return
  }

  // The console reads the same queue the sender does, and the queue will not
  // judge a domain until the held list is loaded.
  if (!(await loadHeldDomains(connected.db))) {
    response.status(503).json({ error: 'The held-domain list could not be read.' })
    return
  }

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const caller = await authorizeAdmin(connected, authorization)
    if (caller.error) {
      response.status(caller.status).json({ error: caller.error })
      return
    }

    let answer
    if (request.method === 'GET') {
      const query = request.query ?? {}
      // Every read that touches the four tables answers with the same sentence
      // when they are not there, rather than each caller reading a driver
      // message and guessing what it meant.
      try {
        const read = VIEWS[query.view] ?? board
        answer = await read(connected.db, query)
      } catch (cause) {
        answer = refusal(cause)
      }
    } else {
      const body = request.body ?? {}
      const action = String(body.action ?? '')
      if (action === 'settings') answer = await saveSettings(connected.db, body)
      else if (action === 'skip') answer = await skip(connected.db, body)
      else if (action === 'add') answer = await addProspect(connected.db, body)
      else if (action === 'variant') answer = await setVariant(connected.db, body)
      else if (action === 'proof') answer = await proof(connected.db, body)
      else answer = { status: 400, body: { error: 'Unknown action.' } }
    }

    response.status(answer.status).json(answer.body)
  } catch {
    response.status(502).json({ error: 'The outreach endpoint did not answer.' })
  }
}
