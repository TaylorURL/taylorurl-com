/**
 * Proves the caller's own setup survives a round trip, and that a business
 * somebody is on the phone with reads as taken to everybody else.
 *
 * Both halves fail silently, which is why they are checked rather than left to
 * be noticed.
 *
 * The setup is stored on the account and read back by two different pieces of
 * code: the console draws the controls from these lists, and the endpoint
 * decides from the same lists what it will keep. A value the console offers
 * that the endpoint quietly refuses is a setting that appears to work - the
 * dropdown moves, the list re-reads, and tomorrow morning the account is back
 * where it started with nothing anywhere saying why. So the normalisers are
 * exercised against exactly what the controls can produce, and the two lists
 * the endpoint holds the console to are asserted against the console's own.
 *
 * The claim is worse, because its failure is a phone call. A caller says they
 * are on a number and every other console draws that number as taken; if the
 * reading of "still on it" is wrong in either direction the section does the
 * opposite of its job. Too generous and a browser that crashed at nine holds a
 * business until somebody notices; too strict and a caller mid-sentence blinks
 * off the board and two other people are free to ring the line they are on.
 * Neither shows up anywhere but on the phone, so both edges are pinned here.
 *
 * The audit is the third of them, and it fails in two directions. Most of the
 * call list is businesses with no site of their own, which is why they are on
 * it, so a row with nothing to read is the common case rather than the edge -
 * and a reading that answered a missing score with a nought would put four
 * zeros in a band of red in front of an owner and call it their site. So every
 * shape of nothing the list actually holds is read here and asserted to carry
 * no number at all, and the sentence it carries instead is asserted to be a
 * sentence.
 *
 * The other direction is the send. The audit leaves the building on a press
 * and cannot be recalled, so the screen asks twice and guards against the
 * second press, and the row says who already sent it so the next caller does
 * not send it again. Every one of those is a piece of markup that can be
 * refactored away without anything failing, and what it would cost is a
 * stranger receiving somebody else's audit twice. So the screen's own source
 * is read for the labels and the guard, and the endpoint's for the columns the
 * screen draws them from - a column dropped from the select is a reading that
 * silently reads as never measured on every row.
 *
 *   npm run check:call-desk
 */
import { bandOf, CATEGORIES, GOOD_FLOOR } from '../../../lib/outreach/audit/bands.js'
import { auditReading, scoresOf } from '../../../lib/outreach/audit/reading.js'
import {
  CALL_PULLS,
  CALL_SCORES,
  CALL_SCORE_FLOORS,
  CALL_STATES,
  CALL_TAKES,
  COLUMN_IDS,
  DEFAULT_COLUMNS,
  DEFAULT_DENSITY,
  DEFAULT_SORT,
  DEFAULT_TAKE,
  DENSITY_IDS,
  FIXED_COLUMNS,
  LIST_COLUMNS,
  NO_FILTERS,
  OPTIONAL_COLUMNS,
  SAVED_VIEW_MAX,
  SAVED_VIEW_NAME_MAX,
  SORT_IDS,
  normalizeColumns,
  normalizeFilters,
  normalizePrefs,
  normalizeSavedViews,
  prefsPatch,
} from '../../../lib/outreach/prospects/callPrefs.js'
import {
  BEAT_MS,
  PHONE_MAX_MS,
  PRESENCE_TTL_MS,
  callerName,
  heldByOther,
  heldNumbers,
  livePresence,
  onPhone,
  onPhoneNow,
  presenceLive,
  saidSince,
  settleDesk,
} from '../../../lib/outreach/prospects/callPresence.js'
import {
  ASSIGNED_MINE,
  ASSIGNED_NOBODY,
  ASSIGNED_STANDINGS,
  matchesAssigned,
  ownerOf,
  PULLS,
} from '../../../lib/outreach/prospects/calls.js'
import { read } from '../../harness/files.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

const NOW = new Date('2026-09-08T15:00:00Z')

