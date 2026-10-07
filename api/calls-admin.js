/**
 * The call list: every business the email pipeline cannot reach, what each is
 * worth ringing, when it comes back round after a call, and the record of what
 * every call came to.
 *
 * The sender ends at an email address and about a fifth of the map sweep has
 * none to end at - the listing names no website, or names a Facebook page or a
 * Square booking page whose only published address belongs to the platform.
 * Those rows stop at 'unreachable' and the pipeline is finished with them.
 * Every one of them still carries the phone number the Places search returned,
 * and a business with no website of its own is the strongest lead the table
 * holds. This is the section that dials them.
 *
 * The whole callable set is ranked on every request rather than a page of it,
 * and that is unavoidable. The ordering is not a column: a business's place is
 * a score built from its review count against the middle count for its own
 * trade, and a middle taken over one page is a different number on every page.
 * So the ranking happens where the set already is - `call_list_page` in the
 * database takes the middle, scores and orders every callable row, and cuts
 * the page. One bounded round trip, and what travels back is the page.
 *
 * It used to be read out here instead, and the set outgrew that: a thousand
 * rows is all one answer carries, so nearly four thousand businesses of wide
 * columns became four seven-hundred-kilobyte requests gathered together, each
 * under its own deadline. One of them queued past ten seconds discarded the
 * three that had arrived and failed the whole read, which is what the console
 * showed as a server error on a list the database can rank in milliseconds.
 *
 * Two verbs. GET answers the list, or with `photos` naming a business, that
 * business's photos off its Google listing. POST records one call - an outcome,
 * a note in whoever's own words, and a time to ring back where one was named.
 * Nothing composes a note, and nothing sends anything: the whole point of this
 * section is that a person picks up a phone.
 *
 * A recorded call also settles who the business belongs to, where nobody holds
 * it yet. That write is here rather than anywhere else because it is the same
 * event - somebody rang them - and doing it in a second request would leave
 * the two able to disagree.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeCaller, connect } from '../lib/db/clients.js'
import { tableMissing } from '../lib/db/rows.js'
import { field, uuid } from '../lib/db/fields.js'
import { TRADE_ALIASES, sharesTrade } from '../lib/outreach/message.js'
import { SOURCES, SPINE, keepLead } from '../lib/leads/spine.js'
import { PORTFOLIO_PROJECTS } from '../src/app/data/portfolio.js'
import {
  ASSIGNED_STANDINGS,
  callMakesLead,
  callPlace,
  defaultCallbackAt,
  interestIn,
  isCallable,
  outcomeAsksInterest,
  outcomeEnds,
  outcomeTakesCallback,
  OUTCOME_IDS,
  ownerOf,
  promiseOf,
  pullBand,
  pullOf,
  readyAt,
  scoreOf,
  triesRun,
} from '../lib/outreach/prospects/calls.js'
import { BOOKING_HOSTS, PLATFORM_HOSTS, PORTAL_HOSTS } from '../lib/outreach/prospects/platforms.js'
// The page sizes, the score floors and the orders are the ones a caller's saved
// setup is held to, and they are read from that module rather than written out
// again here. Two copies is how an endpoint quietly refuses a value the desk
// has already stored for somebody, and the list comes back exactly as it was.
import {
  CALL_SCORE_FLOORS,
  CALL_TAKES,
  DEFAULT_SORT,
  DEFAULT_TAKE,
  SORT_IDS,
} from '../lib/outreach/prospects/callPrefs.js'
import { callsToday, countsOf } from '../lib/outreach/prospects/callShift.js'
import { listingPhotos, photoAddresses } from '../lib/outreach/prospects/placePhotos.js'

const PROSPECTS = 'outreach_prospects'

/** The key the map sweep searches with, which also reads a listing's photos. */
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || ''
const CALLS = 'outreach_calls'
const PROFILES = 'profiles'

/** The views, which decide which bucket of the set is answered for. */
const VIEWS = Object.freeze(['list', 'resting', 'finished'])

/**
 * The callable set's ceiling.
 *
 * Well above the fifteen hundred rows that qualify today and well under what
 * the function's window will carry, so the map filling in over the next year
 * does not silently start ranking against a truncated middle. A read that
 * reaches it says so, and the console prints it rather than presenting a
 * sample as the list.
 */
