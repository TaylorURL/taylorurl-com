import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { MotionConfig } from 'framer-motion'
import { ToastProvider } from './app/components/Toast'
import AppRoutes from './app/routes'

// Eagerly import every top-level view so server rendering is fully synchronous:
// renderToString cannot await the lazy() imports the browser entry uses, and
// would otherwise emit only the Suspense fallback for each page's body.
const viewModules = import.meta.glob('./app/views/*.jsx', { eager: true })
const views = Object.fromEntries(
  Object.entries(viewModules).map(([filePath, module]) => [
    filePath.match(/\/([^/]+)\.jsx$/)[1],
    module.default,
  ])
)

/**
 * Renders a single route to static HTML and collects its react-helmet-async
 * head tags. Used at build time by the prerender plugin — no browser required.
 *
 * @param {string} url - The route path to render (e.g. `/blog/some-slug`).
 * @returns {{ appHtml: string, helmet: import('react-helmet-async').HelmetServerState }}
 */
export function render(url) {
  const helmetContext = {}
  const appHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <StaticRouter location={url}>
            <AppRoutes views={views} />
          </StaticRouter>
        </ToastProvider>
      </MotionConfig>
    </HelmetProvider>
  )
  return { appHtml, helmet: helmetContext.helmet }
}
