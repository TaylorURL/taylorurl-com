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

import { readAll, PAGE_ROWS } from '../../lib/db/rows.js'
import { cases, check, finish, same } from '../harness/checks.js'

/** A query builder over `total` rows, counting the requests it takes. */
function table(total, { fail = null } = {}) {
  const calls = []
  const build = () => ({
    range(from, to) {
      calls.push([from, to])
      if (fail) return Promise.resolve({ data: null, error: fail })
      const rows = []
      for (let at = from; at <= to && at < total; at += 1) rows.push({ id: at })
      return Promise.resolve({ data: rows, error: null })
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

await finish()

console.log(`row paging: all ${cases.length} cases pass`)
