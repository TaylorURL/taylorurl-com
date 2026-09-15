/**
 * Proves the representatives' portal is one section of the console and nothing
 * else, and that the one screen they control offers exactly the decisions the
 * call list accepts.
 *
 * There were two portals until this check was rewritten: this section, and a
 * standalone shell at `/staff` built for a phone. The console works on a phone,
 * so the second one was a second head, a second set of navigation and a second
 * answer to where a screen is opened from, for one set of screens. It is gone,
 * and most of what is asserted below is that it stayed gone in every place it
 * had a hold: a route family, five lazy entries, four prerendered addresses, two
 * lines of `robots.txt` and a branch in the marketing chrome. A leftover in any
 * one of them is quiet in its own way - a mounted route with no view behind it,
 * a prerendered page that 404s, a disallow naming nothing.
 *
 * Who may open the section is asserted here for the opposite reason. A
 * representative is not an admin, and the section carries the admin mark, so
 * without the roles beside it the one surface they have is shut to them by the
 * console's own door - and nothing says so except the redirect they land on.
 *
 * And an outcome the screen offers that the column will not take is a call a
 * representative places, files, and loses.
 *
 * Nothing here touches the network or a browser, so it runs anywhere.
 *
 *   node scripts/site/check-staff-portal.js
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { STATIC_ROUTES, PRERENDER_ROUTES } from '../../vite/site-routes.js'
import { ROUTE_DEFINITIONS, matchViewKeys } from '../../src/app/constants/routes.js'
import {
  ATTEMPT_HOURS,
  CALLBACK_LENGTHS,
  CALL_OUTCOMES,
  OUTCOME_IDS,
  SAME_DAY_LENGTHS,
  callBody,
  callbackIn,
  callbackLengthsFor,
  outcomeAsksInterest,
  outcomeEnds,
  outcomeTakesCallback,
} from '../../lib/outreach/prospects/calls.js'
import { PORTAL_SURFACES } from '../../src/app/views/staff/lib/nav.js'
import { expect as check, finish } from '../harness/checks.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = path => readFileSync(join(ROOT, path), 'utf8')

// The catalogue names the drawing beside each label, so it reaches the marks
// through the alias the app is built with. The rules under test are pure, but
// they live in that file and are tested there rather than in a copy that could
// drift: the module goes through the same resolver the build uses and the
// result is imported. `check-console-scope.js` reads it the same way.
const out = mkdtempSync(join(tmpdir(), 'staff-portal-'))
const bundle = join(out, 'sections.mjs')
await build({
  entryPoints: [join(ROOT, 'src/app/views/console/lib/sections.js')],
  outfile: bundle,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
  alias: { '@components': join(ROOT, 'src/app/components') },
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  jsx: 'automatic',
})
const { SECTIONS, menuSections } = await import(bundle)
rmSync(out, { recursive: true, force: true })

/** The three screens the section switches between, in the order it offers them. */
const VIEWS = Object.freeze(['calls', 'management', 'resources'])

/** Every address the deleted portal published, and where each one now goes. */
const RETIRED = Object.freeze([
  ['/staff', '/console/staff'],
  ['/staff/calls', '/console/staff'],
  ['/staff/management', '/console/staff?view=management'],
  ['/staff/resources', '/console/staff?view=resources'],
])

// ── The section is mounted, and it is the only portal ──────────────────────

const mounted = matchViewKeys('/console/staff')
check(mounted.includes('Console'), '/console/staff does not mount the console frame')
check(mounted.includes('ConsoleStaff'), '/console/staff does not mount the portal')

check(
  !ROUTE_DEFINITIONS.some(route => route.key === 'Staff' || route.path === 'staff'),
  'the route table mounts a staff family of its own again'
)

// A route family is only half of it. The address has to stop being built as a
// page too, or the prerender writes an HTML file for a view that no longer
// exists and the site serves it.
for (const [path] of RETIRED) {
  check(!PRERENDER_ROUTES.includes(path), `${path} is still prerendered, so a dead page is served`)
  check(!STATIC_ROUTES.some(route => route.path === path), `${path} is back in the sitemap`)
}

