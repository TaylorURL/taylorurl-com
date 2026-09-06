import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { m, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { ChevronsLeftRight, Search, Star } from 'lucide-react'

const START_PERCENT = 42
const KEY_STEP = 4
const MIN_PERCENT = 4
const MAX_PERCENT = 96

// The sweep the seam takes on its own, running the whole of its travel: each
// listing arrives whole before the seam turns back, so watching carries the
// comparison as far as dragging it does. One cosine over the period eases both
// turns, so the seam slows as it arrives and leaves without a visible stop at
// either end.
const SWEEP_PERIOD_MS = 11000

// Where on that cosine the seam already stands. The sweep picks up from the
// frame the prerendered page carries rather than snapping to the end of its own
// travel on the first animated frame.
const START_PHASE =
  Math.acos(1 - (2 * (START_PERCENT - MIN_PERCENT)) / (MAX_PERCENT - MIN_PERCENT)) / (Math.PI * 2)

const FINE_POINTER = '(hover: hover) and (pointer: fine)'

/**
 * Whether the page is being pointed at with something that can be held against
 * a spot on it.
 *
 * A finger taps and scrolls; it does not grip. Taking the seam over on the
 * first touch turns a swipe down the page into a drag across the plate, and
 * ends the sweep for a reader who was only passing the hero on their way down.
 * Where there is no such pointer the plate answers nothing and the comparison
 * plays itself.
 *
 * It answers false until it has measured, so a prerendered page carries no drag
 * and hydration is what adds one.
 */
function useFinePointer() {
  const [fine, setFine] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(FINE_POINTER)
    const sync = () => setFine(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return fine
}

/**
 * Whether the plate is somewhere a person could be watching it: on screen, in a
 * tab that is on top.
 *
 * On a phone the plate stands a screen below the headline, so a sweep that
 * starts on load runs its whole travel behind the reader's back and pays for
 * every frame of it out of the same thread the page is still arriving on. The
 * comparison is worth running for whoever is looking at it and worth nothing
 * otherwise.
 *
 * It answers false until it has measured, so the sweep starts when the plate is
 * reached rather than a frame before the observer has said anything.
 */
function useWatched(frameRef) {
  const [watched, setWatched] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined
    let onScreen = typeof IntersectionObserver !== 'function'
    const sync = () => setWatched(onScreen && !document.hidden)
    let observer = null
    if (!onScreen) {
      observer = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting
        sync()
      })
      observer.observe(frame)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      if (observer) observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [frameRef])

  return watched
}

/**
 * The sweep's own frame loop, which exists only while the sweep is running.
 *
 * A loop that keeps its place and returns early on the frames it has nothing to
 * do is still a loop the browser wakes sixty times a second for the length of a
 * visit. Mounting this is what starts the sweep and unmounting it is what stops
 * it, so a plate nobody is looking at costs no frames at all.
 */
function Sweep({ percent, phaseRef }) {
  useAnimationFrame((_, delta) => {
    phaseRef.current = (phaseRef.current + delta / SWEEP_PERIOD_MS) % 1
    const eased = (1 - Math.cos(phaseRef.current * Math.PI * 2)) / 2
    percent.set(MIN_PERCENT + eased * (MAX_PERCENT - MIN_PERCENT))
  })
  return null
}

/** A grey bar standing in for the copy a listing has no website to supply. */
function Blank({ w }) {
  return (
    <span
      className="block h-2.5 rounded bg-[color:var(--wash-paper-strong)]"
      style={{ width: w }}
    />
  )
}

/**
 * One search listing, in the two states a business can appear in. Both states
 * render the same rows at the same heights, so wiping between them moves the
 * listing through a single transformation rather than swapping two cards.
 *
 * Memoised because the seam moves through motion values rather than state: the
 * two listings mount once and the wipe runs over them without React touching
 * either again.
 *
 * Annotated pure because a bare call at the top of a module is a call the
 * bundler has to assume does something, and this one is the whole listing.
 * Without the annotation the second site - whose hero is not this one and whose
 * home page drops every presentation that mounts this plate - still shipped the
 * listing, the roofing company and the town it searches for, in a chunk nothing
 * on that site ever renders.
 *
 * @param {{ live: boolean }} props - `live` is the listing of a business that
 *   has a website; the other is the same business without one.
 */
