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
 *   npm run check:call-desk
 */
import {
  CALL_DENSITIES,
  CALL_PULLS,
  CALL_SCORES,
  CALL_SCORE_FLOORS,
  CALL_SORTS,
  CALL_STATES,
  CALL_TAKES,
  BAND_FLOORS,
  COLUMN_IDS,
  DEFAULT_COLUMNS,
  DEFAULT_DENSITY,
  DEFAULT_PREFS,
  DEFAULT_SORT,
  DEFAULT_TAKE,
  FIXED_COLUMNS,
  LIST_COLUMNS,
  NO_FILTERS,
  OPTIONAL_COLUMNS,
  SAVED_VIEW_MAX,
  SAVED_VIEW_NAME_MAX,
  SORT_IDS,
  WIDTH_BANDS,
  bandOf,
  columnOf,
  columnsAt,
  columnWidths,
  filterChips,
  filtersNarrow,
  normalizeColumns,
  normalizeFilters,
  normalizePrefs,
  normalizeSavedViews,
  prefsPatch,
  sameNarrowing,
  withoutFilter,
} from '../../../lib/outreach/prospects/callPrefs.js'
import {
  BEAT_MS,
  PHONE_MAX_MS,
  PRESENCE_TTL_MS,
  callerMark,
  callerName,
  heldByOther,
  heldNumbers,
  livePresence,
  onPhone,
  onPhoneNow,
  presenceLive,
  saidAgo,
  saidSince,
} from '../../../lib/outreach/prospects/callPresence.js'
import { PULLS } from '../../../lib/outreach/prospects/calls.js'

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want)
    throw new Error(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

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
    ok(column.label && column.weight > 0, `${column.id} carries no label or no width`)
    ok(!(column.fixed && column.at), `${column.id} is fixed but disappears at a width`)
    ok(!(column.fixed && column.off), `${column.id} is fixed but off by default`)
  }
})

check('the drawn columns share the whole table between them', () => {
  for (const set of [DEFAULT_COLUMNS, FIXED_COLUMNS, COLUMN_IDS, normalizeColumns(['address'])]) {
    const widths = columnWidths(set)
    const total = set.reduce((sum, id) => sum + Number.parseFloat(widths[id]), 0)
    ok(Math.abs(total - 100) < 0.01, `${set.length} columns came to ${total}%`)
  }
})

check('a screen falls in the band the stylesheet would have put it in', () => {
  same(bandOf(390), 'xs', 'a phone')
  same(bandOf(BAND_FLOORS.sm), 'sm', 'the first breakpoint exactly')
  same(bandOf(900), 'md', 'a tablet')
  same(bandOf(1024), 'lg', 'a small laptop')
  same(bandOf(1440), 'xl', 'a desk')
  same(bandOf(undefined), 'xl', 'a render with no window to measure')
  for (const band of WIDTH_BANDS) same(bandOf(BAND_FLOORS[band]), band, `the floor of ${band}`)
})

check('a phone draws only the columns that declare no width of their own', () => {
  const always = LIST_COLUMNS.filter(column => !column.at).map(column => column.id)
  for (const id of FIXED_COLUMNS) ok(always.includes(id), `${id} is fixed but gives way`)
  same(columnsAt(COLUMN_IDS, 'xs').join(), always.join(), 'a phone')
  same(columnsAt(COLUMN_IDS, 'xl').join(), COLUMN_IDS.join(), 'a desk')
  ok(columnsAt(COLUMN_IDS, 'lg').length > columnsAt(COLUMN_IDS, 'sm').length, 'wider draws more')
  // A band nothing declares is read as the widest, so a render that could not
  // measure a window draws the whole table rather than four columns of it.
  same(columnsAt(COLUMN_IDS, 'enormous').join(), COLUMN_IDS.join(), 'a band nothing declares')
})

check('the shares still come to a hundred at every width', () => {
  // The reason the width decides the columns rather than the stylesheet hiding
  // them: a share can only be taken over the columns that exist. Four cells
  // hidden with their shares left in the total is a table whose columns come to
  // half the room it has, with the phone numbers written over them.
  for (const band of WIDTH_BANDS) {
    const drawn = columnsAt(DEFAULT_COLUMNS, band)
    const widths = columnWidths(drawn)
    const total = drawn.reduce((sum, id) => sum + Number.parseFloat(widths[id]), 0)
    ok(Math.abs(total - 100) < 0.01, `at ${band} the columns came to ${total}%`)
  }
})

check('turning a column off widens the ones that are left', () => {
  const all = columnWidths(COLUMN_IDS)
  const fewer = columnWidths(FIXED_COLUMNS)
  ok(
    Number.parseFloat(fewer.business) > Number.parseFloat(all.business),
    'the business column did not take the room back'
  )
})

check('a column knows its own label and where it gives way', () => {
  same(columnOf('business').label, 'Business', 'the label')
  same(columnOf('nothing'), null, 'an id nothing offers')
  for (const column of LIST_COLUMNS) {
    if (!column.at) continue
    ok(['sm', 'md', 'lg', 'xl'].includes(column.at), `${column.id} gives way at ${column.at}`)
  }
})

// ── The narrowing ────────────────────────────────────────────────────────

