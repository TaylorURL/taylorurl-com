/**
 * The Call List: the businesses worth ringing, the call backs that are due,
 * the day's calls against the day's goal, and the record of every call.
 *
 * It is the owner's list and nobody else's. Every request is held to the admin
 * door, and there is no team behind it: no claims, no presence, no shifts.
 *
 * GET answers the list, or with `photos` naming a business, that business's
 * photos off its Google listing. The list is one list, in four parts:
 *
 * - `engaged`: the businesses that answered the mail and have not been rung
 *   since - a person opened what the studio sent more than once, followed the
 *   link to its preview site, or wrote back - replies first, then the more a
 *   business did on its preview site the higher (`engaged.js`). They are the
 *   warmest numbers on the list, so they lead it, whatever their site.
 * - `due`: every call back due today or overdue, and every call a chain has
 *   asked for, oldest first.
 * - `rows`: the businesses never called, highest score first, a page at a
 *   time. The map sweep's businesses with no site of their own and every new
 *   company with a phone number are on it together, scored the same way
 *   (`callScore.js`), with the rules in `callList.js` taking out the closed,
 *   the chains, the shared numbers, the Google listings nobody has reviewed
 *   and the ones far busier than their trade. A business is scored as the
 *   company its listings make together (`companies.js`): a supplier with three
 *   yards under two spellings is a staffed supplier, not three contractors.
 * - `waiting`: the businesses whose last call reached a front desk. They sit
 *   below everything fresh until the time the front desk gave comes round,
 *   when the call back it booked moves them up into `due`.
 *
 * `today` is the calls made since midnight in Central, against the goal.
 *
 * Every business on it also carries what has passed between the studio and
 * that company on Facebook, read off `outreach_social_actions`
 * (`social.js`): the comments, messages and posts in the words they were
 * sent in, the follows and reactions a line each, latest first, with the Page
 * the company was identified by and how well that identity is known. It is
 * there because the owner is on the phone and wants to know what this company
 * has already seen from him before he says anything. A company that has
 * answered on Facebook inside the window also comes up the order, by what its
 * answer was worth; the studio's own comments and follows move nothing, and
 * nothing in these two tables puts a business on the list that the list's own
 * rules would not have offered.
 *
 * The scoring is done here rather than in the database because it is one
 * module the endpoint and the check both run, so the order on the page is the
 * order the check worked through by hand. What it reads is held for a few
 * minutes per instance - the callable set, the trade table, the registration
 * dates, and every listing on the table with the companies they make - since
 * none of it moves by the minute; the calls are read fresh, and so is every business on the page
 * before it is drawn, so a business that asked to stop is never offered off a
 * stale read.
 *
 * POST records one call: an outcome, a note in the owner's own words, a time
 * for Call Back and Front Desk and a follow-up day for Pipeline, and for Front
 * Desk the owner's name and direct number where the front desk gave them. A
 * call that reached somebody who could buy becomes a lead, and Pipeline files
 * that lead in the sales pipeline (`pipeline_at`), which the pipeline routine
 * on the Pi reads into its own record and report. Nothing here sends anything; the point of this
 * section is that a person picks up a phone.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { countOf, readAll, tableMissing } from '../lib/db/rows.js'
import { field, uuid } from '../lib/db/fields.js'
import { SOURCES, SPINE, keepLead } from '../lib/leads/spine.js'
import { dayIn, instantOf } from '../lib/time/zone.js'
import {
  DAILY_CALL_GOAL,
  FRONT_DESK,
  NEW_BUSINESS_SOURCE,
  OFFERED_OUTCOMES,
  PAST_CALLING,
  callMakesLead,
  defaultCallbackAt,
  dialHref,
  interestIn,
  isCallable,
  isNewBusiness,
  isRingable,
  outcomeAsksOwner,
  outcomeEnds,
  outcomeFilesPipeline,
  outcomeTakesCallback,
} from '../lib/outreach/prospects/calls.js'
import {
  OPEN_LOOKBACK_DAYS,
  byEngagement,
  engagementOf,
  looksAutomatic,
  siteActivity,
} from '../lib/outreach/prospects/engaged.js'
import { newText, readAutoReply, readOptOut } from '../lib/outreach/sending/replies.js'
import {
  atFrontDesk,
  byOwnerDue,
  byScore,
  indexOf,
  kept,
  phoneKey,
  reasonsFor,
  spokenNumber,
  tradeMedians,
} from '../lib/outreach/prospects/callList.js'
import { factsOf, numbersOf, ownerDigits, scoreOf } from '../lib/outreach/prospects/callScore.js'
import {
  SOCIAL_LOOKBACK_DAYS,
  engageBackOf,
  socialHistoryOf,
} from '../lib/outreach/prospects/social.js'
import { companiesOf } from '../lib/outreach/prospects/companies.js'
import { bareHost, hostOf } from '../lib/outreach/prospects/platforms.js'
import { listingPhotos, photoAddresses } from '../lib/outreach/prospects/placePhotos.js'

const PROSPECTS = 'outreach_prospects'
const CALLS = 'outreach_calls'
const MESSAGES = 'outreach_messages'
const VISITS = 'preview_sessions'
const VISIT_EVENTS = 'preview_events'
const NEW_LEADS = 'new_business_leads'
const METRICS = 'call_trade_metrics'
const SOCIAL = 'outreach_social_actions'
const FACEBOOK_PAGES = 'outreach_prospect_facebook_pages'

/** The key the map sweep searches with, which also reads a listing's photos. */
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || ''