// ── The addresses that were published still answer ────────────────────────

// Four of them were on phone home screens and in bookmarks. A retired address
// that answers 404 is a representative who cannot get to work.
const redirects = JSON.parse(read('vercel.json')).redirects ?? []
for (const [from, to] of RETIRED) {
  const rule = redirects.find(one => one.source === from)
  check(Boolean(rule), `${from} redirects nowhere, so it 404s`)
  check(rule?.destination === to, `${from} redirects to ${rule?.destination} rather than ${to}`)
  check(rule?.permanent === true, `${from} redirects temporarily`)
}

// ── Nothing still describes the shell that went ───────────────────────────

const robots = readFileSync(join(ROOT, 'public/robots.txt'), 'utf8')
check(!/\/staff/.test(robots), 'robots.txt still names /staff, which is an address nobody serves')

// The console's own disallow is what covers the section now, and it has to
// appear under every agent block that carries it - the file holds two, and a
// disallow in one of them is a disallow for one crawler.
const blocks = robots.split('# site:console').length - 1
check(blocks > 0, 'robots.txt no longer marks the block the account screens sit in')
check(
  robots.match(/^Disallow: \/console$/gm)?.length === blocks,
  `robots.txt disallows /console in ${robots.match(/^Disallow: \/console$/gm)?.length ?? 0} of ${blocks} agent blocks`
)

const layout = read('src/app/components/chrome/Layout.jsx')
check(!/isStaff/.test(layout), 'the marketing chrome still branches on a staff family')
check(
  /const bare = [^\n]*isConsole/.test(layout),
  'the console is no longer held bare of the marketing chrome, so the portal would draw under it'
)

const views = read('src/app/views.js')
check(
  !/@views\/staff\/(Staff|pages)/.test(views),
  'views.js still lazily imports a screen of the deleted shell'
)

for (const gone of ['StaffFrame.jsx', 'StaffScreen.jsx', 'pages', 'parts/PortalDoors.jsx']) {
  check(
    !existsSync(join(ROOT, 'src/app/views/staff', gone)),
    `src/app/views/staff/${gone} is back, so there are two portals again`
  )
}

// ── The section's own three views ─────────────────────────────────────────

// Read as source rather than imported: the module draws recharts and React, and
// this check runs in node with neither.
const screen = read('src/app/views/console/pages/studio/PortalScreen.jsx')
const listed = [...screen.matchAll(/key: '([a-z]+)'/g)].map(one => one[1])
check(
  PORTAL_SURFACES.map(one => one.key).join(',') === VIEWS.join(','),
  `the portal publishes ${PORTAL_SURFACES.map(one => one.key).join(', ')} rather than ${VIEWS.join(', ')}`
)
check(
  screen.includes('PORTAL_SURFACES.map('),
  'the tab row no longer draws every surface the portal publishes, so one of them cannot be reached'
)
check(listed.length === 0, 'the tab row names its views itself rather than reading the portal')

for (const surface of PORTAL_SURFACES) {
  check(Boolean(surface.label), `the ${surface.key} surface has no tab label`)
  check(Boolean(surface.title), `the ${surface.key} surface has no title`)
  check(Boolean(surface.lede), `the ${surface.key} surface has no lede`)
}

// ── Who the console lets in ───────────────────────────────────────────────

// A representative is admitted by every endpoint behind these screens and is
// not an admin, so the section has to name the role or the console's own door
// shuts them out of the one surface they have.
const portal = SECTIONS.find(section => section.id === 'staff')
check(Boolean(portal), 'the console no longer carries a staff portal section')
check(portal?.admin === true, 'the staff portal is no longer shut to a client')
check(
  Boolean(portal?.roles?.includes('staff')),
  'the staff portal does not name the staff role, so a representative cannot open it'
)

const forStaff = menuSections({ signedIn: true, role: 'staff' }).map(section => section.id)
const forClient = menuSections({ signedIn: true, role: 'client' }).map(section => section.id)
check(forStaff.includes('staff'), "a representative's menu does not hold the staff portal")
check(!forClient.includes('staff'), "a client's menu holds the staff portal")

