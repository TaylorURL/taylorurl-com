/**
 * Proves a measurement asked for from the console fits inside the runtime that
 * has to answer it.
 *
 * PageSpeed loads the page on Google's own hardware and regularly takes sixty
 * to ninety seconds for a single strategy. The endpoint measures whichever
 * strategies the body names and both when it names none, one after the other,
 * inside a single call - so a request that names none is asking one worker to
 * hold two of those waits end to end.
 *
 * What that costs does not look like anything. Two strategies that are each
 * merely slow rather than stuck run past the runtime's wall clock, and a worker
 * over the clock is killed where it stands: nothing throws, nothing is logged
 * by the function, and the only trace is a 5xx the proxy in front turns into a
 * 502 the reader is shown. #545 was that, on a request 128 seconds in, on a day
 * whose 71 single-strategy runs all answered and whose longest took 98.
 *
 * The nightly sweep already learned this and says so in its own header - "the
 * unit of work is one site and one strategy" - and the console, which is the
 * only other caller, went on asking for both. So the rule is held here rather
 * than left in a comment in the function that was changed: what the console
 * sends has to name a strategy, and each one has to be its own request.
 *
 *   npm run check:speed-measure
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = path => readFileSync(join(HERE, '../..', path), 'utf8')

const HOOK = 'src/app/hooks/console/useSpeedFeed.js'
const REQUESTS = 'src/app/hooks/console/endpoint.js'
const ENDPOINT = 'api/site-speed.js'

const hook = read(HOOK)
const requests = read(REQUESTS)
const endpoint = read(ENDPOINT)

const faults = []
let checks = 0
function check(ok, complaint) {
  checks += 1
  if (!ok) faults.push(complaint)
}

// Both readings are still taken. A fix that dropped one would pass every check
// about request shape and quietly leave the desktop column empty forever.
check(
  /const STRATEGIES = \['mobile', 'desktop'\]/.test(hook),
  `${HOOK} no longer names both strategies, so a site is measured on one of the two figures the table shows`
)

const posts = hook.match(/writeEndpoint\(/g) || []
check(
  posts.length === 1 && /method: 'POST'/.test(requests),
  `${HOOK} sends ${posts.length} kinds of measurement request rather than one, so what the endpoint is asked for depends on which one ran`
)

const body = hook.match(/writeEndpoint\(token, SPEED_PATH, \{([^}]*)\}\)/)
check(
  Boolean(body) && /\bstrategy\b/.test(body[1]),
  `${HOOK} posts no strategy, so the endpoint measures both in one call and the run is killed over the wall clock rather than answered`
)
check(
  Boolean(body) && /\bsite_id\b/.test(body[1]),
  `${HOOK} posts no site, which the endpoint refuses before it measures anything`
)

// The loop is the whole of it: one request per strategy, in order, with the
// request inside the loop rather than the loop inside the request.
const loop = hook.indexOf('for (const strategy of STRATEGIES)')
check(
  loop > -1 && loop < hook.indexOf('writeEndpoint('),
  `${HOOK} sends its measurement outside the loop over the strategies, so both go in one call again`
)

// And the row stays busy for the whole run rather than clearing between the
// two requests, which would offer the button again mid-measurement.
const busy = hook.indexOf('setMeasuring(siteId)')
check(
  busy > -1 && busy < loop,
  `${HOOK} marks the site busy inside the loop, so the button comes back between the two readings and a second run can be started over the first`
)

// The endpoint's own budget has to outlast one strategy and it does not need to
// outlast two. Ninety seconds is the ceiling the function puts on a single
// PageSpeed call, so anything shorter here refuses a reading that was going to
// arrive.
const timeout = endpoint.match(/TIMEOUT_MS = ([\d_]+)/)
check(
  Boolean(timeout) && Number(timeout[1].replace(/_/g, '')) >= 95_000,
  `${ENDPOINT} gives up before one strategy can finish, so a slow page is reported as an endpoint that went quiet`
)

if (faults.length) {
  console.error('check-speed-measure: failed')
  for (const fault of faults) console.error(`  ${fault}`)
  console.error(
    '  one strategy per request; two in one call is a worker killed over the wall clock'
  )
  process.exit(1)
}

console.log(
  `check-speed-measure: ${checks} checks hold - a measurement pressed in the console goes out as ` +
    'one request per strategy, each bounded by a single PageSpeed run, and the row stays busy ' +
    'across both'
)