/** How many never-called businesses one page of the list carries, after the rules. */
const PAGE_TAKE = 100

/** The callable set's ceiling, well above the four thousand rows that qualify. */
const SET_MAX = 6000

/** The columns a business is read with. */
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
  'source',
  'source_ref',
  'rating',
  'rating_count',
  'business_status',
  'skip_reason',
  'email',
  'audit_score',
  'call_due_at',
  'call_due_reason',
  'replied_at',
  'owner_name',
  'owner_phone',
  'owner_source',
  'owner_name_confirmed',
  'owner_phone_confirmed',
  'owner_phone_source',
  'place_type',
  'registered_on',
  'officer_count',
].join(', ')

/**
 * The columns every listing on the table is read with: what a chain and a
 * shared number are read off, what a trade's share of sites is read off, and
 * what joins listings into one company and says how big it is.
 */
const LISTING = [
  'id',
  'name',
  'phone',
  'town',
  'trade',
  'site_kind',
  'website',
  'address',
  'source',
  'place_type',
  'registered_on',
  'officer_count',
].join(', ')

/** The columns of a sent message an open is read from. */
const OPEN_COLUMNS = 'id, prospect_id, sent_at, opened_at, last_open_at, open_count'

/** The columns of a visit to a preview site that say what a person did there. */
const VISIT_COLUMNS =
  'id, prospect_id, started_at, last_seen_at, pages, active_ms, max_scroll, clicks, calls, emails, ctas, form_submits'

/** The kind the preview's tracker gives a tap on Make It Yours. */
const CLAIM_KIND = 'claim'

/** The columns of a reply that say who wrote it and what they said. */
const REPLY_COLUMNS = 'id, prospect_id, subject, body_text, created_at'

/** The columns of a lead that say the studio has already decided about it. */
const LEAD_STANDING = 'source_ref, dismissed_at, bought_at'

/** The columns of a call the history draws. */
const CALL_COLUMNS = 'id, prospect_id, outcome, note, callback_at, called_at'

/** The columns of a Facebook action the card draws. */
const SOCIAL_COLUMNS = [
  'id',
  'prospect_id',
  'direction',
  'action_type',
  'status',
  'interest',
  'acted_at',
  'exact_text',
  'summary',
  'reaction_kind',
  'page_url',
  'source_url',
  'group_name',
  'notes',
].join(', ')

/**
 * The columns the ranking needs off a company's own move, which is less than
 * the card draws: the whole table is read for this and none of the words are
 * wanted.
 */
const ENGAGED_BACK_COLUMNS = 'id, prospect_id, direction, action_type, status, interest, acted_at'

/** The columns of a Facebook Page mapping. */
const PAGE_COLUMNS =
  'prospect_id, page_url, page_id, page_name, verification, verified_at, found_at_url, notes, created_at'

/**
 * The ceiling on the engage-back read, well above the handful of rows the
 * social routine writes in a quarter. It is stated rather than trusted: the
 * read covers the whole table and the list it feeds is the order of a day's
 * calls.
 */
const SOCIAL_SET_MAX = 20_000

/**
 * How many actions one run of a hundred businesses draws, newest first.
 *
 * Newest first is what makes the cap safe: the rows it leaves behind are the
 * oldest, which is also what the card drops when it cuts a long history, so
 * the cap and the card agree on what gets left out.
 */
const SOCIAL_ROWS_AT_ONCE = 2000

/** The columns of every call, which the rules and the measured readings are read from. */
const TALLY_COLUMNS =
  'id, prospect_id, outcome, interested, callback_at, called_at, outreach_prospects(phone, trade)'

/** How many ids one `in` filter carries, which keeps the address short. */
const IDS_AT_ONCE = 100

/** How long the index of every listing's name, number, trade and site is reused. */
const INDEX_KEPT_MS = 30 * 60 * 1000

/** How long the callable set, the trade table and the registration dates are reused. */
const POOL_KEPT_MS = 10 * 60 * 1000

/** A note is a person's own sentence, and the column holds this much of one. */
const NOTE_MAX = 2000

/** An owner's name as a front desk gives it. */
const OWNER_NAME_MAX = 120

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

/** The first instant of today in the studio's own zone, where the day's count starts. */
export function todayFrom(now = new Date()) {
  return instantOf(dayIn(now))
}