// And nothing else. Every other section answers about sites, and a
// representative has none - so a traffic row in their column opens on an empty
// table, which reads as a site with no visitors rather than as a section that
// was never theirs.
const TRAFFIC = ['overview', 'live', 'sites', 'pages', 'sources', 'visitors', 'vitals']
for (const id of TRAFFIC) {
  check(!forStaff.includes(id), `a representative's menu holds ${id}, which answers about sites`)
}
for (const id of forStaff) {
  const section = SECTIONS.find(one => one.id === id)
  check(
    section?.public === true || Boolean(section?.roles?.includes('staff')),
    `a representative's menu holds ${id}, which is neither public nor theirs`
  )
}

// ── The Management Center holds its span in the address ───────────────────

// The console spends `view` on which screen is open, so the span takes a key of
// its own. Held in state instead, a reload would land on Today whatever was
// being read and a link to the board would open on a different question.
const board = read('src/app/views/staff/parts/ShiftBoard.jsx')
const team = read('src/app/views/staff/parts/TeamBoard.jsx')
check(
  /useSearchParams/.test(board) || /useSearchParams/.test(team),
  'the Management Center holds its span somewhere other than the address'
)
check(
  /'range'/.test(board) || /'range'/.test(team),
  'the Management Center does not name the key its span is held under'
)

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

// Every length on the ladder a representative can pick is a step on the ladder
// the list already waits by, so a time picked here and a time the list would
// have come back on its own are the same interval.
check(
  CALLBACK_LENGTHS.length === ATTEMPT_HOURS.length,
  'the callback lengths are not the attempt ladder'
)
for (const length of CALLBACK_LENGTHS) {
  check(ATTEMPT_HOURS.includes(length.hours), `${length.label} is not a step on the attempt ladder`)
  check(Boolean(length.label), `a callback length of ${length.hours} hours has no label`)
}

// The same day set is the one thing that is deliberately not on that ladder.
// The ladder's shortest rung is tomorrow, and tomorrow is the one time a booked
// audit must not be: the owner agreed to be walked through it today. So these
// are held to the day instead of to the ladder, because a length of nought is a
// time already past and a length of a day is the rung they exist to undercut.
for (const length of SAME_DAY_LENGTHS) {
  check(length.hours > 0, `${length.label} is not a length at all`)
  check(length.hours < 24, `${length.label} is not inside the day it is offered for`)
  check(Boolean(length.label), `a same day length of ${length.hours} hours has no label`)
}

// A callback time the endpoint would refuse is a call a representative files and
// loses: it takes a time still to come, and no more than a year out. Asked of
// every outcome that keeps the business, because the screen draws the set the
// outcome names rather than one fixed set, and a length reachable from only one
// tile is a refusal nobody would find until that tile was pressed.
const now = Date.now()
for (const outcome of CALL_OUTCOMES.filter(one => outcomeTakesCallback(one.id))) {
  const lengths = callbackLengthsFor(outcome.id)
  check(lengths.length > 0, `${outcome.label} offers no length to ring back in`)
  for (const length of lengths) {
    const at = callbackIn(length.hours, new Date(now)).getTime()
    check(at > now, `${outcome.label}: ${length.label} lands in the past`)
    check(
      at - now <= 365 * 24 * 3600 * 1000,
      `${outcome.label}: ${length.label} lands more than a year out`
    )
  }
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

await finish()
console.log(
  `staff portal holds: one section at /console/staff, ${VIEWS.length} views, ` +
    `${RETIRED.length} retired addresses redirected, out of the sitemap and the prerender, ` +
    `disallowed in ${blocks} agent blocks, open to ${portal.roles.join(' and ')}. ` +
    `${CALL_OUTCOMES.length} outcomes the column takes, ${CALLBACK_LENGTHS.length} callback lengths off the attempt ladder ` +
    `and ${SAME_DAY_LENGTHS.length} inside the day for an audit.`
)
