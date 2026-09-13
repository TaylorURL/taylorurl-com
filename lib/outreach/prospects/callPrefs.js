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
 * the same answers and they must not be two answers. The endpoint reads these to
 * decide what it will store, and the console reads the same ones to draw a
 * change before the write comes back; a value the console drew that the
 * endpoint would refuse is a setting that silently does not stick.
 *
 * Nothing is stored for a value that was never chosen. Every field reads back
 * as null until somebody sets it, and null means the default rather than an
 * empty choice - which is the whole difference between an account that has
 * never chosen its columns and one that has turned every optional column off.
 */

import { PULLS } from './calls.js'
import { goalsPatch, normalizeGoals } from './callShift.js'

/**
 * Every column the list can draw, in the order it draws them.
 *
 * `fixed` is a column no setup can leave out, because the list stops being a
 * call list without it: who they are, the number, where they stand, and the
 * way to ring them.
 *
 * `off` is a column the default set leaves out.
 */
export const LIST_COLUMNS = Object.freeze([
  Object.freeze({ id: 'business', fixed: true }),
  Object.freeze({ id: 'score' }),
  Object.freeze({ id: 'phone', fixed: true }),
  Object.freeze({ id: 'pull' }),
  Object.freeze({ id: 'reviews', off: true }),
  Object.freeze({ id: 'why' }),
  Object.freeze({ id: 'site' }),
  Object.freeze({ id: 'address', off: true }),
  Object.freeze({ id: 'rung' }),
  Object.freeze({ id: 'assigned' }),
  Object.freeze({ id: 'state', fixed: true }),
])

/** The column ids, for anything that only needs to know one is real. */
export const COLUMN_IDS = Object.freeze(LIST_COLUMNS.map(column => column.id))

/** The columns nobody can turn off. */
export const FIXED_COLUMNS = Object.freeze(
  LIST_COLUMNS.filter(column => column.fixed).map(column => column.id)
)

/** The columns a setup can choose to draw or leave out. */
export const OPTIONAL_COLUMNS = Object.freeze(
  LIST_COLUMNS.filter(column => !column.fixed).map(column => column.id)
)

/** What an account that has never chosen its columns draws. */
export const DEFAULT_COLUMNS = Object.freeze(
  LIST_COLUMNS.filter(column => !column.off).map(column => column.id)
)

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

/** How tight the rows are drawn. */
export const DENSITY_IDS = Object.freeze(['roomy', 'tight'])
export const DEFAULT_DENSITY = 'roomy'

/** The state of play a caller can narrow to. */
export const CALL_STATES = Object.freeze(['all', 'due', 'fresh', 'rung'])

/** How a listing reads against the middle listing in its own trade. */
export const CALL_PULLS = Object.freeze(['all', ...PULLS])

/** The score floors the list can be narrowed to. */
export const CALL_SCORE_FLOORS = Object.freeze([40, 55, 70])

export const CALL_SCORES = Object.freeze(['all', ...CALL_SCORE_FLOORS.map(String)])

/** The orders the list can be read in. */
export const SORT_IDS = Object.freeze(['best', 'waited', 'reviews', 'newest'])
export const DEFAULT_SORT = 'best'

/** The page sizes the list is read in. */
export const CALL_TAKES = Object.freeze([25, 50, 100])
export const DEFAULT_TAKE = 50

/** Nothing narrowed. Every filter reads its own 'all'. */
export const NO_FILTERS = Object.freeze({
  state: 'all',
  pull: 'all',
  min_score: 'all',
  town: 'all',
  trade: 'all',
  assigned: 'all',
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
 * that do come off a list are held to it, and a stored value nothing offers
 * reads back as 'all'.
 */
export function normalizeFilters(stored) {
  const raw = stored && typeof stored === 'object' ? stored : {}
  const filters = { ...NO_FILTERS }
  for (const [key, options] of Object.entries(LISTED_FILTERS)) {
    const value = plain(raw[key])
    if (options.includes(value)) filters[key] = value
  }
  filters.town = plain(raw.town)
  filters.trade = plain(raw.trade)
  // Whoever holds the business: one of the two standings, or an account's own
  // id. Carried as typed for the same reason a town is - the people who can
  // hold a business are rows in another table rather than a list this module
  // could hold - and a stored id nobody answers to narrows to nothing, which
  // is the honest answer to a filter naming somebody who has left.
  filters.assigned = plain(raw.assigned)
  return filters
}

/** How many narrowings one account may keep, and how long a name may be. */
export const SAVED_VIEW_MAX = 12
export const SAVED_VIEW_NAME_MAX = 40

/** A saved view's name, trimmed to what the column holds, or null. */
function viewName(raw) {
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
    goals: normalizeGoals(raw.goals),
  }
}

/**
 * What a change to the setup writes, as the columns the row actually holds.
 *
 * Only what was sent is written. The console saves one thing at a time, and a
 * patch that carried every field would have every other tab's idea of the
 * setup overwrite this one's on the next keystroke.
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
  // Whole rather than by field: the three figures are chosen together and a
  // patch carrying one of them would leave the row holding two somebody chose
  // and one they did not.
  //
  // And nothing is written for a value that cannot be read as three figures,
  // because the alternative is that a malformed send quietly puts the account
  // back on the studio's numbers and loses the ones somebody set.
  const goals = 'goals' in raw ? goalsPatch(raw.goals) : null
  if (goals) patch.goals = goals
  return patch
}