const SET_MAX = 6000

/** The columns the list draws. Named so a column added later is a decision. */
const COLUMNS = [
  'id',
  'name',
  'phone',
  'address',
  'town',
  'trade',
  'website',
  'site_kind',
  'stage',
  'rating',
  'rating_count',
  'rating_count_first',
  'business_status',
  'skip_reason',
  'created_at',
  'assigned_to',
  'assigned_at',
  'email',
  // The audit, which is what the second call is about. A caller walks the owner
  // through these four numbers, so the reading has to arrive with the business
  // rather than being fetched again once somebody is on the phone.
  'audit_score',
  'accessibility_score',
  'best_practices_score',
  'seo_score',
  'audit_at',
  'audit_raw',
  // And whether the audit has already been sent, because two callers work one
  // queue and the second one must not send it again.
  'audit_emailed_at',
  'audit_emailed_by',
  'audit_emailed_to',
].join(', ')

/** The row as the list draws it, cut to the columns this endpoint names. */
function carried(row) {
  const cut = {}
  for (const column of CARRIED) cut[column] = row[column] ?? null
  return cut
}

/** The column names on their own, which is what a returned row is cut to. */
const CARRIED = COLUMNS.split(', ')

/**
 * The trades and the towns the studio holds work in, as the ranking asks for
 * them: a trade is held as the slug the portfolio files work under, and a town
 * lowercased. Built once per function instance off the portfolio itself, since
 * neither moves inside a request.
 */
const PROOF_TRADES = [...new Set(PORTFOLIO_PROJECTS.flatMap(project => project.trades ?? []))]
const PROOF_TOWNS = [
  ...new Set(
    PORTFOLIO_PROJECTS.map(project => String(project.town ?? '').toLowerCase()).filter(Boolean)
  ),
]

/** A note is a person's own sentence, and the column holds this much of one. */
const NOTE_MAX = 2000

/** How far ahead a callback may be set, which is a year and a refusal past it. */
const CALLBACK_MAX_DAYS = 365

/** What is said when the call list itself will not come back. */
const LIST_UNREAD = 'The call list could not be read. Try again in a moment.'

/** What is said when a call will not go on the record. */
const NOT_RECORDED = 'That call could not be saved. Try again in a moment.'

/** What is said when a business's photos will not come back. */
const PHOTOS_UNREAD = 'The photos did not load.'

/**
 * How long the photo descriptors read off a Google listing are used for.
 *
 * Every arrival on a business used to spend a Place Details request on a list
 * of photos that had not changed since the last caller looked, and the Google
 * project's daily allowance for that request is finite: on 2026-10-07 it was
 * spent, and the call screen answered a server error to every business for the
 * rest of the quota day. A listing's photos are the ones its owner uploaded,
 * so a month-old reading of them is the same reading.
 *
 * The addresses are not kept. Google signs those and they expire, so they are
 * bought fresh on every arrival - which is the request that was never the
 * expensive one.
 */
const PHOTOS_KEPT_MS = 30 * 24 * 60 * 60 * 1000

/**
 * What a driver said, turned into an answer the console can print.
 *
 * A missing table is the one fault worth naming outright, because the repair
 * is a migration and nobody is going to guess that from a general sentence.
 * Everything else Postgres says names columns and constraints, so its words go
 * to the log, where they are what we need to find the cause, and `said` is
 * what comes back: whichever of reading the list and recording a call did not
 * happen.
 */
function refusal(error, said) {
  if (tableMissing(error)) {
    return { status: 503, body: { error: 'The call list tables are not in this database yet.' } }
  }
  console.error('calls-admin: %s', error?.message || error)
  return { status: 500, body: { error: said } }
}

