import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import QuietBoundary from './QuietBoundary'
import { lazyWithRetry } from '@utils/lazyWithRetry'

// How many times a piece that failed is built again from scratch.
//
// One, because the second renewal is nearly all cost. A reader whose first move
// restores the piece never reaches it, and one whose first move fails again is
// not having a bad second - they are on a connection or against a chunk that a
// third pass will meet exactly as the second did. What the pass does reach is
// the ticket queue: every exhausted pass reports, and a chunk a deploy has
// genuinely taken away files one report per pass under a fingerprint of its
// own, because the address the report names carries the attempt number.
const DEFAULT_RENEWALS = 1

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
 * The moment to try is a page change. A reader who has moved is a reader who
 * has waited, on a page that has just paid for a fetch of its own, and it is
 * the one signal here that costs nothing when nothing has failed. A page that
 * loaded its chrome correctly never renews, never re-imports, and never runs
 * anything below the first line of this component.
 *
 * @param {{ load: () => Promise<{ default: React.ComponentType }>, renewals?: number }} props -
 *   `load` must be one function for the life of the page; a factory written
 *   inline at the call site is a new one on every render, and the piece would
 *   be built again on every navigation whether or not anything had failed.
 *   Everything else given here is handed to the piece itself.
 */
export default function LateChrome({ load, renewals = DEFAULT_RENEWALS, ...forwarded }) {
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

  useEffect(() => {
    if (gave === null || gave === pathname) return
    if (attempt >= renewals) return
    setGave(null)
    setAttempt(used => used + 1)
  }, [pathname, gave, attempt, renewals])

  return (
    <QuietBoundary key={attempt} onFail={failed}>
      <Suspense fallback={null}>
        <Component {...forwarded} />
      </Suspense>
    </QuietBoundary>
  )
}
