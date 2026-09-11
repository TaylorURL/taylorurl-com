/**
 * Proves the representatives' portal answers on every address it publishes, and
 * that the one screen they control offers exactly the decisions the call list
 * accepts.
 *
 * Four things here are quiet when they break, and each one is quiet in its own
 * way.
 *
 * A path that is not prerendered answers 404 on a direct load and only on a
 * direct load, so it works all day from inside the portal and fails the first
 * time somebody opens the call screen off a phone's home screen. A path missing
 * from `robots.txt` is a staff screen offered to a crawler. A path that reaches
 * the marketing chrome gets a navigation bar above a head that holds still and a
 * footer under a foot that does not scroll, which is the layout the whole surface
 * is built to avoid. And an outcome the screen offers that the column will not
 * take is a call a representative places, files, and loses.
 *
 * Nothing here touches the network or a browser, so it runs anywhere.
 *
 *   node scripts/site/check-staff-portal.js
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STATIC_ROUTES, PRERENDER_ROUTES } from '../../vite/site-routes.js'
import { ROUTE_DEFINITIONS, matchViewKeys } from '../../src/app/constants/routes.js'
import {
  ATTEMPT_HOURS,
  CALLBACK_LENGTHS,
  CALL_OUTCOMES,
  OUTCOME_IDS,
  callBody,
  callbackIn,
  outcomeAsksInterest,
  outcomeEnds,
  outcomeTakesCallback,
} from '../../lib/outreach/prospects/calls.js'
import { headFor } from '../../src/app/views/staff/lib/heads.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** Every address the portal publishes, and the view each one has to mount. */
const SURFACES = Object.freeze([
  { path: '/staff', key: 'StaffPortal' },
  { path: '/staff/calls', key: 'StaffCalls' },
  { path: '/staff/management', key: 'StaffManagement' },
  { path: '/staff/resources', key: 'StaffResources' },
])

const problems = []
const check = (condition, message) => {
  if (!condition) problems.push(message)
}

// ── Every address mounts its own screen ────────────────────────────────────

for (const surface of SURFACES) {
  const keys = matchViewKeys(surface.path)
  check(keys.includes('Staff'), `${surface.path} does not mount the staff frame`)
  check(keys.includes(surface.key), `${surface.path} does not mount ${surface.key}`)
}

const family = ROUTE_DEFINITIONS.find(route => route.key === 'Staff')
check(Boolean(family), 'the route table no longer holds a Staff family')
check(family?.session === true, 'the staff family is not under the session holder')
check(family?.account === true, 'the staff family is not marked as needing accounts')
check(
  (family?.children?.length ?? 0) === SURFACES.length,
  `the staff family mounts ${family?.children?.length} screens, not ${SURFACES.length}`
)

// ── Every address answers on a direct load, and none is offered to a crawler ─

const sitemap = new Set(STATIC_ROUTES.map(route => route.path))
const prerendered = new Set(PRERENDER_ROUTES)
const robots = readFileSync(join(ROOT, 'public/robots.txt'), 'utf8')

for (const surface of SURFACES) {
  check(prerendered.has(surface.path), `${surface.path} is not prerendered, so a direct load 404s`)
  check(!sitemap.has(surface.path), `${surface.path} is in the sitemap and is behind an account`)
}

// One rule covers the family, and it has to appear under every agent block that
// carries the console's own - the file holds two, and a disallow in one of them
// is a disallow for one crawler.
const blocks = robots.split('# site:console').length - 1
check(blocks > 0, 'robots.txt no longer marks the block the account screens sit in')
check(
  robots.match(/^Disallow: \/staff$/gm)?.length === blocks,
  `robots.txt disallows /staff in ${robots.match(/^Disallow: \/staff$/gm)?.length ?? 0} of ${blocks} agent blocks`
)

// ── The surface carries its own chrome ─────────────────────────────────────

const layout = readFileSync(join(ROOT, 'src/app/components/chrome/Layout.jsx'), 'utf8')
check(
  /const isStaff = views\.includes\('Staff'\)/.test(layout),
  'Layout no longer recognises the staff family, so it would draw the marketing chrome over it'
)
check(
  /const bare = [^\n]*isStaff/.test(layout),
  'the staff family is recognised but not held bare of the marketing chrome'
)

// ── Every address has a head, written before there is a session to read ────