/** The first instant of tomorrow in the studio's own zone, which is where "today" ends. */
export function tomorrowFrom(now = new Date()) {
  const [year, month, day] = dayIn(now).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
  return instantOf(next)
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

/**
 * A social read's answer, or nothing where the tables are not in this
 * database yet.
 *
 * The Call List is the owner's phone list and the Facebook history is context
 * beside it, so a history that will not come back is drawn as no history
 * rather than taking the numbers off the screen with it. The two tables being
 * absent is passed over without a word, because that is a deployment standing
 * ahead of its migration and says nothing about any row. Anything else is
 * logged, since a read that keeps failing has to be findable.
 */
async function socialOrNone(read, what) {
  try {
    return await read()
  } catch (cause) {
    if (!tableMissing(cause)) {
      console.error('calls-admin: %s did not come back: %s', what, cause?.message || cause)
    }
    return null
  }
}

/**
 * The strongest move each company has made toward the studio on Facebook
 * lately, across the whole table.
 *
 * Read whole rather than for the page being drawn, because this is what the
 * ranking multiplies by: a company that wrote back has to come up the order
 * before anybody scrolls to it. It is the inbound rows only, confirmed only,
 * and only inside the window `social.js` holds them to, so what travels is
 * the handful of rows that can still lift a score.
 */
async function engagedBackBy(db, now) {
  const since = new Date(now.getTime() - SOCIAL_LOOKBACK_DAYS * 86_400_000).toISOString()
  const { rows } = await readAll(
    () =>
      db
        .from(SOCIAL)
        .select(ENGAGED_BACK_COLUMNS, { count: 'exact' })
        .eq('direction', 'inbound')
        .eq('status', 'confirmed')
        .gte('acted_at', since)
        .order('id'),
    { max: SOCIAL_SET_MAX }
  )
  const own = new Map()
  for (const row of rows) {
    if (!own.has(row.prospect_id)) own.set(row.prospect_id, [])
    own.get(row.prospect_id).push(row)
  }
  const found = new Map()
  for (const [id, moves] of own) {
    const back = engageBackOf(moves, now)
    if (back) found.set(id, back)
  }
  return found
}

/**
 * Each of these businesses' Facebook history as the card draws it: every
 * action on it latest first, and the Page it was identified by.
 *
 * Only the businesses actually on the screen, since this is the part that
 * carries the words.
 */
async function socialFor(db, ids, now) {
  if (!ids.length) return new Map()
  const [actions, pages] = await Promise.all([
    Promise.all(
      runsOf(ids, IDS_AT_ONCE).map(async run => {
        const { data, error } = await db
          .from(SOCIAL)
          .select(SOCIAL_COLUMNS)
          .in('prospect_id', run)
          .order('acted_at', { ascending: false })
          .limit(SOCIAL_ROWS_AT_ONCE)
        if (error) throw error
        return data || []
      })
    ),
    Promise.all(
      runsOf(ids, IDS_AT_ONCE).map(async run => {
        const { data, error } = await db
          .from(FACEBOOK_PAGES)
          .select(PAGE_COLUMNS)
          .in('prospect_id', run)
        if (error) throw error
        return data || []
      })
    ),
  ])
  const held = new Map(ids.map(id => [id, { actions: [], pages: [] }]))
  for (const action of actions.flat()) held.get(action.prospect_id)?.actions.push(action)
  for (const page of pages.flat()) held.get(page.prospect_id)?.pages.push(page)
  const drawn = new Map()
  for (const [id, own] of held) {
    const history = socialHistoryOf({ ...own, now })
    if (history) drawn.set(id, history)
  }
  return drawn
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
 * A read held for a while per instance, keyed by the client it was read
 * through, and let go of if it failed so the next request asks again.
 */
function heldFor(keptMs, read) {
  let held = null
  return db => {
    if (held?.db === db && Date.now() - held.at < keptMs) return held.read
    const reading = read(db)
    held = { db, at: Date.now(), read: reading }
    reading.catch(() => {
      if (held?.read === reading) held = null
    })
    return reading
  }
}

/**
 * Every listing on the table, and the companies they make: a chain and a
 * shared number are read off the names, numbers and towns, the part of a trade
 * with a site of its own off the trades and sites, and which listings are one
 * company - and how many locations, what industry and what state record it
 * has - off all of them (`companiesOf`). It is the whole table rather than the
 * callable set, because a franchise's other offices, a trade's other
 * businesses and a supplier's other yards mostly have sites of their own.
 */
const listingIndex = heldFor(INDEX_KEPT_MS, db =>
  readAll(() => db.from(PROSPECTS).select(LISTING, { count: 'exact' }).order('id')).then(
    answer => ({ rows: answer.rows, companies: companiesOf(answer.rows) })
  )
)

/**
 * Everything the list could offer, and what scores it that is not on the row:
 * every business with a number that is not past calling and either has no
 * site of its own or is a new company, the trade table, and the day each new
 * company was registered, by its taxpayer number.
 */
const callablePool = heldFor(POOL_KEPT_MS, async db => {
  const [listed, metrics, filed] = await Promise.all([
    readAll(
      () =>
        db
          .from(PROSPECTS)
          .select(DETAIL, { count: 'exact' })
          .not('phone', 'is', null)
          .or(`site_kind.in.(none,social),source.eq.${NEW_BUSINESS_SOURCE}`)
          .not('stage', 'in', `(${PAST_CALLING.join(',')})`)
          .order('id'),
      { max: SET_MAX }
    ),
    db.from(METRICS).select('trade, solo_share, avg_sales'),
    readAll(() =>
      db
        .from(NEW_LEADS)
        .select('taxpayer_number, formed_on', { count: 'exact' })
        .not('stage', 'in', '(waiting,gave_up)')
        .order('id')
    ),
  ])
  if (metrics.error) throw metrics.error
  return {
    rows: listed.rows,
    metrics: metrics.data ?? [],
    formed: new Map(filed.rows.map(one => [one.taxpayer_number, one.formed_on])),
  }
})

/**
 * Every call on record with the number and trade it went to, read fresh: the
 * last call is what decides whether a business is still on the list.
 */
async function allCalls(db) {
  const { rows } = await readAll(() =>
    db.from(CALLS).select(TALLY_COLUMNS, { count: 'exact' }).order('id')
  )
  return rows.map(call => ({
    id: call.id,
    prospect_id: call.prospect_id,
    outcome: call.outcome,
    interested: call.interested ?? null,
    callback_at: call.callback_at ?? null,
    called_at: call.called_at ?? null,
    phone: call.outreach_prospects?.phone ?? null,
    trade: call.outreach_prospects?.trade ?? null,
  }))
}

/** Every call recorded since midnight in Central: every row, whatever it came to. */
function callsToday(db, now = new Date()) {
  return countOf(
    db
      .from(CALLS)
      .select('id', { count: 'exact', head: true })
      .gte('called_at', todayFrom(now).toISOString())
  )
}

/** The day each new company was registered on, where the row is one. */
function formedOn(row, formed) {
  return isNewBusiness(row) ? (formed?.get(row.source_ref) ?? null) : null
}

/**
 * Where an owner's name or number came from, as the page names it: a list of
 * sources, each with the words for it and a link where it was a page.
 *
 * The owner finder writes the pages it read - one address, or several
 * separated by spaces - and may name a source that is not a page, such as a
 * contact service; a Front Desk call writes `call`. A host written on its own
 * is named as written.
 *
 * @returns {Array<{label: string, href: string|null}>|null}
 */
function sourcesOf(text) {
  const seen = new Map()
  for (const token of String(text ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)) {
    if (token.toLowerCase() === 'call') seen.set('a call', { label: 'a call', href: null })
    else if (/^https?:\/\//i.test(token)) {
      const host = hostOf(token)
      if (host && !seen.has(host)) seen.set(host, { label: host, href: token })
    } else {
      const label = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(token) ? bareHost(token) : token
      if (!seen.has(label)) seen.set(label, { label, href: null })
    }
  }
  return seen.size ? [...seen.values()] : null
}

/**
 * Where the owner's number came from: its own column, or for a number a Front
 * Desk call wrote before that column existed, the call that wrote it.
 */
function phoneSourceOf(row) {
  return row?.owner_phone_source ?? (row?.owner_source === 'call' ? 'call' : null)
}

/**
 * What the page draws about the owner: the name, the owner's own number where
 * it is not the listing's, whether two sources agree on each, and where each
 * came from.
 */
function ownerFields(row) {
  const digits = ownerDigits(row)
  const name = String(row?.owner_name ?? '').trim() || null
  return {
    owner_name: name,
    owner_name_confirmed: Boolean(name && row?.owner_name_confirmed === true),
    owner_phone: digits ? spokenNumber(digits) : null,
    owner_phone_confirmed: Boolean(digits && row?.owner_phone_confirmed === true),
    owner_from: name ? sourcesOf(row?.owner_source) : null,
    owner_phone_from: digits ? sourcesOf(phoneSourceOf(row)) : null,
  }
}

/**
 * One business as the page draws it.
 *
 * The number to dial is the owner's where one is on file - from a Front Desk
 * call or the owner finder - and the listing's otherwise; both are drawn. An
 * owner's number that is the listing's own main line is not the owner's. Any
 * other number the same one-location company is listed under is drawn after
 * them, as another line to try.
 */
function shaped(
  row,
  calls,
  { facts, formed, companies, engagedBack, now, due = null, engaged = null } = {}
) {
  const formedDay = formedOn(row, formed)
  const company = companies?.get(row.id) ?? null
  const back = engagedBack?.get(row.id) ?? null
  const score = scoreOf({ ...row, formed_on: formedDay, company, engaged_back: back }, facts, now)
  const last = calls[0] ?? null
  const owner = ownerDigits(row)
  const main = phoneKey(row.phone)
  const others = numbersOf({ ...row, company }).filter(ten => ten !== owner && ten !== main)
  const drawn = {
    id: row.id,
    name: row.name,
    trade: row.trade ?? null,
    town: row.town ?? null,
    address: row.address ?? null,
    phone: row.phone,
    ...ownerFields(row),
    dial: dialHref(owner ?? row.phone),
    other_numbers: others.map(spokenNumber),
    website: row.website ?? null,
    site_kind: row.site_kind ?? null,
    email: row.email ?? null,
    rating: row.rating ?? null,
    rating_count: row.rating_count ?? null,
    business_status: row.business_status ?? null,
    audit_score: row.audit_score ?? null,
    call_due_reason: due?.kind === 'asked' ? (row.call_due_reason ?? null) : null,
    new_business: isNewBusiness(row),
    formed_on: formedDay,
    score: { owner: score.owner, need: score.need, budget: score.budget, total: score.total },
    due,
    engaged,
    engaged_back: back,
    // The history itself is read for the businesses actually drawn and put on
    // the row in `list`, since it is the part that carries the words.
    social: null,
    front_desk: !due && last?.outcome === FRONT_DESK ? { at: last.callback_at ?? null } : null,
    calls: calls.map(call => ({
      id: call.id,
      outcome: call.outcome,
      note: call.note ?? null,
      callback_at: call.callback_at ?? null,
      called_at: call.called_at ?? null,
    })),
  }
  drawn.reasons = reasonsFor({ ...row, ...drawn, score })
  return drawn
}

/**
 * The calls owed today: a call back set for any time before tomorrow on the
 * newest call to a business, and a call a chain asked for that nobody has made
 * since. Oldest first, so the most overdue leads.
 *
 * Only the newest call's time counts. A business rung again after a call back
 * was set has been dealt with, and the newer call says what happens next. A
 * Front Desk call books its call back the same way, so a business waiting on
 * its owner comes up here on the day the front desk said.
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
    const calls = history.get(row.id) ?? []
    // The same door every call goes through: nobody who asked to stop, no
    // closed business, nothing with no number, however the time was set. A
    // business already rung is held only to the floor of that door: it was
    // offered once, so a call back booked on it is owed even where it came
    // onto the list by answering the mail rather than by having no site.
    if (!isCallable(row) && !(calls.length && isRingable(row))) continue
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
    if (owed) due.push({ row, calls, owed })
  }
  return due.sort((one, two) => Date.parse(one.owed.at) - Date.parse(two.owed.at))
}

/**
 * The newest reply a person typed to each of these businesses, with what they
 * said: the opt-outs and the auto-responders are passed over, both the ones
 * the mailbox reader knew and the ones it did not (`looksAutomatic`).
 */
async function repliesFor(db, ids) {
  const said = new Map()
  const runs = await Promise.all(
    runsOf(ids, IDS_AT_ONCE).map(async run => {
      const { data, error } = await db
        .from(MESSAGES)
        .select(REPLY_COLUMNS)
        .eq('direction', 'inbound')
        .in('prospect_id', run)
      if (error) throw error
      return data || []
    })
  )
  for (const reply of runs.flat()) {
    const body = String(reply.body_text ?? '')
    if (readOptOut(body).optOut || readAutoReply(reply.subject, body).auto) continue
    if (looksAutomatic(reply.subject, body)) continue
    const held = said.get(reply.prospect_id)
    if (held && Date.parse(held.at) >= Date.parse(reply.created_at)) continue
    said.set(reply.prospect_id, { at: reply.created_at, text: newText(body) || body })
  }
  return said
}

/** Where the studio has already decided about each business: ruled out, or a client. */
async function standingsFor(db, ids) {
  const held = new Map()
  const runs = await Promise.all(
    runsOf(ids, IDS_AT_ONCE).map(async run => {
      const { data, error } = await db.from(SPINE).select(LEAD_STANDING).in('source_ref', run)
      if (error) throw error
      return data || []
    })
  )
  for (const lead of runs.flat()) {
    const was = held.get(lead.source_ref) ?? { dismissed_at: null, bought_at: null }
    held.set(lead.source_ref, {
      dismissed_at: lead.dismissed_at ?? was.dismissed_at,
      bought_at: lead.bought_at ?? was.bought_at,
    })
  }
  return held
}

/**
 * When each letter went to each of these businesses, which says which visits
 * to a preview site came too soon after one to be a person.
 */
async function sendsFor(db, ids) {
  const held = new Map(ids.map(id => [id, []]))
  const runs = await Promise.all(
    runsOf(ids, IDS_AT_ONCE).map(async run => {
      const { data, error } = await db
        .from(MESSAGES)
        .select('prospect_id, sent_at')
        .eq('direction', 'outbound')
        .not('sent_at', 'is', null)
        .in('prospect_id', run)
      if (error) throw error
      return data || []
    })
  )
  for (const message of runs.flat()) held.get(message.prospect_id)?.push(message.sent_at)
  return held
}

/** How many times each of these visits tapped Make It Yours. */
async function claimsFor(db, ids) {
  const held = new Map()
  const runs = await Promise.all(
    runsOf(ids, IDS_AT_ONCE).map(async run => {
      const { data, error } = await db
        .from(VISIT_EVENTS)
        .select('session_id')
        .eq('type', 'click')
        .eq('kind', CLAIM_KIND)
        .in('session_id', run)
      if (error) throw error
      return data || []
    })
  )
  for (const event of runs.flat()) held.set(event.session_id, (held.get(event.session_id) ?? 0) + 1)
  return held
}

/**
 * The businesses that answered the mail and have not been dealt with since,
 * replies first, then the most active on their preview site (`byEngagement`).
 *
 * Every open in the last month is read and counted as `engaged.js` counts it,
 * so a business is here for opening more than once as a person rather than
 * for its mail system fetching the pictures; every visit to a preview site in
 * the last month is read the same way, so a business is here for a person
 * following the link rather than a link checker the moment the letter landed;
 * and every business at `replied` is here for the reply a person typed, where
 * there is one. Then it is held to
 * the floor of the call list's door (`isRingable`), and taken off again where
 * it has been dealt with since: a call made after the latest of its reasons,
 * a last call that ended it, a lead the owner ruled out after it, or a lead
 * that bought. A business that opens the mail or its preview again after a
 * call comes back up, because that is a new reason.
 */
async function engagedList(db, now) {
  const since = new Date(now.getTime() - OPEN_LOOKBACK_DAYS * 86_400_000).toISOString()
  const [opened, visited, replied] = await Promise.all([
    readAll(() =>
      db
        .from(MESSAGES)
        .select(OPEN_COLUMNS, { count: 'exact' })
        .eq('direction', 'outbound')
        .not('opened_at', 'is', null)
        .gte('last_open_at', since)
        .order('id')
    ),
    readAll(() =>
      db
        .from(VISITS)
        .select(VISIT_COLUMNS, { count: 'exact' })
        .not('prospect_id', 'is', null)
        .gte('last_seen_at', since)
        .order('id')
    ),
    db.from(PROSPECTS).select(DETAIL).eq('stage', 'replied').limit(500),
  ])
  if (replied.error) throw replied.error

  const mail = new Map()
  for (const message of opened.rows) {
    if (!mail.has(message.prospect_id)) mail.set(message.prospect_id, [])
    mail.get(message.prospect_id).push(message)
  }
  const visits = new Map()
  for (const visit of visited.rows) {
    if (!visits.has(visit.prospect_id)) visits.set(visit.prospect_id, [])
    visits.get(visit.prospect_id).push(visit)
  }
  // A business with a visit on file is read whether or not the visit turns
  // out to be a person's, since that takes the letters' times to say, and they
  // are read alongside the business rather than a round ahead of it.
  const openers = [...mail.keys()].filter(id => engagementOf({ messages: mail.get(id) }))
  const wrote = new Map((replied.data || []).map(row => [row.id, row]))
  const read = [...new Set([...openers, ...visits.keys()])].filter(id => !wrote.has(id))
  const ids = [...new Set([...wrote.keys(), ...read])]
  if (!ids.length) return []

  const [rows, said, history, standing, sends, claims] = await Promise.all([
    rowsById(db, read),
    repliesFor(db, [...wrote.keys()]),
    callsFor(db, ids),
    standingsFor(db, ids),
    sendsFor(db, [...visits.keys()]),
    claimsFor(
      db,
      visited.rows.map(visit => visit.id)
    ),
  ])

  const engaged = []
  for (const row of [...wrote.values(), ...rows]) {
    if (!isRingable(row)) continue
    const reply = said.get(row.id) ?? null
    const site = siteActivity(
      (visits.get(row.id) ?? []).map(visit => ({ ...visit, claims: claims.get(visit.id) ?? 0 })),
      sends.get(row.id) ?? []
    )
    const found = engagementOf({
      messages: mail.get(row.id) ?? [],
      repliedAt: reply ? reply.at : null,
      reply: reply?.text ?? null,
      site,
    })
    if (!found) continue
    const calls = history.get(row.id) ?? []
    const last = calls[0] ?? null
    if (last && (outcomeEnds(last.outcome) || Date.parse(last.called_at) >= Date.parse(found.at))) {
      continue
    }
    const decided = standing.get(row.id)
    if (decided?.bought_at) continue
    if (decided?.dismissed_at && Date.parse(decided.dismissed_at) >= Date.parse(found.at)) continue
    engaged.push({ row, calls, engaged: found })
  }
  return engaged.sort((one, two) => byEngagement(one.engaged, two.engaged))
}

/**
 * The list under what is due, in its order and with its rules applied: the
 * businesses never called, best first, then the ones waiting on their owner.
 *
 * The rules run over the whole order at once, so a number listed twice is
 * offered once, under its better-placed listing, on whichever page that is.
 */
function ranking(pool, calls, index, taken, dueIds, { facts, companies, engagedBack, now }) {
  const history = new Map()
  for (const call of calls) {
    if (!history.has(call.prospect_id)) history.set(call.prospect_id, [])
    history.get(call.prospect_id).push(call)
  }
  for (const held of history.values()) {
    held.sort((one, two) => Date.parse(two.called_at) - Date.parse(one.called_at))
  }
  const medians = tradeMedians(pool.rows)

  const fresh = []
  const waiting = []
  for (const row of pool.rows) {
    if (dueIds.has(row.id) || !isCallable(row)) continue
    const held = {
      ...row,
      formed_on: formedOn(row, pool.formed),
      calls: history.get(row.id) ?? [],
      trade_median: medians.get(row.trade) ?? null,
      company: companies.get(row.id) ?? null,
      // What the company's own move on Facebook is worth, which is read here
      // as well as on the drawn row: the order of the whole list is what it
      // is for, and a lift applied only to the page in front of somebody
      // would be a lift that never moved anything.
      engaged_back: engagedBack?.get(row.id) ?? null,
    }
    if (!held.calls.length) {
      held.score = scoreOf(held, facts, now)
      fresh.push(held)
    } else if (atFrontDesk(held)) {
      waiting.push(held)
    }
  }
  fresh.sort(byScore)
  waiting.sort(byOwnerDue)

  const offered = kept([...fresh, ...waiting], index, taken)
  return {
    fresh: offered.filter(row => !row.calls.length),
    waiting: offered.filter(row => row.calls.length),
  }
}

/** The list, as the page draws it. */
export async function list(db, query, now = new Date()) {
  const asked = pageOf(query.page)
  const [answered, owed, pool, listed, calls, today, back] = await Promise.all([
    engagedList(db, now),
    dueList(db, now),
    callablePool(db),
    listingIndex(db),
    allCalls(db),
    callsToday(db, now),
    socialOrNone(() => engagedBackBy(db, now), 'what companies answered on Facebook'),
  ])
  const facts = factsOf({ metrics: pool.metrics, listings: listed.rows, calls })
  const engagedBack = back ?? new Map()
  const context = {
    facts,
    formed: pool.formed,
    companies: listed.companies,
    engagedBack,
    now,
  }

  // A business that answered the mail leads the list, carrying the call back
  // it is owed where it is owed one, so it is drawn once and at the top.
  const owedBy = new Map(owed.map(one => [one.row.id, one.owed]))
  const engaged = answered.map(one =>
    shaped(one.row, one.calls, {
      ...context,
      due: owedBy.get(one.row.id) ?? null,
      engaged: one.engaged,
    })
  )
  const first = new Set(engaged.map(row => row.id))
  const due = owed
    .filter(one => !first.has(one.row.id))
    .map(one => shaped(one.row, one.calls, { ...context, due: one.owed }))
  // A number on the list once is on it once: a call back holds its number, and
  // a second listing of it further down is the same phone ringing.
  const taken = new Set([...engaged, ...due].map(row => phoneKey(row.phone)).filter(Boolean))
  const index = indexOf(listed.rows, calls)
  const placed = new Set([...first, ...due.map(row => row.id)])
  const ranked = ranking(pool, calls, index, taken, placed, context)

  const pages = Math.max(1, Math.ceil(ranked.fresh.length / PAGE_TAKE))
  const page = Math.min(asked, pages)
  const onPage = ranked.fresh.slice((page - 1) * PAGE_TAKE, page * PAGE_TAKE)
  const waiting = page === 1 ? ranked.waiting : []

  // Read again before drawing: the set above may be minutes old, and a
  // business that has asked to stop since is not one to put in front of a
  // phone.
  const [current, history] = await Promise.all([
    rowsById(
      db,
      [...onPage, ...waiting].map(row => row.id)
    ),
    callsFor(
      db,
      waiting.map(row => row.id)
    ),
  ])
  const byId = new Map(current.map(row => [row.id, row]))
  const draw = (rows, withCalls) =>
    rows.flatMap(row => {
      const read = byId.get(row.id)
      if (!read || !isCallable(read)) return []
      return [shaped(read, withCalls ? (history.get(row.id) ?? []) : [], context)]
    })

  const shown = {
    engaged: page === 1 ? engaged : [],
    due: page === 1 ? due : [],
    rows: draw(onPage, false),
    waiting: draw(waiting, true),
  }

  // The Facebook history last, for exactly the businesses that came through
  // every rule above. It is the only read here that carries what was said, and
  // reading it for the whole callable set in order to draw one page of it
  // would be four thousand companies' words travelling to show a hundred.
  const drawn = [
    ...new Set(
      Object.values(shown)
        .flat()
        .map(row => row.id)
    ),
  ]
  const social = await socialOrNone(() => socialFor(db, drawn, now), 'the Facebook history')
  const withSocial = rows =>
    social ? rows.map(row => ({ ...row, social: social.get(row.id) ?? null })) : rows

  return {
    status: 200,
    body: {
      engaged: withSocial(shown.engaged),
      due: withSocial(shown.due),
      rows: withSocial(shown.rows),
      waiting: withSocial(shown.waiting),
      page,
      pages,
      today: { calls: today, goal: DAILY_CALL_GOAL },
    },
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

/**
 * What a Front Desk call learned about the owner, as the columns it is
 * written to, or the reason it will not be.
 *
 * Only Front Desk carries a name or a number; on any other result they are a
 * form that disagrees with the button it was sent under. A number has to be a
 * whole one, since it becomes the one the list dials, and it is stored the
 * way the listing's own number is written. A name or a number nobody gave is
 * left as it was rather than cleared: a second front desk that would not say
 * does not unlearn what the first one did. Nor is the listing's own main line
 * kept as the owner's: it is the number that reached the front desk.
 *
 * A value is confirmed when two independent sources agree on it, and a front
 * desk is one. A name or a number the front desk gives that matches the one
 * the owner finder already has is now confirmed, and is otherwise left as it
 * was; one that differs replaces it, from a call, unconfirmed. A second call
 * agreeing with a first is not a second source.
 *
 * `found` is the business as it stands, read before this is asked; the first
 * pass, with nothing read yet, only finds what the form got wrong.
 */
function ownerAnswer(body, outcome, at, found = null) {
  const name = field(body.owner_name, OWNER_NAME_MAX)
  const typed = String(body.owner_phone ?? '').trim()
  if (!outcomeAsksOwner(outcome)) {
    if (name || typed) {
      return { error: 'Only a Front Desk call takes the owner’s name or number.' }
    }
    return { patch: null }
  }
  let ten = null
  if (typed) {
    ten = phoneKey(typed)
    if (!ten) return { error: 'That direct number is not a full phone number.' }
    if (ten === phoneKey(found?.phone)) ten = null
  }
  const patch = { owner_checked_at: at }
  if (name) {
    const held = String(found?.owner_name ?? '')
    if (!sameName(name, held)) {
      Object.assign(patch, { owner_name: name, owner_source: 'call', owner_name_confirmed: false })
    } else if (found?.owner_source !== 'call') {
      patch.owner_name_confirmed = true
    }
  }
  if (ten) {
    if (ten !== phoneKey(found?.owner_phone)) {
      Object.assign(patch, {
        owner_phone: spokenNumber(ten),
        owner_phone_source: 'call',
        owner_phone_confirmed: false,
      })
    } else if (phoneSourceOf(found) !== 'call') {
      patch.owner_phone_confirmed = true
    }
  }
  return { patch }
}

/** Two spellings of one name: case, spacing and punctuation aside. */
function sameName(one, two) {
  const plain = value =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  return Boolean(plain(one)) && plain(one) === plain(two)
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
  // Only Call Back, Front Desk and Pipeline carry a time. A time on anything
  // else is a form that disagrees with the button it was sent under, and on an
  // outcome that ends the list it would be a promise nothing ever reads.
  if (callback.at && !outcomeTakesCallback(outcome)) {
    return {
      status: 400,
      body: { error: 'Only a Call Back, a Front Desk call or Pipeline takes a time.' },
    }
  }
  // Asked here for what the form got wrong, and again below against the
  // business's own number once it has been read.
  const asked = ownerAnswer(body, outcome, null)
  if (asked.error) return { status: 400, body: { error: asked.error } }
  // A call back nobody put a clock on is filed a day out rather than refused,
  // and a pipeline follow-up nobody gave a day is filed a week out.
  const ringBack =
    outcomeTakesCallback(outcome) && !callback.at
      ? defaultCallbackAt(new Date(), outcome).toISOString()
      : callback.at

  // The row has to be one this list could have offered. Without this an id
  // copied from anywhere else would write a call against a business that
  // unsubscribed, which is the one thing this section must not do. The floor
  // of the door is the test (`isRingable`): a business that answered the mail
  // is offered whatever its site and with its reply open.
  const found = await db
    .from(PROSPECTS)
    .select(
      'id, name, phone, email, trade, town, website, site_kind, stage, source, business_status, call_due_at, owner_name, owner_phone, owner_source, owner_name_confirmed, owner_phone_confirmed, owner_phone_source'
    )
    .eq('id', prospectId)
    .maybeSingle()
  if (found.error) return refusal(found.error, NOT_RECORDED)
  if (!found.data) return { status: 404, body: { error: 'That business is no longer on file.' } }
  if (!isCallable(found.data) && !isRingable(found.data)) {
    return { status: 409, body: { error: 'That business is not on the call list.' } }
  }

  // The owner first and the call second. A call that saved without the number
  // the front desk gave would ring the front desk again; written this way
  // round, a refusal saves neither and the same press saves both.
  const owner = ownerAnswer(body, outcome, new Date().toISOString(), found.data)
  if (owner.patch) {
    const { error } = await db.from(PROSPECTS).update(owner.patch).eq('id', prospectId)
    if (error) return refusal(error, NOT_RECORDED)
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

  const filed = await carry(db, found.data, body, ringBack, interested)

  // The day's count is read back rather than added to, so a call made on
  // another screen is in it too. The call is saved whatever this says.
  let today = null
  try {
    today = { calls: await callsToday(db), goal: DAILY_CALL_GOAL }
  } catch (cause) {
    console.error('calls-admin: the day was not counted: %s', cause?.message || cause)
  }

  return {
    status: 200,
    body: {
      ok: true,
      call: written.data?.id ?? null,
      called_at: written.data?.called_at ?? null,
      callback_at: ringBack,
      pipeline: outcomeFilesPipeline(outcome) ? filed : null,
      owner: owner.patch ? ownerAfter(found.data, owner.patch) : null,
      today,
    },
  }
}

/** The owner as the business now has it, in the shape the page draws. */
function ownerAfter(business, patch) {
  const now = ownerFields({ ...business, ...patch })
  return {
    name: now.owner_name,
    name_confirmed: now.owner_name_confirmed,
    phone: now.owner_phone,
    phone_confirmed: now.owner_phone_confirmed,
    from: now.owner_from,
    phone_from: now.owner_phone_from,
  }
}

/**
 * A business that wanted this, carried into the lead record.
 *
 * A cold prospect is not a lead. What changes that is a call that reached
 * somebody who could buy, which is why a number that rang out carries nothing
 * here, nor does a front desk, and a conversation and a call back both do.
 *
 * Pipeline goes one step further: the lead is stamped `pipeline_at`, which is
 * what the pipeline routine on the Pi reads to add it to the sales pipeline,
 * with the follow-up day as its `due_at`. A lead the owner had ruled out is
 * ruled back in, since pressing Pipeline is the owner saying otherwise.
 *
 * Failure here is swallowed. The call is already on the record and is owed its
 * confirmation; a lead that missed its row is worth less than being told a call
 * did not save. What comes back says whether the lead was filed, so a Pipeline
 * press that missed the pipeline is said rather than assumed.
 *
 * @returns {Promise<boolean>} Whether the lead was kept and stamped.
 */
async function carry(db, prospect, body, callbackAt, interested) {
  const outcome = String(body.outcome ?? '')
  if (!callMakesLead(outcome, interested)) return false
  const pipeline = outcomeFilesPipeline(outcome)

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
    if (!lead) return false

    // Stamped rather than merged: the studio has now spoken to this person,
    // and it owes them a call back on the day that was written down.
    const at = new Date().toISOString()
    const { error } = await db
      .from(SPINE)
      .update({
        contacted_at: at,
        ...(callbackAt ? { due_at: callbackAt } : {}),
        ...(pipeline ? { pipeline_at: at, dismissed_at: null, dismissed_reason: null } : {}),
        updated_at: at,
      })
      .eq('id', lead.id)
    if (error) {
      console.error('calls-admin: the lead was not stamped: %s', error.message)
      return false
    }
    return true
  } catch (cause) {
    console.error('calls-admin: the lead was not kept: %s', cause?.message || cause)
    return false
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