/** A page number, one-based, or the first page. */
function pageOf(value) {
  const page = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

/** A filter value as a plain trimmed string, or null where there is none. */
function term(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed && trimmed !== 'all' ? trimmed : null
}

/** One of a list, or the first of it. */
function oneOf(value, allowed, fallback) {
  const held = term(value)
  return held && allowed.includes(held) ? held : fallback
}

/** A page size the endpoint offers, or the default. */
function takeOf(value) {
  const take = Number.parseInt(String(value ?? ''), 10)
  return CALL_TAKES.includes(take) ? take : DEFAULT_TAKE
}

/** A score floor the console offers, or null. */
function floorOf(value) {
  const floor = Number.parseInt(String(value ?? ''), 10)
  return CALL_SCORE_FLOORS.includes(floor) ? floor : null
}

/**
 * A filter on who holds a business: one of the two standings, an account's id,
 * or nothing.
 *
 * Anything else is dropped rather than refused. A filter is a way of looking at
 * a list, and a console that has been handed a value this endpoint does not
 * know should show the whole list rather than an error where the businesses
 * were.
 */
function assignedTerm(value) {
  const held = term(value)
  if (!held) return null
  if (ASSIGNED_STANDINGS.includes(held)) return held
  return uuid(held)
}

/**
 * The people a business can belong to.
 *
 * Both roles the caller door admits, which is the same set the role check lets
 * through. It read the admins alone for as long as every account was one, and
 * the day a representative was hired that became a hole with no symptom worth
 * noticing: their calls were recorded, the businesses were handed to them, and
 * every screen drew both as belonging to nobody, because a name was looked up
 * in a list their account was never in. It is a handful of rows and it is read
 * on every list, because a page that knows an id and not a name draws a
 * business as belonging to nobody.
 */
async function callers(db) {
  const { data, error } = await db
    .from(PROFILES)
    .select('id, full_name')
    .in('role', ['admin', 'staff'])
    .order('full_name')
  if (error) throw error
  return (data || []).map(row => ({ id: row.id, name: row.full_name || null }))
}

/**
 * The trades and towns the studio holds work in, as two sets built once per
 * request rather than a portfolio scan per row.
 *
 * The trade claim is the strongest opener this studio has and it is
 * the one claim on a call a person can check in a second, so it is asked
 * exactly the way the letter pipeline asks it - through `sharesTrade`, which
 * exists because calling a pest control company's line of work a go-kart track
 * is how that claim gets broken.
 */
function proofIndex(trades) {
  const inTrade = new Set()
  for (const trade of trades) {
    if (PORTFOLIO_PROJECTS.some(project => sharesTrade(project, trade))) inTrade.add(trade)
  }
  const inTown = new Set(
    PORTFOLIO_PROJECTS.map(project => String(project.town ?? '').toLowerCase()).filter(Boolean)
  )
  return { inTrade, inTown }
}

/** Whether there is work of ours to name on this call, and of which kind. */
function proofOf(row, { inTrade, inTown }) {
  if (row.trade && inTrade.has(row.trade)) return 'trade'
  if (row.town && inTown.has(String(row.town).toLowerCase())) return 'town'
  return null
}

/** How many client sites a caller is handed to name. Two is a claim; five is a list. */
const WORK_NAMED = 2

/**
 * The client sites this business is actually worth naming out loud, if any.
 *
 * `proof` already says whether there is work in their trade or their town, and
 * a score term can stop at that. A caller cannot: "we have built for your line
 * of work" is a sentence anybody could say, and the whole value of the claim is
 * that the person on the phone can look the name up while they are still on
 * the call. So the matching projects come back with the row rather than the
 * kind of match alone.
 *
 * Named against the same `sharesTrade` the letters use, for the reason the note
 * above `proofIndex` gives. Only genuinely matching work is returned - a row
 * with nothing to claim gets an empty array, and the handbook says the measured
 * thing instead rather than naming a client in the wrong trade.
 */
function proofWork(row, kind) {
  if (!kind) return []
  const near = String(row.town ?? '').toLowerCase()
  const matched = PORTFOLIO_PROJECTS.filter(project =>
    kind === 'trade'
      ? sharesTrade(project, row.trade)
      : String(project.town ?? '').toLowerCase() === near
  )
  return matched.slice(0, WORK_NAMED).map(project => ({
    name: project.name,
    town: project.town ?? null,
    url: project.displayUrl ?? project.url ?? null,
  }))
}

/**
 * The audit report, cut to what is read off it.
 *
 * The stored report is a Lighthouse run kept whole, because the audit job that
 * wrote it has its own reasons to keep it. The call screen reads two things
 * out of it: the address the reading was actually taken on, and the savings it
 * named, which become the sentences a caller says out loud. Everything else -
 * the diagnostics, the screenshots, the timings behind each metric - is weight
 * on a response that already carries fifty businesses.
 *
 * A report that is not an object reads as no report rather than as an empty
 * one, so a row written before the column held anything draws the same as a
 * row that was never measured.
 */
function auditCarried(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    final_url: raw.final_url ?? null,
    opportunities: Array.isArray(raw.opportunities) ? raw.opportunities : [],
  }
}

