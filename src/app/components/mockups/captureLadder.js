import { useCallback, useEffect, useRef, useState } from 'react'
import { portfolioPreviewSrc, portfolioScreenshotServiceUrl } from '@data/portfolio'
import { RETRY_WAITS_MS } from '@utils/retryImage'

/**
 * The ladder every client capture on this site is asked for down.
 *
 * There are two places a capture is drawn - the device frames in
 * `DevicePreview` and the flat card frames `PortfolioPreview` fills - and for a
 * long time they were two different answers to the same question. The frames
 * climbed a ladder, marked the rungs they were still on, and treated the
 * screenshot service past the end of it as somebody else's; the card asked
 * once, fell straight through to the service, and marked nothing. So the fix
 * that stopped a dropped capture being filed as a fault a reader met reached
 * one of them and not the other, and the industry, area and case study pages
 * went on filing a report from every rung. #842, #843 and #844 were three of
 * those from one page view.
 *
 * The ladder lives here now, so the two frames cannot drift apart again: what a
 * lost capture is, how long it is worth waiting out, and which rung a reader
 * actually met are one decision for both.
 */

// How many times the site's own capture is asked for before a frame gives up on
// it. One more than the wait list has rungs, so the first ask is the markup's
// and every rung after it is a retry - the ladder `lazyWithRetry` climbs for a
// chunk, spent here for the same reason: what these failures are is a request
// lost rather than a file gone. Leaving is not free either, which is what
// settles the number: the screenshot service renders on demand behind a
// ten-second wait, answers a two megabyte spinner while it works, and belongs
// to somebody else, so asking twice more for a thirty kilobyte file this site
// already serves is the cheaper thing to try by a wide margin.
export const CAPTURE_ASKS = RETRY_WAITS_MS.length + 1

// Between the asks, widening, and taken from the ladder in `retryImage` rather
// than named again here. The frames climb their own ladder because they have a
// screenshot service past the end of it and a count shared across the page, but
// the waits are not theirs to choose: what a lost capture is and what a lost
// mark is are the same lost request, and the question of how long to wait out a
// stall was measured once.
//
// These were 350ms and then 700ms, which is a ladder that finishes inside the
// first 1.05 seconds. The outages these failures actually are - an edge without
// the new build, a phone changing networks, a proxy refusing for a moment - run
// two or three seconds, so all three asks were spent inside the one stall that
// took the first, the frame reported a file that was present and answering the
// whole time, and the reader was sent on to a two megabyte third-party render
// behind a ten-second wait. #737 was that. Waiting the long rung out costs an
// empty frame for a few seconds on a connection that is already stalling, which
// is what the frame's own ground is there for.
const captureWait = attempt => RETRY_WAITS_MS[attempt] ?? RETRY_WAITS_MS[RETRY_WAITS_MS.length - 1]

// How many retry addresses this document has spent. Counted across the page
// rather than per frame, because the cache that makes a repeated address
// worthless is the document's: the home page's rail carries every project
// twice, and two frames retrying one capture at one address make a single
// request - the second is handed the first's answer, and a first that failed
// would send the copy on to the screenshot service without it having asked at
// all.
let spent = 0

/**
 * Where a capture is looked for, in the order it is tried: the committed WebP,
 * the committed WebP at an address the browser holds no answer for, and finally
 * a live thum.io render of the site itself.
 *
 * The addresses in the middle carry a number because an image that failed is
 * recorded as failed against its URL - so re-using the `src` is not asking
 * again, and the retry that reads as one in the source sends nothing. That is
 * the fault `lazyWithRetry` was written for, one layer down. Measured against
 * the built site with the capture refused and then served: before this, the
 * frame made one request in twenty-five seconds and had gone to the screenshot
 * service inside the first.
 *
 * @param {object} project Entry from `@data/portfolio`.
 * @param {'desktop' | 'phone'} device Which capture.
 * @param {number} attempt Which rung, counting the markup's ask as nought.
 * @param {number} number The document's retry count this rung was handed.
 * @returns {string} The address to ask at.
 */
export function captureSource(project, device, attempt, number) {
  if (attempt >= CAPTURE_ASKS) return portfolioScreenshotServiceUrl(project, device)
  const address = portfolioPreviewSrc(project, device)
  return attempt === 0 ? address : `${address}?retry=${number}`
}

