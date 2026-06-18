import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PRIMARY_LINKS } from '@constants/navigation'

const PILL_THRESHOLD = 50

// Check if a background color is "dark"
function isDarkColor(rgb) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return null
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return null
  const [r, g, b] = match.map(Number)
  // Luminance check
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
  const [pillScrolled, setPillScrolled] = useState(false)
  const [onDark, setOnDark] = useState(false)
  const logoRef = useRef(null)
  const mobileLogoRef = useRef(null)
  const navRef = useRef(null)
  const mobileNavRef = useRef(null)
  const isHome = location.pathname === '/'

  const checkBackground = useCallback(() => {
    const el =
      mobileLogoRef.current?.offsetParent !== null ? mobileLogoRef.current : logoRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    setOnDark(getBackgroundAtPoint(x, y, navRef.current, mobileNavRef.current))
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setPillScrolled(window.scrollY > PILL_THRESHOLD)
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

  // Re-check on route change
  useEffect(() => {
    setMobileOpen(false)
    // Delay to let the page render
    const t = setTimeout(checkBackground, 100)
    return () => clearTimeout(t)
  }, [location.pathname, checkBackground])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const isPillTransparent = isHome && !pillScrolled

  const isActive = to => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <>
      {/* Desktop */}
      <motion.nav
        ref={navRef}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none fixed left-0 right-0 top-0 z-50 hidden px-6 pt-5 md:block"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          {/* Logo */}
          <Link ref={logoRef} to="/" className="group pointer-events-auto flex items-center">
            <img
              src="/images/TaylorURL-Logo.png"
              alt="TaylorURL — websites for small businesses in Baytown, TX"
              width="112"
              height="112"
              fetchPriority="high"
              className="h-28 w-auto transition-all duration-300"
              style={onDark ? { filter: 'brightness(0) invert(1)' } : undefined}
            />
          </Link>

          {/* Right side pill */}
          <div
            className={`pointer-events-auto flex items-center gap-1 rounded-full border px-2 py-1.5 transition-all duration-500 ${
              isPillTransparent
                ? 'border-white/15 bg-white/10 backdrop-blur-xl'
                : 'border-gray-200 bg-surface-base/90 shadow-lg shadow-black/[0.06] backdrop-blur-xl'
            }`}
          >
            {PRIMARY_LINKS.map(link => {
              const active = isActive(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
                    active
                      ? isPillTransparent
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-900 text-white'
                      : isPillTransparent
                        ? 'text-gray-300 hover:text-white'
                        : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}

            <div className={`mx-1 h-5 w-px ${isPillTransparent ? 'bg-white/20' : 'bg-gray-200'}`} />

            <Link
              to="/contact"
              className="group flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-blue-500"
            >
              Get in Touch
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Mobile top bar */}
      <motion.nav
        ref={mobileNavRef}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 right-0 top-0 z-50 md:hidden"
      >
        <div
          className={`flex items-center justify-between overflow-hidden px-5 py-2 transition-all duration-500 ${
            onDark && !mobileOpen
              ? 'bg-transparent'
              : 'border-b border-gray-200/60 bg-surface-base/90 backdrop-blur-xl'
          }`}
        >
          <Link ref={mobileLogoRef} to="/" className="flex items-center">
            <img
              src="/images/TaylorURL-Logo.png"
              alt="TaylorURL — websites for small businesses in Baytown, TX"
              width="80"
              height="80"
              fetchPriority="high"
              className="-mb-[10px] h-20 w-auto transition-all duration-300"
              style={onDark && !mobileOpen ? { filter: 'brightness(0) invert(1)' } : undefined}
            />
          </Link>

          <button
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              onDark && !mobileOpen ? 'text-white' : 'text-gray-700'
            }`}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <div className="flex w-5 flex-col items-end gap-[5px]">
                <span
                  className={`block h-[2px] w-5 rounded-full transition-colors duration-300 ${onDark ? 'bg-white' : 'bg-gray-900'}`}
                />
                <span
                  className={`block h-[2px] w-3.5 rounded-full transition-colors duration-300 ${onDark ? 'bg-white' : 'bg-gray-900'}`}
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 z-[201] flex h-full w-[280px] flex-col overflow-y-auto bg-surface-overlay shadow-2xl md:hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <Link to="/" onClick={() => setMobileOpen(false)}>
                  <img
                    src="/images/TaylorURL-Logo.png"
                    alt="TaylorURL — websites for small businesses in Baytown, TX"
                    width="64"
                    height="64"
                    className="h-16 w-auto"
                  />
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation section */}
              <div className="flex-1 px-4 py-5">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Navigation
                </p>
                <div className="space-y-1">
                  {PRIMARY_LINKS.map((link, i) => (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                    >
                      <Link
                        to={link.to}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center rounded-xl px-3 py-3 text-[14px] font-medium transition-all duration-150 ${
                          isActive(link.to)
                            ? 'bg-blue-50 font-semibold text-blue-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {isActive(link.to) && (
                          <span className="mr-3 h-2 w-2 rounded-full bg-blue-600" />
                        )}
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* CTA at bottom */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.25 }}
                className="border-t border-gray-100 px-4 py-5"
              >
                <Link
                  to="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                >
                  Get in Touch
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
