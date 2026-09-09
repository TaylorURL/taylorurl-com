import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import Beasties from 'beasties'
import { createServer } from 'vite'
import { PRERENDER_ROUTES } from './site-routes.js'

const ROOT_PLACEHOLDER = '<div id="root"></div>'
const BODY_CLOSE_TAG = '</body>'

// Beasties stamps the element it treated as the document; the page does not
// need to carry that.
const CONTAINER_STAMP = ' data-beasties-container'

/**
 * Writes the rules a route's markup needs into the page itself.
 *
 * The first paint waits on the stylesheet: a browser will not draw a page
 * whose <link rel="stylesheet"> is still in flight, and on a phone that link is
 * a round trip and a download before any of the markup after it counts. Every
 * route here is rendered whole at build time, so the rules its markup needs
 * are knowable at build time too. They go into a <style> in the head, and the
 * sheet itself is asked for on a media query that matches nothing - fetched
 * without holding the paint - and switched on when it lands. What arrives late
 * is only what the page has no element for yet.
 *
 * The exceptions are the states the page takes on after it is served. The
 * theme is an attribute the browser stamps on the root before the first paint,
 * the bar takes an attribute when it is scrolled under, a link takes one when
 * it is current - and none of those are on any element at build time, so the
 * rules for them would be left to the late sheet and a reader in the dark
 * theme would be shown the light one first. Every rule keyed on a data- or
 * aria- attribute rides along regardless.
 *
 * The font faces ride along too. The template preloads both files, but a
 * preloaded file with no @font-face naming it is text set in the fallback and
 * then reset when the sheet lands.
 */
function inliner(outDir, base) {
  return new Beasties({
    path: outDir,
    publicPath: base,
    preload: 'media',
    pruneSource: false,
    inlineFonts: true,
    preloadFonts: false,
    allowRules: [/\[(data|aria)-/],
    reduceInlineStyles: false,
    mergeStylesheets: false,
    logLevel: 'silent',
  })
}

// `npm run build -- --no-prerender` builds the bundle and stops, for the rare
// run that only wants to see what the bundler produced. A flag on the command
// rather than an environment variable, because a variable read here has to be
// declared for every environment the project deploys to, and every one of them
// wants the prerender that this would switch off.
const SKIP_FLAG = process.argv.includes('--no-prerender')

/*
 * Every route's HTML is written before the browser runs a line of JavaScript,
 * so any stylesheet missing from its <head> is missing from the first paint.
 * The entry sheet is in there already; anything Vite split off into an async
 * chunk - the console's sheet, reached only through a lazy() view - is not, so
 * that markup paints bare until the chunk pulling it arrives.
 *
 * These walk the built chunk graph to find, for one route, the stylesheets its
 * markup depends on. Static imports only: a lazy() component nested inside a
 * view renders as its fallback here, so its CSS has nothing to dress yet.
 */
function chunkForSource(bundle, source) {
  const suffix = `/${source}`
  return Object.values(bundle).find(
    output =>
      output.type === 'chunk' &&
      output.facadeModuleId &&
      output.facadeModuleId.replace(/\\/g, '/').endsWith(suffix)
  )
}

function collectCss(bundle, chunk, css, visited) {
  if (!chunk || visited.has(chunk.fileName)) return
  visited.add(chunk.fileName)
  for (const file of chunk.viteMetadata?.importedCss || []) css.add(file)
  for (const fileName of chunk.imports || []) collectCss(bundle, bundle[fileName], css, visited)
}

function cssForSources(bundle, sources) {
  const css = new Set()
  const visited = new Set()
  for (const source of sources) collectCss(bundle, chunkForSource(bundle, source), css, visited)
  return [...css]
}

/**
 * Directory-style output (`/about/` → `/about/index.html`) for everything but
 * two special cases: `/` is the site index, and `/404` has to land at the
 * top-level `404.html` Vercel serves for unknown URLs.
 */
function outputPathFor(outDir, route) {
  if (route === '/') return join(outDir, 'index.html')
  if (route === '/404') return join(outDir, '404.html')
  return join(outDir, route, 'index.html')
}

/**
 * Runs the bundle after the first frame rather than before it.
 *
 * Every route written here is a finished document, so its first frame owes
 * the bundle nothing. A module script is deferred, which only means it waits
 * for the parser: it runs the moment parsing ends, and on a slow phone that
 * moment arrives before the browser has found a frame to paint the document
 * in. The page then sits blank while the bundle adopts markup nobody has been
 * shown, and the whole download is charged to the first paint.
 *
 * The entry keeps its early fetch, as a module preload, and loses its script
 * tag. An inline module in its place asks for the bundle one frame after the
 * first, which is the first frame the document can have been painted in and
 * the earliest the bundle can no longer hold it back.
 *
 * The preload asks at a low priority. A module preload is a high priority
 * fetch by default, so a third of a megabyte of entry leaves the pipe in the
 * same breath as the sheet and the two faces, and on a phone's first second
 * those three are what the paint waits on while the entry is what nothing
 * waits on. Named low, it takes the bandwidth the first screen has finished
 * with, and what stands there in the meantime is the whole document, every
 * link on it an address that answers on its own.
 */
function paintFirst(head) {
  const entry = head.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)
  if (!entry) throw new Error('prerender: the built head carries no module entry')
  const [tag, src] = entry
  const preload = `<link rel="modulepreload" crossorigin fetchpriority="low" href="${src}">`
  const boot = `<script type="module">requestAnimationFrame(() => requestAnimationFrame(() => import(${JSON.stringify(src)})))</script>`
  return head.replace(tag, `${preload}${boot}`)
}