check('nothing stored is nothing narrowed', () => {
  same(JSON.stringify(normalizeFilters(null)), JSON.stringify(NO_FILTERS), 'null')
  same(filtersNarrow(null), false, 'null narrows nothing')
  same(filtersNarrow(NO_FILTERS), false, 'every filter at all')
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

check('every filter narrows, and taking one off leaves the rest', () => {
  const filters = normalizeFilters({ state: 'fresh', town: 'Baytown', min_score: '70' })
  same(filtersNarrow(filters), true, 'three narrowings')
  const fewer = withoutFilter(filters, 'town')
  same(fewer.town, 'all', 'the town came off')
  same(fewer.state, 'fresh', 'the state stayed')
  same(fewer.min_score, '70', 'the floor stayed')
})

check('the chips say what is on and nothing else', () => {
  same(filterChips(NO_FILTERS).length, 0, 'nothing narrowed draws nothing')
  const chips = filterChips({ state: 'fresh', town: 'Baytown', pull: 'quiet' })
  same(chips.length, 3, 'three narrowings, three chips')
  same(chips.map(chip => chip.key).join(), 'state,pull,town', 'in the order the controls sit in')
  for (const chip of chips) ok(chip.label && chip.label !== 'all', `a chip reads "${chip.label}"`)
})

check('every chip carries the key that takes it off again', () => {
  for (const key of Object.keys(NO_FILTERS)) {
    const value = key === 'town' || key === 'trade' ? 'Baytown' : null
    const filters = { ...NO_FILTERS, [key]: value ?? offeredValue(key) }
    const chips = filterChips(filters)
    same(chips.length, 1, `${key} drew ${chips.length} chips`)
    same(withoutFilter(filters, chips[0].key)[key], 'all', `${key} could not be taken off`)
  }
})

/** The first value of a listed filter that is not 'all'. */
function offeredValue(key) {
  const options = { state: CALL_STATES, pull: CALL_PULLS, min_score: CALL_SCORES }[key]
  return options.find(one => one.id !== 'all').id
}

// ── What the console offers and the endpoint keeps ───────────────────────

check('every reading the console offers is one the scoring produces', () => {
  // The drift that matters: a band added to the score and not to the control,
  // or a control offering a band nothing is ever in. Either leaves a filter
  // that returns an empty list and looks like a list with nothing in it.
  const offered = CALL_PULLS.filter(one => one.id !== 'all').map(one => one.id)
  same(offered.join(), [...PULLS].join(), 'the console and the scoring disagree')
})

check('every score floor the console offers is one the list can be held to', () => {
  const offered = CALL_SCORES.filter(one => one.id !== 'all').map(one => Number(one.id))
  same(offered.join(), CALL_SCORE_FLOORS.join(), 'the dropdown and the floors disagree')
})

check('every option list carries an all, first, and no id twice', () => {
  for (const [name, options] of Object.entries({
    state: CALL_STATES,
    pull: CALL_PULLS,
    score: CALL_SCORES,
  })) {
    same(options[0].id, 'all', `${name} does not lead with every one of them`)
    same(new Set(options.map(one => one.id)).size, options.length, `${name} repeats an id`)
    same(options[0].chip, null, `${name}'s all draws a chip`)
    for (const one of options.slice(1)) ok(one.chip, `${name}.${one.id} has no chip to draw`)
  }
})

check('the defaults are values their own lists offer', () => {
  ok(SORT_IDS.includes(DEFAULT_SORT), 'the default order is not one of the orders')
  ok(CALL_TAKES.includes(DEFAULT_TAKE), 'the default page size is not one offered')
  ok(
    CALL_DENSITIES.some(one => one.id === DEFAULT_DENSITY),
    'the default density is not one offered'
  )
  same(DEFAULT_PREFS.sort, DEFAULT_SORT, 'the setup and the list disagree on the order')
  same(DEFAULT_PREFS.take, DEFAULT_TAKE, 'the setup and the list disagree on the page size')
  for (const one of CALL_SORTS) ok(one.label, `${one.id} has no label`)
  for (const one of CALL_DENSITIES) ok(one.label && one.note, `${one.id} has no label or note`)
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

check('the list says which kept narrowing it is showing', () => {
  const kept = { filters: { town: 'Baytown' }, sort: 'best' }
  ok(sameNarrowing(kept, { filters: { town: 'Baytown' }, sort: 'best' }), 'the same narrowing')
  ok(!sameNarrowing(kept, { filters: { town: 'Channelview' }, sort: 'best' }), 'a different town')
  // The order counts. The same six businesses by score and by how long they
  // have waited are two different lists to work down.
  ok(!sameNarrowing(kept, { filters: { town: 'Baytown' }, sort: 'waited' }), 'a different order')
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
  same(callerMark({ name: 'Dylan Jordan' }), 'DJ', 'two initials')
  same(callerMark({ name: 'Trenton' }), 'TR', 'one word')
  same(callerMark({}), 'SO', 'nobody at all')
})

check('a call is said in minutes, because seconds are movement rather than news', () => {
  same(saidSince(new Date(NOW.getTime() - 20_000), NOW), 'just now', 'twenty seconds')
  same(saidSince(new Date(NOW.getTime() - 61_000), NOW), '1 min', 'a minute')
  same(saidSince(new Date(NOW.getTime() - 14 * 60_000), NOW), '14 min', 'a quarter hour')
  same(saidSince(new Date(NOW.getTime() - 90 * 60_000), NOW), '1 hr', 'an hour and a half')
  same(saidSince(null, NOW), 'just now', 'no instant at all')
  same(saidAgo(new Date(NOW.getTime() - 61_000), NOW), '1 min ago', 'said as time past')
  same(saidAgo(new Date(NOW.getTime() - 20_000), NOW), 'just now', 'and not "just now ago"')
})

let failed = 0
for (const [name, run] of cases) {
  try {
    run()
  } catch (cause) {
    failed += 1
    console.error(`FAIL  ${name}\n      ${cause.message}`)
  }
}
if (failed) {
  console.error(`\ncall desk: ${failed} of ${cases.length} checks failed`)
  process.exit(1)
}
console.log(`call desk: ${cases.length} checks passed`)
