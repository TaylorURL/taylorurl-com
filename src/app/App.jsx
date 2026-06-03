import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from '@components/Layout'
import ScrollToTop from '@components/ScrollToTop'

const Home = lazy(() => import('@views/Home'))
const About = lazy(() => import('@views/About'))
const Services = lazy(() => import('@views/Services'))
const Pricing = lazy(() => import('@views/Pricing'))
const Privacy = lazy(() => import('@views/Privacy'))
const Terms = lazy(() => import('@views/Terms'))
const License = lazy(() => import('@views/License'))
const Careers = lazy(() => import('@views/Careers'))
const Process = lazy(() => import('@views/Process'))
const Blog = lazy(() => import('@views/Blog'))
const BlogPost = lazy(() => import('@views/BlogPost'))
const Faq = lazy(() => import('@views/Faq'))
const Status = lazy(() => import('@views/Status'))
const NotFound = lazy(() => import('@views/NotFound'))

const SundayLayout = lazy(() => import('@components/sunday/SundayLayout'))
const SundayAuth = lazy(() => import('@views/sunday/SundayAuth'))
const SundayToday = lazy(() => import('@views/sunday/SundayToday'))
const SundayChat = lazy(() => import('@views/sunday/SundayChat'))
const SundayTasks = lazy(() => import('@views/sunday/SundayTasks'))
const SundayProjects = lazy(() => import('@views/sunday/SundayProjects'))
const SundayProjectDetail = lazy(() => import('@views/sunday/SundayProjectDetail'))
const SundayDevices = lazy(() => import('@views/sunday/SundayDevices'))
const SundayFiles = lazy(() => import('@views/sunday/SundayFiles'))
const SundayTodo = lazy(() => import('@views/sunday/SundayTodo'))
const SundayDay = lazy(() => import('@views/sunday/SundayDay'))

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center" />}>
          <Routes>
            <Route path="/sunday/auth" element={<SundayAuth />} />
            <Route path="/sunday" element={<SundayLayout />}>
              <Route index element={<SundayToday />} />
              <Route path="todo" element={<SundayTodo />} />
              <Route path="chat" element={<SundayChat />} />
              <Route path="tasks" element={<SundayTasks />} />
              <Route path="projects" element={<SundayProjects />} />
              <Route path="projects/:id" element={<SundayProjectDetail />} />
              <Route path="files" element={<SundayFiles />} />
              <Route path="devices" element={<SundayDevices />} />
              <Route path="day/:date" element={<SundayDay />} />
            </Route>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="services" element={<Services />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="license" element={<License />} />
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
