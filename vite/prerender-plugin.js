import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'
import { PRERENDER_ROUTES } from './site-routes.js'

const ROOT_PLACEHOLDER = '<div id="root"></div>'
const BODY_CLOSE_TAG = '</body>'

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

// Every route reuses the same built <head> (hashed asset tags, site-wide meta)
// and the body markup trailing the empty root div.
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
 * Renders every route to static HTML at build time so crawlers that don't run
 * JS see real per-route SEO markup rather than the SPA shell.
 *
 * Uses Vite's SSR module loader in-process rather than a headless browser,
 * which is what lets it run inside Vercel's build sandbox.
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
