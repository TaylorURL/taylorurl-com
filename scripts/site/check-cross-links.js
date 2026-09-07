/**
 * Every link one site draws at the other goes somewhere that site publishes.
 *
 * This is the one class of link nothing in the repo was looking at.
 * `check-internal-links.js` reads built HTML, strips the building site's own
 * origin, and skips everything left carrying a scheme — correct for Facebook,
 * correct for a review profile, and exactly wrong for a row naming the other
 * half of the same company. The asymmetry is the sharp part: the same shared
 * markup carrying `https://taylor.website/x` is unchecked on the studio build
 * and load-bearing on the subsidiary build, so which deployment was even asking
 * depended on which one was being built.
 *
 * What that allowed: a page retired on one site leaves a dead row in the other
 * site's chrome, on every page, with the build green, the lint clean, the
 * prerender complete and the link a perfectly ordinary link. It fails only for a
 * reader who clicks it, on the deployment nobody has open. That is the same
 * failure `check-internal-links.js` exists for, one origin over.
 *
 * So the rows are held as data in `lib/site/cross-links.js` and resolved here
 * against the route table of the site that actually serves each one. A path is
 * good if that site publishes it and there is no third answer.
 *
 * It also holds the two records' sibling fields to each other. `siblingOrigin`
 * and `siblingShortName` are written by hand on both records because the map in
 * `sites.js` must not reach a browser chunk, and a value written twice is a
 * value that can disagree with itself. `check-site-key.js` asserts the fields
 * are present on both; only this asserts they are right.
 *
 * Nothing here touches the network or the built output, so it runs anywhere and
 * needs no build first.
 *
 *   npm run check:cross-links
 *   node scripts/site/check-cross-links.js --self-test
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CROSS_LINKS } from '../../lib/site/cross-links.js'
import { SITES } from '../../lib/site/sites.js'
import { SITE_KEYS } from '../../lib/site/registry.js'
import { STATIC_ROUTES as TAYLORWEBSITE_ROUTES } from '../../lib/site/routes/taylorwebsite.js'

const problems = []
const check = (condition, message) => {
  if (!condition) problems.push(message)
}

/**
 * The paths a site publishes, keyed by site.
 *
 * The subsidiary declares its pages in one hand-written list. The studio's are
 * derived, and `vite/site-routes.js` is where from — but that module reads the
 * blog, the portfolio and the town list, several of which import through Vite
 * aliases that do not resolve under bare node. Asking it here would make this
 * check refuse to start for a reason that has nothing to do with cross links.
 *
 * So the studio is asked in a child process the same way
 * `check-route-coverage.js` asks it, which is the arrangement that already
 * works, and the subsidiary is imported directly because it costs nothing.
 */
const PROBE = `
import { registerHooks } from 'node:module'
registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('.')
    return nextResolve(relative && !/\\.[a-z]+$/i.test(specifier) ? specifier + '.js' : specifier, context)
  },
})
const { PRERENDER_ROUTES } = await import('./vite/site-routes.js')
console.log(JSON.stringify(PRERENDER_ROUTES))
`

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const published = key => {
  if (key === 'taylorwebsite') return new Set(TAYLORWEBSITE_ROUTES.map(route => route.path))
  return new Set(
    JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', PROBE], {
        cwd: ROOT,
        env: { ...process.env, SITE: key },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
    )
  )
}

// --- the sibling pair -------------------------------------------------------

// The whole model assumes two sites and exactly two: "the sibling" is a name
// that stops meaning anything at three, and every record would need a map rather
// than a pair of scalars. Better to fail here, on the assumption, than to have
// a third site quietly point at whichever one was written down first.
check(
  SITE_KEYS.length === 2,
  `the sibling fields describe a pair, and there are now ${SITE_KEYS.length} sites ` +
    `(${SITE_KEYS.join(', ')}) — siblingOrigin cannot name one of several`
)

if (SITE_KEYS.length === 2) {
  for (const key of SITE_KEYS) {
    const record = SITES[key]
    const other = SITES[SITE_KEYS.find(name => name !== key)]

    check(
      record.siblingOrigin === other.origin,
      `${key}: siblingOrigin is "${record.siblingOrigin}" but ${other.key} serves "${other.origin}" ` +
        '— every cross-site link on this site would be built on the wrong host'
    )
    check(
      record.siblingShortName === other.shortName,
      `${key}: siblingShortName is "${record.siblingShortName}" but ${other.key} calls itself ` +
        `"${other.shortName}" — the chrome would print a name the other site does not answer to`
    )
  }
}

