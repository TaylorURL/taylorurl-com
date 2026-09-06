/**
 * Every endpoint asks whether this deployment serves it, and the scheduled ones
 * ask a second time.
 *
 * `vercel.json` carries no `functions` block and is read by the platform before
 * any build runs, so it cannot be keyed: every Vercel project built from this
 * repo deploys the whole `api/` tree and registers all nine crons, whatever the
 * site's route table says. The only thing that can tell the two deployments
 * apart is the code, and the only thing that can tell whether the code still
 * does is this.
 *
 * The failure it guards against is an endpoint added later. Adding one to
 * `api/` is how the API grows, nothing about writing one suggests a second site
 * exists, and a handler that forgot the gate is invisible: it answers correctly
 * on the studio and answers on the subsidiary too, spending the same Stripe,
 * Resend, Google and Supabase credentials against a separate set of rate
 * limiters. Nothing 500s. Nothing appears in a log as wrong.
 *
 * The allowlist is asserted rather than merely present, because the expensive
 * mistakes are additions to it. `notify` is the relay every client deployment
 * posts through with that URL compiled in; the outreach endpoints and the
 * newsletter are a warmed sending domain that must have exactly one sender;
 * checkout and the webhook take money.
 *
 *   npm run check:api-gate
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

import { SITES } from '../lib/site/sites.js'
import { SITE_KEYS } from '../lib/site/registry.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = join(ROOT, 'api')

let failed = 0
const fail = message => {
  console.error(`FAIL ${message}`)
  failed += 1
}
const check = (condition, message) => {
  if (!condition) fail(message)
}

/** Every handler file under api/, at any depth. */
function handlers(dir) {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return handlers(path)
    return path.endsWith('.js') ? [path] : []
  })
}

const files = handlers(API)
check(files.length > 0, 'no handlers found under api/')

