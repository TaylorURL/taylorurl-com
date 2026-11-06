/**
 * Proves the rankings under the traffic chart count people, so none of them
 * can come out larger than the Visitors figure above them.
 *
 * On 2026-11-06 the front page read 35 against a site total of 13 visitors,
 * because the page list counted every load and two readers had reopened the
 * front page over and over. The collector now counts a page once per visit and
 * sends how many people opened it; this holds the console to ranking by that.
 *
 *   npm run check:traffic-rankings
 */
import { deepStrictEqual } from 'node:assert/strict'

import {
  LISTED,
  bySource,
  pageVisitors,
  topPages,
} from '../../src/app/views/console/lib/rankings.js'
import { check, finish, ok, same } from '../harness/checks.js'

// `same` compares by identity; the lists here are compared by what they hold.
const alike = (got, want) => deepStrictEqual(got, want)

// The last day on taylorurl.com as the collector answers it now: 12 people,
// 17 visits, each person filed under where their first visit came from.
const visitors = 12
const pages = [
  { path: '/about', pageviews: 3, sessions: 3, visitors: 2 },
  { path: '/', pageviews: 15, sessions: 15, visitors: 11 },
  { path: '/portfolio', pageviews: 4, sessions: 4, visitors: 3 },
  { path: '/start', pageviews: 2, sessions: 2, visitors: 2 },
]
const referrers = [
  { source: 'Direct', sessions: 13, visitors: 8 },
  { source: 'facebook.com', sessions: 2, visitors: 2 },
  { source: 'm.facebook.com', sessions: 1, visitors: 1 },
  { source: 'www.facebook.com', sessions: 1, visitors: 1 },
]

check('pages rank by the people who opened them, not by loads', () => {
  alike(
    topPages(pages).map(page => page.path),
    ['/', '/portfolio', '/about', '/start']
  )
  alike(topPages(pages).map(pageVisitors), [11, 3, 2, 2])
})

check('no page shows more people than the site had', () => {
  ok(
    topPages(pages).every(page => pageVisitors(page) <= visitors),
    'every page within the total'
  )
})

check('two spellings of one host are one source, and the sources add up to the visitors', () => {
  const rows = bySource(referrers)
  alike(rows, [
    { name: 'Direct', visitors: 8 },
    { name: 'facebook.com', visitors: 3 },
    { name: 'm.facebook.com', visitors: 1 },
  ])
  same(
    rows.reduce((sum, row) => sum + row.visitors, 0),
    visitors,
    'sum'
  )
})

check('a collector that does not send people yet still draws', () => {
  alike(topPages([{ path: '/', pageviews: 5 }]).map(pageVisitors), [5])
  alike(bySource([{ source: 'Direct', sessions: 4 }]), [{ name: 'Direct', visitors: 4 }])
  alike(topPages(null), [])
  alike(bySource(undefined), [])
})

check('each list holds the head of the ranking', () => {
  const many = Array.from({ length: LISTED + 4 }, (_, i) => ({ path: `/p${i}`, visitors: i }))
  same(topPages(many).length, LISTED, 'pages')
})

await finish()

console.log(
  'traffic rankings: every page and source counts people, and the sources add up to the visitors'
)