/**
 * One business as the list draws it: the row, what its trade says about it,
 * what it scores and why, where it sits, when it comes back, and every call
 * placed to it.
 */
function drawn(row, { medians, calls, proof, now, named }) {
  // Every call carries who placed it. The record is read by whoever picks the
  // business up next, and a note reading "he said ring back Tuesday" is a
  // different instruction depending on who wrote it - the colleague at the next
  // desk, or somebody who left in March.
  const history = (calls.get(row.id) ?? []).map(call => ({
    ...call,
    called_by_name: call.called_by ? (named.get(call.called_by) ?? null) : null,
  }))
  const carried = { ...row, calls: history }
  const median = medians.get(row.trade) ?? null
  const promise = promiseOf(carried, now)
  const ready = readyAt(carried, now)
  const held = proofOf(row, proof)
  const { score, raw, terms } = scoreOf(row, { median, proof: held, calls: history })

  return {
    ...row,
    // The name beside the id, so a row can say whose it is without the console
    // holding a second index and joining it per render.
    assigned_name: ownerOf(row) ? (named.get(ownerOf(row)) ?? null) : null,
    // The same, for whoever sent the audit. A caller looking at a business
    // somebody already emailed needs the name to know who to ask about it, and
    // an id is not a name.
    audit_emailed_by_name: row.audit_emailed_by ? (named.get(row.audit_emailed_by) ?? null) : null,
    // The report, cut to the two things read off it. The whole blob is a
    // Lighthouse run - tens of kilobytes of diagnostics per row - and this
    // answer carries a page of rows, so sending all of it would spend most of
    // the response on audits nobody opens.
    audit_raw: auditCarried(row.audit_raw),
    pull: pullBand(row, median),
    pull_ratio: pullOf(row, median),
    trade_median: median,
    proof: held,
    proof_work: proofWork(row, held),
    calls: history,
    last_call: history[0] ?? null,
    tries: triesRun(carried),
    callback_at: promise ? promise.toISOString() : null,
    ready_at: ready ? ready.toISOString() : null,
    place: callPlace(carried, now),
    score,
    raw_score: raw,
    terms,
  }
}

/**
 * The whole list, filtered, counted and paged - by the database, in one call.
 *
 * The ranking is the reason this is a function rather than a select. A
 * business's place is its review count against the middle count for its own
 * trade, so the middle has to be taken over the whole callable set before a
 * single row can be ordered, and a page cannot be cut until it is. Done out
 * here that meant reading the set across - four pages of seven hundred
 * kilobytes gathered together, each with its own deadline, where one page
 * queued past its clock discarded the three that had arrived and failed the
 * request whole. Done in Postgres the middle, the score, the order and the
 * page are one bounded round trip, and the rows that travel are the page.
 *
 * The names of the columns the list draws are still this endpoint's, and the
 * row that comes back is cut to them.
 */
