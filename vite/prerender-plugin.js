import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'
import { PRERENDER_ROUTES } from './site-routes.js'

const ROOT_PLACEHOLDER = '<div id="root"></div>'
const BODY_CLOSE_TAG = '</body>'

/**
 * Map a route to its static HTML output path. `/` is the site index, `/404`
 * lands at the top-level `404.html` Vercel auto-serves for unknown URLs, and
 * everything else uses directory-style URLs (`/about/` → `/about/index.html`).
 */
function outputPathFor(outDir, route) {
  if (route === '/') return join(outDir, 'index.html')
  if (route === '/404') return join(outDir, '404.html')
  return join(outDir, route, 'index.html')
}

/**
 * Split the built index.html into the pieces the prerender reuses for every
 * route: the <head> inner HTML (asset tags, site-wide meta, JSON-LD) and the
 * trailing body markup that follows the empty root div (e.g. the analytics tag).
 */
function parseTemplate(template) {
  const headOpenTag = template.match(/<head[^>]*>/)[0]
  const headInner = template.slice(
    template.indexOf(headOpenTag) + headOpenTag.length,
    template.indexOf('</head>')
  )
  const bodyTail = template.slice(
    template.indexOf(ROOT_PLACEHOLDER) + ROOT_PLACEHOLDER.length,
    template.indexOf(BODY_CLOSE_TAG)
  )
  return { headInner, bodyTail }
}

/**
 * Build-time Vite plugin that renders each route to static HTML with
 * react-dom/server and React 19's native head hoisting, so social and AI
 * crawlers (which don't run JS) receive each page's real per-route
 * title/description/canonical/OG markup instead of the SPA shell.
 *
 * Rendering happens in-process via Vite's SSR module loader — no headless
 * browser — so it runs anywhere `vite build` does, including Vercel's sandbox.
 */
export default function prerenderPlugin() {
  let outDir = 'dist'
  return {
    name: 'taylorurl-prerender',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async closeBundle() {
      if (process.env.SKIP_PRERENDER) return

      const template = await readFile(join(outDir, 'index.html'), 'utf8')
      const { headInner, bodyTail } = parseTemplate(template)
      const ssrServer = await createServer({
        appType: 'custom',
        server: { middlewareMode: true },
        logLevel: 'silent',
      })

      try {
        const { render } = await ssrServer.ssrLoadModule('/src/entry-server.jsx')
        for (const route of PRERENDER_ROUTES) {
          const document = render(route, headInner).replace(
            BODY_CLOSE_TAG,
            `${bodyTail}${BODY_CLOSE_TAG}`
          )
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
