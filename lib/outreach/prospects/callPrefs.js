/**
 * How one person has the call list set up: which columns they draw, how tight
 * the rows are, what the list is narrowed to, and the narrowings they have
 * named and kept.
 *
 * The list is worked for hours at a stretch by somebody with a phone in the
 * other hand, and what makes a working list readable is not the same for two
 * people. One wants the scoring chips on screen and can live with eleven rows;
 * one wants forty rows and will open the record when they want the reasoning.
 * One only ever rings Channelview. None of that is a preference about the
 * product, so none of it belongs in the product's defaults - it belongs to the
 * account, and it is stored there.
 *
 * Everything here is a pure function over plain values, because both ends need
 * the same answers and they must not be two answers. The console reads these to
 * draw the controls; the endpoint reads them to decide what it will store, and
 * an option the console offers that the endpoint would refuse is a setting that
 * silently does not stick. The lists are declared once and both sides index
 * them.
 *
 * Nothing is stored for a value that was never chosen. Every field reads back
 * as null until somebody sets it, and null means the default rather than an
 * empty choice - which is the whole difference between an account that has
 * never opened the column chooser and one that has turned every optional
 * column off.
 */

/**
 * Every column the list can draw, in the order it draws them.
 *
 * `fixed` is a column the chooser does not offer, because the list stops being
 * a call list without it: who they are, the number, where they stand, and the
 * way to ring them.
 *
 * `weight` is the share of the table's width the column takes. The table is
 * laid out to fixed widths so nothing can push it past the page, and the
 * shares are declared here rather than as classes on the cells because the set
 * of columns is the reader's to change: nine equal ninths gives the business
 * name the same room as the call button, which is how a list of businesses
 * ends up unreadable at every width.
 *
 * `at` is the width the column appears from. A phone draws the four fixed
 * columns and nothing else, whatever the account has chosen, because a column
 * a reader chose at their desk is not a column they want three words wide on a
 * phone.
 *
 * `off` is a column the chooser offers and the default set leaves out.
 */
export const LIST_COLUMNS = Object.freeze([
  Object.freeze({ id: 'business', label: 'Business', weight: 21, fixed: true }),
  Object.freeze({ id: 'score', label: 'Score', weight: 8 }),
  Object.freeze({ id: 'phone', label: 'Number', weight: 12, fixed: true }),
  Object.freeze({ id: 'pull', label: 'For Its Trade', weight: 14, at: 'sm' }),
  Object.freeze({ id: 'reviews', label: 'Reviews', weight: 9, at: 'md', off: true }),
  Object.freeze({ id: 'why', label: 'Why This One', weight: 17, at: 'xl' }),
  Object.freeze({ id: 'site', label: 'Instead Of A Site', weight: 12, at: 'lg' }),
  Object.freeze({ id: 'address', label: 'Address', weight: 16, at: 'xl', off: true }),
  Object.freeze({ id: 'rung', label: 'Rung', weight: 11, at: 'md' }),
  Object.freeze({ id: 'state', label: 'State', weight: 12, fixed: true }),
  Object.freeze({ id: 'call', label: 'Call', weight: 8, fixed: true }),
])

/** The column ids, for anything that only needs to know one is real. */
export const COLUMN_IDS = Object.freeze(LIST_COLUMNS.map(column => column.id))

/** The columns nobody can turn off. */
export const FIXED_COLUMNS = Object.freeze(
  LIST_COLUMNS.filter(column => column.fixed).map(column => column.id)
)

/** The columns the chooser offers. */
export const OPTIONAL_COLUMNS = Object.freeze(
  LIST_COLUMNS.filter(column => !column.fixed).map(column => column.id)
)

/** What an account that has never opened the chooser draws. */
export const DEFAULT_COLUMNS = Object.freeze(
  LIST_COLUMNS.filter(column => !column.off).map(column => column.id)
)

/** One column by id, or null. */
export function columnOf(id) {
  return LIST_COLUMNS.find(column => column.id === id) ?? null
}

