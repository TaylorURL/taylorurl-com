/**
 * Every internal link on every built page goes somewhere this build serves.
 *
 * One tree builds two sites off one set of views, and the views were all
 * written for the studio. The studio serves `/start`, `/pricing`, `/process`,
 * `/portfolio`, `/speed-check` and the console; the subsidiary serves nine
 * pages and none of those. Nothing about writing `<Link to="/pricing">` says
 * which sites have a pricing page, the route table and the markup are two
 * lists, and only one of them decides what exists - so a link written once for
 * the studio became a 404 in the chrome of every page of the other site, on the
 * home page, the services page and all three service pages at once.
 *
 * That failure is invisible everywhere it could have been caught. It builds. It
 * lints. It prerenders. The page renders perfectly and the link is a normal
 * link. It only fails for a reader who clicks it, and only on one of the two
 * deployments, which is the one nobody has open.
 *
 * `vercel.json` carries no `rewrites`, so there is no SPA fallback catching a
 * cold load: a path with no file behind it is a 404 from the host, not a route
 * the router quietly picks up. That is what makes this exact rather than
 * approximate - a link is good if this build actually contains what it points
 * at, and there is no third answer.
 *
 * Three things count as served. A prerendered page, under either layout
 * `cleanUrls` accepts. A real file, which is how `/site.webmanifest` and
 * `/og.png` are links to something that exists. And a redirect in
 * `vercel.json`, which is the host answering before the filesystem is asked.
 *
 * Absolute links to this site's own origin are read too. A canonical or an
 * og:url pointing at a page that was never built is the same fault with a worse
 * blast radius, because the reader who finds it is a crawler.
 *
 * Runs as `postbuild`, against whichever site was just built.
 *
 *   npm run check:internal-links
 *   node scripts/site/check-internal-links.js --self-test
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

import { SITE } from '../../lib/site/current.js'
import { fail, finish } from '../harness/checks.js'
import { filesUnder } from '../harness/files.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const DIST = join(ROOT, 'dist')

// href only. A src is an asset reference Vite resolved and fingerprinted, and a
// broken one fails the build rather than reaching here.
const HREF = /href="([^"]+)"/g

/**
 * The link targets on these pages that nothing answers.
 *
 * Everything it needs is passed in rather than read off the disk, so the same
 * code the build runs is the code the self-test below can hand a page to.
 *
 * @param {{route: string, html: string}[]} pages
 * @param {(target: string) => boolean} answers Whether anything serves it.
 * @param {string} origin This site's own, so absolute self-links are read too.
 * @returns {Map<string, Set<string>>} Dead target, and the pages naming it.
 */
function deadLinks(pages, answers, origin) {
  const dead = new Map()

  for (const page of pages) {
    for (const [, raw] of page.html.matchAll(HREF)) {
      let href = raw
      // The site's own absolute links - canonical, og:url, the alternates -
      // are internal links wearing an origin.
      if (href.startsWith(origin)) href = href.slice(origin.length) || '/'
      // Anything else with a scheme, a protocol-relative host, a fragment or a
      // mailto/tel belongs to somebody else.
      if (!href.startsWith('/') || href.startsWith('//')) continue

      const target = href.split('#')[0].split('?')[0].replace(/\/+$/, '') || '/'
      if (answers(target)) continue

      if (!dead.has(target)) dead.set(target, new Set())
      dead.get(target).add(page.route)
    }
  }

  return dead
}

/**
 * The check can fail.
 *
 * A link check that silently answers "served" to everything passes every build
 * and reads exactly like one that is working, which is the same shape as the
 * bug it exists to catch. So it is handed a page with one good link and one
 * dead one and has to come back with the dead one alone.
 */
async function selfTest() {
  const served = new Set(['/', '/contact'])
  const pages = [
    {
      route: '/',
      html:
        '<a href="/contact">a</a><a href="/pricing">b</a>' +
        '<a href="https://example.com/pricing">c</a><a href="#top">d</a>' +
        '<a href="mailto:x@y.z">e</a><link rel="canonical" href="https://taylor.website/gone"/>',
    },
  ]
  const found = deadLinks(pages, target => served.has(target), 'https://taylor.website')

  if (!found.has('/pricing')) fail('self-test: a dead internal link was not reported')
  if (!found.has('/gone'))
    fail("self-test: an absolute link to this site's own missing page was not reported")
  if (found.has('/contact')) fail('self-test: a served link was reported dead')
  if (found.size !== 2) {
    fail(
      `self-test: reported ${found.size} dead targets; a foreign host, a fragment and a mailto are not links this owns`
    )
  }

  await finish()
  console.log(
    'internal links self-test holds: a dead path and a dead self-canonical are both caught, ' +
      'and a served path, another host, a fragment and a mailto are not.'
  )
}

if (process.argv.includes('--self-test')) {
  await selfTest()
  process.exit(0)
}

if (!existsSync(DIST)) {
  fail('dist/ is not there; this reads the built pages. Run the build first.')
  process.exit(1)
}

/** Every built page, and the path a reader reaches it at. */
function builtPages() {
  return filesUnder(DIST, /\.html$/).map(path => {
    const route = `/${relative(DIST, path)
      .replace(/index\.html$/, '')
      .replace(/\.html$/, '')}`
    return {
      route: route.length > 1 ? route.replace(/\/$/, '') : '/',
      html: readFileSync(path, 'utf8'),
    }
  })
}

const built = builtPages()
if (built.length === 0) {
  fail('dist/ holds no pages')
  process.exit(1)
}

const served = new Set(built.map(page => page.route))

// A redirect is the host answering before the filesystem is asked, so a link to
// one is a link that lands. Read from vercel.json rather than restated here, so
// removing a redirect surfaces the links that were relying on it.
const { redirects = [] } = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'))
for (const { source } of redirects) {
  if (!source.includes(':') && !source.includes('*')) served.add(source)
}

/** Whether `dist/` holds a file at this path - an image, the manifest, the feed. */
const isFile = href => {
  const path = join(DIST, href.replace(/^\/+/, ''))
  return path.startsWith(DIST) && existsSync(path) && statSync(path).isFile()
}

const dead = deadLinks(built, target => served.has(target) || isFile(target), SITE.origin)

for (const [target, on] of [...dead].sort()) {
  const naming = [...on].sort()
  const shown = naming.slice(0, 6).join(' ')
  const rest = naming.length > 6 ? ` (+${naming.length - 6} more)` : ''
  fail(`${target} goes nowhere ${SITE.key} serves\n  linked from ${shown}${rest}`)
}

await finish({
  hint:
    'Each is a 404 a reader reaches by clicking. Either the page belongs in this ' +
    "site's route table, or the link belongs behind the check that asks whether this " +
    'site serves it - `serves()` in `@constants/navigation`.',
})

console.log(
  `internal links hold: every href across ${built.length} built pages on ${SITE.key} ` +
    'reaches a page, a file or a redirect.'
)
