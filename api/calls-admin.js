/**
 * The Call List: the businesses worth ringing, the call backs that are due,
 * and the record of every call.
 *
 * It is the owner's list and nobody else's. Every request is held to the admin
 * door, and there is no team behind it: no claims, no presence, no shifts.
 *
 * GET answers one of two views, or with `photos` naming a business, that
 * business's photos off its Google listing.
 *
 * - `best` (the default): every call back due today or overdue, and every call
 *   a chain has asked for, first; then the businesses never called, in the
 *   order `call_list_page` ranks them, with the rules in `callList.js` taking
 *   out the closed, the chains, the shared numbers, the listings nobody has
 *   reviewed and the ones far busier than their trade. The ranking is the
 *   database's because a business's place is its review count against the
 *   middle count for its own trade, which only the whole set can give. The
 *   page is a page of that ranking with the rules applied, so pages vary in
 *   length.
 * - `new`: the new-business pipeline's phone-only companies - registered with
 *   the state, a site found, no address on it to write to - which that
 *   pipeline mirrors into `outreach_prospects` for this list. They sit near the
 *   foot of the review ranking, having no Google listing, so they are read as
 *   a view of their own, newest registration first.
 *
 * POST records one call: an outcome, a note in the owner's own words, and for
 * Call Back a time. A call that reached somebody becomes a lead. Nothing here
 * sends anything; the point of this section is that a person picks up a phone.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { readAll, tableMissing } from '../lib/db/rows.js'
import { field, uuid } from '../lib/db/fields.js'
import { TRADE_ALIASES, sharesTrade } from '../lib/outreach/message.js'
import { SOURCES, SPINE, keepLead } from '../lib/leads/spine.js'
import { PORTFOLIO_PROJECTS } from '../src/app/data/portfolio.js'
import { MIRROR_SOURCE, PHONE_ONLY_REASON } from '../lib/new-business/mirror.js'
import { dayIn, instantOf } from '../lib/time/zone.js'
import {
  OFFERED_OUTCOMES,
  callMakesLead,
  defaultCallbackAt,
  dialHref,
  interestIn,
  isCallable,
  outcomeEnds,
  outcomeTakesCallback,
} from '../lib/outreach/prospects/calls.js'
import { indexOf, kept, phoneKey, reasonsFor } from '../lib/outreach/prospects/callList.js'
import { BOOKING_HOSTS, PLATFORM_HOSTS, PORTAL_HOSTS } from '../lib/outreach/prospects/platforms.js'
import { listingPhotos, photoAddresses } from '../lib/outreach/prospects/placePhotos.js'

const PROSPECTS = 'outreach_prospects'
const CALLS = 'outreach_calls'
const NEW_LEADS = 'new_business_leads'

/** The key the map sweep searches with, which also reads a listing's photos. */
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || ''

/** The views, the first of them the default. */
const VIEWS = Object.freeze(['best', 'new'])

/**
 * How many ranked businesses one page reads before the list's own rules take
 * some out. The rules drop roughly a third of the top of the ranking, so a
 * page of this size leaves a working session's worth.
 */
const PAGE_TAKE = 150

/** The callable set's ceiling, well above the four thousand rows that qualify. */
const SET_MAX = 6000

/** The columns a business is read with when it is read directly rather than ranked. */
const DETAIL = [
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
  'business_status',
  'skip_reason',
  'email',
  'audit_score',
  'call_due_at',
  'call_due_reason',
].join(', ')

/** The columns of a call the history draws. */
const CALL_COLUMNS = 'id, prospect_id, outcome, note, callback_at, called_at'

/** How many ids one `in` filter carries, which keeps the address short. */
const IDS_AT_ONCE = 100

/** How long the index of every listing's name and number is reused. */
const INDEX_KEPT_MS = 30 * 60 * 1000

/** A note is a person's own sentence, and the column holds this much of one. */
const NOTE_MAX = 2000

/** How far ahead a call back may be set, which is a year and a refusal past it. */
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
 * A listing's photos are the ones its owner uploaded, so a month-old reading of
 * them is the same reading, and the Place Details allowance is finite. The
 * addresses are not kept: Google signs them and they expire.
 */
