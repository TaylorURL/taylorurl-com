import { Link, useLocation } from 'react-router-dom'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Phone } from 'lucide-react'
import {
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  FOOTER_COLUMNS,
  HEADER_LINKS,
  START_LINK,
  serves,
} from '@constants/navigation'
import { HAS_ACCOUNTS } from '@constants/routes'
import { Logo } from '@components/kit/Kit'
import { NavSearchButton } from './NavUtility'
import { useSearchShortcut } from '@hooks/chrome/useSearchShortcut'
import { useToast } from '@hooks/chrome/useToast'
import { useSessionGlimpse } from '@hooks/session/useSessionGlimpse'
import { useScrollLock } from '@hooks/scroll/useScrollLock'
import QuietBoundary from '../app-shell/QuietBoundary'
import { claimCaught } from '@utils/caughtErrors'
import { lazyWithRetry } from '@utils/lazyWithRetry'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

const loadSiteSearch = () => import('./SiteSearch')

// How many times a search that would not arrive is built again from scratch.
//
// One, and the press is what spends it. The reader reaching for it again is the
// better signal: it costs nothing on a page where nothing failed, and it never
// fires at somebody who has stopped caring. Past it the notice stands and the
// reload it names is the recovery.
const SEARCH_RENEWALS = 1

// The links across the middle of the bar, after whatsapp.com's "Features ⌄,
// Privacy, Blog, Apps, Help Center, For Business": the pages the bar has always
// named, then the free tools, the blog and the contact page. A link whose name
// matches a footer column opens that column as its dropdown.
const MENUS = { Services: 'Services', 'Free Tools': 'Free Tools' }
const EXTRA_LINKS = IS_SECOND_SITE
  ? []
  : [
      { to: '/tools', label: 'Free Tools' },
      { to: '/blog', label: 'Blog' },
      { to: '/contact', label: 'Contact' },
    ].filter(link => serves(link.to))
const NAV_ITEMS = [...HEADER_LINKS, ...EXTRA_LINKS].map(link => ({
  ...link,
  items: MENUS[link.label]
    ? (FOOTER_COLUMNS.find(column => column.head === MENUS[link.label])?.items ?? null)
    : null,
}))

// How long an open menu waits after the pointer leaves it before it closes,
// measured off whatsapp.com's own (it holds for about a fifth of a second, so a
// pointer that slips off the panel on its way down does not lose it).
const CLOSE_AFTER = 200

/**
 * One of the bar's dropdowns, built the way whatsapp.com builds "Features":
 * the label with a growing underline and a chevron that flips, and under it a
 * rounded panel that unrolls (max-height) while it fades and drops into place,
 * its links rising a beat behind it. The timings and curves are in
 * src/index.css under "The bar"; they are whatsapp.com's, measured frame by
 * frame.
 */