// Every route reuses the same built <head> (hashed asset tags, site-wide meta)
// and the body markup trailing the empty root div.
function parseTemplate(template) {
  const headOpenTag = template.match(/<head[^>]*>/)[0]
  const headInner = paintFirst(
    template.slice(template.indexOf(headOpenTag) + headOpenTag.length, template.indexOf('</head>'))
  )
  const bodyTail = template.slice(
    template.indexOf(ROOT_PLACEHOLDER) + ROOT_PLACEHOLDER.length,
    template.indexOf(BODY_CLOSE_TAG)
  )
  return { headInner, bodyTail }
}

/**
 * Renders every route to static HTML at build time so crawlers that don't run
 * JS see real per-route SEO markup rather than the SPA shell.
 *
 * Uses Vite's SSR module loader in-process rather than a headless browser,
 * which is what lets it run inside Vercel's build sandbox.
 */
export default function prerenderPlugin() {
  let outDir = 'dist'
  let base = '/'
  // Read in closeBundle rather than copied here: the CSS file names land on
  // the chunks late in the build, and this is the same object they land on.
  let bundle = null
  return {
    name: 'taylorurl-prerender',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      base = config.base
    },
    writeBundle(_options, written) {
      bundle = written
    },
    async closeBundle() {
      if (SKIP_FLAG) return

      // Rollup runs this hook whether or not the build wrote anything, and a
      // build that died in transform or render never reached `writeBundle`.
      // Reading `dist/index.html` then reads the *last* successful build's page,
      // which `paintFirst` already rewrote - so its module entry is gone, the
      // throw below fires, and that complaint about a head belonging to another
      // build is what Vite reports in place of the error that actually stopped
      // this one. The written bundle is the evidence there is something here to
      // prerender; without it, the failure underneath is the one worth seeing.
      if (!bundle) return

      const template = await readFile(join(outDir, 'index.html'), 'utf8')
      const { headInner, bodyTail } = parseTemplate(template)
      const routes = PRERENDER_ROUTES
      const ssrServer = await createServer({
        appType: 'custom',
        server: { middlewareMode: true },
        logLevel: 'silent',
      })

      try {
        const { render, viewSourcesFor } = await ssrServer.ssrLoadModule('/src/entry-server.jsx')
        const inline = inliner(outDir, base)
        for (const route of routes) {
          const routeCss = cssForSources(bundle || {}, viewSourcesFor(route)).filter(
            file => !headInner.includes(file)
          )
          const head =
            headInner +
            routeCss
              .map(file => `<link rel="stylesheet" crossorigin href="${base}${file}">`)
              .join('')
          const rendered = render(route, head, null).replace(
            BODY_CLOSE_TAG,
            `${bodyTail}${BODY_CLOSE_TAG}`
          )
          const document = (await inline.process(rendered)).replace(CONTAINER_STAMP, '')
          const filePath = outputPathFor(outDir, route)
          await mkdir(dirname(filePath), { recursive: true })
          await writeFile(filePath, `<!doctype html>\n${document}\n`, 'utf8')
        }
      } finally {
        await ssrServer.close()
      }
    },
  }
}
