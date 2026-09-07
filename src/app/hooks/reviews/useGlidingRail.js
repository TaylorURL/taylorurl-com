import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/** How long the rail takes to travel from one stop to the next. */
const GLIDE_MS = 520

/** Ease in and out, so the rail leaves and arrives rather than jerking. */
const glideEase = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * A row that scrolls itself along, one stop at a time.
 *
 * It is a scroller rather than a slider: whatever is put on the rail is laid
 * out end to end in something that scrolls, and moving on is scrolling it. That
 * way a touch screen gets its own swipe for free, a trackpad gets the sideways
 * flick people already try on a row like this, and everything on it stays in
 * the document where a screen reader and a keyboard can still reach it. A
 * slider built out of transforms has to rebuild all three, and usually rebuilds
 * two.
 *
 * It stops moving while a pointer is over it, while anything inside it holds
 * focus, and entirely when the reader has asked for less motion. A row that
 * slides out from under somebody part way through a sentence is worse than a
 * row that never moved.
 *
 * Two rows on the home page ride this: the reviews themselves, and the ratings
 * each network publishes. They differ in what they carry, how long a stop
 * holds, and how a part-width item at the edge is counted, and in nothing else,
 * which is why the mechanism is here and not copied into both.
 *
 * @param {object} options
 * @param {number} options.count How many items stand on the rail.
 * @param {number} options.dwellMs How long a stop holds before the rail moves.
 * @param {'round' | 'floor'} [options.fit] How a part-width item at the right
 *   edge is counted. `round` treats a mostly-visible item as visible, which is
 *   what a row of equal cards that fills its width wants. `floor` counts only
 *   whole items, which is what a row narrower than one item wants, so the last
 *   stop never lands with an item cut in half.
 * @returns {{rail: object, at: number, abreast: number, lastStop: number,
 *   goTo: Function, step: Function, hold: object}} The ref to hang on the
 *   scrolling element, where the rail stands, and the handlers that hold it.
 */
export default function useGlidingRail({ count, dwellMs, fit = 'round' }) {
  const rail = useRef(null)
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  const stillness = useReducedMotion()

  // How many items stand in the rail at once, read off the laid-out widths
  // rather than from the breakpoint the CSS uses, so the two cannot disagree.
  const [abreast, setAbreast] = useState(1)
  useEffect(() => {
    const node = rail.current
    if (!node) return
    const measure = () => {
      const first = node.firstElementChild
      if (!first) return
      const each = first.getBoundingClientRect().width
      const across = each > 0 ? node.clientWidth / each : 1
      setAbreast(Math.max(1, fit === 'floor' ? Math.floor(across) : Math.round(across)))
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(node)
    return () => watch.disconnect()
  }, [fit])

  // The last item that can sit at the left edge with the rail still full.
  const lastStop = Math.max(0, count - abreast)

  // Raised while the rail is travelling under its own steam, and lowered once
  // it arrives. Without it the two effects fight: the travel reports every
  // frame of itself, the reader-scroll effect below reads those frames as the
  // reader moving the rail by hand, and it drags the marker back to the stop
  // the rail has only just left.
  const steering = useRef(false)
  const glide = useRef(0)

  // The rail is animated here rather than handed to `scrollTo({behavior:
  // 'smooth'})`, which does nothing at all inside a mandatory snap container in
  // some browsers: the call is accepted, the scroll position never moves, and
  // the rail sits on its first item looking like a carousel nobody wired up.
  // Writing `scrollLeft` per frame works everywhere. Snapping is lifted for the
  // length of the journey, because mandatory snap points are exactly what pull
  // an intermediate frame back to where it came from.
  const travelTo = useCallback(
    (index, instant) => {
      const node = rail.current
      const target = node?.children[index]
      if (!node || !target) return
      cancelAnimationFrame(glide.current)
      const to = target.offsetLeft - node.offsetLeft
      const from = node.scrollLeft
      steering.current = true

      const land = () => {
        node.style.scrollSnapType = ''
        node.scrollLeft = to
        steering.current = false
        glide.current = 0
      }

      if (instant || stillness || from === to) {
        land()
        return
      }

      node.style.scrollSnapType = 'none'
      const began = performance.now()
      const step = now => {
        const through = Math.min(1, (now - began) / GLIDE_MS)
        node.scrollLeft = from + (to - from) * glideEase(through)
        if (through < 1) glide.current = requestAnimationFrame(step)
        else land()
      }
      glide.current = requestAnimationFrame(step)
    },
    [stillness]
  )

  useEffect(() => () => cancelAnimationFrame(glide.current), [])

  // Where the rail stands, as a value the timer can read without being rebuilt
  // every time it moves. Moving the rail from inside a state updater instead
  // would run the travel twice in development, where React calls an updater a
  // second time to prove it is pure.
  const standing = useRef(0)
  useEffect(() => {
    standing.current = at
  }, [at])

  useEffect(() => {
    if (stillness || held || lastStop < 1) return undefined
    const timer = setInterval(() => {
      const next = standing.current >= lastStop ? 0 : standing.current + 1
      setAt(next)
      travelTo(next)
    }, dwellMs)
    return () => clearInterval(timer)
  }, [stillness, held, lastStop, dwellMs, travelTo])

  // A reader who scrolls the rail by hand moves the marker with it, so the dots
  // never claim a stop the rail is not showing.
  useEffect(() => {
    const node = rail.current
    if (!node) return undefined
    let frame = 0
    const read = () => {
      frame = 0
      if (steering.current) return
      const first = node.firstElementChild
      const each = first?.getBoundingClientRect().width
      if (!each) return
      const gap = parseFloat(getComputedStyle(node).columnGap || '0') || 0
      setAt(Math.min(lastStop, Math.max(0, Math.round(node.scrollLeft / (each + gap)))))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      node.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [lastStop])

  // A rail that grew an item while it sat at the far end would be scrolled past
  // its own last stop, so the marker and the rail are both brought back.
  useEffect(() => {
    if (at > lastStop) {
      setAt(lastStop)
      travelTo(lastStop, true)
    }
  }, [at, lastStop, travelTo])

  const goTo = useCallback(
    index => {
      setAt(index)
      travelTo(index)
    },
    [travelTo]
  )

  const step = useCallback(
    by => goTo(Math.min(lastStop, Math.max(0, standing.current + by))),
    [goTo, lastStop]
  )

  const hold = {
    onMouseEnter: () => setHeld(true),
    onMouseLeave: () => setHeld(false),
    onFocusCapture: () => setHeld(true),
    onBlurCapture: () => setHeld(false),
  }

  return { rail, at, abreast, lastStop, goTo, step, hold }
}
