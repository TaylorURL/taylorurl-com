import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { preview } from 'vite'
import puppeteer from 'puppeteer'
import { PRERENDER_ROUTES } from './site-routes.js'

const NAV_TIMEOUT_MS = 30000

/** Map a route to its static HTML output path (directory-style URLs). */
function outputPathFor(outDir, route) {
  return route === '/' ? join(outDir, 'index.html') : join(outDir, route, 'index.html')
}

/**
 * Build-time Vite plugin that renders each route in a headless browser and
 * writes the resulting HTML to disk, so social and AI crawlers (which don't run
 * JS) receive each page's real, per-route title/description/canonical/OG markup
 * from react-helmet-async instead of the SPA shell.
 *
 * Locally the browser is the system Chromium (set PUPPETEER_EXECUTABLE_PATH);
 * in CI/Vercel it falls back to Puppeteer's bundled Chromium.
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

      const server = await preview({
        preview: { host: '127.0.0.1', port: 0 },
        logLevel: 'silent',
      })
      const origin = server.resolvedUrls.local[0].replace(/\/$/, '')

      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })

      // Render every route into memory first. Writing nothing to the output
      // directory mid-crawl keeps the preview server's SPA fallback serving the
      // pristine index.html shell, so no page inherits another route's baked-in
      // <head> tags. Files are flushed to disk only after the server is closed.
      const rendered = []
      try {
        for (const route of PRERENDER_ROUTES) {
          const page = await browser.newPage()
          // Skip cross-origin fetches (fonts, analytics beacon) for speed and to
          // keep the network from idling out on third-party requests.
          await page.setRequestInterception(true)
          page.on('request', request => {
            if (request.url().startsWith(origin)) request.continue()
            else request.abort()
          })

          await page.goto(`${origin}${route}`, {
            waitUntil: 'networkidle0',
            timeout: NAV_TIMEOUT_MS,
          })
          // The canonical link only exists once react-helmet-async has applied
          // the route's <Seo> tags, so it is a reliable "fully rendered" signal.
          await page.waitForSelector('link[rel="canonical"]', { timeout: 10000 })

          const html = await page.evaluate(() => document.documentElement.outerHTML)
          rendered.push({ filePath: outputPathFor(outDir, route), html })
          await page.close()
        }
      } finally {
        await browser.close()
        await server.close()
      }

      for (const { filePath, html } of rendered) {
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, `<!doctype html>\n${html}\n`, 'utf8')
      }
    },
  }
}
