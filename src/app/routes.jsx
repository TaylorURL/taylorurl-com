import { Route, Routes } from 'react-router-dom'
import Layout from '@components/Layout'
import { ROUTE_DEFINITIONS } from '@constants/routes'

function renderRoute({ key, index, path, children }, views) {
  const View = views[key]
  if (index) return <Route key={key} index element={<View />} />
  return (
    <Route key={key} path={path} element={<View />}>
      {children?.map(child => {
        const ChildView = views[child.key]
        return child.index ? (
          <Route key={child.key} index element={<ChildView />} />
        ) : (
          <Route key={child.key} path={child.path} element={<ChildView />} />
        )
      })}
    </Route>
  )
}

/**
 * @param {{ views: Record<string, React.ComponentType> }} props - Maps each
 *   route key to its view component (lazy in the browser, eager at build time).
 */
export default function AppRoutes({ views }) {
  const SessionScope = views.SessionScope
  // The routes that need to know who is signed in sit under one holder of that
  // answer, so the login form and the console cannot reach two different
  // readings of it and send a visitor between them. Everything else is read by
  // people who are not signed in, and the auth client never reaches those
  // pages.
  const account = ROUTE_DEFINITIONS.filter(route => route.session)
  const open = ROUTE_DEFINITIONS.filter(route => !route.session)

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {open.map(route => renderRoute(route, views))}
        {/* A site with no accounts has no routes under this holder, and a
            layout route standing over nothing is a component mounted to answer
            a question nothing asks. */}
        {account.length > 0 && (
          <Route element={<SessionScope />}>
            {account.map(route => renderRoute(route, views))}
          </Route>
        )}
      </Route>
    </Routes>
  )
}