const PHOTOS_KEPT_MS = 30 * 24 * 60 * 60 * 1000

/**
 * The trades and the towns the studio holds work in, as the ranking asks for
 * them: a trade as the slug the portfolio files work under, a town lowercased.
 */
const PROOF_TRADES = [...new Set(PORTFOLIO_PROJECTS.flatMap(project => project.trades ?? []))]
const PROOF_TOWNS = [
  ...new Set(
    PORTFOLIO_PROJECTS.map(project => String(project.town ?? '').toLowerCase()).filter(Boolean)
  ),
]

/**
 * What a driver said, turned into an answer the console can print. A missing
 * table is named outright, since the repair is a migration; anything else goes
 * to the log and `said` comes back.
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

/** A list cut into runs of a given length. */
function runsOf(values, size) {
  const runs = []
  for (let at = 0; at < values.length; at += size) runs.push(values.slice(at, at + size))
  return runs
}

/** The first instant of tomorrow in the studio's own zone, which is where "today" ends. */
export function tomorrowFrom(now = new Date()) {
  const [year, month, day] = dayIn(now).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
  return instantOf(next)
}

// ── Work of ours in its trade or town ─────────────────────────────────────

/**
 * Whether the studio has built for this business's trade or in its town, which
 * the ranking leans on and the row says.
 *
 * Asked the way the letters ask it, through `sharesTrade`, because calling a
 * pest control company's line of work a go-kart track is how that claim breaks.
 */