/**
 * The columns to draw, from whatever was stored.
 *
 * Null is an account that has never chosen, which is the default set. An array
 * is a choice, and the fixed columns are added back to it rather than trusted
 * to be in it: a stored set written before a fixed column existed would
 * otherwise draw a list with no way to ring anybody.
 */
export function normalizeColumns(stored) {
  if (!Array.isArray(stored)) return [...DEFAULT_COLUMNS]
  const chosen = new Set(stored.filter(id => OPTIONAL_COLUMNS.includes(id)))
  return LIST_COLUMNS.filter(column => column.fixed || chosen.has(column.id)).map(
    column => column.id
  )
}

/** The widths a column can be declared to appear from, narrowest first. */
export const WIDTH_BANDS = Object.freeze(['xs', 'sm', 'md', 'lg', 'xl'])

/** Where each band starts, which is where the stylesheet's own breakpoints are. */
export const BAND_FLOORS = Object.freeze({ xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 })

/** Which band a screen of this width is in. */
export function bandOf(width) {
  const held = Number.isFinite(width) ? width : BAND_FLOORS.xl
  let band = 'xs'
  for (const name of WIDTH_BANDS) {
    if (held >= BAND_FLOORS[name]) band = name
  }
  return band
}

/**
 * The chosen columns that are actually drawn at this width.
 *
 * The narrowing is decided here rather than by hiding cells in the stylesheet,
 * because the widths below are shares of a hundred and a share can only be
 * taken over columns that exist. Hiding four cells and leaving their shares in
 * the total is a table whose columns come to half the room it has, which on a
 * phone is five columns squeezed into the left half of the screen with the
 * phone numbers written over them.
 */
export function columnsAt(ids, band) {
  const reached = WIDTH_BANDS.indexOf(WIDTH_BANDS.includes(band) ? band : 'xl')
  return ids.filter(id => {
    const at = columnOf(id)?.at
    return !at || WIDTH_BANDS.indexOf(at) <= reached
  })
}

/**
 * The share of the table each drawn column takes, as a percentage string.
 *
 * Taken over the columns actually drawn, so turning three off widens the seven
 * that are left rather than leaving the table indented from a margin that is
 * not there.
 */
export function columnWidths(ids) {
  const drawn = ids.map(columnOf).filter(Boolean)
  const total = drawn.reduce((sum, column) => sum + column.weight, 0) || 1
  const widths = {}
  for (const column of drawn) widths[column.id] = `${((column.weight / total) * 100).toFixed(3)}%`
  return widths
}

/** How tight the rows are drawn. */
export const CALL_DENSITIES = Object.freeze([
  Object.freeze({
    id: 'roomy',
    label: 'Roomy',
    note: 'Every cell carries the line under it that says what it means.',
  }),
  Object.freeze({
    id: 'tight',
    label: 'Tight',
    note: 'One line a row, and about twice as many of them on screen.',
  }),
])

export const DENSITY_IDS = Object.freeze(CALL_DENSITIES.map(one => one.id))
export const DEFAULT_DENSITY = 'roomy'

/** The state of play a caller can narrow to. */
export const CALL_STATES = Object.freeze([
  Object.freeze({ id: 'all', label: 'Any State', chip: null }),
  Object.freeze({ id: 'due', label: 'Due Back', chip: 'Due back' }),
  Object.freeze({ id: 'fresh', label: 'Never Called', chip: 'Never called' }),
  Object.freeze({ id: 'rung', label: 'Rung And Ready', chip: 'Rung and ready' }),
])

/** How a listing reads against the middle listing in its own trade. */
export const CALL_PULLS = Object.freeze([
  Object.freeze({ id: 'all', label: 'Every Reading', chip: null }),
  Object.freeze({ id: 'busy', label: 'Busy For Its Trade', chip: 'Busy for its trade' }),
  Object.freeze({ id: 'steady', label: 'Middling For Its Trade', chip: 'Middling' }),
  Object.freeze({ id: 'quiet', label: 'Findable By Nobody', chip: 'Findable by nobody' }),
  Object.freeze({ id: 'unread', label: 'Trade Unread', chip: 'Trade unread' }),
])

