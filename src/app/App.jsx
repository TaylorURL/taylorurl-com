import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from '@components/Layout'
import ScrollToTop from '@components/ScrollToTop'
import ProtectedRoute from '@components/ProtectedRoute'

const Home = lazy(() => import('@views/Home'))
const About = lazy(() => import('@views/About'))
const Services = lazy(() => import('@views/Services'))
const Work = lazy(() => import('@views/Work'))
const Pricing = lazy(() => import('@views/Pricing'))
const Privacy = lazy(() => import('@views/Privacy'))
const Terms = lazy(() => import('@views/Terms'))
const License = lazy(() => import('@views/License'))
const Auth = lazy(() => import('@views/Auth'))
const Dashboard = lazy(() => import('@views/Dashboard'))
const Careers = lazy(() => import('@views/Careers'))
const Process = lazy(() => import('@views/Process'))
const Blog = lazy(() => import('@views/Blog'))
const BlogPost = lazy(() => import('@views/BlogPost'))
const Faq = lazy(() => import('@views/Faq'))
const Status = lazy(() => import('@views/Status'))
const NotFound = lazy(() => import('@views/NotFound'))

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center" />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="services" element={<Services />} />
              <Route path="work" element={<Work />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="license" element={<License />} />
              <Route path="auth" element={<Auth />} />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="careers" element={<Careers />} />
              <Route path="process" element={<Process />} />
              <Route path="blog" element={<Blog />} />
              <Route path="blog/:slug" element={<BlogPost />} />
              <Route path="faq" element={<Faq />} />
              <Route path="status" element={<Status />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </AnimatePresence>
    </BrowserRouter>
  )
}
