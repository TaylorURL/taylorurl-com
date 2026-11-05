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
 * How many pages of one read are allowed to be in flight together.
 *
 * Asking for the pages after the first in one round rather than one after
 * another is worth a lot when there are two or three of them. It stops being
 * worth anything the moment there are more of them than the project will
 * serve at once: the extra ones do not start early, they queue, and a request
 * that queues is spending its own deadline doing it. Sixteen pages asked for
 * together are not sixteen pages read in the time of one - they are sixteen
 * requests sharing the same clock, and the ones at the back of the queue run
 * out of it while the rows they wanted are still waiting to be sent.
 *
 * So a read goes wide, but only this wide, and the pages past that wait for a
 * slot instead of for a timeout. The whole read takes as long as it takes;
 * what it no longer does is fail because it was competing with itself.
 */
export const PAGES_AT_ONCE = 4

/**
 * One page of a read: the rows, whether the set ended inside it, and how many
 * rows the whole set holds where the query asked for that.
 *
 * A query built with `{ count: 'exact' }` on its select answers every page
 * with the size of the whole set, at the cost of one count inside the same
 * request. Without it `count` is null and the read walks the set a page at a
 * time, as it always did.
 */
async function pageOf(build, from, size) {
  const { data, error, count } = await build().range(from, from + size - 1)
  if (error) throw error
  const rows = data || []
  return { rows, short: rows.length < size, count: Number.isInteger(count) ? count : null }
}

/**
 * Every row a query selects, up to `max`.
 *
 * A set that is several pages deep is read a few pages at a time rather than
 * one page after another, wherever the first page says how many rows there
 * are. The call list is the case: thousands of callable businesses read on
 * every poll of every console, and one round trip after another puts the
 * whole latency of all of them on the front of every read.
 *
 * A few pages at a time, and not all of them: see `PAGES_AT_ONCE`. Beyond a
 * handful the extra requests do not overlap, they queue, and queueing is how
 * a page spends its deadline without ever being served. A table of sixteen
 * pages read in four rounds of four is slower than sixteen pages that all
 * came back at once and faster than sixteen that could not.
 *
 * The count is a hint and never the authority - the pages after it are still
 * read until one comes back short, so a set that grew between the count and
 * the pages loses nothing to the gap.
 *
 * @param {() => object} build Returns a fresh query, unranged.
 * @param {{max?: number, pageSize?: number, atOnce?: number}} [bounds]
 * @returns {Promise<{rows: object[], complete: boolean}>} `complete` is false
 *   only where the ceiling stopped the read with rows still to come.
 */
export async function readAll(
  build,
  { max = 50_000, pageSize = PAGE_ROWS, atOnce = PAGES_AT_ONCE } = {}
) {
  const rows = []
  let from = 0
  const wide = Math.max(1, atOnce)

  const first = await pageOf(build, 0, Math.min(pageSize, max))
  rows.push(...first.rows)
  if (first.short) return { rows, complete: true }
  from = rows.length

  if (first.count !== null && first.count > from && from < max) {
    const until = Math.min(first.count, max)
    // Each page is asked for whole rather than cut to the count, so a count
    // that was right comes back with its last page short and the read ends
    // there. A last page cut to the count's own edge would always be full,
    // and a full page has to be followed by another to know the set ended.
    let ended = false
    while (from < until && !ended) {
      const asks = []
      for (let at = from; at < until && asks.length < wide; at += pageSize) {
        const size = Math.min(pageSize, max - at)
        asks.push(pageOf(build, at, size))
        from = at + size
      }
      const pages = await Promise.all(asks)
      for (const page of pages) rows.push(...page.rows)
      // A short page inside the round means the set ended there, so the rows
      // behind it in this round are the end of it and no further round is
      // asked for.
      ended = pages.some(page => page.short)
    }
    if (ended) return { rows, complete: true }
  }

  for (; from < max; from += pageSize) {
    const page = await pageOf(build, from, Math.min(pageSize, max - from))
    rows.push(...page.rows)
    if (page.short) return { rows, complete: true }
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
