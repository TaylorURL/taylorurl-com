import { Route, Routes } from 'react-router-dom'
import Layout from '@components/Layout'

/**
 * The site's route table as data, decoupled from how each view module is
 * loaded. The browser entry supplies lazy views for code splitting; the
 * prerender entry supplies eager views so server rendering stays synchronous.
 * Each `key` matches the view's file name under `@views` (e.g. `BlogPost`).
 */
export const ROUTE_DEFINITIONS = [
  { key: 'Home', index: true },
  { key: 'About', path: 'about' },
  { key: 'Services', path: 'services' },
  { key: 'Pricing', path: 'pricing' },
  { key: 'Privacy', path: 'privacy' },
  { key: 'Terms', path: 'terms' },
  { key: 'License', path: 'license' },
  { key: 'Careers', path: 'careers' },
  { key: 'Process', path: 'process' },
  { key: 'Blog', path: 'blog' },
  { key: 'BlogPost', path: 'blog/:slug' },
  { key: 'Faq', path: 'faq' },
  { key: 'Status', path: 'status' },
  { key: 'NotFound', path: '*' },
]

/**
 * Renders the shared route tree under the site `Layout`.
 *
 * @param {{ views: Record<string, React.ComponentType> }} props - Maps each
 *   route key to its view component (lazy in the browser, eager at build time).
 */
export default function AppRoutes({ views }) {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {ROUTE_DEFINITIONS.map(({ key, index, path }) => {
          const View = views[key]
          return index ? (
            <Route key={key} index element={<View />} />
          ) : (
            <Route key={key} path={path} element={<View />} />
          )
        })}
      </Route>
    </Routes>
  )
}