async function list(db, query, account) {
  const now = new Date()
  const view = oneOf(query.view, VIEWS, 'list')
  const sort = oneOf(query.sort, SORT_IDS, DEFAULT_SORT)
  const take = takeOf(query.take)

  const [{ data, error }, people] = await Promise.all([
    db.rpc('call_list_page', {
      p_view: view,
      p_sort: view === 'resting' ? 'waited' : sort,
      p_take: take,
      p_page: pageOf(query.page),
      p_state: term(query.state),
      p_pull: term(query.pull),
      p_min_score: floorOf(query.min_score),
      p_town: term(query.town),
      p_trade: term(query.trade),
      p_search: term(query.search),
      p_assigned: assignedTerm(query.assigned),
      p_you: account.userId,
      p_now: now.toISOString(),
      // The three readings the score leans on that are not in the database: the
      // trades and towns the studio holds work in, and the hosts that are a
      // platform rather than a site of the business's own. They are the
      // codebase's own lists, passed in rather than copied into the schema,
      // where a second copy would answer differently the day one of them moved.
      p_proof_trades: PROOF_TRADES,
      p_proof_towns: PROOF_TOWNS,
      p_trade_aliases: TRADE_ALIASES,
      p_booking_hosts: BOOKING_HOSTS,
      p_portal_hosts: PORTAL_HOSTS,
      p_platform_hosts: PLATFORM_HOSTS,
      p_max: SET_MAX,
    }),
    callers(db),
  ])
  if (error) throw error

  const named = new Map(people.map(one => [one.id, one.name]))
  const page = data.rows ?? []
  const medians = new Map(
    page
      .filter(row => row.trade && row.trade_median !== null)
      .map(row => [row.trade, row.trade_median])
  )
  const calls = new Map(page.map(row => [row.id, row.calls ?? []]))
  const proof = proofIndex(new Set(page.map(row => row.trade).filter(Boolean)))

  return {
    status: 200,
    body: {
      rows: page.map(row => drawn(carried(row), { medians, calls, proof, now, named })),
      page: data.page,
      pages: data.pages,
      matched: data.matched,
      take,
      sort: view === 'finished' ? 'ended' : view === 'resting' ? 'waited' : sort,
      view,
      bands: data.bands,
      totals: data.totals,
      // What this caller's day has come to. The function hands back their own
      // recent calls rather than counting the day itself, because the day is
      // the studio's own working day in its own zone and that boundary is
      // already settled in one place out here.
      shift: countsOf(callsToday(data.my_calls ?? [], account.userId, now)),
      matched_totals: data.matched_totals,
      next_back: data.next_back ?? null,
      towns: data.towns ?? [],
      trades: data.trades ?? [],
      people,
      complete: data.complete,
      cap: SET_MAX,
    },
  }
}

/**
 * A callback time the column will take, or the reason it will not.
 *
 * A time in the past is refused rather than clamped, because the one thing a
 * callback does is put a business back on the list on a day that has not
 * happened yet, and a clamped one would surface immediately and read as the
 * list being broken.
 */
function callbackAt(value) {
  if (value === null || value === undefined || value === '') return { at: null }
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return { error: 'That callback time could not be read.' }
  const now = Date.now()
  if (when.getTime() <= now) return { error: 'A callback has to be set for a time still to come.' }
  if (when.getTime() > now + CALLBACK_MAX_DAYS * 86_400_000) {
    return { error: 'A callback can be set up to a year out.' }
  }
  return { at: when.toISOString() }
}

/**
 * What the caller said about interest, checked against the outcome carrying it.
 *
 * An outcome that asks and was not answered is stored unanswered rather than
 * refused. The question is one the call may never have got to - a desk that
 * took a message, an owner who had a bay up on the lift - and a form that will
 * not save until somebody picks a side buys its tidy column by making the
 * caller guess. Unanswered still reaches the lead list; only a no takes a
 * business out of it.
 *
 * The one refusal left is an answer sent against an outcome that already
 * settles interest. A Booked marked not interested is a form disagreeing with
 * the button it was submitted under, and picking one of them would be a guess.
 *
 * @returns {{interested: boolean|null}|{error: string}}
 */
function interestFor(outcome, value) {
  const asks = outcomeAsksInterest(outcome)
  if (value === null || value === undefined || value === '') {
    return { interested: asks ? null : interestIn(outcome) }
  }
  if (typeof value !== 'boolean')
    return { error: 'Say whether they were interested, or leave it unsaid.' }
  if (!asks) {
    return { error: 'That outcome already says whether they were interested.' }
  }
  return { interested: value }
}

