/**
 * Proves that a read which has to see every row sees every row.
 *
 * The ceiling this exists for is silent: a plain select answers with a
 * thousand rows and nothing about the rest, so a total counted over it is
 * wrong in a way that still looks like a number. A paging helper that dropped
 * a page, or stopped one page early, would put that back without anything
 * failing, which is why it is checked here rather than trusted.
 *
 * The table is a fake that answers ranges the way PostgREST does: inclusive
 * bounds, a short page at the end, and never more rows than were asked for.
 */

import { readAll, PAGES_AT_ONCE, PAGE_ROWS } from '../../lib/db/rows.js'
import { cases, check, finish, same } from '../harness/checks.js'

/**
 * A query builder over `total` rows, counting the requests it takes.
 *
 * `count` is what the answer says the whole set holds, the way a select built
 * with `{ count: 'exact' }` says it. Left off, the answer carries none, which
 * is what every read that never asked for one gets.
 */
function table(total, { fail = null, count = null } = {}) {
  const calls = []
  const build = () => ({
    range(from, to) {
      calls.push([from, to])
      if (fail) return Promise.resolve({ data: null, error: fail })
      const rows = []
      for (let at = from; at <= to && at < total; at += 1) rows.push({ id: at })
      return Promise.resolve({ data: rows, error: null, count })
    },
  })
  return { build, calls }
}

check('a table under one page is read in one request', async () => {
  const { build, calls } = table(37)
  const { rows, complete } = await readAll(build)
  same(rows.length, 37, 'rows')
  same(complete, true, 'complete')
  same(calls.length, 1, 'requests')
})

check('a table exactly one page long is read whole', async () => {
  const { build, calls } = table(PAGE_ROWS)
  const { rows, complete } = await readAll(build)
  same(rows.length, PAGE_ROWS, 'rows')
  same(complete, true, 'complete')
  // A full page cannot be the end, so the read asks again and gets nothing.
  same(calls.length, 2, 'requests')
})

check('a table past the ceiling loses no row to it', async () => {
  const { build } = table(2431)
  const { rows, complete } = await readAll(build)
  same(rows.length, 2431, 'rows')
  same(complete, true, 'complete')
  same(new Set(rows.map(row => row.id)).size, 2431, 'distinct rows')
  same(rows[0].id, 0, 'first row')
  same(rows[rows.length - 1].id, 2430, 'last row')
})

check('an empty table is one request and no rows', async () => {
  const { build, calls } = table(0)
  const { rows, complete } = await readAll(build)
  same(rows.length, 0, 'rows')
  same(complete, true, 'complete')
  same(calls.length, 1, 'requests')
})

check('a read stopped by its own ceiling says so', async () => {
  const { build } = table(9000)
  const { rows, complete } = await readAll(build, { max: 2000 })
  same(rows.length, 2000, 'rows')
  same(complete, false, 'complete')
})

check('a ceiling inside a page is not overrun', async () => {
  const { build, calls } = table(9000)
  const { rows, complete } = await readAll(build, { max: 1500 })
  same(rows.length, 1500, 'rows')
  same(complete, false, 'complete')
  same(calls[1][1], 1499, 'last row asked for')
})

check('a set that says its size is read in two rounds, not one per page', async () => {
  const { build, calls } = table(2431, { count: 2431 })
  const { rows, complete } = await readAll(build)
  same(rows.length, 2431, 'rows')
  same(complete, true, 'complete')
  same(new Set(rows.map(row => row.id)).size, 2431, 'distinct rows')
  same(rows[rows.length - 1].id, 2430, 'last row')
  // The first page, then the other two together, and nothing asked past the end.
  same(calls.length, 3, 'requests')
  same(calls[2][0], 2000, 'the last page starts where the second ends')
})

check('a count that understates the set loses none of it', async () => {
  const { build } = table(2431, { count: 1500 })
  const { rows, complete } = await readAll(build)
  same(rows.length, 2431, 'rows')
  same(complete, true, 'complete')
  same(new Set(rows.map(row => row.id)).size, 2431, 'distinct rows')
})

check('a count that overstates the set reads it once and stops', async () => {
  const { build } = table(2431, { count: 5000 })
  const { rows, complete } = await readAll(build)
  same(rows.length, 2431, 'rows')
  same(complete, true, 'complete')
  same(new Set(rows.map(row => row.id)).size, 2431, 'distinct rows')
})

check('a counted set past the ceiling stops at the ceiling and says so', async () => {
  const { build, calls } = table(9000, { count: 9000 })
  const { rows, complete } = await readAll(build, { max: 2500 })
  same(rows.length, 2500, 'rows')
  same(complete, false, 'complete')
  same(calls[calls.length - 1][1], 2499, 'last row asked for')
})

check('a counted set under one page is one request', async () => {
  const { build, calls } = table(37, { count: 37 })
  const { rows } = await readAll(build)
  same(rows.length, 37, 'rows')
  same(calls.length, 1, 'requests')
})

check('a refused read raises rather than answering short', async () => {
  const { build } = table(5000, { fail: { code: '42P01', message: 'does not exist' } })
  let raised = null
  try {
    await readAll(build)
  } catch (cause) {
    raised = cause
  }
  same(raised?.code, '42P01', 'the driver code survives')
})

/**
 * A table that answers on a tick rather than at once, and records how many
 * requests were open together at the busiest moment. A read that asks for
 * every remaining page in one go shows the page count here; a read that keeps
 * to a width shows the width.
 */
function watched(total, { count = null } = {}) {
  let open = 0
  let widest = 0
  const build = () => ({
    range(from, to) {
      open += 1
      widest = Math.max(widest, open)
      const rows = []
      for (let at = from; at <= to && at < total; at += 1) rows.push({ id: at })
      return new Promise(settle =>
        setTimeout(() => {
          open -= 1
          settle({ data: rows, error: null, count })
        }, 1)
      )
    },
  })
  return { build, at: () => widest }
}

check('a counted set deeper than the width is not all asked for at once', async () => {
  const total = PAGE_ROWS * 16 + 40
  const { build, at } = watched(total, { count: total })
  const { rows, complete } = await readAll(build)
  same(rows.length, total, 'rows')
  same(complete, true, 'complete')
  same(new Set(rows.map(row => row.id)).size, total, 'distinct rows')
  same(at() <= PAGES_AT_ONCE, true, `pages in flight together (${at()})`)
})

check('a width of one reads a counted set a page at a time, whole', async () => {
  const total = PAGE_ROWS * 5 + 3
  const { build, at } = watched(total, { count: total })
  const { rows, complete } = await readAll(build, { atOnce: 1 })
  same(rows.length, total, 'rows')
  same(complete, true, 'complete')
  same(at(), 1, 'pages in flight together')
})

check('a width wider than the set still reads it once and no more', async () => {
  const { build, calls } = table(2431, { count: 2431 })
  const { rows, complete } = await readAll(build, { atOnce: 50 })
  same(rows.length, 2431, 'rows')
  same(complete, true, 'complete')
  same(calls.length, 3, 'requests')
})

check('a count that overstates the set ends the read on the short page', async () => {
  const { build, calls } = table(1500, { count: 40_000 })
  const { rows, complete } = await readAll(build)
  same(rows.length, 1500, 'rows')
  same(complete, true, 'complete')
  // The first round of four stops at the short second page rather than
  // walking the whole overstated count.
  same(calls.length, 5, 'requests')
})

await finish()

console.log(`row paging: all ${cases.length} cases pass`)
