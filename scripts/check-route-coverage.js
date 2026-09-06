/**
 * The pages a site publishes and the views it mounts, held to each other.
 *
 * One tree builds two sites and there are three lists involved, not two. A site
 * declares its pages in `lib/site/routes/<key>.js`, its router mounts entries
 * from `ALL_ROUTES`, and `src/app/views.js` names the `import()` behind each
 * one. The three drift independently and each drift is quiet in its own way.
 *
 * A page with no route prerenders as the not-found body under its own URL, and
 * every gate stays green: the file is written, its links resolve, and the only
 * thing wrong is what a reader sees. A route with no page is dead weight, which
 * is what the subsidiary carried - the studio's blog, portfolio, trades, towns,
 * tools and pricing, mounted and shipped on a site with none of those pages. And
 * a key mounted by the router but missing from the loader map is the loud one,
 * except that it is loud in a visitor's browser rather than here: `routes.jsx`
 * hands `undefined` to React and the page is a blank screen.
 *
 * So this asserts the three against each other, per site, using the router's own
 * `matchViewKeys` rather than string comparison - `/services/software-engineering`
 * is served by `services/:service`, and a set of paths cannot see that.
 *
 * Nothing here touches the network, so this runs anywhere.
 *
 *   npm run check:route-coverage
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE_KEYS } from '../lib/site/registry.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VIEWS = 'src/app/views.js'
const SECOND = 'lib/site/routes/taylorwebsite.js'

const problems = []
const check = (condition, message) => {
  if (!condition) problems.push(message)
}

/**
 * Keys whose paths are not knowable without the network, so a run without
 * database credentials reaches none of them. Every name here is a hole in the
 * assertion below, which is why it is written out rather than computed.
 */
const UNREACHABLE_WITHOUT_DATABASE = new Set(['NotesIssue'])

// The router reads SITE once at import, so each site is asked in its own child.
const PROBE = `
import { registerHooks } from 'node:module'
registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('.')
    return nextResolve(relative && !/\\.[a-z]+$/i.test(specifier) ? specifier + '.js' : specifier, context)
  },
})
const { PRERENDER_ROUTES } = await import('./vite/site-routes.js')
const { ROUTE_DEFINITIONS, matchViewKeys } = await import('./src/app/constants/routes.js')
const mounted = []
for (const route of ROUTE_DEFINITIONS) {
  mounted.push(route.key)
  for (const child of route.children ?? []) mounted.push(child.key)
}
console.log(JSON.stringify({
  mounted,
  resolved: PRERENDER_ROUTES.map(path => [path, matchViewKeys(path)]),
}))
`

const ask = key =>
  JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', PROBE], {
      cwd: ROOT,
      env: { ...process.env, SITE: key },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  )

for (const key of SITE_KEYS) {
  let site
  try {
    site = ask(key)
  } catch (cause) {
    problems.push(`SITE=${key}: could not resolve its routes (${cause.message.split('\n')[0]})`)
    continue
  }

  const reached = new Set()
  for (const [path, keys] of site.resolved) {
    for (const viewKey of keys) reached.add(viewKey)

    if (path === '/404') {
      // The one path that is meant to reach the catch-all. It is written to the
      // top-level 404.html that answers an unknown URL, and it is the only way
      // NotFound is reached at all, so a site that stopped mounting NotFound
      // would still write the file and still pass every other gate.
      check(
        keys.length === 1 && keys[0] === 'NotFound',
        `SITE=${key}: /404 resolves to ${JSON.stringify(keys)} rather than ['NotFound'], so ` +
          '404.html is written from the wrong view or from no view at all'
      )
      continue
    }

    check(
      keys.length > 0 && !keys.includes('NotFound'),
      `SITE=${key}: the page ${path} is published but no route mounts it, so it prerenders as ` +
        'the not-found body under its own URL while every other gate stays green'
    )
  }

  for (const viewKey of new Set(site.mounted)) {
    if (UNREACHABLE_WITHOUT_DATABASE.has(viewKey)) continue
    check(
      reached.has(viewKey),
      `SITE=${key}: the route ${viewKey} is mounted but no page this site publishes reaches it, ` +
        'so its chunk ships where nothing can ask for it'
    )
  }
}

// The loader map and the subsidiary's own list, read as text because the point
// is what Rollup sees. A key outside a `...(` gate is one every site loads, and
// that set has to be exactly the set the subsidiary says it mounts - the gates
// are what let a chunk go, and a key that drifts out of one takes its chunk with
// it onto a site that has no page for it.
const views = readFileSync(join(ROOT, VIEWS), 'utf8')
const map = views.slice(views.indexOf('const loaders = {'), views.indexOf('export const views'))

// `const loaders = {` opens the object, so an entry belonging to every site sits
// at depth 1; anything deeper is inside a `...(` gate.
let depth = 0
const ungated = []
for (const line of map.split('\n')) {
  const entry = line.match(/^ {2}([A-Za-z]+): \(\) => import\(/)
  if (entry && depth === 1) ungated.push(entry[1])
  depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
  if (depth < 0) depth = 0
}

const declared = readFileSync(join(ROOT, SECOND), 'utf8')
const block = declared.match(/export const VIEW_KEYS = \[([^\]]*)\]/)
const names = block ? [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : []

check(names.length > 0, `${SECOND} no longer exports a readable VIEW_KEYS list`)
check(ungated.length > 0, `${VIEWS} no longer has ungated loaders; the gate shape changed`)

const missing = names.filter(name => !ungated.includes(name))
const extra = ungated.filter(name => !names.includes(name))
check(
  missing.length === 0,
  `${VIEWS} gates ${missing.join(', ')} behind a site check, which ${SECOND} says the ` +
    'subsidiary mounts - the router would hand React an undefined view and the page would ' +
    'render blank'
)
check(
  extra.length === 0,
  `${VIEWS} loads ${extra.join(', ')} on every site, which ${SECOND} does not name - the ` +
    'chunks ship to a site that has no page for them'
)

if (problems.length) {
  for (const problem of problems) console.error('FAIL %s', problem)
  console.error(
    '\n%d problem(s). A page with no route, a route with no page, and a route with no view all ' +
      'build clean.',
    problems.length
  )
  process.exit(1)
}

console.log(
  'route coverage holds: across %d sites every published page is mounted by a route, /404 reaches ' +
    'the catch-all, every mounted route is reached by a page, and the views loaded everywhere are ' +
    'exactly the %d the subsidiary names.',
  SITE_KEYS.length,
  names.length
)
