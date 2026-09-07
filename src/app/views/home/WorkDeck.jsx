import { useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { DesktopMockup } from '@components/mockups/DevicePreview'
import useGlidingRail from '@hooks/reviews/useGlidingRail'

/**
 * The client sites on a rail that turns as it travels.
 *
 * It is a scroller, not a slider, for the reasons `useGlidingRail` is written
 * down: the frames are laid out end to end in something that actually scrolls,
 * so a phone gets its swipe, a trackpad gets its sideways flick, and every card
 * stays in the document where a screen reader and the tab key can reach it. A
 * carousel rebuilt out of transforms has to reimplement all three and usually
 * reimplements two.
 *
 * What is added here is only how a card looks on the way past. Each frame is
 * turned on its own vertical axis and pushed back by however far its middle
 * stands from the middle of the rail, so the one being read faces the reader
 * square and its neighbours are edging away on either side. That is the whole
 * of the depth: a real rotation under a real perspective, driven by a number
 * the rail already knows, rather than a second animation running beside the
 * scroll and drifting out of step with it.
 *
 * Nothing here animates on a timer. The transform is a function of scroll
 * position, so a frame dragged half way turns half way and stops there, and a
 * reader who never scrolls sees a still deck rather than a loop playing to
 * nobody.
 */

/** How long a frame holds at the front before the rail moves itself on. */
const DWELL_MS = 4600

/**
 * What a frame a full rail-width behind the front has done, relative to the one
 * at the front: degrees turned, pixels pushed back, and how far it has dimmed
 * toward the ground behind it.
 *
 * The turn is the load-bearing one and it is deliberately past subtle - these
 * are flat rectangles of screenshot, and a rectangle turned three degrees reads
 * as a rectangle drawn crooked. The push back is what keeps the turn from
 * looking like a shear, because it is the part that makes the far edge of a
 * turned frame genuinely further away.
 */
const TURN = 22
const DEPTH = 260
const DIM = 0.5

/**
 * How far the eye is from the rail.
 *
 * Carried in each frame's own transform rather than as a `perspective` on the
 * rail, because that property reaches an element's children and stops, and a
 * frame that later grows a wrapper would silently flatten.
 */
const PERSPECTIVE = 1400

export default function WorkDeck({ projects }) {
  const stillness = useReducedMotion()
  const { rail, at, lastStop, goTo, step, hold } = useGlidingRail({
    count: projects.length,
    dwellMs: DWELL_MS,
    fit: 'floor',
  })

  // Where each frame stands, written straight to the node. It changes with
  // every scrolled pixel, and a render per pixel would rebuild the rail under
  // the reader's finger.
  const paint = useCallback(() => {
    const node = rail.current
    if (!node) return
    const view = node.clientWidth
    if (view === 0) return
    const front = node.scrollLeft

    for (const item of node.children) {
      const frame = item.firstElementChild
      if (!frame) continue

      const veil = item.querySelector('[data-veil]')

      if (stillness) {
        frame.style.transform = ''
        if (veil) veil.style.opacity = '0'
        item.style.zIndex = ''
        continue
      }

      // Nought at the front of the rail, one a rail-width behind it, and
      // negative for a frame that has already gone by. The rail is anchored at
      // its left rather than its middle - that is where a stop lands and where
      // the reader is looking - so the frame at the front is the one that has
      // not turned at all, and everything else is angling away from it.
      const stands = item.offsetLeft - node.offsetLeft - front
      const off = Math.max(-1, Math.min(1, stands / view))
      const away = Math.abs(off)

      frame.style.transform =
        `perspective(${PERSPECTIVE}px) translateZ(${-(away * DEPTH).toFixed(1)}px) ` +
        `rotateY(${(-off * TURN).toFixed(2)}deg)`
      // A turned frame is shaded rather than faded. Dimming it with `opacity`
      // makes the screenshot translucent, and the drafting grid behind the band
      // then reads straight through a client's home page - which is a washed
      // out card rather than one standing further from the light.
      if (veil) veil.style.opacity = (away * DIM).toFixed(3)
      // The nearest frame has to be the one on top, or a turned neighbour laps
      // over the card the reader is looking at.
      item.style.zIndex = String(100 - Math.round(away * 100))
    }
  }, [rail, stillness])

  useEffect(() => {
    const node = rail.current
    if (!node) return undefined

    let frame = 0
    const settle = () => {
      frame = 0
      paint()
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(settle)
    }

    paint()
    node.addEventListener('scroll', onScroll, { passive: true })
    // The turn is measured off laid-out widths, so it is wrong for exactly as
    // long as it takes a capture to arrive and change one.
    const watch = new ResizeObserver(onScroll)
    watch.observe(node)
    for (const item of node.children) watch.observe(item)

    return () => {
      node.removeEventListener('scroll', onScroll)
      watch.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [rail, paint])

  return (
    <div
      className="flex flex-col gap-7"
      role="group"
      aria-roledescription="carousel"
      aria-label="Client sites this studio has built"
      {...hold}
    >
      <div
        ref={rail}
        className="work-deck flex snap-x snap-mandatory items-start gap-6 overflow-x-auto pb-14 pt-3 lg:gap-8"
      >
        {projects.map((project, index) => (
          <div
            key={project.slug}
            className="w-[clamp(258px,78vw,420px)] shrink-0 snap-start lg:w-[clamp(340px,32vw,460px)]"
          >
            <div className="relative origin-left transition-transform duration-200 ease-out-soft will-change-transform">
              <DesktopMockup project={project} index={index} priority={index === 0} />
              <span
                data-veil
                aria-hidden="true"
                className="device-window pointer-events-none absolute inset-0 bg-scrim opacity-0 transition-opacity duration-200 ease-out-soft"
              />
            </div>

            {/* The frame is a picture of a site rather than a way into one, so
                the way in is the caption under it, which is a name and not a
                screenshot with a cursor on it. */}
            <div className="mt-4 flex items-baseline justify-between gap-4">
              <Link
                to={`/portfolio/${project.slug}`}
                className="text-[15px] font-semibold text-ink-paper transition-colors duration-200 hover:text-[color:var(--accent-loud)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
              >
                {project.name}
              </Link>
              {project.location && (
                <span className="text-paper-faint section-label-sm shrink-0">
                  {project.location.replace(', Texas', ', TX')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* The controls only exist where there is somewhere to go. */}
      {lastStop > 0 && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={at === 0}
            aria-label="Previous site"
            className="review-rail-step"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: lastStop + 1 }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show site ${index + 1} of ${lastStop + 1}`}
                aria-current={index === at ? 'true' : undefined}
                data-on={index === at ? 'true' : undefined}
                className="review-rail-dot"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={at === lastStop}
            aria-label="Next site"
            className="review-rail-step"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
