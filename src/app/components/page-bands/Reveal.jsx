import { useEffect, useRef } from 'react'

/**
 * The one way a band on this page is allowed to arrive.
 *
 * What stood here before was two systems on the same elements. A reveal fired
 * when a block was a fraction below the fold, and a swell fired later, when its
 * middle crossed two thirds down the screen - so a card arrived, settled, and
 * then grew a second time for no reason a reader could connect to anything.
 * Both wrote `transform`, which is why every card and every step carried a
 * second nested element whose only job was to hold them apart. A system that
 * needs an extra div per instance to stop it colliding with itself is a system
 * saying so.
 *
 * This is the whole replacement: a band fades up once, on its own, and is never
 * touched again. There is no per-child API on purpose. A stagger is how the
 * last one sprawled from a section to a heading to each card to each span, and
 * nothing here can be handed an index or a delay.
 *
 * Three things it deliberately does not do.
 *
 * It is not driven by scroll position. Scroll cues it and nothing more, so the
 * fade runs on its own clock: a flick does not blow it through in two frames
 * and inching down does not leave it stalled half open. A value that is a
 * function of the wheel is a readout of the wheel.
 *
 * It does not move anything. The old reveal travelled sixteen pixels up, and
 * travel is what makes a column of bands read as the page assembling itself in
 * front of the reader rather than as the page already being there. Opacity
 * alone leaves the layout settled from the first frame, which also means no
 * band can shift what is under it as it arrives.
 *
 * It does nothing at all on a narrow viewport. One column means every band
 * arrives alone and fills the screen, so the fade is watched from start to
 * finish instead of being met on the way past - and it is watched again for
 * every band, the whole way down. The stylesheet drops it under `sm`.
 *
 * The hidden state lives in CSS behind `data-reveal` on the document, which the
 * inline script in `index.html` sets before the first paint. A visitor whose
 * bundle never arrives is served a page with nothing hidden on it, rather than
 * the blank column a baked-in `opacity: 0` leaves when the script that was
 * going to clear it does not run.
 */

/**
 * How far into the screen a band's top edge has to come before it is cued, as a
 * share of the window height taken off the bottom of the root.
 *
 * A tenth is barely over the fold. Cued there the fade has a moment to run
 * while the reader is still scrolling toward the band, so they arrive at
 * something that has finished rather than watching it finish. Cued earlier it
 * is over before anyone could see it, which is a reveal that costs frames and
 * shows nothing.
 */
const CUE = '0px 0px -10% 0px'

/** Every band waiting to be cued, watched by one observer rather than each its own. */
let watcher = null

function show(entries) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    entry.target.setAttribute('data-shown', '')
    // Shown once and spent. A band that faded back out on the way up would be
    // the page performing for a reader who is going back to re-read something.
    watcher.unobserve(entry.target)
  }
}

function watch(el) {
  if (typeof IntersectionObserver !== 'function') {
    el.setAttribute('data-shown', '')
    return () => {}
  }
  watcher ??= new IntersectionObserver(show, { rootMargin: CUE })
  watcher.observe(el)
  return () => watcher.unobserve(el)
}

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.className] Classes for the same element, so wrapping a
 *   band in this does not cost it a div.
 */
export default function Reveal({ children, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    // A band already on screen when the page opens has no arrival to animate:
    // it is the thing the reader is looking at. It is shown on the spot, which
    // also keeps the fade off the critical path of the first paint.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.setAttribute('data-shown', '')
      return undefined
    }
    return watch(el)
  }, [])

  return (
    <div ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </div>
  )
}
