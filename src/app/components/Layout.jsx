import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navigation from './Navigation'
import Footer from './Footer'
import ScrollProgress from './ScrollProgress'
import BackToTop from './BackToTop'

const SectionIndicator = lazy(() => import('./SectionIndicator'))

export default function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen bg-paper text-ink-paper">
      <a
        href="#main-content"
        className="focus:ring-accent/30 sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:font-mono focus:text-[12px] focus:font-semibold focus:uppercase focus:tracking-[0.18em] focus:text-white focus:shadow-lg focus:outline-none focus:ring-2"
      >
        Skip to main content
      </a>
      <ScrollProgress />
      <Navigation />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      {isHome && (
        <Suspense fallback={null}>
          <SectionIndicator />
        </Suspense>
      )}
    </div>
  )
}
