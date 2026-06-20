import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PRIMARY_LINKS } from '@constants/navigation'
import { useOnDarkBackground } from '@hooks/useOnDarkBackground'

const SCROLL_SOLID_THRESHOLD = 20

function Wordmark({ invert = false, sizeClass = 'h-8 w-[148px]' }) {
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
  const probeRef = useRef(null)
  const navRef = useRef(null)
  const [onDark, recheckBackground] = useOnDarkBackground(probeRef, [navRef])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > SCROLL_SOLID_THRESHOLD)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    const t = setTimeout(recheckBackground, 100)
    return () => clearTimeout(t)
  }, [location.pathname, recheckBackground])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const isTransparent = !scrolled && !mobileOpen
  const useDarkChrome = onDark

  const isActive = to =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  const linkBaseDark = 'text-ink-soft hover:text-ink'
  const linkBaseLight = 'text-paper-mute hover:text-ink-paper'
  const linkActiveDark = 'text-ink'
  const linkActiveLight = 'text-ink-paper'

  return (
    <>
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
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ease-out ${
          isTransparent
            ? 'border-b border-transparent bg-transparent'
            : useDarkChrome
              ? 'border-b border-hair bg-bg/85 backdrop-blur-xl'
              : 'border-b border-hair-paper bg-paper/85 backdrop-blur-xl'
        }`}
      >
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between gap-6 px-6 sm:px-10 lg:h-[76px] lg:px-16">
          <Link
            to="/"
            aria-label="TaylorURL home"
            className="group flex shrink-0 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
          >
            <Wordmark invert={useDarkChrome} sizeClass="h-9 w-[150px]" />
          </Link>

          <ul className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {PRIMARY_LINKS.map(link => {
              const active = isActive(link.to)
              return (
                <li key={link.to} className="relative">
                  <Link
                    to={link.to}
                    aria-current={active ? 'page' : undefined}
                    className={`relative inline-flex items-center rounded-sm px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200 ${
                      useDarkChrome
                        ? active
                          ? linkActiveDark
                          : linkBaseDark
                        : active
                          ? linkActiveLight
                          : linkBaseLight
                    }`}
                  >
                    <span className="mr-1.5 text-accent">{active ? '●' : ''}</span>
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="hidden shrink-0 items-center gap-5 lg:flex">
            <Link
              to="/contact"
              className="group inline-flex items-center gap-2.5 rounded-sm bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
            >
              <span>Start a project</span>
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm transition-colors duration-200 lg:hidden ${
              useDarkChrome
                ? 'text-ink hover:bg-ink/10'
                : 'text-ink-paper hover:bg-ink-paper/10'
            }`}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-bg/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="fixed inset-x-0 top-0 z-[61] flex max-h-[92vh] flex-col overflow-y-auto border-b border-hair bg-bg text-ink shadow-2xl lg:hidden"
            >
              <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-hair px-6">
                <Link to="/" aria-label="TaylorURL home" onClick={() => setMobileOpen(false)}>
                  <Wordmark invert sizeClass="h-9 w-[150px]" />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center rounded-sm text-ink transition-colors duration-200 hover:bg-ink/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1 px-6 py-8">
                <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  Index — Primary
                </p>
                {PRIMARY_LINKS.map((link, i) => {
                  const active = isActive(link.to)
                  return (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 + i * 0.04, duration: 0.25 }}
                    >
                      <Link
                        to={link.to}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between border-b border-hair py-4 transition-colors duration-150 ${
                          active ? 'text-accent' : 'text-ink-soft hover:text-ink'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="font-mono text-[10px] text-ink-faint">
                            0{i + 1}
                          </span>
                          <span className="text-[22px] font-semibold tracking-tight">
                            {link.label}
                          </span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-ink-faint" />
                      </Link>
                    </motion.div>
                  )
                })}
              </div>

              <div className="mt-auto border-t border-hair px-6 py-8">
                <Link
                  to="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="group flex w-full items-center justify-center gap-2.5 rounded-sm bg-accent px-6 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition-all duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
                >
                  <span>Start a project</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
                <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  Baytown, TX
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