/** A presence row as the table holds one: here, and on nothing. */
const here = over => ({
  user_id: 'u1',
  name: 'Dylan Jordan',
  prospect_id: null,
  on_phone_since: null,
  last_seen: NOW.toISOString(),
  ...over,
})

/** The same row, holding a business. */
const onIt = over =>
  here({
    prospect_id: 'p1',
    on_phone_since: new Date(NOW.getTime() - 4 * 60_000).toISOString(),
    ...over,
  })

// ── The columns ──────────────────────────────────────────────────────────

check('an account that has never chosen draws the default set', () => {
  same(normalizeColumns(null).join(), DEFAULT_COLUMNS.join(), 'null')
  same(normalizeColumns(undefined).join(), DEFAULT_COLUMNS.join(), 'nothing stored')
  same(normalizePrefs(null).columns.join(), DEFAULT_COLUMNS.join(), 'no row at all')
})

check('turning every optional column off is a choice, not an empty one', () => {
  // The whole reason a stored null is not a stored empty array. Reading them
  // the same way puts the default set back under somebody who deliberately
  // cleared it, on every load, forever.
  same(normalizeColumns([]).join(), FIXED_COLUMNS.join(), 'an empty choice')
  ok(normalizeColumns([]).length < DEFAULT_COLUMNS.length, 'empty is not the default set')
})

check('the columns the list cannot be worked without are always drawn', () => {
  const held = normalizeColumns(['why'])
  for (const id of FIXED_COLUMNS) ok(held.includes(id), `${id} was dropped`)
  ok(held.includes('why'), 'the chosen column was dropped')
})

check('a column nothing offers is not a column', () => {
  same(
    normalizeColumns(['why', 'salary', 'business']).join(),
    normalizeColumns(['why']).join(),
    'unknown ids'
  )
  // `business` is fixed, so naming it changes nothing either way.
  same(normalizeColumns(['business']).join(), FIXED_COLUMNS.join(), 'a fixed id named')
})

check('the columns come back in the order the table draws them', () => {
  const asked = ['call', 'why', 'business', 'score']
  const held = normalizeColumns(asked)
  const wanted = LIST_COLUMNS.filter(column => column.fixed || asked.includes(column.id)).map(
    column => column.id
  )
  same(held.join(), wanted.join(), 'declaration order')
})

check('every column is either fixed or offered, and no id repeats', () => {
  same(new Set(COLUMN_IDS).size, COLUMN_IDS.length, 'a column id repeats')
  same(FIXED_COLUMNS.length + OPTIONAL_COLUMNS.length, COLUMN_IDS.length, 'a column is neither')
  for (const column of LIST_COLUMNS) {
    ok(!(column.fixed && column.off), `${column.id} is fixed but off by default`)
  }
})

// ── The narrowing ────────────────────────────────────────────────────────

check('nothing stored is nothing narrowed', () => {
  same(JSON.stringify(normalizeFilters(null)), JSON.stringify(NO_FILTERS), 'null')
})

check('a value nothing offers falls back rather than sticking', () => {
  // A stored value no control can show leaves a dropdown blank with no way
  // back to it, which is worse than the narrowing being lost.
  same(normalizeFilters({ state: 'lunchtime' }).state, 'all', 'an unknown state')
  same(normalizeFilters({ pull: 'loud' }).pull, 'all', 'an unknown reading')
  same(normalizeFilters({ min_score: '41' }).min_score, 'all', 'a floor nothing offers')
  same(normalizeFilters({ min_score: '55' }).min_score, '55', 'a floor that is offered')
})

check('a town and a trade are whatever the map found', () => {
  // Neither comes off a list here: they are the towns and trades the sweep
  // actually returned, and the endpoint's own narrowing simply matches nothing
  // if one names a place nobody is in.
  same(normalizeFilters({ town: ' Channelview ' }).town, 'Channelview', 'trimmed')
  same(normalizeFilters({ trade: 'welder' }).trade, 'welder', 'kept as typed')
  same(normalizeFilters({ town: 'all' }).town, 'all', 'the word all is no town')
})

