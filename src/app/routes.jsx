import { Route, Routes } from 'react-router-dom'
import Layout from '@components/Layout'

/**
 * Routes are data so the two entry points can load views differently: the
 * browser entry passes lazy() views for code splitting, the prerender entry
 * passes eager ones because static rendering can't await. Each `key` is the
 * view's file name under `@views`.
 */
const ROUTE_DEFINITIONS = [
  { key: 'Home', index: true },
  { key: 'About', path: 'about' },
  { key: 'Services', path: 'services' },
  { key: 'Contact', path: 'contact' },
  { key: 'Privacy', path: 'privacy' },
  { key: 'Terms', path: 'terms' },
  { key: 'License', path: 'license' },
  { key: 'Process', path: 'process' },
  { key: 'Portfolio', path: 'portfolio' },
  // Unlisted soft-launch page for Spigot/Minecraft plugin work: reachable and
  // prerendered (see vite/site-routes.js) but intentionally kept out of the
  // primary nav and sitemap.
  { key: 'Spigot', path: 'spigot' },
  { key: 'Blog', path: 'blog' },
  { key: 'BlogPost', path: 'blog/:slug' },
  { key: 'Faq', path: 'faq' },
  { key: 'Status', path: 'status' },
  { key: 'NotFound', path: '*' },
]

/**
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
