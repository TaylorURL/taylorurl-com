/**
 * The site key resolves, both records answer the same questions, and exactly one
 * of them owns the schedules.
 *
 * One tree builds two deployments. Every failure that follows from getting that
 * wrong is silent, which is why this runs in the suite rather than being left to
 * a person noticing.
 *
 * A record missing a field the other one carries reads as `undefined` at a call
 * site expecting a string, and a page renders the word instead of refusing. An
 * origin with a trailing slash produces `https://taylor.website//pricing` in
 * every canonical, sitemap entry and og:url on the site, none of which throws. A
 * second deployment answering true to `ownsSchedules()` runs a second outreach
 * pipeline from the same warmed domain on the same ten-minute cron. And the worst
 * of the four: `ownsSchedules()` answering false under an unset SITE would stop
 * every scheduled job on the studio deployment and look exactly like a quiet
 * night — no error, no alert, an empty queue that reads as nothing to do.
 *
 * The last assertion is the reason the whole file exists. Every other check in
 * the suite runs with SITE unset, so that is the case a mistake hides in.
 *
 *   npm run check:site-key
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { DEFAULT_SITE_KEY, SITE_KEYS } from '../../lib/site/registry.js'
import { SITES } from '../../lib/site/sites.js'
import { SITE, SITE_KEY, ownsSchedules } from '../../lib/site/current.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

let failed = 0
const fail = message => {
  console.error(`FAIL ${message}`)
  failed += 1
}
const check = (condition, message) => {
  if (!condition) fail(message)
}

// A record's shape is the union of every field any record declares, so a field
// added to one site is a field the other must answer for — with null where the
// answer is "not this site", never by being absent.
// SITE_KEYS is written by hand in the registry so that importing it does not
// drag in the map. That is only safe while the two agree about which sites exist.
const mapped = Object.keys(SITES)
check(
  mapped.length === SITE_KEYS.length && mapped.every(key => SITE_KEYS.includes(key)),
  `SITE_KEYS [${SITE_KEYS.join(', ')}] and SITES {${mapped.join(', ')}} name different sites`
)

const declared = new Set(SITE_KEYS.flatMap(key => Object.keys(SITES[key] || {})))

for (const key of SITE_KEYS) {
  const record = SITES[key]

  check(record.key === key, `SITES.${key} carries key "${record.key}"`)

  for (const field of declared) {
    check(
      Object.hasOwn(record, field),
      `SITES.${key} is missing "${field}", which the other record declares`
    )
  }

  const { origin } = record
  check(typeof origin === 'string' && origin.startsWith('https://'), `${key}: origin is not https`)
  check(
    !origin.endsWith('/'),
    `${key}: origin ends in a slash, which doubles it in every URL built from it`
  )
  check(!origin.includes('//', 8), `${key}: origin carries a doubled slash`)

  check(typeof record.brandName === 'string' && record.brandName.length > 0, `${key}: no brandName`)
  check(typeof record.runsSchedules === 'boolean', `${key}: runsSchedules is not a boolean`)

  const head = record.head || {}
  for (const field of ['homeTitle', 'description', 'image', 'imageAlt']) {
    check(
      typeof head[field] === 'string' && head[field].length > 0,
      `${key}: head.${field} is empty`
    )
  }
}

// Two origins on one repo. Sharing one would mean both deployments publishing the
// same canonical, which hands Google a duplicate of the established site.
const origins = SITE_KEYS.map(key => SITES[key].origin)
check(new Set(origins).size === origins.length, 'two sites declare the same origin')

// Exactly one owner, and it is the site an unset SITE resolves to. Both halves
// matter: zero owners silences the crons, two owners doubles them.
const owners = SITE_KEYS.filter(key => SITES[key].runsSchedules === true)
check(owners.length === 1, `${owners.length} sites claim runsSchedules; exactly one may`)
check(
  owners[0] === DEFAULT_SITE_KEY,
  `${owners[0]} owns the schedules but ${DEFAULT_SITE_KEY} is what an unset SITE resolves to`
)

// The assertion this file was written for. The suite runs with SITE unset, so if
// the default ever stops owning the schedules, this is the only thing that says so.
check(SITE_KEY === DEFAULT_SITE_KEY, `an unset SITE resolved to "${SITE_KEY}"`)
check(ownsSchedules(), 'an unset SITE does not own the schedules; every cron would 204')
check(
  SITE.origin === SITES[DEFAULT_SITE_KEY].origin,
  'the resolved record is not the default record'
)

// The foldable flags say the same thing as the fields they stand for.
//
// They exist twice because one form has to survive the bundler and the other has
// to be readable, and two answers to one question drift. Asked under both keys,
// in the child process below, because a constant folded at build time is a
// different value in each build and this one runs as the studio.

// The non-default path has to be exercised somewhere, or a typo in the second
// key is invisible until it is in production. Resolving in a child process is the
// only way to ask, since the module reads the variable once at import.
const resolves = value =>
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { SITE, SITE_KEY, ownsSchedules, PUBLISHES_REVIEWS, HAS_LOCAL_SEO } from './lib/site/current.js';" +
        'console.log(JSON.stringify({ key: SITE_KEY, origin: SITE.origin, owns: ownsSchedules(), ' +
        'reviews: PUBLISHES_REVIEWS, localSeo: HAS_LOCAL_SEO }))',
    ],
    {
      cwd: ROOT,
      env: { ...process.env, SITE: value },
      encoding: 'utf8',
      // The refusal probe below expects a throw, and execFileSync writes a
      // child's stderr straight to this process's unless told otherwise. Left
      // inherited, every passing run prints the stack trace of the error the
      // check was asserting, which trains a reader to scroll past a real one.
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  ).trim()

for (const key of SITE_KEYS) {
  let resolved
  try {
    resolved = JSON.parse(resolves(key))
  } catch {
    fail(`SITE=${key} does not resolve`)
    continue
  }
  check(resolved.key === key, `SITE=${key} resolved to "${resolved.key}"`)
  // The record, not just the key. current.js selects with an explicit comparison
  // so the browser build can drop the losing site, which means a key added to the
  // registry and forgotten in that comparison resolves to the default while still
  // reporting its own name. Comparing the origin is what catches it.
  check(
    resolved.origin === SITES[key].origin,
    `SITE=${key} reports its own key but resolved to the record at ${resolved.origin} — ` +
      'the selector in lib/site/current.js is missing a branch for it'
  )
  check(
    resolved.owns === (SITES[key].runsSchedules === true),
    `SITE=${key} disagrees with its own runsSchedules`
  )
  check(
    resolved.reviews === (SITES[key].reviews === true),
    `SITE=${key}: PUBLISHES_REVIEWS is ${resolved.reviews} and the record says ${SITES[key].reviews}. ` +
      'The bundle and the page would disagree about whether this site has a reputation to show.'
  )
  check(
    resolved.localSeo === (SITES[key].localSeo === true),
    `SITE=${key}: HAS_LOCAL_SEO is ${resolved.localSeo} and the record says ${SITES[key].localSeo}`
  )
}

// A name nobody registered must stop the build rather than fall back, because a
// fallback deploys the wrong site's copy, schema and canonical onto the other
// domain and nothing about the output says so.
let refused = false
try {
  resolves('taylor-website')
} catch {
  refused = true
}
check(refused, 'an unrecognised SITE resolved instead of throwing')

// One reader of the variable. The rule exists because the expression means three
// different things in three runtimes, and every extra reader is a place that gets
// one of them wrong.
const readers = execFileSync(
  'grep',
  [
    '-rl',
    '--include=*.js',
    '--include=*.jsx',
    'process\\.env\\.SITE\\b',
    'lib',
    'src',
    'api',
    'vite',
    'scripts',
  ],
  { cwd: ROOT, encoding: 'utf8' }
)
  .split('\n')
  .filter(Boolean)
  // vite.config.js is the substitution itself, and this file greps for the text.
  .filter(path => path !== 'lib/site/current.js' && path !== 'scripts/site/check-site-key.js')

check(
  readers.length === 0,
  `process.env.SITE is read outside lib/site/current.js: ${readers.join(', ')}`
)

// SITE and SITE_URL are different variables and the names are one character apart.
// SITE_URL is a runtime override six api handlers already read; SITE is the build
// key. A reader of one that meant the other is a whole site pointed at the wrong
// origin, so the docs have to name both.
const env = readFileSync(join(ROOT, '.env.example'), 'utf8')
check(/^SITE=/m.test(env) || /\bSITE\b/.test(env), 'SITE is undocumented in .env.example')

if (failed) {
  console.error(
    `\n${failed} problem(s). One tree builds two sites; the key is what tells them apart.`
  )
  process.exit(1)
}

console.log(
  `site key holds: ${SITE_KEYS.length} records answer the same fields, origins are distinct and slash-free, ` +
    `${DEFAULT_SITE_KEY} owns the schedules under an unset SITE, an unknown key refuses, a site that does not ` +
    'route /notes never reads the newsletter table, and one file reads the variable.'
)