// ── What a stored filter holds and the list reads ────────────────────────

check('every reading a stored filter can hold is one the scoring produces', () => {
  // The drift that matters: a band added to the score and not to the filter,
  // or a filter holding a band nothing is ever in. Either leaves a filter that
  // returns an empty list and looks like a list with nothing in it.
  const offered = CALL_PULLS.filter(id => id !== 'all')
  same(offered.join(), [...PULLS].join(), 'the filter and the scoring disagree')
})

check('every score floor a stored filter can hold is one the list can be held to', () => {
  const offered = CALL_SCORES.filter(id => id !== 'all').map(Number)
  same(offered.join(), CALL_SCORE_FLOORS.join(), 'the filter and the floors disagree')
})

check('every option list carries an all, first, and no id twice', () => {
  for (const [name, options] of Object.entries({
    state: CALL_STATES,
    pull: CALL_PULLS,
    score: CALL_SCORES,
  })) {
    same(options[0], 'all', `${name} does not lead with every one of them`)
    same(new Set(options).size, options.length, `${name} repeats an id`)
  }
})

check('the defaults are values their own lists offer', () => {
  ok(SORT_IDS.includes(DEFAULT_SORT), 'the default order is not one of the orders')
  ok(CALL_TAKES.includes(DEFAULT_TAKE), 'the default page size is not one offered')
  ok(DENSITY_IDS.includes(DEFAULT_DENSITY), 'the default density is not one offered')
})

// ── The whole setup ──────────────────────────────────────────────────────

check('a setup survives being stored and read back', () => {
  const setup = {
    columns: ['score', 'address'],
    density: 'tight',
    take: 100,
    sort: 'waited',
    filters: { state: 'fresh', town: 'Baytown' },
    views: [
      { id: 'v1', name: 'Baytown, never called', filters: { town: 'Baytown' }, sort: 'best' },
    ],
  }
  const held = normalizePrefs(setup)
  same(held.density, 'tight', 'density')
  same(held.take, 100, 'page size')
  same(held.sort, 'waited', 'order')
  same(held.filters.town, 'Baytown', 'town')
  same(held.views.length, 1, 'the kept narrowing')
  ok(held.columns.includes('address'), 'a chosen column')
  same(JSON.stringify(normalizePrefs(held)), JSON.stringify(held), 'reading it twice moves it')
})

check('a stored value nothing offers falls back to the default', () => {
  const held = normalizePrefs({ density: 'enormous', take: 37, sort: 'alphabetical' })
  same(held.density, DEFAULT_DENSITY, 'density')
  same(held.take, DEFAULT_TAKE, 'page size')
  same(held.sort, DEFAULT_SORT, 'order')
})

check('a change writes only what it changed', () => {
  // The console saves one thing at a time. A patch carrying every field would
  // have a second tab's idea of the setup overwrite this one's on the next
  // keystroke.
  const patch = prefsPatch({ density: 'tight' })
  same(Object.keys(patch).join(), 'density', 'only the field sent')
  same(Object.keys(prefsPatch({})).length, 0, 'nothing sent writes nothing')
  same(Object.keys(prefsPatch(null)).length, 0, 'nothing at all writes nothing')
  same(prefsPatch({ columns: [] }).columns.join(), FIXED_COLUMNS.join(), 'an emptied set is sent')
  same(prefsPatch({ take: 999 }).take, DEFAULT_TAKE, 'a page size nothing offers')
})

// ── The kept narrowings ──────────────────────────────────────────────────

check('a kept narrowing needs a name and an id, and keeps its order', () => {
  const kept = normalizeSavedViews([
    { id: 'v1', name: 'Baytown', filters: { town: 'Baytown' }, sort: 'waited' },
    { id: 'v2', name: '   ', filters: {} },
    { name: 'no id at all', filters: {} },
    { id: 'v1', name: 'the same id twice', filters: {} },
    'not an object',
  ])
  same(kept.length, 1, 'only the one that was whole')
  same(kept[0].sort, 'waited', 'the order it was kept in')
  same(kept[0].filters.town, 'Baytown', 'the narrowing it was kept as')
})