function NavDropdown({ item, open, onOpen, onLeave, onClose, active, isActive }) {
  const panelId = `nav-menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`
  const pressedBy = useRef('')
  return (
    <div
      className="wa-drop"
      data-open={open ? 'true' : 'false'}
      onPointerEnter={event => event.pointerType === 'mouse' && onOpen()}
      onPointerLeave={event => event.pointerType === 'mouse' && onLeave()}
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) onClose()
      }}
    >
      <button
        type="button"
        className="wa-link wa-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={active ? 'page' : undefined}
        // A mouse has already opened the menu by pointing at it, so its click
        // only keeps it open - on whatsapp.com a click on "Features" never
        // snaps the panel shut under the pointer. A finger or the keyboard
        // toggles it.
        onPointerDown={event => {
          pressedBy.current = event.pointerType
        }}
        onKeyDown={() => {
          pressedBy.current = 'keyboard'
        }}
        onClick={() => {
          if (pressedBy.current === 'mouse') onOpen()
          else if (open) onClose()
          else onOpen()
          pressedBy.current = ''
        }}
      >
        <span className="wa-u">{item.label}</span>
        <span className="wa-trigger-chev" aria-hidden="true">
          <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
        </span>
      </button>
      {/* Each row carries its distance from the bottom of the list as --i, so
          the rows rise in one after another from the bottom up, as on whatsapp.com. */}
      <div id={panelId} className="wa-panel" role="group" aria-label={item.label}>
        <div className="wa-panel-in">
          <div className="wa-panel-col">
            <ul className="wa-panel-list">
              {item.items.map((sub, index) => (
                <li key={sub.to} style={{ '--i': item.items.length - 1 - index }}>
                  <Link
                    to={sub.to}
                    className="wa-panel-item"
                    tabIndex={open ? undefined : -1}
                    aria-current={isActive(sub.to, true) ? 'page' : undefined}
                    onClick={onClose}
                  >
                    <span className="wa-u">{sub.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The bar, after whatsapp.com's header, one for one in TaylorURL's colours.
 *
 * A sticky bar the colour of the page, 80px tall on a wide screen and 56px on
 * a phone. The wordmark at the left; the links centred, 16px and 40px apart,
 * each underlined from the left in the brand blue when pointed at; Services and
 * Free Tools opening whatsapp.com's dropdown; and at the right the search, an
 * outlined "Sign In" pill and the filled "Get a Price" pill, both filling with
 * a rising circle when pointed at.
 *
 * Under 1177px wide (whatsapp.com folds its bar at 1176px): a two-line burger
 * that turns into a cross, the wordmark centred in the room left between it and
 * the filled pill, which stays in the bar as whatsapp.com's "Download" does; the
 * menu takes the screen under the bar at once,
 * big 28px rows between hairlines, a group opening its own view with a way
 * back, and a dark foot with the pills.
 */
export default function Navigation() {
  const location = useLocation()
  const { signedIn } = useSessionGlimpse()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdown, setDropdown] = useState(null)
  const [sheetGroup, setSheetGroup] = useState(null)
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
  // The hairline once the page has moved.
  const [barRaised, setBarRaised] = useState(false)
  useEffect(() => {
    const onScroll = () => setBarRaised(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // One timer for every dropdown, so moving from one trigger to the next
  // cancels the first one's close and the next one opens at once.
  const closing = useRef(0)
  const openMenu = label => {
    window.clearTimeout(closing.current)
    setDropdown(label)
  }
  const leaveMenu = label => {
    window.clearTimeout(closing.current)
    closing.current = window.setTimeout(
      () => setDropdown(current => (current === label ? null : current)),
      CLOSE_AFTER
    )
  }
  const closeMenu = label => {
    window.clearTimeout(closing.current)
    setDropdown(current => (current === label ? null : current))
  }
  useEffect(() => () => window.clearTimeout(closing.current), [])

  // A press anywhere off the bar closes an open dropdown. Safari never focuses
  // a button it is clicked on, so a blur would never come to close it.
  const barRef = useRef(null)
  useEffect(() => {
    if (!dropdown) return undefined
    const onDown = event => {
      if (!barRef.current?.contains(event.target)) setDropdown(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [dropdown])

  const openSearch = () => {
    setMenuOpen(false)
    setDropdown(null)
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
    setDropdown(null)
    setSheetGroup(null)
    setSearchOpen(false)
  }, [location.pathname])

  // Closing the menu forgets the group it was in, so it opens on the top list.
  useEffect(() => {
    if (!menuOpen) setSheetGroup(null)
  }, [menuOpen])

  useScrollLock(menuOpen)

  useEffect(() => {
    if (!menuOpen && !dropdown) return undefined
    const onKey = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (dropdown) {
        setDropdown(null)
        return
      }
      if (sheetGroup) {
        setSheetGroup(null)
        return
      }
      setMenuOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen, dropdown, sheetGroup])

  const isActive = (to, exact = false) =>
    to === '/' || exact ? location.pathname === to : location.pathname.startsWith(to)
  const groupActive = item =>
    isActive(item.to) || (item.items ?? []).some(sub => isActive(sub.to, true))
  // The way into the console, on every site that has accounts: Sign In for a
  // visitor, Console for someone already signed in.
  const account = HAS_ACCOUNTS
    ? signedIn
      ? { to: '/console', label: 'Console' }
      : { to: '/login', label: 'Sign In' }
    : null
  const group = sheetGroup ? NAV_ITEMS.find(item => item.label === sheetGroup) : null

  return (
    <>
      <header
        className="wa-header"
        data-raised={barRaised ? 'true' : 'false'}
        data-open={menuOpen ? 'true' : 'false'}
      >
        <nav ref={barRef} aria-label="Primary" className="wa-bar">
          <div className="wa-bar-start">
            <button
              ref={toggleRef}
              type="button"
              className="wa-burger"
              onClick={() => setMenuOpen(open => !open)}
              aria-label={menuOpen ? 'Close the Menu' : 'Open the Menu'}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? 'site-menu' : undefined}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
            <Link to="/" aria-label="Home" className="wa-logo">
              <Logo />
            </Link>
          </div>

          <ul className="wa-links">
            {NAV_ITEMS.map(item => (
              <li key={item.to}>
                {item.items ? (
                  <NavDropdown
                    item={item}
                    open={dropdown === item.label}
                    onOpen={() => openMenu(item.label)}
                    onLeave={() => leaveMenu(item.label)}
                    onClose={() => closeMenu(item.label)}
                    active={groupActive(item)}
                    isActive={isActive}
                  />
                ) : (
                  <Link
                    to={item.to}
                    className="wa-link"
                    aria-current={isActive(item.to) ? 'page' : undefined}
                  >
                    <span className="wa-u">{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>

          <div className="wa-actions">
            <NavSearchButton
              className="wa-icon"
              labelClass="sr-only"
              markClass="h-[19px] w-[19px]"
              onOpen={openSearch}
            />
            {account && (
              <Link to={account.to} className="wa-btn wa-btn-outline wa-btn-bar">
                <span className="wa-btn-label">{account.label}</span>
                <ChevronRight className="wa-btn-icon h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            )}
            <Link to={START_LINK.to} className="wa-btn wa-btn-fill wa-btn-bar">
              <span className="wa-btn-label">{START_LINK.label}</span>
              <ArrowRight className="wa-btn-icon h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </nav>

        {menuOpen && (
          <div id="site-menu" className="wa-sheet">
            {group ? (
              <div key={group.label} className="wa-sheet-view wa-sheet-view-sub">
                <button
                  type="button"
                  className="wa-sheet-back wa-rise"
                  style={{ '--i': group.items.length }}
                  onClick={() => setSheetGroup(null)}
                >
                  <ArrowLeft className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                  <span>{group.label}</span>
                </button>
                <ul className="wa-sheet-sublist">
                  {group.items.map((sub, index) => (
                    <li
                      key={sub.to}
                      className="wa-rise"
                      style={{ '--i': group.items.length - 1 - index }}
                    >
                      <Link
                        to={sub.to}
                        className="wa-sheet-subitem"
                        aria-current={isActive(sub.to, true) ? 'page' : undefined}
                      >
                        {sub.label}
                        <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul key="top" className="wa-sheet-view wa-sheet-list">
                <li className="wa-sheet-row wa-rise" style={{ '--i': 0 }}>
                  <Link
                    to="/"
                    className="wa-sheet-link"
                    aria-current={isActive('/', true) ? 'page' : undefined}
                  >
                    Home
                  </Link>
                </li>
                {NAV_ITEMS.map((item, index) => (
                  <li key={item.to} className="wa-sheet-row wa-rise" style={{ '--i': index + 1 }}>
                    {item.items ? (
                      <button
                        type="button"
                        className="wa-sheet-link"
                        aria-current={groupActive(item) ? 'page' : undefined}
                        onClick={() => setSheetGroup(item.label)}
                      >
                        {item.label}
                        <ArrowRight
                          className="wa-sheet-arrow h-6 w-6"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <Link
                        to={item.to}
                        className="wa-sheet-link"
                        aria-current={isActive(item.to) ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="wa-sheet-foot">
              <div className="wa-sheet-foot-row">
                <Link to={START_LINK.to} className="wa-btn wa-btn-fill wa-btn-wide">
                  <span className="wa-btn-label">{START_LINK.label}</span>
                  <ArrowRight className="wa-btn-icon h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
              <div className="wa-sheet-foot-row wa-sheet-foot-pair">
                <a href={COMPANY_PHONE_HREF} className="wa-btn wa-btn-outline wa-btn-on-deep">
                  <Phone className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  <span className="wa-btn-label">{COMPANY_PHONE}</span>
                </a>
                {account && (
                  <Link to={account.to} className="wa-btn wa-btn-outline wa-btn-on-deep">
                    <span className="wa-btn-label">{account.label}</span>
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
