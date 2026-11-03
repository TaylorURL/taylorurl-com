import { Link, useLocation } from 'react-router-dom'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Menu, Phone, X } from 'lucide-react'
import {
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  FOOTER_COLUMNS,
  HEADER_LINKS,
  START_LINK,
} from '@constants/navigation'
import { HAS_ACCOUNTS } from '@constants/routes'
import { Logo } from '@components/kit/Kit'
import { BUTTONS, TYPE } from '@components/kit/styles'
import { NavSearchButton } from './NavUtility'
import { useSearchShortcut } from '@hooks/chrome/useSearchShortcut'
import { useToast } from '@hooks/chrome/useToast'
import { useSessionGlimpse } from '@hooks/session/useSessionGlimpse'
import { useScrollLock } from '@hooks/scroll/useScrollLock'
import QuietBoundary from '../app-shell/QuietBoundary'
import { claimCaught } from '@utils/caughtErrors'
import { lazyWithRetry } from '@utils/lazyWithRetry'

const loadSiteSearch = () => import('./SiteSearch')

// How many times a search that would not arrive is built again from scratch.
//
// One, and the press is what spends it. The reader reaching for it again is the
// better signal: it costs nothing on a page where nothing failed, and it never
// fires at somebody who has stopped caring. Past it the notice stands and the
// reload it names is the recovery.
const SEARCH_RENEWALS = 1

const LINK =
  'rounded-full px-3.5 py-2 text-[15px] font-medium text-ink-soft transition-colors duration-150 hover:text-ink aria-[current=page]:text-ink'

/**
 * The bar: the wordmark, three links, the phone number and the one button.
 *
 * It replaced a bar of five dropdown menus with about forty links between
 * them. Everything those menus reached is in the footer, and the pages these
 * three links open lead on to the rest. On a phone the bar is the wordmark, a
 * call button and a menu that opens straight under it, with no slide and no
 * animation - it is a list of links, not a moment.
 */