check('a name longer than the column is cut rather than refused', () => {
  const name = 'x'.repeat(SAVED_VIEW_NAME_MAX + 40)
  const kept = normalizeSavedViews([{ id: 'v1', name, filters: {} }])
  same(kept[0].name.length, SAVED_VIEW_NAME_MAX, 'the name was not cut to the column')
})

check('an account keeps as many narrowings as it may and no more', () => {
  const many = Array.from({ length: SAVED_VIEW_MAX + 5 }, (_, at) => ({
    id: `v${at}`,
    name: `View ${at}`,
    filters: {},
  }))
  same(normalizeSavedViews(many).length, SAVED_VIEW_MAX, 'the ceiling did not hold')
})

// ── Who is on the phone ──────────────────────────────────────────────────

check('a beat is worth more than one gap and less than forever', () => {
  // Three beats and a margin. Two would drop a caller off the board every time
  // a request took longer than the gap between them.
  ok(PRESENCE_TTL_MS > BEAT_MS * 2, 'one slow request drops a caller off the board')
  ok(PRESENCE_TTL_MS < 5 * 60_000, 'a crashed console holds a number for minutes')
  ok(PHONE_MAX_MS > 30 * 60_000, 'a long call is cut off while it is still running')
  ok(PHONE_MAX_MS < 8 * 60 * 60_000, 'a tab left open holds a number all day')
})

check('a console that has stopped saying it is here is not here', () => {
  same(presenceLive(here(), NOW), true, 'a beat this second')
  const late = here({ last_seen: new Date(NOW.getTime() - PRESENCE_TTL_MS + 1_000).toISOString() })
  same(presenceLive(late, NOW), true, 'inside the window')
  const gone = here({ last_seen: new Date(NOW.getTime() - PRESENCE_TTL_MS - 1).toISOString() })
  same(presenceLive(gone, NOW), false, 'past the window')
  same(presenceLive({ last_seen: null }, NOW), false, 'a row with no beat on it')
  same(presenceLive(null, NOW), false, 'no row at all')
})

check('a number is only held while somebody is both here and on it', () => {
  same(onPhone(onIt(), NOW), true, 'beating, four minutes in')
  same(onPhone(here(), NOW), false, 'here and on nothing')
  const quiet = onIt({ last_seen: new Date(NOW.getTime() - PRESENCE_TTL_MS - 1).toISOString() })
  same(onPhone(quiet, NOW), false, 'a console that stopped beating gives the number back')
  const forever = onIt({ on_phone_since: new Date(NOW.getTime() - PHONE_MAX_MS - 1).toISOString() })
  same(onPhone(forever, NOW), false, 'a tab left open on a business gives it back')
})

check('the board is whoever is here, and the calls are whoever is on one', () => {
  const rows = [
    here({ user_id: 'u1' }),
    onIt({ user_id: 'u2', prospect_id: 'p2' }),
    here({ user_id: 'u3', last_seen: new Date(NOW.getTime() - 10 * 60_000).toISOString() }),
  ]
  same(livePresence(rows, NOW).length, 2, 'the one that stopped beating is off the board')
  same(onPhoneNow(rows, NOW).length, 1, 'only the one on a phone')
  same(onPhoneNow(rows, NOW)[0].user_id, 'u2', 'and it is the right one')
})

check('the longest call leads the board', () => {
  // The board is read to know who to ask about a business, and a call that has
  // been running twenty minutes is the one worth asking about first.
  const rows = [
    onIt({
      user_id: 'u2',
      prospect_id: 'p2',
      on_phone_since: new Date(NOW.getTime() - 60_000).toISOString(),
    }),
    onIt({
      user_id: 'u1',
      prospect_id: 'p1',
      on_phone_since: new Date(NOW.getTime() - 900_000).toISOString(),
    }),
  ]
  same(onPhoneNow(rows, NOW)[0].user_id, 'u1', 'the oldest call is not first')
})

