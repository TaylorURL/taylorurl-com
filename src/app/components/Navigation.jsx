import { Link, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PRIMARY_LINKS } from '@constants/navigation'

const SCROLL_SOLID_THRESHOLD = 24

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

/**
 * The source logo PNG is 1024×1024 but the wordmark only occupies the band
 * y=415→683 (~26% of the canvas). Rendering the raw image at a normal nav
 * size yields a tiny wordmark surrounded by transparent padding. This wrapper
 * crops the whitespace by sizing the image to ~3.8× the wrapper height and
 * centering it, so the wordmark itself fills the wrapper — making the brand
 * mark the visual anchor of the bar.
 */
function LogoMark({ sizeClass, invert }) {
  return (
    <div className={`relative overflow-hidden ${sizeClass}`}>
      <img
        src="/images/TaylorURL-Logo.png"
        alt="TaylorURL — websites for small businesses in Baytown, TX"
        width="1024"
        height="1024"
        fetchPriority="high"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380%] w-auto max-w-none select-none transition-[filter] duration-300"
        style={{
          transform: 'translate(-50%, -54%)',
          filter: invert ? 'brightness(0) invert(1)' : undefined,
        }}
        draggable={false}
      />
    </div>
  )
}

export default function Navigation() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [onDark, setOnDark] = useState(false)
  const probeRef = useRef(null)
  const navRef = useRef(null)
  const isHome = location.pathname === '/'

  const checkBackground = useCallback(() => {
    const el = probeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    setOnDark(getBackgroundAtPoint(x, y, navRef.current))
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > SCROLL_SOLID_THRESHOLD)
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

  // Transparent only over the dark home hero before any scroll.
  const isTransparent = isHome && !scrolled && !mobileOpen
  const onHeroDark = isTransparent && onDark

  const isActive = to =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <>
      {/* Hidden probe — anchored where the logo sits, used to sample the page bg behind the nav. */}
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none fixed left-10 top-10 h-1 w-1"
      />

      <motion.nav
        ref={navRef}
        aria-label="Primary"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out ${
          isTransparent
            ? 'border-transparent bg-transparent'
            : 'border-gray-200/70 bg-white/85 shadow-[0_1px_0_0_rgba(15,23,42,0.04),0_10px_30px_-18px_rgba(15,23,42,0.18)] backdrop-blur-xl'
        }`}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 md:h-20 md:gap-8 md:px-8 lg:px-12">
          {/* LOGO — the anchor of the bar */}
          <Link
            to="/"
            aria-label="TaylorURL home"
            className="group flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
          >
            <LogoMark
              sizeClass="h-10 w-[150px] md:h-12 md:w-[180px]"
              invert={onHeroDark}
            />
          </Link>

          {/* DESKTOP LINKS — minimalist text with motion-animated active underline */}
          <ul className="hidden flex-1 items-center justify-center md:flex">
            {PRIMARY_LINKS.map(link => {
              const active = isActive(link.to)
              return (
                <li key={link.to} className="relative">
                  <Link
                    to={link.to}
                    aria-current={active ? 'page' : undefined}
                    className={`relative inline-flex items-center px-4 py-2 text-[13.5px] font-medium tracking-[-0.005em] transition-colors duration-200 ${
                      onHeroDark
                        ? active
                          ? 'text-white'
                          : 'text-gray-400 hover:text-white'
                        : active
                          ? 'text-gray-900'
                          : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                    {active && (
                      <motion.span
                        layoutId="nav-active-indicator"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className={`absolute inset-x-3 -bottom-[3px] h-[2px] rounded-full ${
                          onHeroDark ? 'bg-blue-400' : 'bg-blue-600'
                        }`}
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* DESKTOP CTA — gradient pill with launch arrow */}
          <div className="hidden shrink-0 items-center md:flex">
            <Link
              to="/contact"
              className={`group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-all duration-200 ease-out active:scale-[0.97] ${
                onHeroDark
                  ? 'bg-white text-gray-900 shadow-[0_4px_18px_-4px_rgba(255,255,255,0.35)] hover:shadow-[0_6px_22px_-2px_rgba(255,255,255,0.45)]'
                  : 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_4px_14px_-2px_rgba(37,99,235,0.45)] hover:from-blue-500 hover:to-blue-600 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_8px_24px_-4px_rgba(37,99,235,0.55)]'
              }`}
            >
              <span>Start a project</span>
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* MOBILE TOGGLE */}
          <button
            type="button"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 md:hidden ${
              onHeroDark
                ? 'text-white hover:bg-white/10'
                : 'text-gray-900 hover:bg-gray-900/[0.06]'
            }`}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.nav>

      {/* MOBILE SHEET — drops from the top, edge-to-edge, premium feel */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-gray-950/55 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="fixed inset-x-0 top-0 z-[61] flex max-h-[92vh] flex-col overflow-y-auto rounded-b-3xl border-b border-gray-200 bg-white shadow-2xl md:hidden"
            >
              <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-gray-100 px-5">
                <Link to="/" aria-label="TaylorURL home" onClick={() => setMobileOpen(false)}>
                  <LogoMark sizeClass="h-10 w-[150px]" invert={false} />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-900 transition-colors duration-200 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-1 px-4 py-6" aria-label="Mobile primary">
                <p className="px-3 pb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
                  Navigate
                </p>
                {PRIMARY_LINKS.map((link, i) => {
                  const active = isActive(link.to)
                  return (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04, duration: 0.25 }}
                    >
                      <Link
                        to={link.to}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-[17px] font-medium transition-colors duration-150 ${
                          active
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-800 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span>{link.label}</span>
                        {active ? (
                          <span className="h-2 w-2 rounded-full bg-blue-600" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-gray-300" />
                        )}
                      </Link>
                    </motion.div>
                  )
                })}
              </nav>

              <div className="mt-auto border-t border-gray-100 px-5 py-6">
                <Link
                  to="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-6 py-4 text-base font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_6px_22px_-4px_rgba(37,99,235,0.55)] transition-all duration-200 ease-out hover:from-blue-500 hover:to-blue-600 active:scale-[0.98]"
                >
                  <span>Start a project</span>
                  <ArrowUpRight className="h-5 w-5 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
                <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
                  Baytown, TX · Serving the Greater Houston area
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