export default function Navigation() {
  const location = useLocation()
  const { signedIn } = useSessionGlimpse()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // Which copy of the search is in use. The chunk is lazy, and `lazy` keeps a
  // rejection for the life of the component it made, so a fetch that failed
  // once would fail every press after it. A renewal builds a new copy from the
  // same loader, carrying the failure across so it starts past the address
  // that failed.
  const [searchAttempt, setSearchAttempt] = useState(0)
  const searchCause = useRef(null)
  const searchSpent = useRef(0)
  const searchBuilt = useRef({ attempt: -1, Component: null })
  if (searchBuilt.current.attempt !== searchAttempt) {
    searchBuilt.current = {
      attempt: searchAttempt,
      Component: lazyWithRetry(loadSiteSearch, { after: searchCause.current }),
    }
  }
  const SiteSearch = searchBuilt.current.Component
  const toggleRef = useRef(null)
  const toast = useToast()

  const openSearch = () => {
    setMenuOpen(false)
    setSearchOpen(true)
  }
  useSearchShortcut(openSearch)

  // A search chunk that did not arrive closes the panel and says so. The first
  // time it offers another press, which builds a fresh copy; after that only a
  // newer document can reach the file, so it says to reload.
  const reportSearchUnavailable = useCallback(
    error => {
      claimCaught(error)
      searchCause.current = error
      setSearchOpen(false)
      if (searchSpent.current < SEARCH_RENEWALS) {
        searchSpent.current += 1
        setSearchAttempt(used => used + 1)
        toast('Search didn’t open. Press it again.', 'error')
        return
      }
      console.error(error)
      toast('Search needs a fresh copy of this page. Reload to open it.', 'error')
    },
    [toast]
  )

  // A new page closes whatever the bar had open.
  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  useScrollLock(menuOpen)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMenuOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const isActive = to => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))
  // The way into the console, on every site that has accounts: Sign In for a
  // visitor, Console for someone already signed in.
  const account = HAS_ACCOUNTS
    ? signedIn
      ? { to: '/console', label: 'Console' }
      : { to: '/login', label: 'Sign In' }
    : null

  return (
    <>
      <header className="sticky top-0 z-[var(--z-nav)] bg-[var(--nav-surface)] backdrop-blur-xl">
        <nav
          aria-label="Primary"
          className="mx-auto flex h-16 w-full max-w-[1160px] items-center justify-between gap-6 px-5 sm:h-[72px] sm:px-8"
        >
          <Link to="/" aria-label="Home" className="shrink-0 rounded-md py-1">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {HEADER_LINKS.map(link => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={LINK}
                  aria-current={isActive(link.to) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 lg:flex">
            <NavSearchButton
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white/[0.06] hover:text-ink"
              labelClass="sr-only"
              markClass="h-[18px] w-[18px]"
              onOpen={openSearch}
            />
            <a
              href={COMPANY_PHONE_HREF}
              className="px-3 text-[15px] font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {COMPANY_PHONE}
            </a>
            {account && (
              <Link to={account.to} className={`${BUTTONS.secondary} min-h-[42px] px-5`}>
                {account.label}
              </Link>
            )}
            <Link to={START_LINK.to} className={`${BUTTONS.primary} min-h-[42px] px-5`}>
              {START_LINK.label}
            </Link>
          </div>

          <div className="flex items-center gap-1 lg:hidden">
            <a
              href={COMPANY_PHONE_HREF}
              className={`${BUTTONS.primary} min-h-[38px] gap-1.5 px-4 text-[14px]`}
              aria-label={`Call ${COMPANY_PHONE}`}
            >
              <Phone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Call
            </a>
            <NavSearchButton
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
              labelClass="sr-only"
              markClass="h-5 w-5"
              onOpen={openSearch}
            />
            <button
              ref={toggleRef}
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
              onClick={() => setMenuOpen(open => !open)}
              aria-label={menuOpen ? 'Close the Menu' : 'Open the Menu'}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? 'site-menu' : undefined}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div
            id="site-menu"
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto bg-[var(--paper)] lg:hidden"
          >
            <div className="px-5 pb-10 pt-3">
              <ul>
                {HEADER_LINKS.map(link => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="flex items-center justify-between py-4 text-[22px] font-medium tracking-[-0.02em] text-ink"
                      aria-current={isActive(link.to) ? 'page' : undefined}
                    >
                      {link.label}
                      <ArrowRight className="h-5 w-5 text-ink-mute" strokeWidth={1.8} />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-7">
                {FOOTER_COLUMNS.map(column => (
                  <div key={column.head}>
                    <p className={TYPE.label}>{column.head}</p>
                    <ul className="mt-2.5 space-y-1">
                      {column.items.map(item => (
                        <li key={item.to}>
                          <Link to={item.to} className="block py-1 text-[15px] text-ink-soft">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3">
                <Link to={START_LINK.to} className={`${BUTTONS.primary} w-full`}>
                  {START_LINK.label}
                </Link>
                <a href={COMPANY_PHONE_HREF} className={`${BUTTONS.secondary} w-full`}>
                  <Phone className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  Call {COMPANY_PHONE}
                </a>
                {account && (
                  <Link to={account.to} className={`${BUTTONS.secondary} w-full`}>
                    {account.label}
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* The search is a piece of the bar rather than the page, so a chunk it
          cannot fetch fails here instead of at the boundary above the routes,
          which answers for a page by reloading the document. Mounted only while
          it is open, which keeps the index it carries out of the bundle every
          visitor is served. */}
      {searchOpen && (
        <QuietBoundary key={searchAttempt} onFail={reportSearchUnavailable}>
          <Suspense fallback={null}>
            <SiteSearch onClose={() => setSearchOpen(false)} />
          </Suspense>
        </QuietBoundary>
      )}
    </>
  )
}