/** The score floors the console offers, which the endpoint holds it to. */
export const CALL_SCORE_FLOORS = Object.freeze([40, 55, 70])

export const CALL_SCORES = Object.freeze([
  Object.freeze({ id: 'all', label: 'Any Score', chip: null }),
  ...CALL_SCORE_FLOORS.map(floor =>
    Object.freeze({ id: String(floor), label: `Score ${floor} And Up`, chip: `${floor}+` })
  ),
])

/** The orders the list can be read in. */
export const CALL_SORTS = Object.freeze([
  Object.freeze({ id: 'best', label: 'Best First' }),
  Object.freeze({ id: 'waited', label: 'Longest Since Rung' }),
  Object.freeze({ id: 'reviews', label: 'Most Reviews' }),
  Object.freeze({ id: 'newest', label: 'Newest On The List' }),
])

export const SORT_IDS = Object.freeze(CALL_SORTS.map(one => one.id))
export const DEFAULT_SORT = 'best'

/** The page sizes the list is read in, and the batches Call Mode works in. */
export const CALL_TAKES = Object.freeze([25, 50, 100])
export const DEFAULT_TAKE = 50

/** Nothing narrowed. Every filter reads its own 'all'. */
export const NO_FILTERS = Object.freeze({
  state: 'all',
  pull: 'all',
  min_score: 'all',
  town: 'all',
  trade: 'all',
})

/** The filters that come off a fixed list, and the list each comes off. */
const LISTED_FILTERS = Object.freeze({
  state: CALL_STATES,
  pull: CALL_PULLS,
  min_score: CALL_SCORES,
})

/** A stored string as a plain trimmed one, or 'all'. */
function plain(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed && trimmed !== 'all' ? trimmed : 'all'
}

/**
 * A stored filter set as one the list will actually take.
 *
 * A town or a trade is whatever the map sweep found and cannot be checked
 * against a list here, so it is carried as typed and the endpoint's own
 * narrowing simply matches nothing if it names a town nobody is in. The three
 * that do come off a list are held to it, because a stored value nothing
 * offers would leave a control showing a blank and no way back to it.
 */
export function normalizeFilters(stored) {
  const raw = stored && typeof stored === 'object' ? stored : {}
  const filters = { ...NO_FILTERS }
  for (const [key, options] of Object.entries(LISTED_FILTERS)) {
    const value = plain(raw[key])
    if (options.some(one => one.id === value)) filters[key] = value
  }
  filters.town = plain(raw.town)
  filters.trade = plain(raw.trade)
  return filters
}

/** Whether a filter set narrows anything at all. */
export function filtersNarrow(filters) {
  const held = normalizeFilters(filters)
  return Object.keys(NO_FILTERS).some(key => held[key] !== 'all')
}

/**
 * What is narrowing the list right now, as a chip apiece.
 *
 * Six dropdowns each showing a value is six things to read before a reader
 * knows why a business they expected is not on screen. The chips say only what
 * is on, each carries the way to take it off, and nothing is drawn when nothing
 * is narrowed.
 */
export function filterChips(filters) {
  const held = normalizeFilters(filters)
  const chips = []
  for (const [key, options] of Object.entries(LISTED_FILTERS)) {
    const found = options.find(one => one.id === held[key])
    if (found?.chip) chips.push({ key, label: found.chip })
  }
  if (held.town !== 'all') chips.push({ key: 'town', label: held.town })
  if (held.trade !== 'all') chips.push({ key: 'trade', label: held.trade })
  return chips
}

/** A filter set with one filter put back to 'all'. */
export function withoutFilter(filters, key) {
  return normalizeFilters({ ...normalizeFilters(filters), [key]: 'all' })
}

/**
 * Whether two narrowings are the same narrowing.
 *
 * Read to say which saved view the list is currently showing, so a caller who
 * pressed one can see that they are inside it and press it again to leave. The
 * order counts as part of it: the same six businesses ranked by score and
 * ranked by how long they have waited are two different lists to work.
 */
