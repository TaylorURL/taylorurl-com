import { useEffect, useRef } from 'react'

/**
 * How an element on the home page arrives.
 *
 * Every heading, card, step and panel below the hero is drawn hidden, and is
 * shown the first time it comes onto the screen: a short fade and the same
 * fourteen pixels of rise the page itself arrives with, so a reader scrolling
 * down meets each thing as it becomes the thing to look at, rather than finding
 * a whole band already standing there.
 *
 * The unit is the element and not the band. A band shown all at once is a
 * screen of content landing together, and on a phone it was a screen the
 * reader watched fade rather than met, which is why the band arrival stood
 * down under `sm`. An element is small enough to arrive as it is reached, so
 * this runs at every width.
 *
 * Whatever comes onto the screen in the same frame is set off in the order it
 * stands on the page: two cards in a row, the three steps of the process, a
 * heading and the sentence beside it. The stagger is worked out here from what
 * actually arrived together and is never handed in as a prop, which is how the
 * system before the last one sprawled from a section to a heading to each card
 * to each span. There is no per-child API on purpose.
 *
 * Scroll cues the arrival and nothing more, so it runs on its own clock: a
 * flick does not blow it through in two frames and inching down does not leave
 * it stalled half open. A value that is a function of the wheel is a readout of
 * the wheel.
 *
 * Shown once and spent. An element that went back out on the way up would be
 * the page performing for a reader who is going back to re-read something.
 *
 * The hidden state lives in CSS behind `data-reveal` on the document, which the
 * inline script in `index.html` sets before the first paint. A visitor whose
 * bundle never arrives is served a page with nothing hidden on it, rather than
 * the blank column a baked-in `opacity: 0` leaves when the script that was
 * going to clear it does not run. The motion itself is the stylesheet's, under
 * THE ARRIVAL in `index.css`; this file decides when it runs.
 */

/**
 * How far into the screen an element's top edge has to come before it is cued,
 * as a share of the window height taken off the bottom of the root.
 *
 * A tenth is barely over the fold. Cued there the arrival has a moment to run
 * while the reader is still scrolling toward the element, so they arrive at
 * something that has finished rather than watching it finish. Cued earlier it
 * is over before anyone could see it, which is an arrival that costs frames and
 * shows nothing.
 */
const CUE = '0px 0px -10% 0px'

/**
 * How far apart two elements arriving in the same frame are set off, and the
 * most steps any one of them waits.
 *
 * The step is the page arrival's own, so a row of cards coming up under a
 * scroll and a column of sections coming up under a page change move to one
 * rhythm. The cap is for a flick that lands a whole band in one frame: the
 * fifth element waits as long as the fourth, rather than the last one sitting
 * invisible on a screen the reader has already reached.
 */
const STEP_MS = 60
const STEP_CAP = 4

/** Every element waiting to be cued, watched by one observer rather than each its own. */
let watcher = null

/**
 * Where an entry stands on the page, top edge first and then left edge, so a
 * batch is set off in reading order whatever order the observer handed it over
 * in.
 */
function byPlace(a, b) {
  return (
    a.boundingClientRect.top - b.boundingClientRect.top ||
    a.boundingClientRect.left - b.boundingClientRect.left
  )
}

function arrive(entries) {
  const arriving = entries.filter(entry => entry.isIntersecting).sort(byPlace)
  arriving.forEach((entry, i) => {
    const el = entry.target
    el.style.setProperty('--reveal-delay', `${Math.min(i, STEP_CAP) * STEP_MS}ms`)
    el.setAttribute('data-shown', 'arriving')
    watcher.unobserve(el)
  })
}

function watch(el) {
  if (typeof IntersectionObserver !== 'function') {
    el.setAttribute('data-shown', '')
    return () => {}
  }
  watcher ??= new IntersectionObserver(arrive, { rootMargin: CUE })
  watcher.observe(el)
  return () => watcher.unobserve(el)
}

/**
 * @param {object} props
 * @param {string} [props.as] The element itself - an `article` for a card, an
 *   `li` for a step, an `h2` for a heading - so arriving never costs an element
 *   a wrapper, and a grid never has to be told about one.
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.className] Classes for the same element.
 */
export default function Reveal({ as: Tag = 'div', children, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    // An element already on screen when the page opens has no arrival to
    // animate: it is the thing the reader is looking at. It is shown on the
    // spot, which also keeps the arrival off the critical path of the first
    // paint.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.setAttribute('data-shown', '')
      return undefined
    }
    return watch(el)
  }, [])

  return (
    <Tag ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </Tag>
  )
}
