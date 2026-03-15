import { Outlet, useLocation } from 'react-router-dom'
import Navigation from './Navigation'
import Footer from './Footer'
import ScrollProgress from './ScrollProgress'
import BackToTop from './BackToTop'
import CursorGlow from './CursorGlow'
import SectionIndicator from './SectionIndicator'

export default function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen bg-white">
      <ScrollProgress />
      <CursorGlow />
      <Navigation />
      <main>
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      {isHome && <SectionIndicator />}
    </div>
  )
}