export function sameNarrowing(one, two) {
  const left = normalizeFilters(one?.filters)
  const right = normalizeFilters(two?.filters)
  const sorts =
    (SORT_IDS.includes(one?.sort) ? one.sort : DEFAULT_SORT) ===
    (SORT_IDS.includes(two?.sort) ? two.sort : DEFAULT_SORT)
  return sorts && Object.keys(NO_FILTERS).every(key => left[key] === right[key])
}

/** How many narrowings one account may keep, and how long a name may be. */
export const SAVED_VIEW_MAX = 12
export const SAVED_VIEW_NAME_MAX = 40

/** A saved view's name, trimmed to what the column holds, or null. */
export function viewName(raw) {
  const name = typeof raw === 'string' ? raw.trim().slice(0, SAVED_VIEW_NAME_MAX) : ''
  return name || null
}

/**
 * The narrowings this account has named and kept.
 *
 * A saved view is a filter set and the order to read it in, under a name
 * somebody chose. Anything that is not that is dropped rather than repaired:
 * these are written by one console and read by the same one, so a row that
 * does not have the shape is corruption rather than an older format.
 */
export function normalizeSavedViews(stored) {
  if (!Array.isArray(stored)) return []
  const kept = []
  const seen = new Set()
  for (const raw of stored) {
    if (!raw || typeof raw !== 'object') continue
    const name = viewName(raw.name)
    const id = typeof raw.id === 'string' ? raw.id.trim().slice(0, 64) : ''
    if (!name || !id || seen.has(id)) continue
    seen.add(id)
    kept.push({
      id,
      name,
      filters: normalizeFilters(raw.filters),
      sort: SORT_IDS.includes(raw.sort) ? raw.sort : DEFAULT_SORT,
    })
    if (kept.length >= SAVED_VIEW_MAX) break
  }
  return kept
}

/** What an account is set up as before it has set anything up. */
export const DEFAULT_PREFS = Object.freeze({
  columns: DEFAULT_COLUMNS,
  density: DEFAULT_DENSITY,
  take: DEFAULT_TAKE,
  sort: DEFAULT_SORT,
  filters: NO_FILTERS,
  views: Object.freeze([]),
})

/**
 * A stored row as the setup the console draws from, with every field the
 * console reads present whether or not the account has ever chosen it.
 */
export function normalizePrefs(stored) {
  const raw = stored && typeof stored === 'object' ? stored : {}
  const take = Number.parseInt(String(raw.take ?? ''), 10)
  return {
    columns: normalizeColumns(raw.columns),
    density: DENSITY_IDS.includes(raw.density) ? raw.density : DEFAULT_DENSITY,
    take: CALL_TAKES.includes(take) ? take : DEFAULT_TAKE,
    sort: SORT_IDS.includes(raw.sort) ? raw.sort : DEFAULT_SORT,
    filters: normalizeFilters(raw.filters),
    views: normalizeSavedViews(raw.views),
  }
}

/**
 * What a change to the setup writes, as the columns the row actually holds.
 *
 * Only what was sent is written. The console saves one thing at a time - a
 * column turned off, a view kept, the filters as they now stand - and a patch
 * that carried every field would have every other tab's idea of the setup
 * overwrite this one's on the next keystroke.
 */
export function prefsPatch(sent) {
  const raw = sent && typeof sent === 'object' ? sent : {}
  const patch = {}
  if ('columns' in raw) patch.columns = normalizeColumns(raw.columns)
  if ('density' in raw) {
    patch.density = DENSITY_IDS.includes(raw.density) ? raw.density : DEFAULT_DENSITY
  }
  if ('take' in raw) {
    const take = Number.parseInt(String(raw.take ?? ''), 10)
    patch.take = CALL_TAKES.includes(take) ? take : DEFAULT_TAKE
  }
  if ('sort' in raw) patch.sort = SORT_IDS.includes(raw.sort) ? raw.sort : DEFAULT_SORT
  if ('filters' in raw) patch.filters = normalizeFilters(raw.filters)
  if ('views' in raw) patch.views = normalizeSavedViews(raw.views)
  return patch
}
