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
      <ScrollProgress />
      <Navigation />
      <main>
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
