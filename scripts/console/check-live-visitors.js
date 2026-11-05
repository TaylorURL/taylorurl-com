/**
 * Proves the overview's "On the site now" card answers for every visitor: one
 * row for each page and source with how many are on it, the busiest first,
 * held to the sites in scope.
 *
 * The feed is the live view's own shape, as `analytics_live()` answered it on
 * 2026-11-05 - a stack of direct visits on each front page - with a search
 * arrival under two spellings and a tagged link added beside them.
 *
 *   node scripts/console/check-live-visitors.js
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { visitorGroups } from '../../src/app/views/console/lib/onNow.js'
import { check, finish, ok, same } from '../harness/checks.js'

const visit = (ref, path, source, started_at, campaign = null) => ({
  ref,
  path,
  source,
  campaign,
  city: 'Dallas',
  started_at,
})

const SITES = [
  {
    site_id: 'site-taylorurl',
    name: 'taylorurl.com',
    live: 6,
    visitors: [
      visit('a1', '/', 'Direct', '2026-11-05T15:24:59.137Z'),
      visit('a2', '/', 'Direct', '2026-11-05T14:57:41.002Z'),
      visit('a3', '/', 'Direct', null),
      visit('a4', '/pricing', 'www.google.com', '2026-11-05T15:10:06.927Z'),
      visit('a5', '/pricing', 'google.com', '2026-11-05T15:01:00.000Z'),
      visit('a6', '/start', 'newsletter', null, 'november'),
    ],
  },
  {
    site_id: 'site-smyrna',
    name: 'smyrnatools.com',
    live: 2,
    visitors: [
      visit('b1', '/', 'Direct', '2026-11-05T15:21:56.410Z'),
      visit('b2', '/', 'Direct', '2026-11-04T11:18:38.000Z'),
    ],
  },
  {
    site_id: 'site-rootrise',
    name: 'rootriseholdings.com',
    live: 1,
    visitors: [visit('c1', '/app/signals', 'Direct', '2026-11-05T14:46:07.549Z')],
  },
]

check('visitors on the same page from the same source are one row with a count', () => {
  const rows = visitorGroups(SITES, [])
  same(
    rows.map(row => `${row.site}${row.path} ← ${row.source} × ${row.n}`).join(' | '),
    [
      'taylorurl.com/ ← Direct × 3',
      'smyrnatools.com/ ← Direct × 2',
      'taylorurl.com/pricing ← google.com × 2',
      'rootriseholdings.com/app/signals ← Direct × 1',
      'taylorurl.com/start ← newsletter × 1',
    ].join(' | '),
    'the busiest first, then the latest arrival, two spellings of Google as one source'
  )
  same(
    rows.reduce((sum, row) => sum + row.n, 0),
    9,
    'every visitor is counted once'
  )
  same(rows[4].campaign, 'november', 'a tagged link keeps its campaign')
  ok(new Set(rows.map(row => row.key)).size === rows.length, 'two rows share a key')
})

check('a campaign and a site each keep their own row', () => {
  const rows = visitorGroups(
    [
      {
        site_id: 'a',
        name: 'a.com',
        visitors: [
          visit('1', '/', 'facebook', null, 'november'),
          visit('2', '/', 'facebook', null),
        ],
      },
      { site_id: 'b', name: 'b.com', visitors: [visit('3', '/', 'facebook', null)] },
    ],
    []
  )
  same(rows.length, 3, 'a tagged link, an untagged one and another site are three rows')
})

check('only the sites in scope are listed', () => {
  const rows = visitorGroups(SITES, ['site-rootrise'])
  same(rows.map(row => `${row.path} × ${row.n}`).join(','), '/app/signals × 1', 'one site in scope')
  same(visitorGroups([], []).length, 0, 'nobody on')
  same(visitorGroups([{ site_id: 'x', name: 'x.com', live: 0 }], []).length, 0, 'no visitors key')
})

check('the overview card draws each group’s source and count', () => {
  const page = readFileSync(
    join(import.meta.dirname, '../../src/app/views/console/pages/traffic/OverviewPage.jsx'),
    'utf8'
  )
  const card = page.slice(page.indexOf('function OnNow('), page.indexOf('function YourSites('))
  ok(/visitorGroups\(liveSites, siteIds\)/.test(card), 'the card does not read the visitors')
  ok(/row\.source/.test(card), 'the card does not draw where they came from')
  ok(/row\.n\b/.test(card), 'the card does not count each row')
  ok(/SkeletonList/.test(card), 'the card draws before the live feed answers')
})

await finish()

console.log(
  'live visitors: visitors on now are counted by the page they have open and where they came from'
)
