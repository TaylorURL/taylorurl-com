/**
 * The console's own pages are not visits - to the tracker, and to the console.
 *
 * The rule is declared twice by necessity. The tracker reads it off the script
 * tag in `index.html`, because one tracker serves every site TaylorURL looks
 * after and the declaration belongs to the site making it; the console reads it
 * from `counted.js`, because the rows recorded before the tag carried it are
 * still in the table and still at the top of every page ranking. Two readers,
 * one rule, and nothing but this script to stop them drifting - which would
 * leave the console either hiding pages the tracker is still counting or
 * counting pages it has stopped filing, both silently.
 *
 * The site test is the other half. A client's `/login` is an ordinary page with
 * sixty-odd views on it, and taking it out of their figures because this site
 * calls that path a workspace would be a wrong nobody would think to look for.
 *
 *   npm run check:traffic-ignore
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  IGNORE_RULE,
  counted,
  countedPages,
  withCountedPages,
} from '../src/app/views/analytics/lib/counted.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const check = (ok, said) => {
  if (!ok) {
    failures += 1
    console.error(`  FAIL ${said}`)
  }
}

// One rule, both readers.
const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
const tag = html.match(/<script[^>]*analytics-tracker[^>]*>/)
check(Boolean(tag), 'index.html carries no analytics-tracker script tag')
const declared = tag && tag[0].match(/data-ignore="([^"]*)"/)
check(Boolean(declared), 'the tracker tag declares no data-ignore')
check(
  declared && declared[1] === IGNORE_RULE,
  `the tag declares "${declared ? declared[1] : ''}" and the console reads "${IGNORE_RULE}"`
)

// What the rule says, read the way the tracker reads it: a path is not counted
// when it sits under an entry, unless it sits under an exception, and a prefix
// is a path boundary rather than a string one.
const PATHS = [
  ['/', true],
  ['/work', true],
  ['/notes/why-a-fast-site-wins', true],
  ['/console', false],
  ['/console/', false],
  ['/console/live', false],
  ['/console/outreach', false],
  ['/console/pages', false],
  ['/console/status', true],
  ['/console/status/anything', true],
  ['/consoles', true],
  ['/console-guide', true],
  ['/login', false],
  ['/login/reset', false],
  ['/logins', true],
  ['/console#top', false],
]
for (const [path, visit] of PATHS) {
  check(counted(path) === visit, `${path} reads as ${counted(path) ? 'a visit' : 'not a visit'}`)
}

// The rule is this site's, and it is applied to this site's rows alone. The
// figures are the ones the table actually held when the rows were still drawn.
const ACROSS = [
  { site: 'taylorurl.com', path: '/console', pageviews: 691 },
  { site: 'taylorurl.com', path: '/console/status', pageviews: 475 },
  { site: 'taylorurl.com', path: '/login', pageviews: 156 },
  { site: 'www.taylorurl.com', path: '/console/live', pageviews: 460 },
  { site: 'taylorurl.com', path: '/work', pageviews: 300 },
  { site: 'rootriseholdings.com', path: '/login', pageviews: 63 },
  { site: 'tiretracker.app', path: '/dashboard', pageviews: 189 },
  { site: 'deluxfitbyangie.com', path: '/admin/bookings', pageviews: 3 },
]
const kept = countedPages(ACROSS, null).map(row => `${row.site}${row.path}`)
check(
  kept.join(' ') ===
    'taylorurl.com/console/status taylorurl.com/work rootriseholdings.com/login tiretracker.app/dashboard deluxfitbyangie.com/admin/bookings',
  `across the account the table kept: ${kept.join(' ') || 'nothing'}`
)

// Scoped to one site the rows name no site, so the scope does.
const SCOPED = [
  { path: '/console', pageviews: 691 },
  { path: '/console/status', pageviews: 475 },
  { path: '/login', pageviews: 156 },
  { path: '/work', pageviews: 300 },
]
const ours = countedPages(SCOPED, 'taylorurl.com').map(row => row.path)
check(
  ours.join(' ') === '/console/status /work',
  `scoped to this site the table kept: ${ours.join(' ') || 'nothing'}`
)
check(
  countedPages(SCOPED, 'rootriseholdings.com').length === SCOPED.length,
  "scoping to a client's site took rows out of their figures"
)
check(
  countedPages(SCOPED, null).length === SCOPED.length,
  'a read naming no site dropped rows it could not attribute'
)
check(countedPages(null, 'taylorurl.com').length === 0, 'a payload with no pages threw')

// The payload is otherwise untouched, and unchanged when nothing was dropped.
const payload = {
  totals: { pageviews: 4000 },
  referrers: [{ source: 'Direct', sessions: 12 }],
  pages: ACROSS,
}
const filtered = withCountedPages(payload, null)
check(filtered.totals === payload.totals, 'the totals did not survive the filter')
check(filtered.referrers === payload.referrers, 'the referrers did not survive the filter')
check(filtered.pages.length === 5, `the filtered payload holds ${filtered.pages.length} pages`)
check(withCountedPages(null, null) === null, 'an unanswered read did not stay null')
const clean = { pages: [{ site: 'taylorurl.com', path: '/work', pageviews: 300 }] }
check(
  withCountedPages(clean, null) === clean,
  'a payload with nothing to drop came back as a new object'
)

if (failures) {
  console.error(`traffic-ignore: ${failures} checks failed`)
  process.exit(1)
}
console.log(
  `traffic-ignore: one rule "${IGNORE_RULE}" on the tag and in the console, ` +
    `${PATHS.length} paths judged, and only this site's rows filtered`
)
