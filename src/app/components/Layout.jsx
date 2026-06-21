import { Outlet, useLocation } from 'react-router-dom'
import Navigation from './Navigation'
import Footer from './Footer'
import ScrollProgress from './ScrollProgress'
import BackToTop from './BackToTop'
import SectionIndicator from './SectionIndicator'
import ChatWidget from './ChatWidget'

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
      {isHome && <SectionIndicator />}
      <ChatWidget />
    </div>
  )
}
