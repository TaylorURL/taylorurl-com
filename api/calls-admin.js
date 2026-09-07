/**
 * The call list: every business the email pipeline cannot reach, in the order
 * to ring them, and the record of what each call came to.
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
 * and that is deliberate. The ordering is not a column: a business's place on
 * the list is its review count measured against the middle count for its own
 * trade, and a middle taken over one page is a different number on every page.
 * The set is about fifteen hundred rows of eleven short columns, which is one
 * round trip and a few hundred kilobytes at the database; what travels back to
 * the console is one page of it.
 *
 * Two verbs. GET answers the list. POST records one call, and it is the only
 * write in here: an outcome, a note in whoever's own words, and a time to ring
 * back where one was named. Nothing composes a note, and nothing sends
 * anything - the whole point of this section is that a person picks up a
 * phone.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { readAll, tableMissing } from '../lib/db/rows.js'
import { field, uuid } from '../lib/db/fields.js'
import {
  callRank,
  isCallable,
  medianOf,
  outcomeEnds,
  outcomeNeedsCallback,
  OUTCOME_IDS,
  pullBand,
  TRADE_FLOOR,
} from '../lib/outreach/prospects/calls.js'

const PROSPECTS = 'outreach_prospects'
const CALLS = 'outreach_calls'

/** Rows one page of the list carries. */
const PAGE_ROWS = 50

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
].join(', ')

/** A note is a person's own sentence, and the column holds this much of one. */
const NOTE_MAX = 2000

/** How far ahead a callback may be set, which is a year and a refusal past it. */
const CALLBACK_MAX_DAYS = 365

/** What a driver said, turned into an answer the console can print. */
function refusal(error) {
  if (tableMissing(error)) {
    return { status: 503, body: { error: 'The call list tables are not in this database yet.' } }
  }
  return { status: 500, body: { error: error.message || 'The call list could not be read.' } }
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

/**
 * Every call on file, newest first, filed under the business it was placed to.
 *
 * Read whole rather than joined, because the join would be one query per page
 * of prospects and the table holds one row per call placed by one person - it
 * is small now and it is small in five years.
 */
async function callsByProspect(db) {
  const { rows } = await readAll(
    () =>
      db
        .from(CALLS)
        .select('id, prospect_id, outcome, note, callback_at, called_at')
        .order('called_at', { ascending: false }),
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
 * One business as the list draws it: the row, what its trade says about it,
 * and every call placed to it.
 *
 * `callback_at` is lifted off the newest call that named one, so the sort and
 * the badge read one field rather than each walking the history.
 */
function drawn(row, medians, calls) {
  const history = calls.get(row.id) ?? []
  const last = history[0] ?? null
  const promised = history.find(call => call.callback_at) ?? null
  return {
    ...row,
    pull: pullBand(row, medians.get(row.trade) ?? null),
    trade_median: medians.get(row.trade) ?? null,
    calls: history,
    last_call: last,
    callback_at: promised?.callback_at ?? null,
  }
}

/**
 * The businesses still worth ringing, in the order to ring them.
 *
 * A business whose last call ended it - booked, not interested, a wrong number
 * - is off the list. Those are counted rather than simply vanishing, and the
 * ones that ended in work are counted apart from the ones that ended in a no:
 * a strip reporting them as one figure would put the section's only good news
 * in with its refusals.
 */
function working(rows, now) {
  const open = []
  let booked = 0
  let closed = 0
  for (const row of rows) {
    if (!row.last_call || !outcomeEnds(row.last_call.outcome)) {
      open.push(row)
      continue
    }
    if (row.last_call.outcome === 'booked') booked += 1
    else closed += 1
  }
  open.sort((one, two) => callRank(one, now) - callRank(two, now))
  return { open, booked, closed }
}

/** The list narrowed to what the console asked for. */
function narrow(rows, { town, trade, pull, search }, now) {
  const needle = search ? search.toLowerCase() : null
  return rows.filter(row => {
    if (town && row.town !== town) return false
    if (trade && row.trade !== trade) return false
    if (pull === 'due') {
      if (!row.callback_at || new Date(row.callback_at) > now) return false
    } else if (pull === 'fresh') {
      if (row.last_call) return false
    } else if (pull && row.pull !== pull) return false
    if (needle) {
      const hay = `${row.name ?? ''} ${row.town ?? ''} ${row.phone ?? ''}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

/** The whole list, filtered, counted and paged. */
async function list(db, query) {
  const now = new Date()

  const [{ rows, complete }, calls] = await Promise.all([
    readAll(
      () =>
        db
          .from(PROSPECTS)
          .select(COLUMNS)
          .in('site_kind', ['none', 'social'])
          .not('phone', 'is', null),
      { max: SET_MAX }
    ),
    callsByProspect(db),
  ])

  const callable = rows.filter(isCallable)
  const medians = mediansByTrade(callable)
  const drawnRows = callable.map(row => drawn(row, medians, calls))
  const { open, booked, closed } = working(drawnRows, now)

  const due = open.filter(row => row.callback_at && new Date(row.callback_at) <= now).length
  const fresh = open.filter(row => !row.last_call).length

  const filtered = narrow(
    open,
    {
      town: term(query.town),
      trade: term(query.trade),
      pull: term(query.pull),
      search: term(query.search),
    },
    now
  )

  const page = pageOf(query.page)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_ROWS))
  const from = (Math.min(page, pages) - 1) * PAGE_ROWS

  return {
    status: 200,
    body: {
      rows: filtered.slice(from, from + PAGE_ROWS),
      page: Math.min(page, pages),
      pages,
      matched: filtered.length,
      totals: { open: open.length, due, fresh, worked: open.length - fresh, booked, closed },
      towns: [...new Set(open.map(row => row.town).filter(Boolean))].sort(),
      trades: [...new Set(open.map(row => row.trade).filter(Boolean))].sort(),
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
  if (outcomeNeedsCallback(outcome) && !callback.at) {
    return { status: 400, body: { error: 'A call back needs the time to ring them back at.' } }
  }

  // The row has to be one this list would actually have offered. Without this
  // an id copied from the outreach board would write a call against a business
  // that unsubscribed, which is the one thing the whole section must not do.
  const found = await db
    .from(PROSPECTS)
    .select('id, name, phone, site_kind, stage, business_status')
    .eq('id', prospectId)
    .maybeSingle()
  if (found.error) return refusal(found.error)
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
  if (written.error) return refusal(written.error)

  return { status: 200, body: { ok: true, call: written.data?.id ?? null } }
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
      answer =
        request.method === 'GET'
          ? await list(wired.db, request.query ?? {})
          : await record(wired.db, request.body ?? {}, account)
    } catch (cause) {
      answer = refusal(cause)
    }
    return response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('calls-admin: %s', cause.message)
    return response.status(502).json({ error: 'The call list endpoint did not answer.' })
  }
}
