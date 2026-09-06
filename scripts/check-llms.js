/**
 * Checks that llms.txt covers the site the router serves, and nothing else.
 *
 * The file is written at build time from the route table the sitemap is built
 * from, so a new page reaches it without an edit. What that does not settle is
 * whether a page reaches it at all: a route family carrying a group no section
 * claims, a page routed under no name, or a spelling that names one trade and
 * links to another each drop pages out of the guide while the sitemap holds
 * every one of them.
 *
 * So the cover is checked both ways. Every published route is in the file
 * exactly once, and every route the site prerenders without publishing - the
 * console, the sign-in pages, the soft-launched ones - is absent, because
 * robots.txt disallows them and a guide listing them undoes that.
 *
 *   npm run check:llms
 */
import { llmsText } from '../vite/llms-plugin.js'
import {
  AREA_ROUTES,
  BLOG_ROUTES,
  BLOG_SERIES_ROUTES,
  CASE_STUDY_ROUTES,
  INDUSTRY_ROUTES,
  PRERENDER_ROUTES,
  SITEMAP_ROUTES,
  SITE_URL,
  TOOL_ROUTES,
  issueRoutes,
} from '../vite/site-routes.js'

// Stands in for the newsletter table, which the build reads over the network.
// The archive is a route family like any other, and a family that only exists
// on a machine able to reach the database is a family nothing checks.
const ISSUES = [
  {
    slug: 'the-two-in-the-morning-call',
    title: 'The Two in the Morning Call',
    preheader: 'What a trade site has to do at the hour the work actually arrives.',
    published_at: '2026-08-14T13:00:00Z',
  },
]

const ROUTES = [...SITEMAP_ROUTES, ...issueRoutes(ISSUES)]

// The refusals the builder raises stop a build, so they are reported here the
// way every other failure is rather than as a stack trace.
let FILE
try {
  FILE = llmsText(ROUTES)
} catch (cause) {
  console.error(`FAIL ${cause.message}`)
  process.exit(1)
}

const EMOJI = /\p{Extended_Pictographic}/u

let failed = 0
const fail = message => {
  console.error(`FAIL ${message}`)
  failed += 1
}
const check = (condition, message) => {
  if (!condition) fail(message)
}

/** Every page the file links, in the order it lists them. */
const linked = [...FILE.matchAll(/^- \[([^\]]+)]\(([^)]+)\)(?::\s*(.+))?$/gm)].map(match => ({
  name: match[1],
  url: match[2],
  summary: match[3] ?? null,
}))

const under = prefix => linked.filter(entry => entry.url.startsWith(`${SITE_URL}${prefix}`))

// Every published page is listed, once. A second line for one page is as much a
// defect as none: it means two route families claim the same address.
{
  const counts = new Map()
  for (const entry of linked) counts.set(entry.url, (counts.get(entry.url) ?? 0) + 1)

  for (const route of ROUTES) {
    const seen = counts.get(`${SITE_URL}${route.path}`) ?? 0
    if (seen === 0) fail(`${route.path} is routed and published, and llms.txt does not list it`)
    if (seen > 1) fail(`${route.path} is listed ${seen} times`)
  }

  const routed = new Set(ROUTES.map(route => `${SITE_URL}${route.path}`))
  for (const url of counts.keys()) {
    if (!routed.has(url)) fail(`${url} is listed and the router does not serve it`)
  }
}

// The pages built so a direct load answers, and held out of the sitemap on
// purpose. Listing one publishes what robots.txt disallows.
{
  const published = new Set(SITEMAP_ROUTES.map(route => route.path))
  const withheld = PRERENDER_ROUTES.filter(path => !published.has(path))
  check(withheld.length > 0, 'no route is prerendered without being published; the check is blind')
  for (const path of withheld) {
    check(!FILE.includes(`(${SITE_URL}${path})`), `${path} is unpublished and llms.txt lists it`)
  }
}

// Each family reaches the file whole. The count comes from the data rather than
// from a number written here, which is the half that cannot go stale on its own.
{
  const families = [
    ['industries', INDUSTRY_ROUTES, under('/industries/')],
    ['service areas', AREA_ROUTES, under('/areas/')],
    ['free tools', TOOL_ROUTES, under('/tools/')],
    ['case studies', CASE_STUDY_ROUTES, under('/portfolio/')],
    ['article series', BLOG_SERIES_ROUTES, under('/blog/series/')],
    [
      'articles',
      BLOG_ROUTES,
      under('/blog/').filter(entry => !entry.url.startsWith(`${SITE_URL}/blog/series/`)),
    ],
  ]
  for (const [family, routes, listed] of families) {
    check(
      listed.length === routes.length,
      `${family}: ${listed.length} listed, ${routes.length} routed`
    )
  }
}

// A name that no longer folds back to the address under it points a reader at
// the wrong page, and reads as correct from either side alone.
for (const route of INDUSTRY_ROUTES) {
  const slug = route.path.slice('/industries/'.length)
  const folded = route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  check(folded === slug, `/industries/${slug} is named "${route.name}", which folds to "${folded}"`)
}

// Every line says what its page is. A bare link is a page a reader has to open
// to find out whether it is worth opening.
for (const entry of linked) {
  check(Boolean(entry.name.trim()), `${entry.url} is listed under an empty name`)
  check(Boolean(entry.summary?.trim()), `${entry.url} is listed with nothing said about it`)
  check(entry.url.startsWith(`${SITE_URL}/`), `${entry.url} is not an address on this site`)
}

// Every section is headed, introduced, and carries pages. A heading with no
// line under it is a group a reader has to infer.
{
  const headings = [...FILE.matchAll(/^## (.+)$/gm)].map(match => match[1])
  check(headings.length > 0, 'the file carries no sections')
  for (const heading of headings) {
    const section = FILE.slice(FILE.indexOf(`## ${heading}`))
    const [, intro] = section.split('\n\n')
    check(
      Boolean(intro?.trim()) && !intro.startsWith('- '),
      `${heading}: says nothing about itself`
    )
    check(section.includes('\n- ['), `${heading}: carries no pages`)
  }
  check(FILE.startsWith('# '), 'the file does not open with the site name')
  check(FILE.includes('\n> '), 'the file carries no summary line')
}

check(!EMOJI.test(FILE), 'the file carries an emoji')
check(FILE.endsWith('\n'), 'the file does not end in a newline')

// The build stops on each of the three ways a page drops out of the guide in
// silence, rather than writing a file that is quietly short.
{
  const refuses = (routes, what) => {
    try {
      llmsText(routes)
      fail(`a route ${what} reached llms.txt rather than stopping the build`)
    } catch {
      // Throwing is the pass.
    }
  }
  const first = SITEMAP_ROUTES[0]
  refuses([...ROUTES, { ...first, path: '/somewhere-new', group: 'unclaimed' }], 'with no section')
  refuses([...ROUTES, { ...first, path: '/somewhere-new', name: '' }], 'with no name')
  refuses([...ROUTES, first], 'listed twice')
}

if (failed) {
  console.error(`\n${failed} llms.txt ${failed === 1 ? 'check' : 'checks'} failed`)
  process.exit(1)
}

const sections = [...FILE.matchAll(/^## (.+)$/gm)].length
console.log(
  `llms.txt covers the router: ${linked.length} pages in ${sections} sections, ` +
    `${Math.round(FILE.length / 1024)}KB`
)
