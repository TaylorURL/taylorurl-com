import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PRIMARY_LINKS } from '@constants/navigation'

const SOLID_THRESHOLD = 24

function isDarkColor(rgb) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return null
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return null
  const [r, g, b] = match.map(Number)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.45
}

function getBackgroundAtPoint(x, y, ...ignoreEls) {
  const els = document.elementsFromPoint(x, y)
  for (const el of els) {
    if (ignoreEls.some(ref => ref && ref.contains(el))) continue
    const bg = window.getComputedStyle(el).backgroundColor
    const dark = isDarkColor(bg)
    if (dark !== null) return dark
  }
  return false
}

export default function Navigation() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [onDark, setOnDark] = useState(false)
  const probeRef = useRef(null)
  const navRef = useRef(null)
  const mobileNavRef = useRef(null)
  const isHome = location.pathname === '/'

  const checkBackground = useCallback(() => {
    const el = probeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    setOnDark(getBackgroundAtPoint(x, y, navRef.current, mobileNavRef.current))
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > SOLID_THRESHOLD)
      checkBackground()
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', checkBackground, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', checkBackground)
    }
  }, [checkBackground])

  useEffect(() => {
    setMobileOpen(false)
    const t = setTimeout(checkBackground, 100)
    return () => clearTimeout(t)
  }, [location.pathname, checkBackground])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // Transparent over the home hero before scroll; solid bar everywhere else.
  const isTransparent = isHome && !scrolled
  const showBarChrome = !isTransparent

  const isActive = to => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <>
      {/* Hidden probe — anchored where the logo sits, used to sample the page bg behind the nav. */}
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none fixed left-8 top-7 h-1 w-1 md:left-10 md:top-8"
      />

      {/* Desktop nav — full-width bar */}
      <motion.nav
        ref={navRef}
        aria-label="Primary"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-50 hidden border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out md:block ${
          showBarChrome
            ? 'border-gray-200/80 bg-surface-base/85 shadow-sm shadow-black/[0.03] backdrop-blur-xl'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link to="/" className="flex shrink-0 items-center" aria-label="TaylorURL home">
            <img
              src="/images/TaylorURL-Logo.png"
              alt="TaylorURL — websites for small businesses in Baytown, TX"
              width="120"
              height="120"
              fetchPriority="high"
              className="h-10 w-auto transition-[filter] duration-300"
              style={isTransparent && onDark ? { filter: 'brightness(0) invert(1)' } : undefined}
            />
          </Link>

          <div className="flex items-center gap-1">
            {PRIMARY_LINKS.map(link => {
              const active = isActive(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? 'page' : undefined}
                  className={`relative rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors duration-200 ${
                    isTransparent
                      ? active
                        ? 'bg-white/15 text-white'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      : active
                        ? 'bg-gray-900/[0.06] text-gray-900'
                        : 'text-gray-500 hover:bg-gray-900/[0.04] hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/contact"
              className={`group flex items-center gap-1.5 rounded-full px-5 py-2 text-[13.5px] font-semibold transition-all duration-200 ease-out active:scale-[0.97] ${
                isTransparent
                  ? 'bg-white text-gray-900 shadow-sm shadow-black/10 hover:bg-gray-100'
                  : 'bg-gray-900 text-white shadow-sm shadow-black/10 hover:bg-blue-600 hover:shadow-blue-600/25'
              }`}
            >
              Get in Touch
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Mobile nav — full-width bar */}
      <motion.nav
        ref={mobileNavRef}
        aria-label="Primary"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ease-out md:hidden ${
          showBarChrome || mobileOpen
            ? 'border-gray-200/80 bg-surface-base/90 backdrop-blur-xl'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="flex h-14 items-center justify-between px-5">
          <Link to="/" className="flex items-center" aria-label="TaylorURL home">
            <img
              src="/images/TaylorURL-Logo.png"
              alt="TaylorURL — websites for small businesses in Baytown, TX"
              width="120"
              height="120"
              fetchPriority="high"
              className="h-9 w-auto transition-[filter] duration-300"
              style={
                isTransparent && onDark && !mobileOpen
                  ? { filter: 'brightness(0) invert(1)' }
                  : undefined
              }
            />
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
              isTransparent && onDark && !mobileOpen
                ? 'text-white hover:bg-white/10'
                : 'text-gray-900 hover:bg-gray-900/[0.05]'
            }`}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <div className="flex w-5 flex-col items-end gap-[5px]">
                <span
                  className={`block h-[2px] w-5 rounded-full transition-colors duration-300 ${
                    isTransparent && onDark ? 'bg-white' : 'bg-gray-900'
                  }`}
                />
                <span
                  className={`block h-[2px] w-3.5 rounded-full transition-colors duration-300 ${
                    isTransparent && onDark ? 'bg-white' : 'bg-gray-900'
                  }`}
                />
              </div>
            )}
          </button>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 z-[201] flex h-full w-[300px] flex-col overflow-y-auto bg-surface-overlay shadow-2xl md:hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex h-14 items-center justify-between border-b border-gray-200/80 px-5">
                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  aria-label="TaylorURL home"
                  className="flex items-center"
                >
                  <img
                    src="/images/TaylorURL-Logo.png"
                    alt="TaylorURL — websites for small businesses in Baytown, TX"
                    width="120"
                    height="120"
                    className="h-9 w-auto"
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 px-4 py-6">
                <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                  Menu
                </p>
                <div className="space-y-0.5">
                  {PRIMARY_LINKS.map((link, i) => {
                    const active = isActive(link.to)
                    return (
                      <motion.div
                        key={link.to}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                      >
                        <Link
                          to={link.to}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium transition-colors duration-150 ${
                            active
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            {active && (
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            )}
                            {link.label}
                          </span>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.25 }}
                className="border-t border-gray-200/80 px-4 py-5"
              >
                <Link
                  to="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all duration-200 ease-out hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/25 active:scale-[0.98]"
                >
                  Get in Touch
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