check('a held number reads as taken to everybody but whoever is on it', () => {
  const held = heldNumbers([onIt({ user_id: 'u2', prospect_id: 'p9' })], NOW)
  same(held.size, 1, 'the number is held')
  ok(heldByOther(held, 'p9', 'u1'), 'a colleague is not warned off it')
  same(heldByOther(held, 'p9', 'u2'), null, 'the caller is warned off their own call')
  same(heldByOther(held, 'p8', 'u1'), null, 'a number nobody is on reads as held')
})

check('a caller is named by whatever the account carries', () => {
  same(callerName({ name: 'Dylan Jordan' }), 'Dylan Jordan', 'a full name')
  same(callerName({ name: '  ', email: 'pedro@taylorurl.com' }), 'pedro', 'no name, an address')
  same(callerName({}), 'Somebody', 'neither')
})

check('a call is said in minutes, because seconds are movement rather than news', () => {
  same(saidSince(new Date(NOW.getTime() - 20_000), NOW), 'just now', 'twenty seconds')
  same(saidSince(new Date(NOW.getTime() - 61_000), NOW), '1 min', 'a minute')
  same(saidSince(new Date(NOW.getTime() - 14 * 60_000), NOW), '14 min', 'a quarter hour')
  same(saidSince(new Date(NOW.getTime() - 90 * 60_000), NOW), '1 hr', 'an hour and a half')
  same(saidSince(null, NOW), 'just now', 'no instant at all')
})

// ── Whose business it is ─────────────────────────────────────────────

const YOU = '11111111-1111-4111-8111-111111111111'
const THEM = '22222222-2222-4222-8222-222222222222'

check('a business reads as held only when somebody actually holds it', () => {
  same(ownerOf({ assigned_to: YOU }), YOU, 'an id is who holds it')
  same(ownerOf({ assigned_to: '  ' }), null, 'whitespace holds nothing')
  same(ownerOf({ assigned_to: null }), null, 'null holds nothing')
  same(ownerOf({}), null, 'a row with no column holds nothing')
  same(ownerOf(null), null, 'no row holds nothing')
})

check('the filter on who holds a business answers for every standing', () => {
  const mine = { assigned_to: YOU }
  const theirs = { assigned_to: THEM }
  const nobodys = { assigned_to: null }

  for (const row of [mine, theirs, nobodys]) {
    ok(matchesAssigned(row, 'all', YOU), 'everything survives all')
    ok(matchesAssigned(row, '', YOU), 'and an empty filter')
    ok(matchesAssigned(row, undefined, YOU), 'and no filter at all')
  }

  ok(matchesAssigned(mine, ASSIGNED_MINE, YOU), 'mine keeps mine')
  ok(!matchesAssigned(theirs, ASSIGNED_MINE, YOU), 'and drops theirs')
  ok(!matchesAssigned(nobodys, ASSIGNED_MINE, YOU), "and drops nobody's")
  ok(!matchesAssigned(mine, ASSIGNED_MINE, null), 'nobody signed in owns nothing')

  ok(matchesAssigned(nobodys, ASSIGNED_NOBODY, YOU), 'nobody keeps the unheld')
  ok(!matchesAssigned(mine, ASSIGNED_NOBODY, YOU), 'and drops the held')

  ok(matchesAssigned(theirs, THEM, YOU), 'an id keeps that person')
  ok(!matchesAssigned(mine, THEM, YOU), 'and drops everybody else')
})

check('the two standings are the only ones that are not an id', () => {
  same(ASSIGNED_STANDINGS.length, 2, 'two standings')
  ok(ASSIGNED_STANDINGS.includes(ASSIGNED_MINE), 'mine is one')
  ok(ASSIGNED_STANDINGS.includes(ASSIGNED_NOBODY), 'nobody is the other')
  ok(!ASSIGNED_STANDINGS.includes('all'), "'all' is no filter rather than a standing")
})