/** One call recorded against one business. */
async function record(db, body, account) {
  const prospectId = uuid(body.id)
  if (!prospectId) return { status: 400, body: { error: 'Pick the business the call was to.' } }

  const outcome = String(body.outcome ?? '')
  if (!OUTCOME_IDS.includes(outcome)) {
    return { status: 400, body: { error: 'Pick what the call came to.' } }
  }

  const callback = callbackAt(body.callback_at)
  if (callback.error) return { status: 400, body: { error: callback.error } }
  // A call back nobody put a clock on is filed a day out rather than refused.
  // The refusal was the endpoint asking the caller for a fact the call did not
  // produce: plenty of them end at "try me again" and nothing more, and the
  // only ways past a required field are a time somebody invented or an outcome
  // that is not what happened.
  const ringBack =
    outcomeTakesCallback(outcome) && !callback.at
      ? defaultCallbackAt(new Date(), outcome).toISOString()
      : callback.at
  // A business that is off the list does not come back to one, so an ending
  // outcome may not carry a time. Without this a mis-keyed Booked with a
  // callback still on the form would file a promise nothing will ever read.
  if (outcomeEnds(outcome) && callback.at) {
    return {
      status: 400,
      body: { error: 'That outcome takes the business off the list, so it cannot name a time.' },
    }
  }

  const interest = interestFor(outcome, body.interested)
  if (interest.error) return { status: 400, body: { error: interest.error } }

  // The row has to be one this list would actually have offered. Without this
  // an id copied from the outreach board would write a call against a business
  // that unsubscribed, which is the one thing the whole section must not do.
  const found = await db
    .from(PROSPECTS)
    .select(
      'id, name, phone, email, trade, town, website, site_kind, stage, business_status, assigned_to'
    )
    .eq('id', prospectId)
    .maybeSingle()
  if (found.error) return refusal(found.error, NOT_RECORDED)
  if (!found.data) return { status: 404, body: { error: 'That business is no longer on file.' } }
  if (!isCallable(found.data)) {
    return { status: 409, body: { error: 'That business is not on the call list.' } }
  }

  const written = await db
    .from(CALLS)
    .insert({
      prospect_id: prospectId,
      outcome,
      note: field(body.note, NOTE_MAX),
      interested: interest.interested,
      callback_at: ringBack,
      called_by: account.userId,
    })
    .select('id')
    .maybeSingle()
  if (written.error) return refusal(written.error, NOT_RECORDED)

  // Who the business belongs to and whether it becomes a lead are two facts
  // the same call settles, and neither needs the other, so they are written
  // together. A caller is waiting on this answer with the next number already
  // in front of them, and every round trip on it is a pause between calls.
  const [took] = await Promise.all([
    claim(db, prospectId, account.userId),
    carry(db, found.data, body, ringBack, interest.interested),
  ])

  return {
    status: 200,
    body: { ok: true, call: written.data?.id ?? null, assigned_to: took },
  }
}

/**
 * A business that wanted this, carried into the lead record.
 *
 * A cold prospect is not a lead. Eight thousand names off a map are a list to
 * work, and putting them in front of a person as leads would bury the handful
 * who asked for something. What changes that is a call that reached somebody,
 * which is why a number that rang out carries nothing here and Booked, Call
 * Back and a conversation all do.
 *
 * The gate reads the interest the caller recorded only to take a business back
 * out. Requiring that answer to get in was tried and put right the same day:
 * the question does not always come up on the call, and the calls it went
 * unanswered on were the ones that vanished - a conversation held, a note
 * written, and nothing in front of anybody afterwards.
 *
 * Failure here is swallowed. The call is already on the record and the caller
 * is owed their confirmation; a lead that missed its row is worth less than a
 * caller told their call did not save.
 */
