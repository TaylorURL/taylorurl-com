/**
 * That the portfolio's two halves still agree, and that the heavy one is still
 * out of the bundle every page loads.
 *
 * `@data/portfolio` carries what a row needs to be drawn; `@data/portfolioStudies`
 * carries the writing behind `/portfolio/:slug`. They are apart for one reason:
 * the navigation drawer names three studies and shows three preview shots, and
 * the drawer is in the layout of every page, so anything the drawer can reach
 * is in the bundle a first-time visitor waits on. Twenty-five kilobytes of case
 * study prose in there is twenty-five kilobytes spent on a page that renders
 * none of it.
 *
 * That separation is invisible. Nothing about `import { PORTFOLIO_STUDIES }`
 * looks different from any other line, and a single one of them added to a file
 * the layout reaches puts the whole of the prose back on the critical path with
 * no test failing and no page looking wrong. So it is checked rather than
 * remembered, in two parts.
 *
 * The first is that the halves still describe the same twelve projects. An
 * entry claiming a study nobody wrote renders a link to a page that throws; a
 * study written for an entry that has been removed is dead text that still
 * ships. Both fail here, by slug.
 *
 * The second is the import graph. Every static import is followed out from the
 * browser entry, through the aliases the bundler resolves, stopping only where
 * a module is reached by `import()` rather than by name - which is the same
 * boundary the bundler splits on. The studies module turning up in that
 * reachable set is a failure, and the chain that reaches it is printed module
 * by module, so the report names the offending edge rather than the symptom.
 *
 *     npm run check:portfolio-split
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { expect as check, finish } from '../harness/checks.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const { PORTFOLIO_PROJECTS } = await import('../../src/app/data/portfolio.js')
const { PORTFOLIO_STUDIES, portfolioStudyBySlug } =
  await import('../../src/app/data/portfolioStudies.js')

/* The halves describe the same projects, joined on slug and nothing else. */
for (const project of PORTFOLIO_PROJECTS) {
  if (!project.hasStudy) continue
  const study = portfolioStudyBySlug(project.slug)?.study
  check(Boolean(study), `${project.slug} claims a case study that nobody wrote`)
}

const slugs = new Set(PORTFOLIO_PROJECTS.map(project => project.slug))
for (const project of PORTFOLIO_STUDIES) {
  check(
    slugs.has(project.slug),
    `a case study is written for ${project.slug}, which is not a portfolio entry`
  )
}
check(
  PORTFOLIO_STUDIES.length === PORTFOLIO_PROJECTS.filter(project => project.hasStudy).length,
  'the number of studies and the number of entries claiming one disagree'
)

/*
 * The fields each side owes its readers. A rename on one half that the other
 * half still spells is the failure this catches: the page renders, the value is
 * undefined, and the row it belonged to is simply blank.
 */
const ENTRY_FIELDS = [
  'name',
  'slug',
  'kind',
  'url',
  'displayUrl',
  'tagline',
  'trades',
  'description',
  'pagespeed',
]
const STUDY_FIELDS = [
  'title',
  'description',
  'summary',
  'sector',
  'business',
  'site',
  'build',
  'stack',
]

for (const project of PORTFOLIO_PROJECTS) {
  for (const field of ENTRY_FIELDS) {
    check(project[field] !== undefined, `${project.slug} has no ${field}`)
  }
}
for (const project of PORTFOLIO_STUDIES) {
  for (const field of STUDY_FIELDS) {
    check(project.study[field] !== undefined, `the ${project.slug} study has no ${field}`)
  }
}

/*
 * `location` is on the entry rather than in the study because three modules
 * outside the study page read it, one of them from the layout. Moving it back
 * inside would put the prose on the critical path again by the back door.
 */
check(
  PORTFOLIO_STUDIES.every(project => project.study.location === undefined),
  'a study carries its own location, which the reviews list reads off the entry'
)

/* --- the import graph --- */

const ALIASES = {
  '@components': 'src/app/components',
  '@reactbits': 'src/app/components/reactbits',
  '@hooks': 'src/app/hooks',
  '@views': 'src/app/views',
  '@constants': 'src/app/constants',
  '@data': 'src/app/data',
  '@utils': 'src/app/utils',
  '@app': 'src/app',
  '@lib': 'lib',
}

/** A specifier as a file on disk, or null for a package. */
function resolve(specifier, from) {
  let base
  if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier)
  else {
    const alias = Object.keys(ALIASES).find(a => specifier === a || specifier.startsWith(`${a}/`))
    if (!alias) return null
    base = path.join(ROOT, ALIASES[alias], specifier.slice(alias.length))
  }
  const candidates = [
    base,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ]
  return candidates.find(file => existsSync(file) && statSync(file).isFile()) ?? null
}

/*
 * Static imports only. `import()` is where the bundler cuts a chunk, so a
 * module reached that way is not in the bundle the layout carries and following
 * it would report every lazily loaded route as though it were.
 */
const STATIC_IMPORT = /^\s*import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/gm

const ENTRY = path.join(ROOT, 'src/main.jsx')
const STUDIES = path.join(ROOT, 'src/app/data/portfolioStudies.js')

const cameFrom = new Map([[ENTRY, null]])
const queue = [ENTRY]
while (queue.length) {
  const file = queue.shift()
  for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
    const next = resolve(match[1], file)
    if (!next || cameFrom.has(next)) continue
    cameFrom.set(next, file)
    queue.push(next)
  }
}

if (cameFrom.has(STUDIES)) {
  const chain = []
  for (let at = STUDIES; at; at = cameFrom.get(at)) chain.unshift(path.relative(ROOT, at))
  check(
    false,
    `the case study prose is back in the bundle every page loads:\n         ${chain.join('\n      -> ')}`
  )
}

await finish()

console.log(
  `portfolio-split: ${PORTFOLIO_PROJECTS.length} entries and ${PORTFOLIO_STUDIES.length} studies agree on every slug ` +
    `and carry every field their views read; the studies module is not among the ${cameFrom.size} modules the browser ` +
    `entry reaches without a dynamic import.`
)