check('a filter on who holds a business is stored like any other', () => {
  same(NO_FILTERS.assigned, 'all', 'it starts at all')
  same(normalizeFilters({ assigned: ASSIGNED_MINE }).assigned, ASSIGNED_MINE, 'a standing keeps')
  same(normalizeFilters({ assigned: THEM }).assigned, THEM, 'and so does an id')
  same(normalizeFilters({ assigned: '  ' }).assigned, 'all', 'whitespace is no filter')
})

check('the list can draw who a business belongs to', () => {
  const column = LIST_COLUMNS.find(one => one.id === 'assigned')
  ok(column, 'the column exists')
  ok(!column.fixed, 'it is one a setup can leave out')
})

// ── What a beat is allowed to redraw ─────────────────────────────────

const SETUP = Object.freeze({
  columns: ['business', 'score', 'phone', 'state', 'call'],
  density: 'roomy',
  take: 50,
  sort: 'best',
  filters: { ...NO_FILTERS },
  views: [],
})
const BOARD = [
  { user_id: YOU, name: 'A Caller', prospect_id: null, on_phone_since: null, last_seen: 't1' },
]
const DESK = { you: YOU, prefs: SETUP, presence: BOARD, at: '2026-09-08T20:00:00Z' }

/** The same answer again, as a fresh object, the way a real beat arrives. */
function again(extra = {}) {
  return JSON.parse(JSON.stringify({ ...DESK, at: '2026-09-08T20:00:20Z', ...extra }))
}

check('a beat that says nothing new redraws nothing', () => {
  // The whole point. The beat lands three times a minute per console and
  // almost always repeats itself, and a fresh object every time made the
  // columns fresh too - which rebuilt the entire table to say nothing had
  // happened. Identity is the assertion because identity is what React reads.
  const beat = again()
  delete beat.prefs
  ok(settleDesk(DESK, beat) === DESK, 'the desk is the same object')
})

check('a beat carrying no setup is not a beat saying the setup is gone', () => {
  const beat = again()
  delete beat.prefs
  same(settleDesk(DESK, beat).prefs, SETUP, 'the held setup is kept')
  ok(settleDesk(null, beat).prefs === null, 'and a first answer without one holds none')
})

check('a beat that says something new redraws only that', () => {
  const onCall = again({
    presence: [{ ...BOARD[0], prospect_id: '33333333-3333-4333-8333-333333333333' }],
  })
  delete onCall.prefs
  const after = settleDesk(DESK, onCall)
  ok(after !== DESK, 'a caller picking up a phone is a change')
  ok(after.prefs === SETUP, 'and the untouched setup keeps its identity')
  ok(after.presence !== DESK.presence, 'while the board that moved is replaced')
})

check('a saved setup is adopted, and an unchanged one is not', () => {
  const saved = again({ prefs: { ...SETUP, density: 'tight' } })
  same(settleDesk(DESK, saved).prefs.density, 'tight', 'a real change lands')
  ok(settleDesk(DESK, again()) === DESK, 'and saving what was already set redraws nothing')
})

check('the clock an answer was taken on is never a reason to redraw', () => {
  // Every answer carries a different `at` and nothing on the page draws it, so
  // comparing it would defeat the whole check above.
  const beat = again({ at: '2026-09-08T23:59:59Z' })
  delete beat.prefs
  ok(settleDesk(DESK, beat) === DESK, 'a later clock alone changes nothing')
})

// ── The audit a caller reads out ─────────────────────────────────────────

/** A business with a site of its own that the audit has actually measured. */
const AUDITED = Object.freeze({
  id: 'a1',
  name: 'Gulf Coast Plumbing',
  site_kind: 'own',
  website: 'https://gulfcoastplumbing.com',
  audit_score: 34,
  accessibility_score: 71,
  best_practices_score: 96,
  seo_score: 82,
  audit_at: new Date(NOW.getTime() - 11 * 24 * 60 * 60_000).toISOString(),
  audit_raw: {
    final_url: 'https://gulfcoastplumbing.com/',
    opportunities: [
      { id: 'unused-javascript', title: 'Reduce unused JavaScript', savings_ms: 2400 },
      { id: 'server-response-time', title: 'Reduce initial server response time', savings_ms: 900 },
      // A saving of nothing is the report saying the audit passed, and a
      // report lists everything it ran.
      { id: 'redirects', title: 'Avoid multiple page redirects', savings_ms: 0 },
    ],
  },
})

