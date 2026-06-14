import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { MotionConfig } from 'framer-motion'
import { ToastProvider } from './app/components/Toast'
import AppRoutes from './app/routes'

// Eagerly import every top-level view so server rendering is fully synchronous:
// renderToStaticMarkup cannot await the lazy() imports the browser entry uses,
// and would otherwise emit only an empty shell for each page's body.
const viewModules = import.meta.glob('./app/views/*.jsx', { eager: true })
const views = Object.fromEntries(
  Object.entries(viewModules).map(([filePath, module]) => [
    filePath.match(/\/([^/]+)\.jsx$/)[1],
    module.default,
  ])
)

/**
 * Renders a route to a complete static HTML document. The built template's
 * <head> is injected verbatim (hashed asset tags, site-wide meta, JSON-LD), and
 * React 19 hoists each route's react-helmet-async <title>/<meta>/<link> into
 * that same <head> — so crawlers receive real per-route SEO markup. No browser
 * is involved, so it runs anywhere `vite build` does.
 *
 * @param {string} url - Route path to render (e.g. `/blog/some-slug`).
 * @param {string} headInner - Inner HTML of the built template's <head>.
 * @returns {string} A complete HTML document (without the leading doctype).
 */
export function render(url, headInner) {
  return renderToStaticMarkup(
    <html lang="en">
      <head dangerouslySetInnerHTML={{ __html: headInner }} />
      <body>
        <div id="root">
          <HelmetProvider>
            <MotionConfig reducedMotion="user">
              <ToastProvider>
                <StaticRouter location={url}>
                  <AppRoutes views={views} />
                </StaticRouter>
              </ToastProvider>
            </MotionConfig>
          </HelmetProvider>
        </div>
      </body>
    </html>
  )
}
