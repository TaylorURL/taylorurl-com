/**
 * Proves the navbar search returns the page a reader named, and nothing else.
 *
 * The expensive failure here is not the search that finds nothing -- that one
 * announces itself the first time anybody uses it. It is the search that always
 * finds eight things. A ranking mistake that lets a page into the list without
 * matching produces a box that looks like it works: the top row is usually
 * right, the seven under it are whatever the site thinks is important, and the
 * reader learns to distrust the whole thing without ever filing a fault. That
 * is exactly what a standing per-kind weight does when it is added before the
 * did-this-match test rather than after it, which is how this was first
 * written.
 *
 * The other silent one is staleness. The index is built from the data the pages
 * are built from, so a field renamed in `@data` does not break the search -- it
 * quietly indexes `undefined` and the pages stop being findable. The second
 * half of this run reads those modules and asks whether the fields the index
 * takes are still there. The trades are outside its reach: that module carries
 * the drawings its panel column uses, so it cannot be loaded without a JSX
 * transform, and the search's own use of it is covered by the fixtures above
 * rather than by the data.
 *
 * npm run check:site-search
 */

import path from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rankEntries, scoreEntry, splitMatch } from '../../src/app/utils/search.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// The data modules import each other the way the bundler resolves them, by
// alias and without an extension, neither of which Node does on its own. Only
// the modules that are already free of React are reachable this way, which is
// deliberate on their side rather than lucky on ours.
const ALIASES = {
  '@data': 'src/app/data',
  '@utils': 'src/app/utils',
  '@constants': 'src/app/constants',
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = Object.keys(ALIASES).find(
      key => specifier === key || specifier.startsWith(`${key}/`)
    )
    if (alias) {
      const rest = specifier.slice(alias.length)
      const target = path.join(ROOT, ALIASES[alias] + rest)
      return nextResolve(pathToFileURL(target).href, context)
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.js`, context)
    }
    return nextResolve(specifier, context)
  },
})

let failures = 0
const check = (ok, said) => {
  if (!ok) {
    failures += 1
    console.error(`  FAIL ${said}`)
  }
}

const top = (entries, query) => rankEntries(entries, query)[0]?.label
const labels = (entries, query) => rankEntries(entries, query).map(row => row.label)

/* The site's own pages, in the shape the index builds them in. The wording is
   the real wording, because the orderings worth protecting are the ones the
   real names produce. */
const PAGES = [
  {
    label: 'Keeping It Running',
    slug: 'care',
    section: 'Services',
    summary: 'Hosting, security, backups, and a direct line to me.',
    weight: 12,
  },
  {
    label: 'Getting Found on Google',
    slug: 'seo',
    section: 'Services',
    summary: 'The work that puts a business in front of people searching nearby.',
    weight: 12,
  },
  { label: 'A Brand-New Website', slug: 'new-website', section: 'Services', weight: 12 },
  { label: 'Rebuilding Your Current Site', slug: 'redesign', section: 'Services', weight: 12 },
  {
    label: 'Pricing',
    slug: 'pricing',
    section: 'Services',
    summary: 'What things cost up front, and what they cost each month.',
    weight: 14,
  },
  { label: 'Roofing', slug: 'roofing', section: 'Industries', weight: 8 },
  {
    label: 'Baytown',
    slug: 'baytown',
    section: 'Areas',
    summary: 'Websites for Baytown businesses.',
    weight: 3,
  },
  {
    label: 'What Google Actually Cares About in 2026',
    slug: 'what-google-actually-cares-about-in-2026',
    section: 'Notes',
    summary: 'Most of what Google weighs now is your website itself.',
    keywords: ['SEO'],
    weight: 0,
  },
  {
    label: 'QR Code Generator',
    slug: 'qr-code-generator',
    section: 'Tools',
    summary: 'A code that opens your site.',
    weight: 12,
  },
]

/* A weight is a tie-break, never an entry ticket. This is the one that looked
   like it worked. */
check(labels(PAGES, 'zzzznothing').length === 0, 'a query matching nothing still returned pages')
check(
  !labels(PAGES, 'roofing').includes('Pricing'),
  'a weighted page came back for a query it does not match'
)
check(
  labels(PAGES, 'roofing').length === 1,
  'roofing returned more than the one page that carries the word'
)

/* Two words are a narrowing. */
check(top(PAGES, 'new website') === 'A Brand-New Website', 'a two-word name was not found whole')
check(
  labels(PAGES, 'new website').length === 1,
  'a two-word query returned pages matching only one of the words'
)

/* The word the address uses is a name, even when the page never says it. */
check(top(PAGES, 'care') === 'Keeping It Running', 'the care page was not found by its own slug')
check(top(PAGES, 'seo') === 'Getting Found on Google', 'the SEO page was not found by its own slug')
check(top(PAGES, 'redesign') === 'Rebuilding Your Current Site', 'a slug-named page was not first')

/* A name outranks a description, and a leading word outranks a buried one. */
check(top(PAGES, 'google') === 'Getting Found on Google', 'a summary match outranked a name match')
check(top(PAGES, 'cost') === 'Pricing', 'a page findable only by its summary was not found')
check(top(PAGES, 'qr') === 'QR Code Generator', 'a leading name match was not first')

/* Nothing is a real answer, and an empty box is not a query. */
check(rankEntries(PAGES, '').length === 0, 'an empty query returned pages')
check(rankEntries(PAGES, '   ').length === 0, 'a whitespace query returned pages')
check(scoreEntry(PAGES[0], 'zzzz') === 0, 'a page scored for a word it does not carry')

/* The cap holds. */
const many = Array.from({ length: 40 }, (unused, at) => ({
  label: `Website Number ${at}`,
  slug: `website-${at}`,
  section: 'Work',
}))
check(rankEntries(many, 'website').length === 8, 'the result cap was not honoured')
check(rankEntries(many, 'website', 3).length === 3, 'a caller-set cap was not honoured')

/* Two identical calls must agree. A regex carrying `lastIndex` between calls
   answers differently on alternating rows, and the list it produces is wrong in
   a way no single run can show. */
const once = labels(PAGES, 'google')
const twice = labels(PAGES, 'google')
check(JSON.stringify(once) === JSON.stringify(twice), 'the same query ranked two ways')
// The branch that asks the question is the one where the term starts a later
// word: only there does the scorer look at the character in front of the hit.
// Six passes rather than two, because a regex holding its place between calls
// alternates, and two calls can agree by landing on the same parity.
const laterWord = { label: 'A Brand-New Website', slug: 'new-website', section: 'Services' }
const passes = Array.from({ length: 6 }, () => scoreEntry(laterWord, 'website'))
check(new Set(passes).size === 1, `scoring one page drifted across passes: ${passes.join(', ')}`)
const buried = { label: 'Unwebsited', slug: 'unwebsited', section: 'Work' }
check(
  scoreEntry(laterWord, 'website') > scoreEntry(buried, 'website'),
  'a word buried mid-word scored as high as one starting a word'
)

/* A row has to be able to say what it matched on. The whole phrase wins where
   it landed, even when it straddles the label's own punctuation. */
const phrase = splitMatch('A Brand-New Website', 'new website')
check(phrase.hit === 'New Website', `the typed phrase was not marked whole: ${phrase.hit}`)
// The label holds both words but not the phrase, so the longest single term
// that landed is what gets marked.
const split = splitMatch('Getting Found on Google', 'found google')
check(split.hit === 'Google', `a split phrase marked the wrong span: ${split.hit}`)
const single = splitMatch('Getting Found on Google', 'google')
check(single.hit === 'Google', `the matched word was not marked: ${JSON.stringify(single)}`)
const longest = splitMatch('Getting Found on Google', 'a google')
check(longest.hit === 'Google', 'the shortest term was marked instead of the longest')
const missing = splitMatch('Pricing', 'roofing')
check(missing.hit === '' && missing.before === 'Pricing', 'a label with no match was cut anyway')

/* The fields the index reads. A rename here does not break the search loudly;
   it indexes `undefined` and the pages stop being findable. */
const has = (row, field) => row && typeof row[field] === 'string' && row[field].length > 0

const { AREAS } = await import('../../src/app/data/towns-and-trades/areas.js')
check(AREAS.length > 0, 'no towns to index')
check(
  AREAS.every(area => has(area, 'slug') && has(area, 'name')),
  'a town lost its slug or name'
)

const { BLOG_POSTS, BLOG_SERIES_INDEX } = await import('../../src/app/data/blog/index.js')
check(BLOG_POSTS.length > 0, 'no articles to index')
check(
  BLOG_POSTS.every(post => has(post, 'slug') && has(post, 'title') && has(post, 'excerpt')),
  'an article lost the slug, title or excerpt the index reads'
)
check(
  BLOG_SERIES_INDEX.every(series => has(series, 'slug') && has(series, 'name')),
  'a series lost its slug or name'
)

const { TOOLS_INDEX } = await import('../../src/app/data/pages/tools.js')
check(
  TOOLS_INDEX.every(tool => has(tool, 'path') && has(tool, 'name') && has(tool, 'summary')),
  'a tool lost the path, name or summary the index reads'
)

const { SERVICE_LINES } = await import('../../src/app/data/pages/services.js')
check(
  SERVICE_LINES.every(line => has(line, 'slug') && has(line, 'name') && has(line, 'summary')),
  'a service line lost the slug, name or summary the index reads'
)

const { PORTFOLIO_STUDIES } = await import('../../src/app/data/portfolioStudies.js')
check(
  PORTFOLIO_STUDIES.every(project => has(project, 'slug') && has(project, 'name')),
  'a case study lost its slug or name'
)

/* Every town, article and case study is a page the panels never list, which is
   the half of the search that is not a shortcut to something already reachable.
   If these ever reach zero the search still works and quietly covers less. */
check(AREAS.length >= 8, `only ${AREAS.length} towns reachable by search`)
check(BLOG_POSTS.length >= 20, `only ${BLOG_POSTS.length} articles reachable by search`)

if (failures) {
  console.error(`site-search: ${failures} checks failed`)
  process.exit(1)
}

console.log(
  `site-search: a weight cannot put a page in the list, two words narrow rather than widen, a page is found by the word its address uses as well as the word it prints, names outrank descriptions, the cap holds, repeated queries agree, matched words are marked, and the index still reaches ${AREAS.length} towns, ${BLOG_POSTS.length} articles, ${PORTFOLIO_STUDIES.length} case studies, ${SERVICE_LINES.length} service lines and ${TOOLS_INDEX.length} tools`
)