for (const surface of SURFACES) {
  const head = headFor(surface.path)
  check(Boolean(head?.title), `${surface.path} has no title`)
  check(Boolean(head?.description), `${surface.path} has no description`)
}
// An address with no entry falls to the portal's rather than to nothing, which
// is the only state reachable while a fifth screen is being added.
check(
  headFor('/staff/nothing-yet').title === headFor('/staff').title,
  'an unknown staff address has no head'
)
const titles = new Set(SURFACES.map(surface => headFor(surface.path).title))
check(titles.size === SURFACES.length, 'two staff screens publish the same title')

// ── The call screen offers what the column accepts ─────────────────────────

// The screen draws `CALL_OUTCOMES` directly rather than a set of its own, so
// this asserts the set the column takes has not come apart from the set the
// constant names - which is what a new outcome added to one of them would do.
check(
  CALL_OUTCOMES.every(outcome => OUTCOME_IDS.includes(outcome.id)),
  'the screen offers an outcome the calls column will not take'
)
check(
  new Set(CALL_OUTCOMES.map(outcome => outcome.key)).size === CALL_OUTCOMES.length,
  'two outcomes answer to the same key, so one of them cannot be pressed'
)

// Every length a representative can pick is a step on the ladder the list
// already waits by, so a time picked here and a time the list would have come
// back on its own are the same interval.
check(
  CALLBACK_LENGTHS.length === ATTEMPT_HOURS.length,
  'the callback lengths are not the attempt ladder'
)
for (const length of CALLBACK_LENGTHS) {
  check(ATTEMPT_HOURS.includes(length.hours), `${length.label} is not a step on the attempt ladder`)
  check(Boolean(length.label), `a callback length of ${length.hours} hours has no label`)
}

// A callback time the endpoint would refuse is a call a representative files and
// loses: it takes a time still to come, and no more than a year out.
const now = Date.now()
for (const length of CALLBACK_LENGTHS) {
  const at = callbackIn(length.hours, new Date(now)).getTime()
  check(at > now, `${length.label} lands in the past`)
  check(at - now <= 365 * 24 * 3600 * 1000, `${length.label} lands more than a year out`)
}

// ── The body the screen files is the body the endpoint takes ──────────────

// The endpoint reads `body.id`, and the column it writes is `prospect_id`. A
// screen that sends the column name is refused with "Pick the business the call
// was to", which reads as a screen that lost the business rather than as a key
// that was spelled the other way - and it is refused on every single call, so it
// is the whole feature rather than an edge of it.
const filed = callBody({ id: 'b1', outcome: 'spoke', interested: true, note: '  said ring back  ' })
check('id' in filed, 'the filed call does not name the business under the key the endpoint reads')
check(!('prospect_id' in filed), 'the filed call sends the column name rather than the body key')
check(filed.note === 'said ring back', 'a typed note is not trimmed before it is filed')
check(callBody({ id: 'b1', outcome: 'spoke' }).note === null, 'an empty note is filed as a string')

for (const outcome of CALL_OUTCOMES) {
  const body = callBody({
    id: 'b1',
    outcome: outcome.id,
    hours: ATTEMPT_HOURS[0],
    interested: true,
  })
  // A business that is off the list does not come back to one, so an ending
  // outcome carrying a time is refused outright.
  check(
    !outcomeEnds(outcome.id) || body.callback_at === null,
    `${outcome.label} files a time on an outcome that ends the list`
  )
  check(
    outcomeTakesCallback(outcome.id) === Boolean(body.callback_at),
    `${outcome.label} disagrees with itself about whether it names a time`
  )
  // And an outcome that settles interest on its own is refused for carrying an
  // answer to a question it did not ask.
  check(
    outcomeAsksInterest(outcome.id) || body.interested === null,
    `${outcome.label} files an interest against an outcome that already says`
  )
}

if (problems.length) {
  for (const problem of problems) console.error(`FAIL  ${problem}`)
  console.error(`\nstaff portal: ${problems.length} problem${problems.length === 1 ? '' : 's'}`)
  process.exit(1)
}
console.log(
  `staff portal holds: ${SURFACES.length} addresses, each mounted, prerendered, out of the sitemap, ` +
    `disallowed in ${blocks} agent blocks and bare of the marketing chrome. ` +
    `${CALL_OUTCOMES.length} outcomes the column takes and ${CALLBACK_LENGTHS.length} callback lengths off the attempt ladder.`
)