/** Every shape of nothing the call list actually holds, and what each one is. */
const UNMEASURED = Object.freeze([
  ['no site at all', { site_kind: 'none', website: null }],
  [
    'a Facebook page',
    { site_kind: 'social', website: 'https://www.facebook.com/gulfcoastplumbing' },
  ],
  [
    'a site nobody has measured yet',
    { site_kind: 'own', website: 'https://gulfcoastplumbing.com' },
  ],
])

check('a business with nothing to read says which nothing it is', () => {
  // The common case, not the edge. The call list is made of businesses the
  // email pipeline could not reach, which is mostly businesses with no site of
  // their own, so the screen draws this far more often than it draws scores.
  for (const [what, row] of UNMEASURED) {
    const reading = auditReading(row, NOW)
    same(reading.measured, false, `${what} reads as measured`)
    ok(reading.why.length > 0, `${what} says nothing about why`)
    ok(reading.why.trim().endsWith('.'), `${what} is not said as a sentence`)
    ok(/^[A-Z]/.test(reading.why), `${what} does not open as a sentence`)
    same(reading.age, null, `${what} carries an age`)
    same(reading.at, null, `${what} carries an instant`)
  }
})

check('a business with nothing to read is never given a number', () => {
  // The whole fault this guards. A missing score answered with a nought draws
  // four zeros in a band of red and calls it the owner's site, and the owner is
  // on the phone looking at a site that does not exist.
  for (const [what, row] of UNMEASURED) {
    const reading = auditReading(row, NOW)
    same(reading.scores.length, 0, `${what} draws cells`)
    same(reading.issues.length, 0, `${what} names faults`)
    ok(
      scoresOf(row).every(score => score.value === null),
      `${what} produces a number when its scores are read directly`
    )
    ok(
      scoresOf(row).every(score => score.band === 'plain'),
      `${what} lands a category in a coloured band`
    )
  }
})

check('a measured business reads four scores, each in the band its number falls in', () => {
  const reading = auditReading(AUDITED, NOW)
  same(reading.measured, true, 'a measured row reads as unmeasured')
  same(reading.scores.length, CATEGORIES.length, 'the four categories')
  same(
    reading.scores.map(score => score.column).join(),
    CATEGORIES.map(entry => entry.column).join(),
    "the report's own order"
  )
  for (const score of reading.scores) {
    same(score.band, bandOf(score.value), `${score.column} is painted out of its band`)
    ok(score.label.length > 0, `${score.column} has no label`)
  }
  same(reading.scores[0].band, 'poor', 'a 34 is not poor')
  same(reading.scores[2].band, 'good', 'a 96 is not good')
})

check('a reading says how old it is, because a caller is asked', () => {
  const reading = auditReading(AUDITED, NOW)
  same(reading.age?.days, 11, 'the age in days')
  ok(reading.age?.said.startsWith('Measured'), 'the age is not said')
  ok(!/undefined|NaN/.test(reading.age?.said ?? ''), 'the age reads as a fault')
  same(reading.at, AUDITED.audit_at, 'the instant the date is drawn from')
})

check('a category the report answered nothing for is carried as nothing, not as nought', () => {
  // A row measured before the audit asked for all four has a performance
  // figure and no reading for the rest. Four cells are still drawn, and one of
  // them says so.
  const reading = auditReading({ ...AUDITED, accessibility_score: null }, NOW)
  const missing = reading.scores.find(score => score.column === 'accessibility_score')
  same(missing.value, null, 'an unanswered category carries a value')
  same(missing.band, 'plain', 'an unanswered category is painted')
  ok(
    reading.scores.every(score => score.value !== 0),
    'an unanswered category became a nought'
  )
})