// --- the rows themselves ----------------------------------------------------

/**
 * Everything wrong with one row, given the paths its naming site publishes.
 *
 * A function rather than assertions inline, so the self test below can feed it a
 * row that is actually broken and prove the catching happens. A check whose only
 * evidence is that it found nothing has not shown it can find anything.
 *
 * `serves` is null where the route table could not be read; the path assertion is
 * skipped rather than guessed at, and the read failure is reported on its own.
 */
export function rowProblems(entry, serves, siteKeys = SITE_KEYS) {
  const found = []
  const where = entry.key || entry.path

  if (!siteKeys.includes(entry.site)) {
    found.push(`${where}: names site "${entry.site}", which is not one of ${siteKeys.join(', ')}`)
  }
  if (typeof entry.path !== 'string' || !entry.path.startsWith('/')) {
    found.push(
      `${where}: path "${entry.path}" is not rooted — the origin is filled in at the point of ` +
        'use, so a path carrying its own host would produce a doubled one'
    )
  } else if (entry.path.includes('://')) {
    found.push(
      `${where}: path "${entry.path}" carries an origin, which the site record already supplies`
    )
  } else if (serves && !serves.has(entry.path)) {
    found.push(
      `${where}: ${entry.site} does not publish ${entry.path}, so this row is a link to a host ` +
        '404 in the chrome of every page on the other site — and no other check looks at it'
    )
  }
  if (typeof entry.label !== 'string' || entry.label.length === 0) {
    found.push(`${where}: carries no label, so the row would draw as an empty link`)
  }
  return found
}

check(CROSS_LINKS.length > 0, 'lib/site/cross-links.js names no cross-site rows at all')

const seen = new Set()
const routes = new Map()

for (const entry of CROSS_LINKS) {
  check(!seen.has(entry.key), `two cross links share the key "${entry.key}"`)
  seen.add(entry.key)

  if (SITE_KEYS.includes(entry.site) && !routes.has(entry.site)) {
    try {
      routes.set(entry.site, published(entry.site))
    } catch (cause) {
      problems.push(
        `could not read the routes ${entry.site} publishes (${cause.message.split('\n')[0]})`
      )
      routes.set(entry.site, null)
    }
  }

  problems.push(...rowProblems(entry, routes.get(entry.site) ?? null))
}

// --- self test --------------------------------------------------------------

// The assertions above fire only on a real fault, so a clean run proves the file
// parsed and not that it can catch anything. These feed the real function the
// four faults it exists for.
if (process.argv.includes('--self-test')) {
  const serves = new Set(['/', '/about'])
  const good = { key: 'ok', site: SITE_KEYS[0], path: '/about', label: 'About' }
  const faults = []

  const expect = (entry, serving, wanted) => {
    const found = rowProblems(entry, serving)
    if ((found.length === 0) !== (wanted === 0)) {
      faults.push(`${entry.key}: expected ${wanted ? 'a problem' : 'none'}, got ${found.length}`)
    }
  }

  expect(good, serves, 0)
  expect({ ...good, key: 'unpublished', path: '/services/nothing-here' }, serves, 1)
  expect({ ...good, key: 'unrooted', path: 'about' }, serves, 1)
  expect({ ...good, key: 'absolute', path: 'https://elsewhere.example/about' }, serves, 1)
  expect({ ...good, key: 'unlabelled', label: '' }, serves, 1)

  // A path the naming site does publish must not be reported, or the check would
  // fail every honest row and get switched off.
  expect({ ...good, key: 'root', path: '/' }, serves, 0)

  if (faults.length) {
    for (const fault of faults) console.error('SELF-TEST FAIL %s', fault)
    process.exit(1)
  }
  console.log(
    'self test: an unpublished path, an unrooted one, one carrying its own origin and an ' +
      'unlabelled row are all caught, and two good rows are not.'
  )
}

if (problems.length) {
  for (const problem of problems) console.error('FAIL %s', problem)
  console.error(
    '\n%d problem(s). A cross-site link is the one link in the tree that no other check reads.',
    problems.length
  )
  process.exit(1)
}

console.log(
  'cross links hold: %d row(s) across %d sites, each resolving to a page the naming site ' +
    'publishes, and both records agree about the other.',
  CROSS_LINKS.length,
  SITE_KEYS.length
)
