import { Link, useLocation } from 'react-router-dom'
import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight, Menu, Phone, X } from 'lucide-react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { PAGE_CHANGE_MS } from '@constants/animations'
import {
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  DRAWER_LINKS,
  NAV_DRAWER_DURATION,
  NAV_DURATION,
  NAV_EASE,
  NAV_GROUPS,
  START_LINK,
} from '@constants/navigation'
import { HAS_ACCOUNTS } from '@constants/routes'
import { NavBarLink, NavPanelViewport, NavTrigger } from './NavMenu'
import { NavSearchButton, NavUtility } from './NavUtility'
import ThemePicker from '@components/navigation/ThemePicker'
import { useSearchShortcut } from '@hooks/chrome/useSearchShortcut'
import { useToast } from '@hooks/chrome/useToast'
import { useSessionGlimpse } from '@hooks/session/useSessionGlimpse'
import { announceGroundChange, useOnDarkBackground } from '@hooks/theme/useOnDarkBackground'
import { useScrolledPast } from '@hooks/scroll/useScrolledPast'
import { useTheme } from '@hooks/theme/useTheme'
import { SITE } from '../../../../lib/site/current.js'
import QuietBoundary from '../app-shell/QuietBoundary'
import { lazyWithRetry } from '@utils/lazyWithRetry'

// Below this depth the bar is transparent; past it the shell takes its
// surface, before the first line of content reaches the bar's underside.
const SCROLL_SURFACE_THRESHOLD = 24
// A panel that opens the instant a pointer crosses its trigger makes a dense
// bar unusable, and one that closes the instant the pointer leaves the shell
// cannot survive a wobble; the two graces cover both. Travel between triggers
// skips the open grace, because the reader has already said they are browsing.
const OPEN_DELAY_MS = 90
const CLOSE_DELAY_MS = 180

// The search, and the index of the whole site it carries, arrive the first time
// somebody reaches for them rather than in the bundle every visitor is served.
// NavUtility warms the same chunk when a pointer crosses the trigger, so by the
// time the press lands it is usually already down.
const SiteSearch = lazyWithRetry(() => import('./SiteSearch'))

function Wordmark({ invert = false }) {
  return (
    <div className="nav-mark relative overflow-hidden">
      <img
        src="/images/TaylorURL-Logo.webp"
        alt={SITE.logoAlt}
        width="384"
        height="384"
        fetchPriority="high"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380%] w-auto max-w-none select-none transition-[filter] duration-[var(--nav-duration-slow)] ease-out-soft"
        style={{
          transform: 'translate(-50%, -54%)',
          filter: invert ? 'brightness(0) invert(1)' : undefined,
        }}
        draggable={false}
      />
    </div>
  )
}

/**
 * One row of the phone drawer.
 *
 * Its own component because the element the row is built from depends on where
 * the row goes, and the choice cannot be made inside the `map` without either
 * repeating the whole body or handing `Link` an `as` prop it does not have. A
 * row naming a page on this site is a route; a row naming the other site is an
 * anchor, because the two are separate deployments on separate origins and the
 * router has no way across. Same tab, and no external-link arrow beyond the one
 * every row already carries: it is the same company, not somewhere else.
 *
 * The mark is guarded rather than assumed. Every studio row carries one and a
 * cross-site row has no glyph of its own to carry, and an unguarded
 * `<entry.mark />` on a row without one takes the whole drawer down.
 */
function DrawerRow({ entry, active, onNavigate }) {
  const Row = entry.href ? 'a' : Link
  const link = entry.href
    ? { href: entry.href }
    : { to: entry.to, 'aria-current': active ? 'page' : undefined }

  return (
    <Row className="drawer-link" {...link} onClick={onNavigate}>
      <span className="flex items-center gap-4 text-left">
        {entry.mark ? <entry.mark className="h-6 w-6 shrink-0 text-ink-mute" /> : null}
        <span className="text-[20px] font-semibold tracking-tight">{entry.label}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint" />
    </Row>
  )
}