function proofOf(row) {
  if (row.trade && PORTFOLIO_PROJECTS.some(project => sharesTrade(project, row.trade))) {
    return 'trade'
  }
  if (row.town && PROOF_TOWNS.includes(String(row.town).toLowerCase())) return 'town'
  return null
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** Every call to each of these businesses, newest first, by business. */
async function callsFor(db, ids) {
  const held = new Map(ids.map(id => [id, []]))
  const runs = await Promise.all(
    runsOf(ids, IDS_AT_ONCE).map(async run => {
      const { data, error } = await db
        .from(CALLS)
        .select(CALL_COLUMNS)
        .in('prospect_id', run)
        .order('called_at', { ascending: false })
      if (error) throw error
      return data || []
    })
  )
  for (const call of runs.flat()) held.get(call.prospect_id)?.push(call)
  return held
}

/** These businesses, read whole. */
async function rowsById(db, ids) {
  const runs = await Promise.all(
    runsOf(ids, IDS_AT_ONCE).map(async run => {
      const { data, error } = await db.from(PROSPECTS).select(DETAIL).in('id', run)
      if (error) throw error
      return data || []
    })
  )
  return runs.flat()
}

/**
 * Every listing's name, number and town, which is what a chain and a shared
 * number are read off. It is the whole table rather than the callable set,
 * because a franchise's other offices mostly have sites of their own. Kept for
 * half an hour per instance: listings arrive by the sweep, not by the minute.
 */
let listings = null

function listingIndex(db) {
  if (listings?.db === db && Date.now() - listings.at < INDEX_KEPT_MS) return listings.read
  const read = readAll(() =>
    db.from(PROSPECTS).select('name, phone, town', { count: 'exact' }).order('id')
  ).then(answer => answer.rows)
  listings = { db, at: Date.now(), read }
  read.catch(() => {
    if (listings?.read === read) listings = null
  })
  return read
}

/** The numbers called under any listing, read fresh: the last call is part of it. */
async function calledNumbers(db) {
  const { rows } = await readAll(() =>
    db.from(CALLS).select('id, outreach_prospects(phone)', { count: 'exact' }).order('id')
  )
  return rows.map(call => ({ phone: call.outreach_prospects?.phone ?? null }))
}

/** The index the list's rules are read against. */
async function listIndex(db) {
  const [all, called] = await Promise.all([listingIndex(db), calledNumbers(db)])
  return indexOf(all, called)
}

/** One business as the page draws it. */
function shaped(row, calls, extra = {}) {
  const drawn = {
    id: row.id,
    name: row.name,
    trade: row.trade ?? null,
    town: row.town ?? null,
    address: row.address ?? null,
    phone: row.phone,
    dial: dialHref(row.phone),
    website: row.website ?? null,
    site_kind: row.site_kind ?? null,
    email: row.email ?? null,
    rating: row.rating ?? null,
    rating_count: row.rating_count ?? null,
    business_status: row.business_status ?? null,
    audit_score: row.audit_score ?? null,
    trade_median: row.trade_median ?? null,
    proof: proofOf(row),
    call_due_reason: extra.due?.kind === 'asked' ? (row.call_due_reason ?? null) : null,
    new_business: Boolean(extra.newBusiness),
    formed_on: extra.formedOn ?? null,
    due: extra.due ?? null,
    calls: calls.map(call => ({
      id: call.id,
      outcome: call.outcome,
      note: call.note ?? null,
      callback_at: call.callback_at ?? null,
      called_at: call.called_at ?? null,
    })),
  }
  drawn.reasons = reasonsFor(drawn)
  return drawn
}

/**
 * The calls owed today: a call back set for any time before tomorrow on the
 * newest call to a business, and a call a chain asked for that nobody has made
 * since. Oldest first, so the most overdue leads.
 *
 * Only the newest call's time counts. A business rung again after a call back
 * was set has been dealt with, and the newer call says what happens next.
 */
async function dueList(db, now) {
  const before = tomorrowFrom(now).toISOString()
  // Read as instants: the column comes back as `+00:00` and a string compare
  // against a `Z` would be deciding on punctuation.
  const sooner = (one, two) => Date.parse(one) < Date.parse(two)
  const [promised, asked] = await Promise.all([
    db
      .from(CALLS)
      .select('prospect_id')
      .not('callback_at', 'is', null)
      .lt('callback_at', before)
      .limit(2000),
    db
      .from(PROSPECTS)
      .select(DETAIL)
      .not('call_due_at', 'is', null)
      .lt('call_due_at', before)
      .limit(500),
  ])
  if (promised.error) throw promised.error
  if (asked.error) throw asked.error

  const chained = new Map((asked.data || []).map(row => [row.id, row]))
  const wanted = [...new Set((promised.data || []).map(one => one.prospect_id))].filter(
    id => !chained.has(id)
  )
  const [read, history] = await Promise.all([
    rowsById(db, wanted),
    callsFor(db, [...new Set([...wanted, ...chained.keys()])]),
  ])

  const due = []
  for (const row of [...chained.values(), ...read]) {
    // The same door every call goes through: nobody who asked to stop, no
    // closed business, nothing with no number, however the time was set.
    if (!isCallable(row)) continue
    const calls = history.get(row.id) ?? []
    const last = calls[0] ?? null
    let owed = null
    if (last?.callback_at && sooner(last.callback_at, before) && !outcomeEnds(last.outcome)) {
      owed = { kind: 'callback', at: last.callback_at }
    } else if (
      row.call_due_at &&
      sooner(row.call_due_at, before) &&
      (!last || sooner(last.called_at, row.call_due_at))
    ) {
      owed = { kind: 'asked', at: row.call_due_at }
    }
    if (owed) due.push(shaped(row, calls, { due: owed }))
  }
  return due.sort((one, two) => Date.parse(one.due.at) - Date.parse(two.due.at))
}

/** One page of the ranking, with the list's rules applied. */
async function bestList(db, page, now, index, taken) {
  const { data, error } = await db.rpc('call_list_page', {
    p_view: 'list',
    p_sort: 'best',
    p_take: PAGE_TAKE,
    p_page: page,
    // Never called, and the ranking's own idea of a call back that has come
    // due, which the rules below drop for already having a call. Call backs
    // are read by `dueList`, against today rather than against the ranking's
    // fortnight.
    p_state: 'fresh',
    p_now: now.toISOString(),
    // The readings the score leans on that are not in the database: the trades
    // and towns the studio holds work in, and the hosts that are a platform
    // rather than a site of the business's own.
    p_proof_trades: PROOF_TRADES,
    p_proof_towns: PROOF_TOWNS,
    p_trade_aliases: TRADE_ALIASES,
    p_booking_hosts: BOOKING_HOSTS,
    p_portal_hosts: PORTAL_HOSTS,
    p_platform_hosts: PLATFORM_HOSTS,
    p_max: SET_MAX,
  })
  if (error) throw error

  // The new-business companies have their own view, since the review ranking
  // has nothing to read them by.
  const ranked = (data?.rows ?? []).filter(row => row.skip_reason !== PHONE_ONLY_REASON)
  const rows = kept(ranked, index, taken).map(row => shaped(row, []))
  return { rows, page: data?.page ?? page, pages: data?.pages ?? page }
}

/** The new-business pipeline's phone-only companies nobody has called, newest first. */
async function newList(db, index, taken) {
  const [mirrored, filed] = await Promise.all([
    db
      .from(PROSPECTS)
      .select(DETAIL)
      .eq('source', MIRROR_SOURCE)
      .eq('skip_reason', PHONE_ONLY_REASON)
      .limit(2000),
    db.from(NEW_LEADS).select('prospect_id, formed_on').eq('stage', 'phone_only').limit(2000),
  ])
  if (mirrored.error) throw mirrored.error
  if (filed.error) throw filed.error

  const formed = new Map((filed.data || []).map(one => [one.prospect_id, one.formed_on]))
  const callable = (mirrored.data || []).filter(isCallable)
  const history = await callsFor(
    db,
    callable.map(row => row.id)
  )
  const candidates = callable
    .map(row => ({ ...row, calls: history.get(row.id) ?? [] }))
    .sort(
      (one, two) =>
        String(formed.get(two.id) ?? '').localeCompare(String(formed.get(one.id) ?? '')) ||
        String(one.name).localeCompare(String(two.name))
    )
  return kept(candidates, index, taken).map(row =>
    shaped(row, [], { newBusiness: true, formedOn: formed.get(row.id) ?? null })
  )
}

/** The list, as the page draws it. */
export async function list(db, query, now = new Date()) {
  const view = VIEWS.includes(query.view) ? query.view : VIEWS[0]
  const page = view === 'best' ? pageOf(query.page) : 1

  const [due, index] = await Promise.all([dueList(db, now), listIndex(db)])
  // A number on the list once is on it once: a call back holds its number, and
  // a second listing of it further down is the same phone ringing.
  const taken = new Set(due.map(row => phoneKey(row.phone)).filter(Boolean))

  if (view === 'new') {
    const rows = await newList(db, index, taken)
    return { status: 200, body: { view, due, rows, page: 1, pages: 1 } }
  }
  const best = await bestList(db, page, now, index, taken)
  return {
    status: 200,
    body: { view, due: page === 1 ? due : [], rows: best.rows, page: best.page, pages: best.pages },
  }
}

// ── Recording a call ───────────────────────────────────────────────────────

/**
 * A call back time the column will take, or the reason it will not.
 *
 * A time in the past is refused rather than clamped: a call back puts a
 * business back on the list at a time that has not happened yet.
 */
function callbackAt(value) {
  if (value === null || value === undefined || value === '') return { at: null }
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return { error: 'That call back time could not be read.' }
  const now = Date.now()
  if (when.getTime() <= now) return { error: 'A call back has to be set for a time still to come.' }
  if (when.getTime() > now + CALLBACK_MAX_DAYS * 86_400_000) {
    return { error: 'A call back can be set up to a year out.' }
  }
  return { at: when.toISOString() }
}

/** One call recorded against one business. */
export async function record(db, body, account) {
  const prospectId = uuid(body.id)
  if (!prospectId) return { status: 400, body: { error: 'Pick the business the call was to.' } }

  const outcome = String(body.outcome ?? '')
  if (!OFFERED_OUTCOMES.includes(outcome)) {
    return { status: 400, body: { error: 'Pick what the call came to.' } }
  }

  const callback = callbackAt(body.callback_at)
  if (callback.error) return { status: 400, body: { error: callback.error } }
  // Only Call Back carries a time. A time on anything else is a form that
  // disagrees with the button it was sent under, and on an outcome that ends
  // the list it would be a promise nothing ever reads.
  if (callback.at && !outcomeTakesCallback(outcome)) {
    return { status: 400, body: { error: 'Only a Call Back takes a time.' } }
  }
  // A call back nobody put a clock on is filed a day out rather than refused.
  const ringBack =
    outcomeTakesCallback(outcome) && !callback.at
      ? defaultCallbackAt(new Date()).toISOString()
      : callback.at

  // The row has to be one this list would actually have offered. Without this
  // an id copied from anywhere else would write a call against a business that
  // unsubscribed, which is the one thing this section must not do.
  const found = await db
    .from(PROSPECTS)
    .select(
      'id, name, phone, email, trade, town, website, site_kind, stage, business_status, call_due_at'
    )
    .eq('id', prospectId)
    .maybeSingle()
  if (found.error) return refusal(found.error, NOT_RECORDED)
  if (!found.data) return { status: 404, body: { error: 'That business is no longer on file.' } }
  if (!isCallable(found.data)) {
    return { status: 409, body: { error: 'That business is not on the call list.' } }
  }

  const interested = interestIn(outcome)
  const written = await db
    .from(CALLS)
    .insert({
      prospect_id: prospectId,
      outcome,
      note: field(body.note, NOTE_MAX),
      interested,
      callback_at: ringBack,
      called_by: account.userId,
    })
    .select('id, called_at')
    .maybeSingle()
  if (written.error) return refusal(written.error, NOT_RECORDED)

  await carry(db, found.data, body, ringBack, interested)

  return {
    status: 200,
    body: {
      ok: true,
      call: written.data?.id ?? null,
      called_at: written.data?.called_at ?? null,
      callback_at: ringBack,
    },
  }
}

/**
 * A business that wanted this, carried into the lead record.
 *
 * A cold prospect is not a lead. What changes that is a call that reached
 * somebody, which is why a number that rang out carries nothing here and a
 * conversation and a call back both do.
 *
 * Failure here is swallowed. The call is already on the record and is owed its
 * confirmation; a lead that missed its row is worth less than being told a call
 * did not save.
 */
async function carry(db, prospect, body, callbackAt, interested) {
  if (!callMakesLead(String(body.outcome ?? ''), interested)) return

  try {
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

    // Stamped rather than merged: the studio has now spoken to this person,
    // and it owes them a call back on the day that was written down.
    const { error } = await db
      .from(SPINE)
      .update({
        contacted_at: new Date().toISOString(),
        ...(callbackAt ? { due_at: callbackAt } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id)
    if (error) console.error('calls-admin: the lead was not stamped: %s', error.message)
  } catch (cause) {
    console.error('calls-admin: the lead was not kept: %s', cause?.message || cause)
  }
}

// ── Photos ─────────────────────────────────────────────────────────────────

/**
 * One business's photos, read off the Google listing it was found through.
 *
 * Asked for one business at a time and only when somebody presses for them:
 * each photo is a billed request to Google. `listed` says which nothing an
 * empty answer is - no listing on file, or a listing with no photos.
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

  const held = keptPhotos(data.place_photos)
  let listed = held.fresh ? held.photos : null
  if (!listed) {
    try {
      listed = await listingPhotos(data.place_id, { key: PLACES_KEY })
      await keepPhotos(db, id, listed)
    } catch (cause) {
      // Where this business has been read before, the descriptors on the row
      // name the same photos.
      if (!held.photos) {
        console.error('calls-admin photos: %s', cause.message)
        return { status: 502, body: { error: PHOTOS_UNREAD } }
      }
      console.error('calls-admin photos: %s, showing what is on file', cause.message)
      listed = held.photos
    }
  }
  const found = await photoAddresses(listed, { key: PLACES_KEY })
  return { status: 200, body: { photos: found, listed: true } }
}

/** The photo descriptors on a business's row, and whether they are recent enough to reuse. */
function keptPhotos(held) {
  const photos = Array.isArray(held?.photos) ? held.photos : null
  if (!photos) return { photos: null, fresh: false }
  const at = Date.parse(held?.at ?? '')
  const fresh = Number.isFinite(at) && Date.now() - at < PHOTOS_KEPT_MS
  return { photos, fresh }
}

/** Keep what the listing answered on the business's row, for the next look. */
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
    const account = await authorizeAdmin(wired, authorization)
    if (account.status) return response.status(account.status).json({ error: account.error })

    const query = request.query ?? {}
    let answer
    try {
      answer =
        request.method === 'POST'
          ? await record(wired.db, request.body ?? {}, account)
          : query.photos
            ? await photos(wired.db, query.photos)
            : await list(wired.db, query)
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
