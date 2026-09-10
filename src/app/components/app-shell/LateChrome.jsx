import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import QuietBoundary from './QuietBoundary'
import { lazyWithRetry } from '@utils/lazyWithRetry'

// How many times a piece that failed is built again from scratch on a move.
//
// One, because the second move is nearly all cost. A reader whose first move
// restores the piece never reaches it, and one whose first move fails again is
// not having a bad second - they are on a connection or against a chunk that a
// third pass will meet exactly as the second did.
const DEFAULT_RENEWALS = 1

// And how many times it is built again for a reader who does not move at all.
//
// A move was the only signal here, and it is a signal the reader owes the page
// rather than one the page can wait for. Everything under this component asks
// for its chunk three times inside eleven hundred milliseconds and then stops,
// so a page that could not reach the site for the two or three seconds these
// faults actually last has spent the whole recovery inside the outage - and a
// reader who then stays where they are keeps a page with a piece missing off
// it, for as long as they stay, against a file that started answering again
// seconds after they lost it. Measured against the built site with the chunk
// refused for three seconds and served from then on: three attempts, the last
// at 1,069ms, and the assistant still absent twenty-six seconds later with the
// file answering the whole time and nothing ever asking for it again.
//
// So the piece is offered again on a wait as well, and the two are counted
// apart. Sharing one budget would mean an outage lasting half a minute spends
// its renewal on a timer that fires inside the first ten seconds, and the
// reader who does go somewhere - the one case that already worked - arrives
// with nothing left to spend.
const DEFAULT_WAITS = 1

// How long after giving up. Long enough to be on the other side of what these
// outages measure, short enough that a reader who came to the page for the
// assistant is still on it.
const WAIT_MS = 5000

/**
 * A piece of chrome that arrives on its own, and is allowed to arrive late.
 *
 * `QuietBoundary` settled what a failure costs the reader: nothing, because the
 * piece leaves rather than taking the page with it. What it did not settle is
 * how long it stays gone, and the answer was the rest of the visit. The
 * boundary holds `failed` for its lifetime, the layout under it is not rebuilt
 * by a navigation, and so one bad second at load removed the assistant from
 * every page the reader went on to open - measured against the built site, with
 * the chunk refused for six seconds and then served normally: the launcher was
 * absent on arrival and still absent after two navigations made well after the
 * file had come back, and the app never asked for it a second time.
 *
 * Asking again is the whole of this component, and there are two records of the
 * failure standing between it and a request. `React.lazy` keeps one on the
 * component, and re-throws it forever, so resetting the boundary alone resets
 * straight back into it - which is why a renewal builds a new lazy component
 * from the same factory and keys the boundary to it. The browser's module map
 * keeps the other, against every address already tried, which is the fault
 * `lazyWithRetry` was written for and which reaches one address further than it
 * looked: a second pass numbering its attempts from one asks at addresses the
 * first pass has already spoiled. Measured with the chunk refused and then
 * served, that pass reported a fresh failure without putting a single request
 * on the wire. So the failure travels with the renewal, and `lazyWithRetry`
 * carries on from the address it names rather than starting over at one it
 * already knows the answer to.
 *
 * One moment to try is a page change. A reader who has moved is a reader who
 * has waited, on a page that has just paid for a fetch of its own, and it is
 * the one signal here that costs nothing when nothing has failed. A page that
 * loaded its chrome correctly never renews, never re-imports, and never runs
 * anything below the first line of this component.
 *
 * The other is a wait, and it is there because the first one is a move the
 * reader may never make. A page change was the whole of the answer, and it left
 * the reader who stays exactly where the boundary put them: the assistant asks
 * three times inside eleven hundred milliseconds, a connection that dropped for
 * three seconds refuses all three, and the corner is then empty for the rest of
 * a page nobody leaves - against a file that has been answering since a second
 * after they lost it. So a piece that gave up where the reader still is is
 * offered again five seconds later, on a budget of its own.
 *
 * Neither can loop. A pass is spent when it starts rather than when it fails,
 * the two counts are held against the moves and the waits separately, and a
 * piece that has spent both stops asking for the life of the document.
 *
 * @param {{ load: () => Promise<{ default: React.ComponentType }>, renewals?: number, waits?: number, waitMs?: number }} props -
 *   `load` must be one function for the life of the page; a factory written
 *   inline at the call site is a new one on every render, and the piece would
 *   be built again on every navigation whether or not anything had failed.
 *   Everything else given here is handed to the piece itself.
 */
export default function LateChrome({
  load,
  renewals = DEFAULT_RENEWALS,
  waits = DEFAULT_WAITS,
  waitMs = WAIT_MS,
  ...forwarded
}) {
  const { pathname } = useLocation()
  const [attempt, setAttempt] = useState(0)
  // Which page the piece was last on when it gave up, and what it died of.
  // The page is held rather than a flag, because the renewal is owed to the
  // reader having moved and a flag cannot tell a move from the failure that had
  // just been recorded. The error is held because the next pass needs it: the
  // address it names is the one the module map is holding a rejection against,
  // and asking anywhere else means starting from it.
  const [gave, setGave] = useState(null)
  // Kept out of the render path, so that arriving at the next address is not
  // also a re-render of whatever the piece was decorating.
  const cause = useRef(null)

  // Built here rather than in a `useMemo`, which React is free to discard and
  // recompute - and recomputing this one is not a repeated calculation but a
  // second component, which would drop a widget the reader may have open and
  // fetch the chunk again to replace it.
  const built = useRef({ attempt: -1, Component: null })
  if (built.current.attempt !== attempt) {
    built.current = { attempt, Component: lazyWithRetry(load, { after: cause.current }) }
  }
  const Component = built.current.Component

  const failed = useCallback(
    error => {
      cause.current = error
      setGave(pathname)
    },
    [pathname]
  )

  // What each kind of renewal has spent. Held apart rather than counted off one
  // number, because they answer different failures: a move is the reader
  // telling the page that time has passed, and a wait is the page finding that
  // out for itself when they do not. One number would let whichever came first
  // take the other's, and the one that always comes first is the timer.
  //
  // In a ref because nothing on screen reads it, and because it has to be true
  // the moment a pass starts rather than a render later - a count that lags is
  // a count that lets a second timer arm behind the first.
  const spent = useRef({ moved: 0, waited: 0 })

  useEffect(() => {
    if (gave === null) return

    const renew = () => {
      setGave(null)
      setAttempt(used => used + 1)
    }

    // The reader has gone somewhere since the piece gave up.
    if (gave !== pathname) {
      if (spent.current.moved >= renewals) return
      spent.current.moved += 1
      renew()
      return
    }

    // They have not, so the page waits on their behalf. The timer is cleared by
    // this effect's own cleanup, which runs on the navigation that would have
    // renewed it anyway and on the unmount that ends the question - so a piece
    // that has already come back is never fetched a second time.
    if (spent.current.waited >= waits) return
    const timer = setTimeout(() => {
      spent.current.waited += 1
      renew()
    }, waitMs)
    return () => clearTimeout(timer)
  }, [pathname, gave, renewals, waits, waitMs])

  return (
    <QuietBoundary key={attempt} onFail={failed}>
      <Suspense fallback={null}>
        <Component {...forwarded} />
      </Suspense>
    </QuietBoundary>
  )
}