export default function Navigation() {
  const location = useLocation()
  const { resolved } = useTheme()
  const { signedIn, firstName, checking, signOut } = useSessionGlimpse()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [changing, setChanging] = useState(false)
  // One panel, owned here: the shell renders a single viewport and the open
  // group only swaps its content, so moving between triggers hands the open
  // state across instead of closing one panel and replaying another's
  // entrance.
  const [openGroup, setOpenGroup] = useState(null)
  const reducedMotion = useReducedMotion()
  const panelId = useId()
  const panelRef = useRef(null)
  const hoverTimer = useRef(0)
  const probeRef = useRef(null)
  const navRef = useRef(null)
  const toggleRef = useRef(null)
  const landed = useRef(false)
  const scrolled = useScrolledPast(SCROLL_SURFACE_THRESHOLD)
  const onDark = useOnDarkBackground(probeRef, [navRef])
  const toast = useToast()

  const openPanel = NAV_GROUPS.find(group => group.key === openGroup) || null

  const clearHover = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = 0
    }
  }

  useEffect(() => clearHover, [])

  const focusTrigger = key => document.querySelector(`[data-nav-trigger="${key}"]`)?.focus()

  const hoverOpen = key => {
    clearHover()
    if (openGroup) {
      setOpenGroup(key)
      return
    }
    hoverTimer.current = window.setTimeout(() => setOpenGroup(key), OPEN_DELAY_MS)
  }

  const hoverClose = () => {
    clearHover()
    hoverTimer.current = window.setTimeout(() => setOpenGroup(null), CLOSE_DELAY_MS)
  }

  const closePanel = () => {
    clearHover()
    setOpenGroup(null)
  }

  // Held still across renders: the menu's away-press and Escape listeners hang
  // off this, and a fresh function each render takes them down and puts them
  // back on every keystroke the bar sees.
  const closeAccount = useCallback(() => setAccountOpen(false), [])

  // The search stands over the whole page, so it takes the bar's own layers
  // down on the way up rather than opening a third thing on top of two.
  const openSearch = () => {
    clearHover()
    setOpenGroup(null)
    setMobileOpen(false)
    setAccountOpen(false)
    setSearchOpen(true)
  }

  useSearchShortcut(openSearch)

  // A press the site cannot answer is answered anyway.
  //
  // Failing quietly is right for the pieces that arrive on their own: nobody
  // asked for the wash behind the hero or the marks down the side, so nobody is
  // owed a sentence when one does not turn up. The search is the one piece of
  // chrome a reader reaches for on purpose, and the same silence there is a
  // control that swallowed a press - the panel opens for the length of the
  // fetch and closes again with nothing said, which reads as a button that does
  // not work rather than as a search that could not be fetched.
  //
  // It is also permanent, which is the part a reader could never guess. `lazy`
  // records a rejected module for the life of the document, so the second press
  // is not a second attempt: it is the first one's failure handed straight back.
  // Every press after that fails in the same frame and just as quietly, and the
  // search stays gone for as long as the page is open.
  //
  // What has actually happened is that a deploy replaced the file this document
  // was built to ask for, and only a newer document carries the new address. So
  // a fresh page is the entire recovery, and it is the reader's to make rather
  // than ours to take: reloading for them would throw away whatever they were
  // part-way through typing, over a panel they can have back in a second. The
  // notice names the one thing that works and then waits to be acted on.
  const reportSearchUnavailable = useCallback(() => {
    setSearchOpen(false)
    toast('Search needs a fresh copy of this page. Reload to open it.', 'error')
  }, [toast])

  const closeAndRefocus = () => {
    const key = openGroup
    closePanel()
    if (key) focusTrigger(key)
  }

  const openForKeyboard = key => {
    clearHover()
    setOpenGroup(key)
    // One frame, so the panel has rendered before focus moves into it.
    window.requestAnimationFrame(() => panelRef.current?.querySelector('a')?.focus())
  }

  const toggleGroup = key => {
    clearHover()
    setOpenGroup(current => (current === key ? null : key))
  }

  // A step along the bar takes any open panel with it, so arrowing across the
  // triggers reads the same as running a pointer along them.
  const stepTrigger = (key, delta) => {
    const at = NAV_GROUPS.findIndex(group => group.key === key)
    const next = NAV_GROUPS[(at + delta + NAV_GROUPS.length) % NAV_GROUPS.length]
    clearHover()
    if (openGroup) setOpenGroup(next.key)
    focusTrigger(next.key)
  }

  // A group and the account menu are two panels hanging off one bar, and a
  // reader who opens the second wants the first gone. Watching the group rather
  // than closing at each of the four places it can open means no route in ever
  // leaves both down.
  useEffect(() => {
    if (openGroup) setAccountOpen(false)
  }, [openGroup])

  // A URL change closes the layers, and marks the bar as standing over a page
  // that is being replaced. Sampling the ground here would read the page being
  // left, since the new one is not on screen yet; the reading is retaken when
  // the content arrives, which the layout says out loud through GROUND_CHANGE.
  //
  // The first run is the page the visit opened on, which is already painted and
  // is not replacing anything.
  useEffect(() => {
    setMobileOpen(false)
    setOpenGroup(null)
    setAccountOpen(false)
    setSearchOpen(false)
    if (!landed.current) {
      landed.current = true
      return undefined
    }
    setChanging(true)
    // The reading the bar acts on is the one taken when it stops standing on
    // its own surface, so it is retaken here rather than left as whatever was
    // sampled while the two pages were crossing.
    const settled = setTimeout(() => {
      setChanging(false)
      announceGroundChange()
    }, PAGE_CHANGE_MS)
    return () => clearTimeout(settled)
  }, [location.pathname])

  // The drawer holds the page still under it, and hands back the place it was
  // opened from. The root is what scrolls here, so it is the root that is held;
  // releasing it without putting the offset back drops the reader wherever the
  // clamp left them, which is a jump they did not ask for on the way out of a
  // menu. The restore is instant on purpose - the page is already where it was
  // and gliding there would animate a move that never happened.
  useEffect(() => {
    if (!mobileOpen) return undefined
    const held = window.scrollY
    const root = document.documentElement
    const heldOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = heldOverflow
      document.body.style.overflow = ''
      window.scrollTo({ top: held, behavior: 'instant' })
    }
  }, [mobileOpen])

  // Escape closes whichever layer is open, wherever focus sits - the panel's
  // own handler only hears it while focus is inside the shell. Focus goes back
  // to the control that opened the layer: the drawer is a dialog and always
  // hands it to the toggle, while the panel hands it to its trigger only when
  // focus was in the bar to begin with, so a press aimed at the page does not
  // pull it up here.
  useEffect(() => {
    if (!mobileOpen && !openGroup) return
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      const inBar = navRef.current?.contains(document.activeElement)
      setMobileOpen(false)
      setOpenGroup(null)
      if (mobileOpen) toggleRef.current?.focus()
      else if (openGroup && inBar) focusTrigger(openGroup)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, openGroup])

  // A surfaced shell stands on the page's own ground, so its ink follows the
  // setting; a transparent one stands on whatever section is behind it, which
  // is what the probe answers. Either way the bar names a dark ground when it
  // is on one, and the wordmark inverts with it.
  //
  // A page being replaced is the fourth reason to surface, and the one that is
  // not about the reader. Mid-change there is no settled ground to read: the
  // page leaving is fading out and the page arriving has not finished coming
  // up, so a bar sampling it takes ink for a ground that is on its way to being
  // something else. Standing on its own surface for the length of the change is
  // what keeps the wordmark and the links legible across it, whichever ground
  // it lands on.
  const surfaced = scrolled || openGroup !== null || accountOpen || mobileOpen || changing
  const onDarkGround = surfaced ? resolved === 'dark' : onDark

  const isActive = to => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))

  // A route may be listed in more than one group, since a page can be worth
  // reaching from more than one place, but only one trigger in the bar may
  // light for it. Lighting two says the reader is in two sections at once,
  // which is the bar reporting something that cannot be true.
  //
  // The group whose match is most specific owns the route, and where two match
  // the same path the one declared first owns it, so ownership follows the
  // order the bar reads in rather than the order a route happened to be added.
  const routesOf = group =>
    [group.feature?.to, ...group.columns.flatMap(column => column.items.map(entry => entry.to))]
      .filter(Boolean)
      .filter(isActive)

  const owner = NAV_GROUPS.reduce(
    (best, group) => {
      const depth = routesOf(group).reduce((longest, to) => Math.max(longest, to.length), 0)
      return depth > best.depth ? { group, depth } : best
    },
    { group: null, depth: 0 }
  ).group

  const groupActive = group => group === owner

  return (
    <>
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none fixed left-10 top-10 h-1 w-1"
      />

      <header
        ref={navRef}
        className="nav-arrive pointer-events-none fixed inset-x-0 top-0 z-[var(--z-nav)] flex justify-center"
      >
        <nav
          aria-label="Primary"
          data-ground={onDarkGround ? 'dark' : undefined}
          data-surfaced={surfaced}
          data-expanded={openGroup !== null ? 'true' : undefined}
          className="nav-shell pointer-events-auto"
          onPointerEnter={event => event.pointerType !== 'touch' && clearHover()}
          onPointerLeave={event => event.pointerType !== 'touch' && openGroup && hoverClose()}
        >
          <div className="nav-pad nav-row flex items-center justify-between gap-6">
            <Link
              to="/"
              aria-label="TaylorURL home"
              className="shrink-0 rounded-[var(--r-control)] py-1 opacity-100 transition-opacity duration-[var(--nav-duration)] ease-out-soft hover:opacity-80"
            >
              <Wordmark invert={onDarkGround} />
            </Link>

            {/* Grouped or not. A site with nine pages declares no groups, and
                the bar says its three destinations once each rather than
                standing three headings over them. Everything below the bar -
                the panel, the drawer, the search - is untouched by which of
                the two is drawn, because a group that does not exist opens
                nothing. */}
            <ul className="hidden flex-1 items-center justify-center gap-1 lg:flex">
              {NAV_GROUPS.length
                ? NAV_GROUPS.map(group => (
                    <NavTrigger
                      key={group.key}
                      group={group}
                      panelId={panelId}
                      open={openGroup === group.key}
                      active={groupActive(group)}
                      onHover={() => hoverOpen(group.key)}
                      onToggle={() => toggleGroup(group.key)}
                      onClose={closeAndRefocus}
                      onOpenForKeyboard={() => openForKeyboard(group.key)}
                      onStep={delta => stepTrigger(group.key, delta)}
                    />
                  ))
                : DRAWER_LINKS.map(entry => (
                    <NavBarLink
                      key={entry.to}
                      to={entry.to}
                      label={entry.label}
                      active={isActive(entry.to)}
                    />
                  ))}
            </ul>

            {/* The quiet controls travel as one ringed group, so the bar ends
                in a single loud action with one piece of furniture beside it
                rather than four things queueing for the same corner. */}
            <div className="hidden shrink-0 items-center gap-3 lg:flex">
              <NavUtility
                signedIn={signedIn}
                firstName={firstName}
                checking={checking}
                accountOpen={accountOpen}
                onAccountToggle={next => setAccountOpen(next)}
                onAccountClose={closeAccount}
                onSignOut={signOut}
                onOpenSearch={openSearch}
              />
              <Link
                to={START_LINK.to}
                className="btn btn-primary group h-[var(--control-h)] min-h-0 px-5 text-[14px]"
              >
                <span>{START_LINK.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-[var(--nav-duration)] ease-out-soft group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Search sits outside the drawer as well as inside it. The drawer
                covers the bar while it is open, so a way in that only existed
                in here would be a way in a reader has to open the menu to
                reach, which is the hunt the search is for. */}
            <div className="flex shrink-0 items-center gap-1 lg:hidden">
              <a
                href={COMPANY_PHONE_HREF}
                className="nav-toggle"
                aria-label={`Call ${COMPANY_PHONE}`}
              >
                <Phone className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </a>
              <NavSearchButton
                className="nav-toggle"
                labelClass="sr-only"
                markClass="h-5 w-5"
                onOpen={openSearch}
              />
              <button
                ref={toggleRef}
                className="nav-toggle"
                type="button"
                onClick={() => setMobileOpen(prev => !prev)}
                aria-label={mobileOpen ? 'Close the Menu' : 'Open the Menu'}
                aria-expanded={mobileOpen}
                aria-controls={mobileOpen ? 'site-menu' : undefined}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="hidden lg:block">
            <NavPanelViewport
              group={openPanel}
              panelId={panelId}
              panelRef={panelRef}
              isActive={isActive}
              onClose={closeAndRefocus}
              onCloseAll={closePanel}
            />
          </div>
        </nav>
      </header>

      {/* The page dims behind an open panel, so the shell reads as a layer
          over the page rather than as more bar. A press anywhere on it
          closes. */}
      {/* Mounted only while it is open, which is what keeps the index it
          carries out of the bundle every visitor is served. Nothing is shown
          while the chunk is on its way: the press that opens it is a keystroke,
          and a spinner that flashes for the length of one is more disturbance
          than the wait it reports. */}
      {/* The panel is a piece of the bar rather than the page under it, so a
          chunk it cannot fetch fails here instead of at the boundary above the
          routes -- which answers for a page by reloading the document, and had
          been reloading whatever the reader was in the middle of over a search
          they had not opened yet. Closing on the way out puts the bar back the
          way it was; the notice is what keeps that from reading as a press that
          did nothing. */}
      {searchOpen && (
        <QuietBoundary onFail={reportSearchUnavailable}>
          <Suspense fallback={null}>
            <SiteSearch onClose={() => setSearchOpen(false)} />
          </Suspense>
        </QuietBoundary>
      )}

      <AnimatePresence>
        {openPanel && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : NAV_DURATION, ease: NAV_EASE }}
            aria-hidden="true"
            className="scrim fixed inset-0 z-[var(--z-float)] hidden lg:block"
            onPointerDown={() => closePanel()}
          />
        )}
      </AnimatePresence>

      {/* The scrim and the drawer take an AnimatePresence each rather than
          sharing one over a fragment. A fragment is a child the presence cannot
          key, so neither half is ever removed once its exit has played, and a
          drawer left mounted off-screen is forty tab stops nobody can see.

          The scrim dismisses on press rather than on click: a drag that starts
          inside the drawer and ends out here would otherwise close the menu. */}
      <AnimatePresence>
        {mobileOpen && (
          <m.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : NAV_DURATION, ease: NAV_EASE }}
            aria-hidden="true"
            className="scrim fixed inset-0 z-[var(--z-scrim)] cursor-pointer touch-manipulation lg:hidden"
            onPointerDown={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <m.div
            key="drawer"
            initial={reducedMotion ? { opacity: 0 } : { transform: 'translateY(100%)' }}
            animate={reducedMotion ? { opacity: 1 } : { transform: 'translateY(0%)' }}
            exit={reducedMotion ? { opacity: 0 } : { transform: 'translateY(100%)' }}
            transition={{ duration: reducedMotion ? 0 : NAV_DRAWER_DURATION, ease: NAV_EASE }}
            id="site-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site Menu"
            /* The menu is the bar on a phone, and it is a dialog outside both
               the header and the nav, so nothing about where it sits says so.
               Named here because the number inside it is the one most likely to
               be tapped on the device most of this site is read on, and a tap
               reported from the wrong place is worse than one reported from
               nowhere: it reads as the assistant earning calls it never had. */
            data-call-place="nav"
            /* It rises from the bottom edge rather than dropping from the top,
               because that is the end of the screen a thumb reaches without the
               phone being re-gripped, and the rows nearest the thumb are the
               ones most readers want.

               Capped against the visible viewport rather than the layout one:
               on a phone the browser's own toolbar retracts, and the layout
               measure is taller than the screen while it is out, which puts the
               last rows of the menu under it. The cap is short enough that the
               bar stays uncovered, so the toggle that opened the sheet is still
               there to close it. */
            className="border-hair fixed inset-x-0 bottom-0 z-[var(--z-drawer)] flex max-h-[88dvh] flex-col overflow-y-auto overscroll-contain rounded-t-[var(--r-feature)] border-t bg-bg text-ink shadow-[var(--lift)] lg:hidden"
          >
            {/* The grabber, which is the whole of the sheet's head. A sheet
                that rises from the bottom leaves the bar standing above it, so
                the wordmark and the close are still on screen where they were:
                repeating them in here would be the second copy of each, and
                both would sit at the end of the screen furthest from the thumb.
                The bar is uncovered on purpose, and closing is its toggle, the
                scrim, or Escape. */}
            <div aria-hidden="true" className="flex shrink-0 justify-center pb-1 pt-3">
              <span className="h-1 w-9 rounded-full bg-[color:var(--ink-ghost)]" />
            </div>

            {/* Six indexes, one to a line, names alone.

                The bar's five groups stay the bar's: a panel of thirty-eight
                destinations is something a pointer browses and a thumb wades
                through. Every row here is a page that carries its own branch,
                so the rest of the site is one tap further in rather than gone,
                and the list is short enough that all six plus the account pair,
                the number and Start a Project land on screen without a scroll.
                The appearance setting sits below that fold, which is the right
                side of it: it is a thing a reader changes once.

                Search is not repeated in here. The sheet leaves the bar
                standing, and the bar already carries it. */}
            <div className="nav-pad flex flex-col py-2">
              {DRAWER_LINKS.map((entry, entryIndex) => (
                <m.div
                  key={entry.to ?? entry.href}
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' }
                  }
                  animate={{ opacity: 1, transform: 'translateY(0px)' }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : {
                          delay: 0.04 + entryIndex * 0.04,
                          duration: NAV_DURATION,
                          ease: NAV_EASE,
                        }
                  }
                >
                  {/* An anchor where the row points at the other site, for the
                      reason `NavBarLink` gives: two origins, one router, and it
                      cannot reach across. */}
                  <DrawerRow
                    entry={entry}
                    active={entry.to ? isActive(entry.to) : false}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </m.div>
              ))}
            </div>
            <div className="border-hair mt-auto border-t">
              <div className="nav-pad py-8">
                {/* Two equal outlined halves above the filled CTA: the same
                    three tiers the bar shows, stacked for a thumb.

                    The sheet is the bar on a phone, so it answers the same
                    question the cluster does: a site with no accounts offers
                    neither half, and the number and the enquiry stand on their
                    own. */}
                {HAS_ACCOUNTS && !checking && (
                  <div className={`mb-3 grid gap-3 ${signedIn ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {signedIn ? (
                      <>
                        <Link
                          className="drawer-account-button"
                          to="/console"
                          onClick={() => setMobileOpen(false)}
                        >
                          {firstName || 'Account'}
                        </Link>
                        <button
                          className="drawer-account-button"
                          type="button"
                          onClick={() => {
                            setMobileOpen(false)
                            signOut()
                          }}
                        >
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <Link
                        className="drawer-account-button"
                        to="/login"
                        onClick={() => setMobileOpen(false)}
                      >
                        Log In
                      </Link>
                    )}
                  </div>
                )}
                <a
                  className="btn btn-secondary mb-3 w-full"
                  href={COMPANY_PHONE_HREF}
                  onClick={() => setMobileOpen(false)}
                >
                  <Phone className="h-4 w-4" strokeWidth={1.5} />
                  <span>{COMPANY_PHONE}</span>
                </a>
                <Link
                  className="btn btn-primary group w-full"
                  to={START_LINK.to}
                  onClick={() => setMobileOpen(false)}
                >
                  <span>{START_LINK.label}</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-[var(--nav-duration)] ease-out-soft group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>

                {/* The setting, within reach of the bar. The other copy stands
                    at the foot of the page, and these pages run several
                    thousand pixels on a phone, so down there it is a setting a
                    reader has to scroll the whole site to change. The panel
                    frame rather than the bar's: this has a column of its own,
                    which is what lets the three states carry their words.

                    The drawer stays open on a press. It takes the ground the
                    setting chose, so it turns under the finger and says the
                    press landed without the reader closing it to find out. */}
                <div className="border-hair mt-8 border-t pt-6">
                  <p className="section-label-sm mb-3 text-ink-faint">Appearance</p>
                  <ThemePicker variant="panel" />
                </div>

                <p className="section-label-sm mt-8 text-center text-ink-faint">
                  {SITE.locationShort}
                </p>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