for (const path of files) {
  const source = readFileSync(path, 'utf8')
  const name = relative(ROOT, path)

  check(source.includes('servedHereOr404'), `${name} does not ask whether this site serves it`)

  // First statement, not merely present. A gate below a database read, a quota
  // spend or a send has already let the thing happen it exists to prevent.
  const entry = source.match(
    /export default (?:async )?function handler\((\w+), (\w+)\) \{\n([^\n]*)\n/
  )
  if (!entry) {
    fail(`${name} has no recognisable handler entry`)
    continue
  }
  check(
    entry[3].includes('servedHereOr404'),
    `${name} asks late: the first line of its handler is "${entry[3].trim()}"`
  )
  check(
    entry[1] !== '_request',
    `${name} declares the request unused, but the gate reads the path from it`
  )
}

// The scheduled work asks a second time, inside the job rather than at the door.
// The api gate already 404s these on a site that does not serve them, so this is
// the second lock rather than the first - and it is the one that holds if an
// endpoint is ever added to an allowlist without anyone thinking about the cron
// attached to it. Two outreach pipelines sending from one warmed domain is not a
// failure that announces itself; it is a reputation dropping over weeks.
const SCHEDULED = [
  'lib/outreach/runtime.js',
  'api/newsletter-due.js',
  'api/social-queue.js',
  'api/social-watch.js',
  'api/start-followup.js',
]

for (const name of SCHEDULED) {
  const source = readFileSync(join(ROOT, name), 'utf8')
  check(source.includes('ownsSchedules'), `${name} runs scheduled work without asking whose it is`)
}

// lib/http/scheduler.js is deliberately not on that list. api/notify.js uses
// isScheduler as a fallback authentication path - it resolves a project by slug
// when the token presented is the cron secret - so gating inside it would refuse
// client deployments rather than refuse a second site's cron.
const scheduler = readFileSync(join(ROOT, 'lib/http/scheduler.js'), 'utf8')
check(
  !scheduler.includes('ownsSchedules'),
  'lib/http/scheduler.js gates on the site; api/notify.js authenticates through it and would refuse clients'
)

for (const key of SITE_KEYS) {
  const allowed = SITES[key].apiAllowlist
  if (allowed === null) continue

  check(Array.isArray(allowed), `${key}: apiAllowlist is neither null nor an array`)

  // Each of these is a decision with a cost behind it, so changing one should
  // mean changing this line too rather than sliding through.
  for (const endpoint of ['notify', 'stripe-webhook', 'checkout', 'newsletter-send']) {
    check(
      !allowed.includes(endpoint),
      `${key} claims "${endpoint}". That endpoint takes money, sends mail as the studio, or is the ` +
        'relay client deployments post through, and exactly one deployment may answer it.'
    )
  }
  for (const endpoint of allowed) {
    check(
      !endpoint.startsWith('outreach/'),
      `${key} claims "${endpoint}"; the outreach pipeline sends from one warmed domain and one site runs it`
    )
    const exists = files.some(path => relative(API, path).replace(/\.js$/, '') === endpoint)
    check(exists, `${key} allows "${endpoint}", which is not a handler under api/`)
  }
}

// The decisions themselves, not just that the calls are present. Static analysis
// proves every handler asks; only running it proves the answers are right, and a
// gate that let everything through would satisfy every check above.
const { servedHereOr404 } = await import('../lib/http/guard.js')
const fakeResponse = () => ({
  status() {
    return this
  },
  json() {
    return this
  },
})
const serves = url => servedHereOr404({ url }, fakeResponse())

// Under an unset SITE this file runs as the studio, whose allowlist is null.
for (const url of ['/api/contact', '/api/notify', '/api/checkout', '/api/outreach/send']) {
  check(serves(url), `the studio refused ${url}; its allowlist is null and it serves everything`)
}
check(serves('/api/contact?utm_source=x'), 'a query string changed the answer')
check(serves('/api/contact/'), 'a trailing slash changed the answer')

// The studio's allowlist is null, so every probe above returns on the first line
// and proves nothing about the code that does the refusing. That path only runs
// for a site with a real allowlist, and the module reads its site once at import,
// so asking it takes a child process.
const asSecondSite = urls =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import { servedHereOr404 } from './lib/http/guard.js';" +
          'const r = () => ({ status() { return this }, json() { return this } });' +
          `const urls = ${JSON.stringify(urls)};` +
          'console.log(JSON.stringify(urls.filter(u => servedHereOr404({ url: u }, r()))))',
      ],
      { cwd: ROOT, env: { ...process.env, SITE: 'taylorwebsite' }, encoding: 'utf8' }
    ).trim()
  )

const REFUSED_THERE = [
  '/api/notify',
  '/api/checkout',
  '/api/stripe-webhook',
  '/api/newsletter-send',
  '/api/newsletter-due',
  '/api/outreach/send',
  '/api/outreach/source',
  '/api/social-queue',
  '/api/console-admin',
  '/api/payments-admin',
  '/api/speed-check',
  '/api/site-audit',
  // The console's summary proxy. It reads as the collector and is not: the
  // collector runs on Supabase's own origin and the browser talks to it
  // directly, while this endpoint answers `useAnalytics`, which only the
  // console pages mount.
  '/api/analytics',
]
const leaked = asSecondSite(REFUSED_THERE)
check(
  leaked.length === 0,
  `the subsidiary would answer on ${leaked.join(', ')} — each spends the studio's credentials`
)

// And the three it does serve, in every URL shape the router can hand it. A gate
// that refused these would take the enquiry form and the collector down on a
// site whose only conversion path is the enquiry form.
const SERVED_THERE = ['/api/contact', '/api/contact/', '/api/contact?utm_source=x', '/api/version']
const missing = SERVED_THERE.filter(url => !asSecondSite([url]).length)
check(missing.length === 0, `the subsidiary refused ${missing.join(', ')}, which it must serve`)

if (failed) {
  console.error(
    `\n${failed} problem(s). Both deployments serve every file in api/; only the code says otherwise.`
  )
  process.exit(1)
}

console.log(
  `api gate holds: ${files.length} handlers ask before acting and none asks late, the ` +
    `${SCHEDULED.length} scheduled jobs ask whose schedule it is, and no allowlist claims money, ` +
    'mail or the client relay.'
)
