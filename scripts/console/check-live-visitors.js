/**
 * Proves the overview's "On the site now" card answers for each visitor: the
 * page they have open and where they came from, newest arrival first, held to
 * the sites in scope.
 *
 * The feed is the live view's own shape, as `analytics_live()` answered it on
 * 2026-11-05, with a referral and a tagged link added beside the direct
 * visits that morning held.
 *
 *   node scripts/console/check-live-visitors.js
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { visitorsOnNow } from '../../src/app/views/console/lib/onNow.js'
import { check, finish, ok, same } from '../harness/checks.js'

const SITES = [
  {
    site_id: 'site-taylorurl',
    name: 'taylorurl.com',
    live: 3,
    visitors: [
      {
        ref: '4ec9c1b7',
        path: '/',
        source: 'Direct',
        campaign: null,
        city: 'Dallas',
        started_at: '2026-11-05T15:24:59.137Z',
      },
      {
        ref: '7656248d',
        path: '/pricing',
        source: 'www.google.com',
        campaign: null,
        city: 'Baytown',
        started_at: '2026-11-05T15:30:06.927Z',
      },
      {
        ref: '3d1c4cb2',
        path: '/start',
        source: 'newsletter',
        campaign: 'november',
        city: 'Houston',
        started_at: null,
      },
    ],
  },
  {
    site_id: 'site-rootrise',
    name: 'rootriseholdings.com',
    live: 1,
    visitors: [
      {
        ref: 'be088211',
        path: '/app/signals',
        source: 'Direct',
        campaign: null,
        city: 'Boston',
        started_at: '2026-11-05T14:46:07.549Z',
      },
    ],
  },
]

check('every visitor on now is a row with the page and where they came from', () => {
  const rows = visitorsOnNow(SITES, [])
  same(rows.length, 4, 'one row a visitor, across every site')
  same(
    rows.map(row => `${row.site}${row.path} ← ${row.source}`).join(' | '),
    [
      'taylorurl.com/pricing ← google.com',
      'taylorurl.com/ ← Direct',
      'rootriseholdings.com/app/signals ← Direct',
      'taylorurl.com/start ← newsletter',
    ].join(' | '),
    'newest arrival first, the unrecorded arrival last, sources named as a reader says them'
  )
  same(rows[3].campaign, 'november', 'a tagged link keeps its campaign')
  ok(new Set(rows.map(row => row.key)).size === rows.length, 'two rows share a key')
})

check('only the sites in scope are listed', () => {
  const rows = visitorsOnNow(SITES, ['site-rootrise'])
  same(rows.map(row => row.path).join(','), '/app/signals', 'one site in scope')
  same(visitorsOnNow([], []).length, 0, 'nobody on')
  same(visitorsOnNow([{ site_id: 'x', name: 'x.com', live: 0 }], []).length, 0, 'no visitors key')
})

check('the overview card draws each visitor’s source', () => {
  const page = readFileSync(
    join(import.meta.dirname, '../../src/app/views/console/pages/traffic/OverviewPage.jsx'),
    'utf8'
  )
  const card = page.slice(page.indexOf('function OnNow('), page.indexOf('function YourSites('))
  ok(/visitorsOnNow\(liveSites, siteIds\)/.test(card), 'the card does not read the visitors')
  ok(/row\.source/.test(card), 'the card does not draw where they came from')
  ok(/SkeletonList/.test(card), 'the card draws before the live feed answers')
})

await finish()

console.log('live visitors: each visitor on now shows the page and where they came from')
