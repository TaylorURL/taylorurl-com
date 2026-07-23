import { Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import ScrollToTop from '@components/ScrollToTop'
import ErrorBoundary from '@components/ErrorBoundary'
import { lazyWithRetry } from '@utils/lazyWithRetry'
import AppRoutes from './routes'

const views = {
  Home: lazyWithRetry(() => import('@views/Home')),
  About: lazyWithRetry(() => import('@views/About')),
  Services: lazyWithRetry(() => import('@views/Services')),
  Contact: lazyWithRetry(() => import('@views/Contact')),
  Privacy: lazyWithRetry(() => import('@views/Privacy')),
  Terms: lazyWithRetry(() => import('@views/Terms')),
  License: lazyWithRetry(() => import('@views/License')),
  Process: lazyWithRetry(() => import('@views/Process')),
  Portfolio: lazyWithRetry(() => import('@views/Portfolio')),
  Spigot: lazyWithRetry(() => import('@views/Spigot')),
  Blog: lazyWithRetry(() => import('@views/Blog')),
  BlogPost: lazyWithRetry(() => import('@views/BlogPost')),
  Faq: lazyWithRetry(() => import('@views/Faq')),
  Status: lazyWithRetry(() => import('@views/Status')),
  NotFound: lazyWithRetry(() => import('@views/NotFound')),
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ErrorBoundary>
        <AnimatePresence mode="wait">
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center" />}>
            <AppRoutes views={views} />
          </Suspense>
        </AnimatePresence>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
