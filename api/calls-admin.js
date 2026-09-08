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
 * The whole callable set is read on every request rather than a page of it,
 * and that is deliberate. The ordering is not a column: a business's place is
 * a score built from its review count against the middle count for its own
 * trade, and a middle taken over one page is a different number on every page.
 * The set is about fifteen hundred rows of short columns, which is one round
 * trip; what travels back to the console is one page of it.
 *
 * Both reads are totally ordered - `.order('id')` under the prospects read and
 * under the calls read - because `readAll` pages with `.range()` and this set
 * is already two pages deep. An unordered query paged that way can hand back
 * the same row twice and skip another, and on the calls read that is not a
 * cosmetic fault: a dropped newest call silently changes the run, the wait,
 * the place and the score of the business it belonged to.
 *
 * Two verbs. GET answers the list. POST records one call - an outcome, a note
 * in whoever's own words, and a time to ring back where one was named - or
 * hands a business from one caller to another. Nothing composes a note, and
 * nothing sends anything: the whole point of this section is that a person
 * picks up a phone.
 *
 * A recorded call also settles who the business belongs to, where nobody holds
 * it yet. That write is here rather than anywhere else because it is the same
 * event - somebody rang them - and doing it in a second request would leave
 * the two able to disagree.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { readAll, tableMissing } from '../lib/db/rows.js'
import { field, uuid } from '../lib/db/fields.js'
import { sharesTrade } from '../lib/outreach/message.js'
import { PORTFOLIO_PROJECTS } from '../src/app/data/portfolio.js'
import {
  ASSIGNED_STANDINGS,
  byCallOrder,
  callPlace,
  isCallable,
  matchesControls,
  medianOf,
  outcomeEnds,
  OUTCOME_IDS,
  ownerOf,
  placeCalls,
  promiseOf,
  pullBand,
  pullOf,
  readyAt,
  scoreOf,
  TRADE_FLOOR,
  triesRun,
} from '../lib/outreach/prospects/calls.js'
// The page sizes, the score floors and the orders are the console's own
// controls, and they are read from the same module the console draws them from
// rather than written out again here. Two copies is how an endpoint quietly
// refuses an option a dropdown is still offering: the control moves, the
// caller picks it, and the list comes back exactly as it was.
import {
  CALL_SCORE_FLOORS,
  CALL_TAKES,
  DEFAULT_SORT,
  DEFAULT_TAKE,
  SORT_IDS,
} from '../lib/outreach/prospects/callPrefs.js'

const PROSPECTS = 'outreach_prospects'
const CALLS = 'outreach_calls'
const PROFILES = 'profiles'

/** The views, which decide which bucket of the set is answered for. */
const VIEWS = Object.freeze(['list', 'calling', 'resting', 'finished'])

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
].join(', ')

/** A note is a person's own sentence, and the column holds this much of one. */
const NOTE_MAX = 2000

/** How far ahead a callback may be set, which is a year and a refusal past it. */
const CALLBACK_MAX_DAYS = 365

/** What is said when the call list itself will not come back. */
const LIST_UNREAD = 'The call list could not be read. Try again in a moment.'

/** What is said when a call will not go on the record. */
const NOT_RECORDED = 'That call could not be saved. Try again in a moment.'

/** And when a business will not change hands. */
const NOT_HANDED = 'That business could not be handed over. Try again in a moment.'

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
 * Every call on file, newest first, filed under the business it was placed to.
 *
 * Read whole rather than joined, because the join would be one query per page
 * of prospects and the table holds one row per call placed by one person - it
 * is small now and it is small in five years. Ordered on the id as well as the
 * instant, because `called_at` is not unique and a working session produces
 * bursts of calls inside the same second.
 */
async function callsByProspect(db) {
  const { rows } = await readAll(
    () =>
      db
        .from(CALLS)
        .select('id, prospect_id, outcome, note, callback_at, called_at, called_by')
        .order('called_at', { ascending: false })
        .order('id', { ascending: false }),
    { max: SET_MAX * 4 }
  )
  const byProspect = new Map()
  for (const call of rows) {
    const held = byProspect.get(call.prospect_id)
    if (held) held.push(call)
    else byProspect.set(call.prospect_id, [call])
  }
  return byProspect
}

/**
 * The people a business can belong to.
 *
 * Everybody who can reach this endpoint at all, which is the same set the role
 * check lets through, so a picker cannot offer somebody the write would then
 * refuse. It is three rows and it is read on every list, because the console
 * needs a name against an id in three places - the column, the chip and the
 * hand-over - and a page that knows an id and not a name draws a business as
 * belonging to nobody.
 */
async function callers(db) {
  const { data, error } = await db
    .from(PROFILES)
    .select('id, full_name')
    .eq('role', 'admin')
    .order('full_name')
  if (error) throw error
  return (data || []).map(row => ({ id: row.id, name: row.full_name || null }))
}

