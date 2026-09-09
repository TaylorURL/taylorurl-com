import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navigation from '../navigation/Navigation'
import PageTransition from './PageTransition'
import { DeferredWaiting } from '../app-shell/Waiting'
import Footer from './Footer'
import ScrollProgress from './ScrollProgress'
import BackToTop from './BackToTop'
import { matchViewKeys } from '@constants/routes'
import { announceGroundChange } from '@hooks/theme/useOnDarkBackground'
import { recordCall, recordPageView } from '@data/leads/conversion'
import { counted } from '../../views/analytics/lib/counted.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

const SectionIndicator = lazy(() => import('./SectionIndicator'))

// Whether there is an assistant to mount.
//
// The widget asks `/api/live-chat` whether one is answering before it draws
// anything, and on the subsidiary that endpoint is not in the `apiAllowlist`, so
// the probe 404s and the widget correctly draws nothing. The degradation is
// right; the request is still waste - one 404 on every page load, on every page,
// for an answer the build already knows. Asked here rather than inside the
// widget so the question is settled before anything is fetched.
const HAS_ASSISTANT = !IS_SECOND_SITE

// The assistant reaches every marketing page, so it is the one piece of chrome
// that would otherwise sit in the first bundle for the sake of a corner nobody
// has pressed yet. It arrives on its own.
//
// Held behind the answer above rather than beside it, so the build with no
// assistant carries no reference to the chunk at all: the constant folds, the
// import is unreachable, and the widget leaves the deployment rather than
// sitting in it waiting to be asked for.
const LiveChat = HAS_ASSISTANT ? lazy(() => import('./LiveChat')) : null

/**
 * Tells the fixed chrome that the ground under it has been replaced.
 *
 * The bar picks its ink by sampling whatever sits behind it, and a page change
 * swaps that out from under it. It sits inside the page's own transition and
 * inside its suspense boundary, so it mounts at the one moment the answer has
 * actually changed: when a route's content is on the page. A timer set from the
 * URL change instead reads whichever page is still on screen, which is the
 * outgoing one for as long as the outgoing one takes to leave.
 *
 * The second reading is a frame later, for a section whose ground is settled by
 * a webfont or an image rather than by the markup that just landed.
 */
function GroundSignal() {
  useEffect(() => {
    announceGroundChange()
    const frame = requestAnimationFrame(announceGroundChange)
    return () => cancelAnimationFrame(frame)
  }, [])
  return null
}

/**
 * Which page the chrome treats a path as being on.
 *
 * A section that keeps its own chrome across several URLs is one page as far as
 * the transition and the arrival below are concerned: moving inside it must not
 * tear the chrome down, and must not throw the reader back to the top of a
 * column they are working their way down.
 *
 * Asked of the route table rather than of the text of the path, for the reason
 * given where the chrome is chosen below.
 *
 * @param {string} pathname
 */
function pageKeyFor(pathname) {
  return matchViewKeys(pathname).includes('Console') ? '/console' : pathname
}

/**
 * Which of the number's places a tap came from.
 *
 * Read off the landmark the anchor sits in rather than passed down to each one,
 * so a number added somewhere new is reported from the day it is added instead
 * of the day somebody remembers to label it. The names are the landmarks'
 * because that is what the answer is worth: a tap from the bar is a reader who
 * came to call, and a tap from the closing panel is one who read to the end
 * first, and the campaign that produced each is the thing being separated.
 */
function placeOf(link) {
  const named = link.closest('[data-call-place]')
  if (named) return named.dataset.callPlace
  if (link.closest('nav')) return 'nav'
  if (link.closest('footer')) return 'footer'
  if (link.closest('[role="dialog"]')) return 'chat'
  return 'page'
}