const Listing = /*#__PURE__*/ memo(function Listing({ live }) {
  return (
    <div className="flex h-full flex-col gap-5 p-6 sm:p-8">
      <div className="border-hair flex items-center gap-3 rounded-full border bg-[color:var(--paper-field)] px-4 py-3">
        <Search className="text-paper-faint h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="truncate font-mono text-[12px] text-paper-soft">
          metal roofing baytown tx
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-5 w-5 flex-shrink-0 rounded ${live ? 'bg-accent' : 'bg-[color:var(--wash-paper-strong)]'}`}
            aria-hidden="true"
          />
          {live ? (
            <span className="text-paper-faint font-mono text-[11px]">yourroofingcompany.com</span>
          ) : (
            <Blank w="7rem" />
          )}
        </div>

        <p
          className={`text-[19px] font-semibold leading-snug ${live ? 'text-accent' : 'text-paper-mute'}`}
        >
          Your Roofing Company
        </p>

        <div className="flex h-4 items-center gap-2">
          {live ? (
            <>
              <span className="flex gap-0.5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map(i => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--warn-fill)', fill: 'var(--warn-fill)' }}
                  />
                ))}
              </span>
              <span className="text-paper-faint font-mono text-[11px]">4.9 · 127 reviews</span>
            </>
          ) : (
            <Blank w="4.5rem" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          {live ? (
            <p className="text-[14px] leading-relaxed text-paper-soft">
              Standing seam and R-panel roofing across Baytown, Mont Belvieu, and Highlands. Free
              estimates, work photographed on every job.
            </p>
          ) : (
            <>
              <Blank w="100%" />
              <Blank w="62%" />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-end justify-end gap-3">
        {live ? (
          <>
            <span className="flex gap-2" aria-hidden="true">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="border-hair h-12 w-14 rounded-md border bg-[color:var(--wash-accent)]"
                />
              ))}
            </span>
            <span className="rounded-md bg-[color:var(--accent-fill)] px-4 py-2.5 text-[13px] font-semibold text-[color:var(--on-accent)]">
              Visit Website
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
})

/**
 * The hero's figure: one local search listing split down the middle, with no
 * website on the left of the seam and a website on the right. The seam sweeps
 * end to end on its own so the comparison plays without being asked for, and
 * hands over to a mouse or a keyboard that reaches for it.
 */
export default function SearchSeamPlate() {
  const reduced = useReducedMotion()
  const fine = useFinePointer()
  const plateRef = useRef(null)
  const percent = useMotionValue(START_PERCENT)

  // The seam is a motion value rather than state: it moves every frame while it
  // sweeps, and driving that through React would re-render both listings sixty
  // times a second. `reading` is the throttled copy the slider reports, which is
  // the only part of the seam a screen reader has to follow.
  const [reading, setReading] = useState(START_PERCENT)
  const [held, setHeld] = useState(false)
  const [taken, setTaken] = useState(false)

  const watched = useWatched(plateRef)
  const sweeping = !reduced && !taken && !held && watched
  const phaseRef = useRef(START_PHASE)

  const clipPath = useTransform(percent, v => `inset(0 ${100 - v}% 0 0)`)
  const seamAt = useTransform(percent, v => `${v}%`)

  // The reported value follows the seam at four times a second while it sweeps,
  // and exactly while a person is moving it. Reporting every frame would give a
  // screen reader a number it can never finish saying, and polling one that is
  // standing still would be a render four times a second for a value that has
  // not changed, so the poll runs while the sweep does and settles on the seam's
  // own figure the moment it stops.
  useEffect(() => {
    if (!sweeping) {
      setReading(Math.round(percent.get()))
      return undefined
    }
    const id = setInterval(() => setReading(Math.round(percent.get())), 250)
    return () => clearInterval(id)
  }, [percent, sweeping])

  const clamp = value => Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value))

  const setSeam = useCallback(
    value => {
      const next = clamp(value)
      percent.set(next)
      setReading(Math.round(next))
    },
    [percent]
  )

  const moveTo = useCallback(
    clientX => {
      const rect = plateRef.current?.getBoundingClientRect()
      if (!rect) return
      setSeam(((clientX - rect.left) / rect.width) * 100)
    },
    [setSeam]
  )

  // Pointer capture keeps the drag alive once the pointer leaves the plate,
  // which is where a seam this close to an edge is usually released.
  const onPointerDown = event => {
    setTaken(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    moveTo(event.clientX)
  }

  const onPointerMove = event => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    moveTo(event.clientX)
  }

  const onKeyDown = event => {
    const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP, Home: -100, End: 100 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    setTaken(true)
    setSeam(percent.get() + step)
  }

  // Only a pointer that can be held against the plate takes the seam over, and
  // the resize cursor is only offered where there is a cursor to change. What
  // the keyboard reaches stays wired whatever is pointing at the page.
  const grip = fine
    ? {
        onPointerDown,
        onPointerMove,
        onPointerEnter: () => setHeld(true),
        onPointerLeave: () => setHeld(false),
      }
    : null

  return (
    // The sheet follows the reader's setting rather than pinning itself to
    // paper: under the dark one a white listing is the only lit rectangle on
    // the page, and the seam stops reading as a split in one surface. It fills
    // with the raised surface rather than the page ground, so the sheet still
    // stands off the section it sits on under either setting.
    <div
      ref={plateRef}
      {...grip}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      className={`card-lift relative h-[368px] w-full select-none overflow-hidden bg-[color:var(--surface-1)] sm:h-[404px] ${fine ? 'cursor-ew-resize' : 'cursor-default'}`}
    >
      {sweeping ? <Sweep percent={percent} phaseRef={phaseRef} /> : null}

      <div className="absolute inset-0">
        <Listing live />
      </div>

      <m.div
        className="absolute inset-0 bg-[color:var(--surface-1)]"
        style={{ clipPath }}
        aria-hidden="true"
      >
        <Listing live={false} />
      </m.div>

      {/* The seam and the handle ride a layer of their own rather than their own
          `left`. A percentage left is a position the browser has to place the
          element at again on every frame of an eleven-second sweep; the same
          distance as a transform is a layer moved once it has been drawn. The
          layer fills the plate, so the percentage it travels is a percentage of
          the width `left` was resolved against and the seam lands where it did. */}
      <m.div
        className="pointer-events-none absolute inset-0"
        style={{ x: seamAt, willChange: 'transform' }}
        aria-hidden="true"
      >
        <span className="absolute inset-y-0 left-0 w-px bg-accent" />
      </m.div>

      <m.div
        className="pointer-events-none absolute inset-0 z-[var(--z-raised)]"
        style={{ x: seamAt, willChange: 'transform' }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare a listing with no website to the same listing with one"
          aria-valuemin={MIN_PERCENT}
          aria-valuemax={MAX_PERCENT}
          aria-valuenow={reading}
          aria-valuetext={`${reading} percent showing the listing with no website`}
          onKeyDown={onKeyDown}
          className="pointer-events-auto absolute left-0 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-manipulation items-center justify-center rounded-full bg-[color:var(--accent-fill)] text-[color:var(--on-accent)] transition-colors duration-200 ease-out-soft hover:bg-[color:var(--accent-fill-hi)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] active:bg-[color:var(--accent-fill-hi)]"
        >
          <ChevronsLeftRight aria-hidden="true" className="h-4 w-4" />
        </div>
      </m.div>

      <span className="section-label-sm text-paper-mute pointer-events-none absolute bottom-4 left-6 sm:left-8">
        No Website
      </span>
      <span className="section-label-sm text-paper-mute pointer-events-none absolute bottom-4 right-6 sm:right-8">
        With a Website
      </span>
    </div>
  )
}