check('every fault the reading names is a whole sentence', () => {
  const reading = auditReading(AUDITED, NOW)
  ok(reading.issues.length > 0, 'a page scoring 34 names nothing wrong with it')
  for (const issue of reading.issues) {
    ok(issue.id.length > 0, 'a fault with no id')
    ok(!/undefined|NaN|\[object/.test(issue.text), `${issue.id} reads as a fault: ${issue.text}`)
    ok(/^[A-Z]/.test(issue.text), `${issue.id} does not open as a sentence`)
    ok(issue.text.trim().endsWith('.'), `${issue.id} is not said as a sentence`)
  }
  // A hundred beside a complaint reads as padding, so a category in the good
  // band is not a fault and is not listed.
  const good = CATEGORIES.filter(entry => AUDITED[entry.column] >= GOOD_FLOOR)
  ok(good.length > 0, 'the fixture no longer has a category to leave out')
  for (const entry of good) {
    ok(
      !reading.issues.some(issue => issue.id === entry.column),
      `${entry.column} is in the good band and is listed as a fault`
    )
  }
})

// ── The screen, and the send it cannot take back ─────────────────────────

const SCREEN = read('src/app/views/staff/parts/CallDesk.jsx')

check('the screen offers the audit to the client in so many words', () => {
  ok(SCREEN.includes('Email Client This Audit'), 'the control that sends the audit is gone')
})

check('the send is asked twice, in two different words, and both are refusable', () => {
  // One label used for both steps is one step: a caller who reads the same
  // control twice presses it twice without reading it the second time.
  ok(SCREEN.includes('Send the Audit'), 'the first confirmation is gone')
  ok(SCREEN.includes('Yes, Send It'), 'the second confirmation is gone')
  ok(SCREEN.includes('Cancel'), 'there is no way out of the confirmation')
  ok(!SCREEN.includes('window.confirm'), 'the confirmation left the screen for a browser dialog')
})

check('a second press before the first send settles is ignored', () => {
  ok(/feed\.sending/.test(SCREEN), 'the screen does not read whether a send is in flight')
  ok(
    /emailing\.current/.test(SCREEN),
    'nothing guards the press itself, so a double press sends twice'
  )
  ok(SCREEN.includes("'Sending'"), 'a send in flight does not say so')
})

check('the screen says who already sent the audit', () => {
  // Two callers work one queue. Without the name the second one has no way to
  // know it went, and the owner gets it twice from two people.
  ok(SCREEN.includes('audit_emailed_at'), 'the screen does not read whether the audit went')
  ok(SCREEN.includes('audit_emailed_by_name'), 'the screen does not say who sent it')
  ok(SCREEN.includes('audit_emailed_to'), 'the screen does not say where it went')
})

// ── The columns the screen draws it all from ─────────────────────────────

const DOOR = read('api/calls-admin.js')
const SELECTED = DOOR.match(/const COLUMNS = \[([\s\S]*?)\]\.join/)?.[1] ?? ''

check('the list names every column the reading is taken from', () => {
  // A column dropped from the select does not fail anything. It makes the
  // reading read as never measured, on every row, quietly.
  ok(SELECTED.length > 0, 'the list no longer names its own columns')
  for (const entry of CATEGORIES) {
    ok(SELECTED.includes(`'${entry.column}'`), `${entry.column} is not selected`)
  }
  for (const column of ['audit_at', 'audit_raw', 'audit_emailed_at', 'audit_emailed_to', 'email']) {
    ok(SELECTED.includes(`'${column}'`), `${column} is not selected`)
  }
})

check('the list hands over a name for whoever sent the audit', () => {
  ok(/audit_emailed_by_name:/.test(DOOR), 'the row carries an id where the screen draws a name')
})

await finish()
console.log(`call desk: ${cases.length} checks passed`)