/**
 * Puts the reader at the top of the page they navigated to.
 *
 * This sits inside the route's own suspense boundary, next to the signal above,
 * because the two want the same moment: the one where the page navigated to is
 * on the screen. Hanging it on the end of the outgoing page's fade looked like
 * that moment and was not. A route's code is fetched when the route is reached,
 * a route still waiting on its chunk suspends, and the transition holds the
 * outgoing page until the incoming one has finished arriving - so a page whose
 * code had not been downloaded yet left the fade unfinished, and nothing that
 * waited on the end of it ever ran. A reader following a link out of the footer
 * kept the footer's scroll offset, which on the page they had asked for is a
 * screen with nothing on it.
 *
 * The path is read from the router rather than taken as a prop for the same
 * reason: while the transition is holding the outgoing page, the element around
 * this one is the one the outgoing page was rendered from, and its props are the
 * outgoing page's. Context is not frozen with them, which is how the outlet
 * beside this renders the new page at all.
 */
function Arrival({ onArrive }) {
  const { pathname } = useLocation()
  const page = pageKeyFor(pathname)
  useEffect(() => {
    onArrive(page)
  }, [page, onArrive])
  return null
}

export default function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  // The console carries its own chrome: a column of sections, a bar holding the
  // site and window pickers, and one region that scrolls. Putting the marketing
  // bar above it and the marketing footer below it would give a dashboard two
  // navigations and a page that scrolls in two places, which is what made it
  // read as a page with tables on it rather than as a dashboard.
  //
  // Which section a path belongs to is a question the route table answers, and
  // reading the text of the path instead answers a different one. A URL under
  // `/console` that names no window matches nothing there and falls to the
  // not-found view, which is a page like any other and wants the bar and the
  // footer - both so a reader who mistyped has something to press, and because
  // the document served for an unknown address is the not-found page built with
  // that chrome on it. A path test called it console, took the chrome back off,
  // and handed React a tree that did not describe the page it was adopting.
  const views = matchViewKeys(location.pathname)
  const isConsole = views.includes('Console')
  // The sign-in screens carry their own: a wordmark that goes home and a panel
  // saying what the account opens. The marketing bar over them puts a second
  // wordmark beside that one and offers a reader on the log-in page a link to
  // the log-in page.
  const isAuth = views.includes('Login') || views.includes('Signup')
  const bare = isConsole || isAuth
  const mainRef = useRef(null)

  // Whether the served page has been adopted. The two deferred pieces at the
  // foot of this file wait on it.
  //
  // Both show nothing while their chunk is on its way, so neither has anything
  // to contribute to the page a visitor is handed. Left ungated they contribute
  // something worse: an import held by name is resolved once per process, and
  // the prerender walks every route in one, so the first page built writes
  // nothing for them and every page built after it writes the whole thing. The
  // browser, opening any one page on its own, has resolved neither and shows
  // nothing - and markup the browser will not claim is markup the page it was
  // handed gets thrown out over.
  const [adopted, setAdopted] = useState(false)
  useEffect(() => setAdopted(true), [])

  // The pixel in the page head counts the page it was loaded on and nothing
  // after it, so every navigation from there is reported here. The key rather
  // than the path, so a page the reader lands on twice in a row is counted
  // twice, as Google's own count of history changes has it; and the last key
  // held rather than a first-run flag, so an effect run twice on one page
  // reports it once.
  const lastPage = useRef(location.key)
  useEffect(() => {
    if (lastPage.current === location.key) return
    lastPage.current = location.key
    recordPageView()
  }, [location.key])

  // A tap on the number, wherever the number is.
  //
  // It is the one answer this site asks for that leaves no trace behind it: a
  // form posts to an endpoint that can report what it accepted, and a call
  // hands the visitor to the dialer and the page never hears from them again.
  // Unreported, an ad that produces nothing but phone calls reads as an ad that
  // produces nothing.
  //
  // One listener on the document rather than a handler on each anchor, because
  // the number is rendered in the bar, the utility strip, the footer, the
  // assistant, the hero, the closing panel, the status page and the contact
  // page, and three of those are lazy. A handler per anchor is nine places to
  // remember and a tenth that gets added without one.
  //
  // On capture, because a tap on a `tel:` link on a phone hands the document to
  // the dialer, and a listener that waits its turn in the bubble is a listener
  // that may not get one.
  //
  // The console is exempt, and it has to be: the same layout is over it, it
  // shows a project's support number in four places, and the people reading it
  // have already bought. A tap there is the work being done rather than a lead,
  // and a client who arrived on an ad is inside that click's window for ninety
  // days - so the call action would book a second conversion against the click
  // that already paid for them, on an action expecting one or two events in a
  // month. The rule is not written again here. `counted` is the one the tracker
  // reads off the tag in the head, `check-traffic-ignore.js` holds the two
  // together, and its exception for the public status board is the same
  // exception this wants: that page is read by people who have bought nothing.
  useEffect(() => {
    const tapped = event => {
      const node = event.target
      const from = node?.nodeType === 1 ? node : node?.parentElement
      const link = from?.closest?.('a[href^="tel:"]')
      if (!link) return
      if (!counted(window.location.pathname)) return
      recordCall(placeOf(link))
    }
    document.addEventListener('click', tapped, true)
    return () => document.removeEventListener('click', tapped, true)
  }, [])

  // The console keeps its own chrome across every section under it, so all of
  // them are one page as far as this transition is concerned; the column and the
  // bar stay where they are and the work region does its own crossfade. Every
  // other URL is a page of its own.
  const routeKey = pageKeyFor(location.pathname)

  // Which page the reader has been put at the top of. The page the browser
  // handed us is not one of them: it may have been reloaded halfway down, and
  // where it sits belongs to the browser's own restoration rather than to this.
  // It is held here rather than in the component that calls it, which is torn
  // down and built again with every page.
  const arrivedAt = useRef(null)

  // Both of these move the page under whoever is reading it, so they wait until
  // the page being navigated to is actually on screen rather than firing the
  // moment the URL changes. Scrolling a page a reader is still looking at back
  // to the top is the jump the transition exists to remove, and moving focus
  // before the new content is there announces the page a reader has just left.
  const arrive = useCallback(page => {
    const landing = arrivedAt.current === null
    const again = arrivedAt.current === page
    arrivedAt.current = page
    if (landing || again) return
    // A link carrying a fragment is asking for a place on the page rather than
    // the top of it, so it is left where it is.
    if (window.location.hash) return
    window.scrollTo(0, 0)
    // Without this a reader on the keyboard or a screen reader is left wherever
    // the last page's focus was, usually a link in the navigation, and has to
    // tab back down through the chrome to reach what they navigated to.
    mainRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="min-h-dvh text-ink-paper">
      <a
        href="#main-content"
        className="sr-only transition-colors duration-200 ease-out-soft hover:bg-[color:var(--accent-fill-hi)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-skip)] focus:rounded-[var(--r-control)] focus:bg-[color:var(--accent-fill)] focus:px-4 focus:py-2.5 focus:text-[15px] focus:font-semibold focus:text-[color:var(--on-accent)] focus:shadow-[var(--raise)]"
      >
        Skip to Main Content
      </a>
      {!bare && <ScrollProgress />}
      {!bare && <Navigation />}
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <PageTransition routeKey={routeKey} className="page-arrive">
          {/* Each page waits inside its own transition rather than under one
              boundary above the chrome. A page whose code is still coming down
              then costs the page, not the bar and the footer with it, and the
              outgoing page still gets to leave first. */}
          <Suspense fallback={<DeferredWaiting />}>
            <GroundSignal />
            <Arrival onArrive={arrive} />
            <Outlet />
          </Suspense>
        </PageTransition>
      </main>
      {!bare && <Footer />}
      {!bare && <BackToTop />}
      {HAS_ASSISTANT && !bare && adopted && (
        <Suspense fallback={null}>
          <LiveChat startOpen={location.pathname === '/live'} />
        </Suspense>
      )}
      {isHome && adopted && (
        <Suspense fallback={null}>
          <SectionIndicator />
        </Suspense>
      )}
    </div>
  )
}
