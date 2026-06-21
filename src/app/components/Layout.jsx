import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navigation from './Navigation'
import Footer from './Footer'
import ScrollProgress from './ScrollProgress'
import BackToTop from './BackToTop'

// Below-the-fold widgets — pulled out of the critical path so the document
// becomes interactive without waiting on their JS. None of them render any
// above-the-fold UI: SectionIndicator floats over hero scroll, ChatWidget is
// a launcher that idles until clicked, and a `null` fallback is fine for all.
const SectionIndicator = lazy(() => import('./SectionIndicator'))
const ChatWidget = lazy(() => import('./ChatWidget'))

export default function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen bg-paper text-ink-paper">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:font-mono focus:text-[12px] focus:font-semibold focus:uppercase focus:tracking-[0.18em] focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
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
      <Suspense fallback={null}>
        {isHome && <SectionIndicator />}
        <ChatWidget />
      </Suspense>
    </div>
  )
}
