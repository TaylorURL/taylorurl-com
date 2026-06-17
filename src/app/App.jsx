import { lazy, Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import ScrollToTop from '@components/ScrollToTop'
import AppRoutes from './routes'

const views = {
  Home: lazy(() => import('@views/Home')),
  About: lazy(() => import('@views/About')),
  Services: lazy(() => import('@views/Services')),
  Contact: lazy(() => import('@views/Contact')),
  Privacy: lazy(() => import('@views/Privacy')),
  Terms: lazy(() => import('@views/Terms')),
  License: lazy(() => import('@views/License')),
  Process: lazy(() => import('@views/Process')),
  Portfolio: lazy(() => import('@views/Portfolio')),
  Blog: lazy(() => import('@views/Blog')),
  BlogPost: lazy(() => import('@views/BlogPost')),
  Faq: lazy(() => import('@views/Faq')),
  Status: lazy(() => import('@views/Status')),
  NotFound: lazy(() => import('@views/NotFound')),
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center" />}>
          <AppRoutes views={views} />
        </Suspense>
      </AnimatePresence>
    </BrowserRouter>
  )
}
