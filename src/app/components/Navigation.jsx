import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PRIMARY_LINKS } from '@constants/navigation'

const SCROLL_THRESHOLD = 20

export default function Navigation() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 md:px-6"
      >
        <div
          className={`mx-auto max-w-6xl rounded-2xl border transition-all duration-500 ${
            scrolled
              ? 'border-gray-200/80 bg-white/75 shadow-lg shadow-gray-900/5 backdrop-blur-xl'
              : 'border-transparent bg-white/50 backdrop-blur-sm'
          }`}
        >
          <div className="flex items-center justify-between px-5 py-3">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <span className="text-[1.35rem] font-bold tracking-tight text-gray-900">
                Taylor<span className="text-blue-600">URL</span>
              </span>
            </Link>

            {/* Desktop links */}
            <div className="hidden items-center gap-1 md:flex">
              {PRIMARY_LINKS.map(link => {
                const isActive = location.pathname === link.to
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>

            {/* Right side */}
            <div className="hidden items-center gap-3 md:flex">
              <Link
                to="/auth"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900"
              >
                Sign In
              </Link>
              <Link
                to="/pricing"
                className="group flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700"
              >
                Get a Quote
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(prev => !prev)}
              className="relative z-50 flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 md:hidden"
            >
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="h-5 w-5" strokeWidth={1.5} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="h-5 w-5" strokeWidth={1.5} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-4 right-4 top-20 z-50 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xl shadow-gray-900/10 md:hidden"
            >
              <div className="p-3">
                {PRIMARY_LINKS.map(link => {
                  const isActive = location.pathname === link.to
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className={`block rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                        isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </div>
              <div className="border-t border-gray-100 p-3">
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-4 py-3 text-center text-[15px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Sign In
                </Link>
                <Link
                  to="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Get a Quote
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
