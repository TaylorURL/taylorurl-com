import { useCallback, useEffect, useRef, useState } from 'react'
import { Globe } from 'lucide-react'
import { MAX_MS } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { portfolioPreviewSrc, portfolioScreenshotServiceUrl } from '@data/portfolio'
import { RETRY_WAITS_MS } from '@utils/retryImage'
import GlareHover from '@reactbits/GlareHover/GlareHover'

/**
 * The browser and phone frames a portfolio entry's captures are shown in.
 * Shared by the portfolio index and the case study pages so both frame a site
 * the same way and read from the same capture path.
 */

// The box each capture occupies, in the ratio its stage holds. Stated on the
// element as well as on the stage so the space is reserved from the markup
// alone, before any stylesheet has been read.
const PREVIEW_BOX = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
}

// How many times the site's own capture is asked for before the frame gives up
// on it. One more than the ladder below has rungs, so the first ask is the
// markup's and every rung after it is a retry - the ladder `lazyWithRetry`
// climbs for a chunk, spent here for the same reason: what
// these failures are is a request lost rather than a file gone. Leaving is not
// free either, which is what settles the number: the screenshot service renders
// on demand behind a ten-second wait, answers a two megabyte spinner while it
// works, and belongs to somebody else, so asking twice more for a thirty
// kilobyte file this site already serves is the cheaper thing to try by a wide
// margin.
const CAPTURE_ASKS = RETRY_WAITS_MS.length + 1

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
// empty stage for a few seconds on a connection that is already stalling, which
// is what the stage standing on its own is drawn for.
const captureWait = attempt => RETRY_WAITS_MS[attempt] ?? RETRY_WAITS_MS[RETRY_WAITS_MS.length - 1]

// Where a capture is looked for, in the order it is tried: the committed WebP,
// the committed WebP at an address the browser holds no answer for, and finally
// a live thum.io render of the site itself. Past the end the stage stands on its
// own, so a site whose capture is genuinely missing leaves an empty screen in
// the frame rather than the browser's broken-image mark.
//
// The addresses in the middle carry a number because an image that failed is
// recorded as failed against its URL - so re-using the `src` is not asking
// again, and the retry that reads as one in the source sends nothing. That is
// the fault `lazyWithRetry` was written for, one layer down. Measured against
// the built site with the capture refused and then served: before this, the
// frame made one request in twenty-five seconds and had gone to the screenshot
// service inside the first.
function previewSource(project, device, attempt, number) {
  if (attempt >= CAPTURE_ASKS) return portfolioScreenshotServiceUrl(project, device)
  const address = portfolioPreviewSrc(project, device)
  return attempt === 0 ? address : `${address}?retry=${number}`
}

// How many retry addresses this document has spent. Counted across the page
// rather than per frame, because the cache that makes a repeated address
// worthless is the document's: the home page's rail carries every project twice,
// and two frames retrying one capture at one address make a single request - the
// second is handed the first's answer, and a first that failed would send the
// copy on to the screenshot service without it having asked at all.
let spent = 0

