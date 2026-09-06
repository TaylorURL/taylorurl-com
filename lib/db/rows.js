/**
 * Reading a whole table, rather than as much of it as one answer carries.
 *
 * A plain select stops at the project's row ceiling, and stopping there is not
 * an error: the answer arrives with a thousand rows in it and says nothing
 * about the rest. A total counted over that answer is a figure that was right
 * until the table passed a thousand rows and has been quietly wrong ever
 * since, which is the worst shape a number on a dashboard can take - it is
 * still a number, it still moves, and nothing about it says it stopped.
 *
 * So a read that has to see every row asks for it a page at a time and stops
 * when a page comes back short. The query is passed as a function rather than
 * as a builder, because a builder holds one request's worth of state and
 * cannot be ranged a second time.
 *
 * A ceiling is still worth having, since an endpoint answering a console has
 * seconds to do it in. It is a stated one: `readAll` says how many rows it
 * covered, and a caller that reached the ceiling can say so beside the figures
 * rather than presenting a sample as a total.
 */

/** Rows one page carries, which is the ceiling a single answer stops at. */
export const PAGE_ROWS = 1000

/**
 * Every row a query selects, up to `max`.
 *
 * @param {() => object} build Returns a fresh query, unranged.
 * @param {{max?: number, pageSize?: number}} [bounds]
 * @returns {Promise<{rows: object[], complete: boolean}>} `complete` is false
 *   only where the ceiling stopped the read with rows still to come.
 */
export async function readAll(build, { max = 50_000, pageSize = PAGE_ROWS } = {}) {
  const rows = []
  for (let from = 0; from < max; from += pageSize) {
    const size = Math.min(pageSize, max - from)
    const { data, error } = await build().range(from, from + size - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < size) return { rows, complete: true }
  }
  return { rows, complete: false }
}

/**
 * How many rows a query selects, without any of them travelling.
 *
 * A count is the one figure that never needs the rows behind it, and asking
 * for it this way is exact however large the table is - so a headline total
 * stays right past any ceiling a breakdown beside it runs into.
 *
 * @param {object} query A query with `count: 'exact', head: true` set.
 * @returns {Promise<number>}
 */
/**
 * Whether an error is Postgres or PostgREST saying a table is absent, which
 * each of them says its own way.
 */
export function tableMissing(error) {
  const code = error?.code || ''
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST106') return true
  return /does not exist|could not find the table/i.test(error?.message || '')
}

/**
 * Whether an error says a column is not in the table, which is what a read
 * ahead of its migration gets back. Postgres and PostgREST each have their
 * own way of saying it.
 */
export function columnMissing(error) {
  const code = error?.code || ''
  if (code === '42703' || code === 'PGRST204') return true
  return /column .* does not exist|could not find the .* column/i.test(error?.message || '')
}

export async function countOf(query) {
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}