/**
 * The middle review count for each trade, over the callable businesses in it.
 *
 * A trade holding fewer than TRADE_FLOOR of them gets no middle at all rather
 * than one taken over four rows, and every business in it reads `unread`.
 */
function mediansByTrade(callable) {
  const counts = new Map()
  for (const row of callable) {
    if (!row.trade || typeof row.rating_count !== 'number') continue
    const held = counts.get(row.trade)
    if (held) held.push(row.rating_count)
    else counts.set(row.trade, [row.rating_count])
  }
  const medians = new Map()
  for (const [trade, values] of counts) {
    if (values.length >= TRADE_FLOOR) medians.set(trade, medianOf(values))
  }
  return medians
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

/** The set split into the three things a caller can be looking at. */
function placed(rows) {
  const call = []
  const resting = []
  const finished = []
  for (const row of rows) {
    if (placeCalls(row.place)) call.push(row)
    else if (row.place === 'resting' || row.place === 'promised') resting.push(row)
    else finished.push(row)
  }
  return { call, resting, finished }
}

/** Every place counted, over whichever set is handed in. */
function countPlaces(rows) {
  const counted = { call: 0, due: 0, fresh: 0, ready: 0, resting: 0, booked: 0, closed: 0 }
  for (const row of rows) {
    if (placeCalls(row.place)) counted.call += 1
    if (row.place === 'due') counted.due += 1
    else if (row.place === 'fresh') counted.fresh += 1
    else if (row.place === 'ready') counted.ready += 1
    else if (row.place === 'resting' || row.place === 'promised') counted.resting += 1
    else if (row.place === 'booked') counted.booked += 1
    else if (row.place === 'closed') counted.closed += 1
  }
  return counted
}

/**
 * The list narrowed to what the console asked for.
 *
 * The rule itself lives beside the score and the places rather than here,
 * because the exemption it carries - a business due back survives every
 * control but the search - is a statement about the list rather than about
 * this endpoint, and it is the one part of the narrowing worth proving.
 */
function narrow(rows, controls) {
  return rows.filter(row => matchesControls(row, controls))
}

/** The four orders the list can be read in. */
function sorted(rows, sort, now) {
  const ordered = [...rows]
  if (sort === 'waited') {
    return ordered.sort((one, two) => {
      const a = one.ready_at ? Date.parse(one.ready_at) : Infinity
      const b = two.ready_at ? Date.parse(two.ready_at) : Infinity
      return a - b
    })
  }
  if (sort === 'reviews') {
    return ordered.sort((one, two) => (two.rating_count ?? -1) - (one.rating_count ?? -1))
  }
  if (sort === 'newest') {
    return ordered.sort((one, two) =>
      String(two.created_at ?? '').localeCompare(String(one.created_at ?? ''))
    )
  }
  return ordered.sort(byCallOrder(now))
}

/**
 * The Finished view's own order: the last call first, whichever way the list
 * is sorted.
 *
 * It ignores the sort parameter deliberately. None of the four orders answers
 * the question this view is opened with, which is what happened most recently
 * - `newest` is when the listing was filed, which has nothing to do with it.
 */
function byLastCall(rows) {
  return [...rows].sort((one, two) =>
    String(two.last_call?.called_at ?? '').localeCompare(String(one.last_call?.called_at ?? ''))
  )
}

/** The whole list, filtered, counted and paged. */
async function list(db, query, account) {
  const now = new Date()

  const [{ rows, complete }, calls, people] = await Promise.all([
    readAll(
      () =>
        db
          .from(PROSPECTS)
          .select(COLUMNS)
          .in('site_kind', ['none', 'social'])
          .not('phone', 'is', null)
          .order('id'),
      { max: SET_MAX }
    ),
    callsByProspect(db),
    callers(db),
  ])

  const named = new Map(people.map(one => [one.id, one.name]))
  const callable = rows.filter(isCallable)
  const medians = mediansByTrade(callable)
  const proof = proofIndex(new Set(callable.map(row => row.trade).filter(Boolean)))
  const drawnRows = callable.map(row => drawn(row, { medians, calls, proof, now, named }))

  const buckets = placed(drawnRows)
  // The strip, the dropdowns and the soonest return all answer for the whole
  // list rather than for the question just asked, so they stay steady while a
  // caller narrows. The empty state reads the filtered figures instead, since
  // it is answering that question and nothing else.
  const totals = countPlaces(drawnRows)

  const view = oneOf(query.view, VIEWS, 'list')
  const sort = oneOf(query.sort, SORT_IDS, DEFAULT_SORT)
  const take = takeOf(query.take)

  const pool =
    view === 'resting' ? buckets.resting : view === 'finished' ? buckets.finished : buckets.call

  const filtered = narrow(pool, {
    state: term(query.state),
    pull: term(query.pull),
    minScore: floorOf(query.min_score),
    town: term(query.town),
    trade: term(query.trade),
    search: term(query.search),
    assigned: assignedTerm(query.assigned),
    you: account.userId,
  })

  const ordered =
    view === 'finished'
      ? byLastCall(filtered)
      : sorted(filtered, view === 'resting' ? 'waited' : sort, now)

  const page = pageOf(query.page)
  const pages = Math.max(1, Math.ceil(ordered.length / take))
  const held = Math.min(page, pages)
  const from = (held - 1) * take

  const backs = buckets.resting
    .map(row => row.ready_at)
    .filter(Boolean)
    .sort()

  return {
    status: 200,
    body: {
      rows: ordered.slice(from, from + take),
      page: held,
      pages,
      matched: ordered.length,
      take,
      sort: view === 'finished' ? 'ended' : view === 'resting' ? 'waited' : sort,
      view,
      bands: {
        due: filtered.filter(row => row.place === 'due').length,
        call: filtered.filter(row => row.place !== 'due').length,
      },
      totals,
      matched_totals: countPlaces(filtered),
      next_back: backs[0] ?? null,
      towns: [...new Set(buckets.call.map(row => row.town).filter(Boolean))].sort(),
      trades: [...new Set(buckets.call.map(row => row.trade).filter(Boolean))].sort(),
      people,
      complete,
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
  if (outcome === 'callback' && !callback.at) {
    return { status: 400, body: { error: 'A call back needs the time to ring them back at.' } }
  }
  // A business that is off the list does not come back to one, so an ending
  // outcome may not carry a time. Without this a mis-keyed Booked with a
  // callback still on the form would file a promise nothing will ever read.
  if (outcomeEnds(outcome) && callback.at) {
    return {
      status: 400,
      body: { error: 'That outcome takes the business off the list, so it cannot name a time.' },
    }
  }

  // The row has to be one this list would actually have offered. Without this
  // an id copied from the outreach board would write a call against a business
  // that unsubscribed, which is the one thing the whole section must not do.
  const found = await db
    .from(PROSPECTS)
    .select('id, name, phone, site_kind, stage, business_status, assigned_to')
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
      callback_at: callback.at,
      called_by: account.userId,
    })
    .select('id')
    .maybeSingle()
  if (written.error) return refusal(written.error, NOT_RECORDED)

  const took = await claim(db, prospectId, account.userId)

  return {
    status: 200,
    body: { ok: true, call: written.data?.id ?? null, assigned_to: took },
  }
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
 * settled by the next call, or by hand. So it is logged and the answer says
 * nobody was claimed rather than telling somebody their call did not save.
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
 * One business handed from whoever holds it to somebody else, or to nobody.
 *
 * Every other change of hands in this file is automatic and conditional. This
 * one is a person deciding, so it is unconditional: it takes a business off
 * the caller who has had it since the first call, which is exactly the thing
 * `claim` above refuses to do on its own.
 *
 * `to` may be null, which puts the business back in the pool. That is the only
 * way back to unheld, and it is worth having: a caller who leaves, or a
 * business claimed by a wrong number, would otherwise stay in a name nobody
 * can act on.
 */
async function assign(db, body) {
  const prospectId = uuid(body.id)
  if (!prospectId) return { status: 400, body: { error: 'Pick the business to hand over.' } }

  const to = body.to === null || body.to === '' ? null : uuid(body.to)
  if (body.to && !to) return { status: 400, body: { error: 'Pick who it goes to.' } }

  // Only somebody who can work the list at all. Without this an id from
  // anywhere would put a business in the name of an account that will never
  // see it, and it would read on every screen exactly like a real hand-over.
  if (to) {
    const people = await callers(db)
    if (!people.some(one => one.id === to)) {
      return { status: 400, body: { error: 'That person does not work the call list.' } }
    }
  }

  const written = await db
    .from(PROSPECTS)
    .update({ assigned_to: to, assigned_at: to ? new Date().toISOString() : null })
    .eq('id', prospectId)
    .select('id, assigned_to, assigned_at')
    .maybeSingle()
  if (written.error) return refusal(written.error, NOT_HANDED)
  if (!written.data) return { status: 404, body: { error: 'That business is no longer on file.' } }

  return {
    status: 200,
    body: {
      ok: true,
      assigned_to: written.data.assigned_to,
      assigned_at: written.data.assigned_at,
    },
  }
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
    const account = await authorizeAdmin(wired, authorization)
    if (account.status) return response.status(account.status).json({ error: account.error })

    let answer
    try {
      const body = request.body ?? {}
      answer =
        request.method === 'GET'
          ? await list(wired.db, request.query ?? {}, account)
          : // A hand-over and a recorded call are both POSTs to this endpoint
            // and they are told apart by what the body carries, because they
            // are the same thing happening to the same business and splitting
            // them across two addresses would say otherwise.
            'assign' in body
            ? await assign(wired.db, body.assign ?? {})
            : await record(wired.db, body, account)
    } catch (cause) {
      answer = refusal(cause, request.method === 'POST' ? NOT_RECORDED : LIST_UNREAD)
    }
    return response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('calls-admin: %s', cause.message)
    return response.status(502).json({ error: 'The call list endpoint did not answer.' })
  }
}
