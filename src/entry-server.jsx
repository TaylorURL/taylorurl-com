import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { MotionConfig } from 'framer-motion'
import { ToastProvider } from './app/components/Toast'
import AppRoutes from './app/routes'

// Eager, not lazy: renderToStaticMarkup can't await, so lazy() views would
// render as empty shells here.
const viewModules = import.meta.glob('./app/views/*.jsx', { eager: true })
const views = Object.fromEntries(
  Object.entries(viewModules).map(([filePath, module]) => [
    filePath.match(/\/([^/]+)\.jsx$/)[1],
    module.default,
  ])
)

/**
 * The built template's <head> goes in verbatim so hashed asset tags survive;
 * React 19 then hoists the route's helmet tags into that same <head>, which is
 * what gets crawlers real per-route SEO instead of the shell's.
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