async function carry(db, prospect, body, callbackAt, interested) {
  if (!callMakesLead(String(body.outcome ?? ''), interested)) return

  const lead = await keepLead(
    {
      source: SOURCES.call,
      ref: prospect.id,
      email: prospect.email,
      phone: prospect.phone,
      business: prospect.name,
      trade: prospect.trade,
      website: prospect.website,
      town: prospect.town,
      note: field(body.note, NOTE_MAX),
    },
    db
  )
  if (!lead) return

  // Two facts the call settles that the merge deliberately will not touch: the
  // studio has now spoken to this person, and it owes them a call back on the
  // day the caller wrote down. Both are stamped rather than merged, because a
  // later call moves the callback and the merge only ever fills blanks.
  const { error } = await db
    .from(SPINE)
    .update({
      contacted_at: new Date().toISOString(),
      ...(callbackAt ? { due_at: callbackAt } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
  if (error) console.error('calls-admin: the lead was not stamped: %s', error.message)
}

/**
 * The business put in the caller's name, where nobody had it.
 *
 * `is('assigned_to', null)` is the whole of the race. Two callers who record
 * against the same unheld business in the same second both read it as unheld
 * a moment earlier, and without the condition in the statement the second
 * write would take it off the first. With it, the second update matches no row
 * and the business stays with whoever got there first, which is the rule.
 *
 * A failure here is not a failure of the call. The call is on the record and
 * the caller is owed the confirmation for it; who the business belongs to is
 * settled by the next call. So it is logged and the answer says nobody was
 * claimed rather than telling somebody their call did not save.
 */
async function claim(db, prospectId, userId) {
  const { data, error } = await db
    .from(PROSPECTS)
    .update({ assigned_to: userId, assigned_at: new Date().toISOString() })
    .eq('id', prospectId)
    .is('assigned_to', null)
    .select('assigned_to')
    .maybeSingle()
  if (error) {
    console.error('calls-admin: the business could not be claimed: %s', error.message)
    return null
  }
  return data?.assigned_to ?? null
}

/**
 * One business's photos, read off the Google listing it was found through.
 *
 * Asked for one business at a time, as a caller arrives on it, rather than
 * carried on every row of the list: each photo is a billed request to Google,
 * and the list is fifteen hundred businesses of which a caller sees one.
 *
 * `listed` tells the screen which nothing an empty answer is. A business added
 * by hand has no listing to read, which is a different fact from a listing that
 * holds no photos.
 */
async function photos(db, value) {
  const id = uuid(value)
  if (!id) return { status: 400, body: { error: 'That is not a business on the list.' } }
  const { data, error } = await db
    .from(PROSPECTS)
    .select('place_id, place_photos')
    .eq('id', id)
    .maybeSingle()
  if (error) return refusal(error, PHOTOS_UNREAD)
  if (!data) return { status: 404, body: { error: 'That business is not on the list.' } }
  if (!data.place_id) return { status: 200, body: { photos: [], listed: false } }
  if (!PLACES_KEY) return { status: 503, body: { error: 'Google photos are not set up here.' } }

  const kept = keptPhotos(data.place_photos)
  let listed = kept.fresh ? kept.photos : null
  if (!listed) {
    try {
      listed = await listingPhotos(data.place_id, { key: PLACES_KEY })
      await keepPhotos(db, id, listed)
    } catch (cause) {
      // Where this business has been read before, Google refusing the listing
      // read costs nothing: the descriptors on the row name the same photos.
      if (!kept.photos) {
        console.error('calls-admin photos: %s', cause.message)
        return { status: 502, body: { error: PHOTOS_UNREAD } }
      }
      console.error('calls-admin photos: %s, showing what is on file', cause.message)
      listed = kept.photos
    }
  }
  const found = await photoAddresses(listed, { key: PLACES_KEY })
  return { status: 200, body: { photos: found, listed: true } }
}

/**
 * The photo descriptors on a business's row, and whether they are recent
 * enough to be used without asking Google again.
 *
 * Both answers matter separately. Fresh descriptors are used instead of a
 * request; stale ones are still better than nothing when the request refuses.
 */
function keptPhotos(held) {
  const photos = Array.isArray(held?.photos) ? held.photos : null
  if (!photos) return { photos: null, fresh: false }
  const at = Date.parse(held?.at ?? '')
  const fresh = Number.isFinite(at) && Date.now() - at < PHOTOS_KEPT_MS
  return { photos, fresh }
}

/**
 * Keep what the listing answered on the business's row.
 *
 * It is written for the next caller rather than for this one, so a write that
 * will not go through is logged and the photos are served anyway.
 */
async function keepPhotos(db, id, photos) {
  const { error } = await db
    .from(PROSPECTS)
    .update({ place_photos: { at: new Date().toISOString(), photos } })
    .eq('id', id)
  if (error) console.error('calls-admin photos: not kept: %s', error.message)
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return

  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'not authorized' })
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'GET or POST only' })
  }

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const account = await authorizeCaller(wired, authorization)
    if (account.status) return response.status(account.status).json({ error: account.error })

    const query = request.query ?? {}
    let answer
    try {
      answer =
        request.method === 'POST'
          ? await record(wired.db, request.body ?? {}, account)
          : query.photos
            ? await photos(wired.db, query.photos)
            : await list(wired.db, query, account)
    } catch (cause) {
      answer = refusal(
        cause,
        request.method === 'POST' ? NOT_RECORDED : query.photos ? PHOTOS_UNREAD : LIST_UNREAD
      )
    }
    return response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('calls-admin: %s', cause.message)
    return response.status(502).json({ error: 'The call list endpoint did not answer.' })
  }
}