/**
 * One frame's place on the ladder, and the props the picture in it carries.
 *
 * @param {object} project Entry from `@data/portfolio`.
 * @param {'desktop' | 'phone'} device Which capture the frame shows.
 * @returns {{
 *   attempt: number,
 *   source: string | null,
 *   loaded: boolean,
 *   image: object,
 * }} `source` is null once there is nothing left to ask for, which is where a
 *   frame draws its own answer instead. `image` is spread onto the `<img>`, and
 *   the caller keys the element on `attempt`.
 */
export function useCaptureLadder(project, device) {
  const [loaded, setLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // The number the address this frame is about to ask at carries, taken from
  // the document's count each time one is needed. A frame whose capture arrives
  // - which is nearly all of them, nearly all of the time - never takes one.
  const number = useRef(0)
  const waiting = useRef(null)

  // Past the screenshot service there is nothing left to ask.
  const source =
    attempt > CAPTURE_ASKS ? null : captureSource(project, device, attempt, number.current)

  // The last rung is somebody else's service, and by the time a frame reaches
  // it the page has already settled what a missing capture looks like: the
  // frame's own answer, drawn, which is these components working rather than
  // broken. `data-probe` is what the reporter in the page head reads to tell an
  // ask from a dependency - it holds the failure for the live console and files
  // nothing - and it is here for the same reason the console's favicon lookup
  // carries it. The rungs before this one are this site's own file, and the
  // last of them reports, so a capture that has genuinely gone missing still
  // arrives as a fault.
  const asking = attempt >= CAPTURE_ASKS

  // How many further asks at this site's own file the frame has after the one
  // it is making now. `data-retry` is the other half of the same reader: the
  // listener holds a failure from an element still carrying attempts and files
  // one from an element whose ladder is spent, which is how `retryImage` has
  // always marked the mark in the navigation bar.
  //
  // Dropped before the last ask at the site's own file rather than after it,
  // for the reason `retryImage` drops it there: the rung with nothing after it
  // has to look like a dependency, or a capture that is genuinely gone is held
  // on every rung and reports nothing. That rung asks at the built address
  // carrying a `retry` marker, which `settled()` strips, so a real loss still
  // files under the address the build wrote.
  const left = asking ? 0 : CAPTURE_ASKS - 1 - attempt

  useEffect(() => () => clearTimeout(waiting.current), [])

  // What a frame does with a capture that did not arrive. While there are asks
  // left on the site's own file it waits and asks again, longer each time.
  // Once there are not, it moves on with no wait at all: the screenshot service
  // is the next thing to try rather than the same thing again, and so is the
  // frame's own answer past it.
  //
  // Rebuilt when the attempt changes and at no other time, which is exactly
  // when the image is replaced - so the ref callback holding it is attached
  // once per attempt, and one lost capture is counted once.
  const give = useCallback(() => {
    if (attempt >= CAPTURE_ASKS - 1) {
      setAttempt(attempt + 1)
      return
    }
    spent += 1
    number.current = spent
    waiting.current = setTimeout(() => setAttempt(attempt + 1), captureWait(attempt))
  }, [attempt])

  // A capture that finished before React attached its handlers fired its load
  // event into nothing, and `onLoad` alone can never learn that it did: the
  // image sits decoded, complete and permanently transparent behind an opacity
  // that is waiting for an event already spent. The pages these frames appear
  // on are prerendered, so the fetch starts while the markup is being parsed
  // and every capture at the top of a page wins that race - which is why the
  // effect was two blank frames at the head of the portfolio and correct ones
  // the moment a row loaded late enough to be seen loading.
  //
  // The element itself is the only thing that still holds the answer, so it is
  // read at mount. `complete` with no width is the same race lost on the error
  // side, and it advances to the next source exactly as `onError` would have -
  // which is the only thing that can, because the error event for that failure
  // was fired before any handler of ours existed. A card that asked once and
  // waited for `onError` to tell it to fall back never fell back at all.
  //
  // The callback is stable and the image is keyed on the attempt, so the read
  // happens once per rung rather than on every render of the row - an inline
  // ref re-runs on each one, and the error branch would then count a single
  // failed capture more than once.
  const readSettledImage = useCallback(
    node => {
      if (!node || !node.complete) return
      if (node.naturalWidth > 0) setLoaded(true)
      else give()
    },
    [give]
  )

  return {
    attempt,
    source,
    loaded,
    image: {
      ref: readSettledImage,
      src: source,
      ...(asking ? { 'data-probe': '' } : null),
      ...(left > 0 ? { 'data-retry': String(left) } : null),
      decoding: 'async',
      onLoad: () => setLoaded(true),
      onError: give,
    },
  }
}
