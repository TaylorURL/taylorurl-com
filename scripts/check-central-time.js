/**
 * Every time a person reads is written in one zone, whatever is rendering it.
 *
 * A date left to `Intl` is written in the zone of whatever ran the code, which
 * is the reader's laptop in the browser and UTC inside a function. The studio
 * keeps one clock, so a stamp says the same thing from Sydney as it does from
 * the desk it was made at. Nothing on the page distinguishes the two cases:
 * the difference only shows when the same value is rendered twice under two
 * zones and compared, which is what this does.
 *
 * The second half is the day key. A day bucket built off a UTC clock puts a
 * Texas evening under tomorrow, and a cap counted over that day is counted
 * over the wrong one.
 *
 *   npm run check:central-time
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

let failed = 0
const fail = message => {
  console.error(`FAIL ${message}`)
  failed += 1
}
const check = (condition, message) => {
  if (!condition) fail(message)
}

// The zones a render is compared across. One either side of Central and one
// far enough round that a day boundary falls inside a working afternoon.
const ELSEWHERE = ['UTC', 'Australia/Sydney', 'America/New_York']

// A moment late enough in a Texas evening that every zone east of it has
// already turned the day over.
const LATE = '2026-08-31T03:30:00Z'

const renders = source =>
  ELSEWHERE.map(zone =>
    execFileSync(process.execPath, ['--input-type=module', '-e', source], {
      env: { ...process.env, TZ: zone },
      encoding: 'utf8',
    }).trim()
  )

const agrees = (label, source) => {
  const [first, ...rest] = renders(source)
  for (const [index, other] of rest.entries()) {
    check(
      other === first,
      `${label} reads "${first}" in ${ELSEWHERE[0]} and "${other}" in ${ELSEWHERE[index + 1]}`
    )
  }
  return first
}

const day = agrees(
  'the day key',
  `import { dayIn } from './lib/time/zone.js'; console.log(dayIn('${LATE}'))`
)
check(day === '2026-08-30', `the day key put 22:30 Central under ${day} rather than 2026-08-30`)

const stamp = agrees(
  'a rendered instant',
  `import { formatInstant } from './lib/time/zone.js'
   console.log(formatInstant('${LATE}', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))`
)
check(
  /10:30 PM/.test(stamp),
  `a rendered instant came out as "${stamp}" rather than the 10:30 PM it was in Texas`
)

const calendar = agrees(
  'a calendar date',
  `import { formatDate } from './lib/time/zone.js'; console.log(formatDate('2026-08-31'))`
)
check(
  calendar === 'August 31, 2026',
  `a date-only value rendered as "${calendar}", so it was moved by a zone it does not belong to`
)

const sending = agrees(
  'the sending day',
  `import { dayStartsAt } from './lib/outreach/schedule.js'; console.log(dayStartsAt(new Date('${LATE}')))`
)
check(
  sending.startsWith('2026-08-30'),
  `the sending day started at ${sending} rather than Central midnight on 2026-08-30`
)

// The second half: nothing new renders a date without naming the zone it is
// in. A file is asked only about the calls it makes itself, so a helper that
// pins the zone once covers every caller that goes through it.
const ROOTS = ['src', 'lib', 'api', 'scripts', 'vite']
const SKIP = new Set(['node_modules', 'dist', 'dist-ssr'])

// Where a date carries a zone that is not the studio's, each with the reason.
const EXCEPT = new Map([
  // The analytics buckets arrive already truncated by the database, so a label
  // is read in the zone they were cut in rather than in this one.
  ['src/app/views/analytics/lib/format.js', 'buckets are cut by the database'],
  ['src/app/views/console/pages/LivePage.jsx', 'buckets are cut by the database'],
  ['src/app/views/console/pages/OverviewPage.jsx', 'buckets are cut by the database'],
  // A stored `YYYY-MM-DD` is a square on a calendar rather than a moment, and
  // moving it into a zone is how it lands on the day before.
  ['src/app/views/CaseStudy.jsx', 'a calendar date, rendered from its parts'],
  // A field with no zone on it, which is what the input is defined to take.
  ['src/app/views/console/pages/NewsletterPage.jsx', 'a datetime-local field'],
  // Machine formats, read by somebody else's parser.
  ['vite/feed-plugin.js', 'RFC-822, in GMT because the format says so'],
  ['vite/site-routes.js', 'sitemap and feed stamps'],
])

const walk = dir => {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (/\.(js|jsx)$/.test(entry)) out.push(path)
  }
  return out
}

// `toLocaleDateString` and `toLocaleTimeString` only ever write a date.
// `toLocaleString` also writes numbers, and the two are told apart by the
// options object: a number is formatted with none, or with currency and digit
// counts, and a date is formatted with the fields of a date.
const RENDERS_A_DATE = /\.toLocale(?:Date|Time)String\s*\(/g
const DATE_FIELDS =
  /\b(?:weekday|era|year|month|day|hour|minute|second|dateStyle|timeStyle|timeZoneName)\s*:/
const MAYBE_A_DATE = /\.toLocaleString\s*\(/g

for (const root of ROOTS) {
  for (const path of walk(root)) {
    if (EXCEPT.has(path)) continue
    if (path === 'scripts/check-central-time.js') continue
    const source = readFileSync(path, 'utf8')
    const sites = [
      ...[...source.matchAll(RENDERS_A_DATE)].map(match => match.index),
      ...[...source.matchAll(MAYBE_A_DATE)]
        .map(match => match.index)
        .filter(index => DATE_FIELDS.test(source.slice(index, index + 400))),
    ]
    for (const index of sites) {
      // The call's own argument list, which is where the zone is named.
      if (source.slice(index, index + 400).includes('timeZone')) continue
      const line = source.slice(0, index).split('\n').length
      fail(`${path}:${line} writes a date without naming the zone it is in`)
    }
  }
}

if (failed) {
  console.error(`\n${failed} problem(s). Every date a person reads is written in one zone.`)
  process.exit(1)
}

console.log(
  'Central time holds: the day key, a rendered instant, a calendar date and the ' +
    'sending day all read the same from any zone, and nothing renders a date without naming one.'
)