// The stage keeps the site's own ground behind the image and fades the preview
// in once it arrives.
function PreviewImage({ project, device, priority, stageClassName }) {
  const [loaded, setLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // The number the address this frame is about to ask at carries, taken from the
  // document's count each time one is needed. A frame whose capture arrives -
  // which is nearly all of them, nearly all of the time - never takes one.
  const number = useRef(0)
  const waiting = useRef(null)

  // Past the screenshot service there is nothing left to ask, and the stage
  // stands on its own.
  const source =
    attempt > CAPTURE_ASKS ? null : previewSource(project, device, attempt, number.current)
  const box = PREVIEW_BOX[device]
  // The last rung is somebody else's service, and by the time the frame reaches
  // it the page has already settled what a missing capture looks like: the stage
  // standing on its own, which is this component working rather than broken.
  // `data-probe` is what the reporter in the page head reads to tell an ask from
  // a dependency - it holds the failure for the live console and files nothing -
  // and it is here for the same reason the console's favicon lookup carries it.
  // The rungs before this one are this site's own file, and the last of them
  // reports, so a capture that has genuinely gone missing still arrives as a
  // fault.
  const asking = attempt >= CAPTURE_ASKS

  // How many further asks at this site's own file the frame has after the one
  // it is making now. `data-retry` is the other half of the same reader: the
  // listener holds a failure from an element still carrying attempts and files
  // one from an element whose ladder is spent, which is how `retryImage` has
  // always marked the mark in the navigation bar. This ladder was the one that
  // never carried it, so each of its first two asks filed a fault of its own
  // for a capture the third ask was about to fetch - and the reader, who saw
  // the picture arrive 350ms late, met nothing at all.
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
  // empty stage past it.
  //
  // Rebuilt when the attempt changes and at no other time, which is exactly when
  // the image below is replaced - so the ref callback holding it is attached once
  // per attempt, and one lost capture is counted once.
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
  // that is waiting for an event already spent. The pages this frame appears on
  // are prerendered, so the fetch starts while the markup is being parsed and
  // every capture at the top of a page wins that race - which is why the effect
  // was two blank frames at the head of the portfolio and correct ones the
  // moment a row loaded late enough to be seen loading.
  //
  // The element itself is the only thing that still holds the answer, so it is
  // read at mount. `complete` with no width is the same race lost on the error
  // side, and it advances to the next source exactly as `onError` would have.
  // The callback is stable and the image is keyed on the source, so the read
  // happens once per source rather than on every render of the row - an inline
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

  return (
    <div className={`relative overflow-hidden bg-bg ${stageClassName}`}>
      {source && (
        <img
          key={attempt}
          ref={readSettledImage}
          src={source}
          {...(asking ? { 'data-probe': '' } : null)}
          {...(left > 0 ? { 'data-retry': String(left) } : null)}
          alt={`The ${project.name} website on a ${device === 'phone' ? 'phone' : 'desktop'}`}
          width={box.width}
          height={box.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={give}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ease-out-soft ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}

/**
 * @param {object} props
 * @param {object} props.project - Entry from `PORTFOLIO_PROJECTS`.
 * @param {number} [props.index] - Row position, shown as the frame's sheet
 *   number. Omitted where the frame stands alone.
 * @param {boolean} [props.priority] - Loads the capture eagerly.
 */
export function DesktopMockup({ project, index, priority = false }) {
  return (
    <GlareHover
      {...GROUNDS.sheet.attrs}
      width="100%"
      height="100%"
      background="transparent"
      borderColor="transparent"
      borderRadius="var(--device-window)"
      glareColor="var(--shine-sweep)"
      glareOpacity={0.28}
      glareAngle={-40}
      glareSize={260}
      transitionDuration={MAX_MS * 1000}
      // The frame is a picture of a site rather than a way into one, so the
      // pointer stays what it is over the rest of the page.
      className="border-hair-paper device-window !cursor-default overflow-hidden border bg-paper shadow-[var(--lift)]"
    >
      <div className="border-hair-paper flex items-center gap-1.5 border-b bg-paper px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-[color:var(--ink-ghost)]" />
        <span className="h-2 w-2 rounded-full bg-[color:var(--ink-ghost)]" />
        <span className="h-2 w-2 rounded-full bg-[color:var(--ink-ghost)]" />
        <div className="border-hair-paper text-paper-faint bg-surface-2 ml-3 flex flex-1 items-center gap-1.5 truncate rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.01em]">
          <Globe className="h-3 w-3" strokeWidth={1.75} />
          <span className="truncate">{project.displayUrl}</span>
        </div>
        {index !== undefined && (
          <span className="text-paper-faint section-label-sm hidden sm:inline">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
      </div>
      <PreviewImage
        project={project}
        device="desktop"
        priority={priority}
        stageClassName="aspect-[16/10] w-full"
      />
    </GlareHover>
  )
}

/**
 * @param {object} props
 * @param {object} props.project - Entry from `PORTFOLIO_PROJECTS`.
 * @param {boolean} [props.priority] - Loads the capture eagerly.
 */
export function PhoneMockup({ project, priority = false }) {
  return (
    // The shell stands on the page, so its edge and its lift belong there; the
    // screen inside it is the website, and takes the sheet.
    <div className="border-hair device-shell relative w-[200px] border bg-[color:var(--device-body)] p-[var(--device-bezel)] shadow-[var(--lift)] sm:w-[228px]">
      <div {...GROUNDS.sheet.attrs} className="device-screen relative overflow-hidden bg-bg">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[var(--z-raised)] flex justify-center pt-1.5">
          <span className="h-4 w-20 rounded-full bg-[color:var(--device-body)]" />
        </div>
        <PreviewImage
          project={project}
          device="phone"
          priority={priority}
          stageClassName="aspect-[390/844] w-full"
        />
      </div>
    </div>
  )
}
