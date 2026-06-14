import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'
import { PRERENDER_ROUTES } from './site-routes.js'

const ROOT_PLACEHOLDER = '<div id="root"></div>'
const HEAD_CLOSE_TAG = '</head>'

/** Map a route to its static HTML output path (directory-style URLs). */
function outputPathFor(outDir, route) {
  return route === '/' ? join(outDir, 'index.html') : join(outDir, route, 'index.html')
}

/** Serialize the react-helmet-async tags collected during render into <head>. */
function serializeHead(helmet) {
  return [helmet.title, helmet.meta, helmet.link, helmet.script]
    .map(group => group.toString().trim())
    .filter(Boolean)
    .join('\n    ')
}

/**
 * Build-time Vite plugin that renders each route to static HTML with
 * react-dom/server and injects react-helmet-async's per-route head tags, so
 * social and AI crawlers (which don't run JS) receive each page's real
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
      const ssrServer = await createServer({
        appType: 'custom',
        server: { middlewareMode: true },
        logLevel: 'silent',
      })

      try {
        const { render } = await ssrServer.ssrLoadModule('/src/entry-server.jsx')
        for (const route of PRERENDER_ROUTES) {
          const { appHtml, helmet } = render(route)
          const html = template
            .replace(HEAD_CLOSE_TAG, `    ${serializeHead(helmet)}\n  ${HEAD_CLOSE_TAG}`)
            .replace(ROOT_PLACEHOLDER, `<div id="root">${appHtml}</div>`)

          const filePath = outputPathFor(outDir, route)
          await mkdir(dirname(filePath), { recursive: true })
          await writeFile(filePath, html, 'utf8')
        }
      } finally {
        await ssrServer.close()
      }
    },
  }
}
