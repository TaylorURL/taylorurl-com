import { useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { DesktopMockup } from '@components/mockups/DevicePreview'

/**
 * The client sites on a rail that turns as it travels.
 *
 * It is a scroller rather than a slider: the frames are laid out end to end in
 * something that genuinely scrolls, and moving on is scrolling it. That keeps
 * every card in the document where a screen reader and the tab key still reach
 * it, and it keeps the depth honest, because the number the turn is drawn from
 * is the rail's own scroll position rather than a second animation running
 * beside it and drifting out of step.
 *
 * Each frame is turned on its own vertical axis, pushed back by however far it
 * stands from the front of the rail, and stepped down a size for each slot it
 * is queued behind. So the frame at the front faces the reader square and whole
 * while the ones waiting angle away and stand smaller, and because all of that
 * is a function of position rather than of which project it is, the sizes
 * belong to the slots: a frame grows as its turn comes round and gives the size
 * back on the way past.
 *
 * The rail is the band's own and a reader cannot take hold of it. It carries no
 * buttons, it does not stop under a pointer, and it does not answer a wheel, a
 * drag or a swipe. A visitor is meant to glance at this band on the way down
 * the page rather than work it, and a deck that halts the moment a cursor
 * crosses it spends most of its life stopped on whichever frame the mouse
 * happened to pass over. The names under the frames are still links and still a
 * tab away; it is the turning that is out of the reader's hands, not the work.
 *
 * It runs on rather than turning back. The frames are laid down twice and the
 * rail is lifted back by one whole set the instant it reaches the copy - the
 * same sites in the same places, so there is nothing to see - and the deck
 * reads as one queue with no end rather than a row that walks to the far wall
 * and rewinds past everything it has just shown.
 *
 * The one thing that does stop it is a reader who has asked for less motion.
 * That stands down the travel and the turn together and leaves a still deck.
 */

/** How long a frame holds at the front before the rail moves itself on. */
const DWELL_MS = 4600

/** How long the rail takes to travel from one frame to the next. */
const GLIDE_MS = 520

/** Ease in and out, so the rail leaves and arrives rather than jerking. */
const glideEase = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

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
 * What a frame gives up for each slot it stands behind the front one, and the
 * slot past which it gives up nothing further.
 *
 * The push back shrinks a frame a little already, but it is measured against
 * the width of the whole rail rather than the frames standing on it, so on a
 * deck three frames wide the one at the front is barely larger than the one
 * behind it and does not read as the one being shown. This is counted in slots
 * instead: whichever frame is at the front is whole, and the ones queued behind
 * it step down. The stop is there because a frame further back than the second
 * is off the edge of the band, and carrying the step on would only make the
 * ones nobody sees smaller.
 */
const SHRINK = 0.15
const SHRINK_STOP = 2

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
  const rail = useRef(null)
  const count = projects.length

  // Where each frame stands, written straight to the node. It changes with
  // every scrolled pixel, and a render per pixel would rebuild the rail under
  // the reader.
  const paint = useCallback(() => {
    const node = rail.current
    if (!node) return
    const view = node.clientWidth
    if (view === 0) return
    const front = node.scrollLeft
    // How far apart two neighbouring frames stand, which is what a slot is.
    const pitch =
      node.children.length > 1 ? node.children[1].offsetLeft - node.children[0].offsetLeft : view

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
      // its left rather than its middle - that is where a frame lands and where
      // the reader is looking - so the frame at the front is the one that has
      // not turned at all, and everything else is angling away from it.
      const stands = item.offsetLeft - node.offsetLeft - front
      const off = Math.max(-1, Math.min(1, stands / view))
      const away = Math.abs(off)
      // The same distance again, counted in slots rather than in rail widths,
      // so the step down lands on the frames themselves and holds whatever the
      // band is wide.
      const slots = pitch > 0 ? Math.min(SHRINK_STOP, Math.abs(stands) / pitch) : 0

      frame.style.transform =
        `perspective(${PERSPECTIVE}px) translateZ(${-(away * DEPTH).toFixed(1)}px) ` +
        `rotateY(${(-off * TURN).toFixed(2)}deg) scale(${(1 - slots * SHRINK).toFixed(4)})`
      // A turned frame is shaded rather than faded. Dimming it with `opacity`
      // makes the screenshot translucent, and the band behind it then reads
      // straight through a client's home page - which is a washed out card
      // rather than one standing further from the light.
      if (veil) veil.style.opacity = (away * DIM).toFixed(3)
      // The nearest frame has to be the one on top, or a turned neighbour laps
      // over the card the reader is looking at.
      item.style.zIndex = String(100 - Math.round(away * 100))
    }
  }, [stillness])

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
  }, [paint])

  // The travel. `scrollLeft` is written per frame rather than handed to
  // `scrollTo({behavior: 'smooth'})`, which a container the reader cannot
  // scroll accepts and then ignores, leaving the deck sitting on its first
  // frame looking like a slideshow nobody wired up.
  useEffect(() => {
    const node = rail.current
    if (!node || stillness || count < 2) return undefined

    // Which frame is at the front, counted along the first set alone. It walks
    // one past the end of that set and is lifted straight back to nought, which
    // is the same site in the same place because the set behind it is a copy.
    let at = 0
    let glide = 0

    const anchor = index => {
      const target = node.children[index]
      return target ? target.offsetLeft - node.offsetLeft : 0
    }

    const move = () => {
      // A travel still in flight is called off rather than left to land later.
      // A tab nobody is looking at stops handing out animation frames while the
      // dwell timer keeps firing, so without this a deck comes back from a
      // background tab with a queue of stale travels landing at once, each
      // hauling the rail somewhere different.
      cancelAnimationFrame(glide)
      const next = at + 1
      const from = node.scrollLeft
      const to = anchor(next)
      const began = performance.now()

      const travel = now => {
        const through = Math.min(1, (now - began) / GLIDE_MS)
        node.scrollLeft = from + (to - from) * glideEase(through)
        if (through < 1) {
          glide = requestAnimationFrame(travel)
          return
        }
        glide = 0
        at = next % count
        if (at !== next) {
          node.scrollLeft = anchor(at)
          // The lift moves every frame a whole set sideways at once, and a turn
          // drawn a frame late there is a deck that visibly flinches on the seam.
          paint()
        }
      }

      glide = requestAnimationFrame(travel)
    }

    const timer = setInterval(move, DWELL_MS)
    return () => {
      clearInterval(timer)
      cancelAnimationFrame(glide)
    }
  }, [stillness, count, paint])

  return (
    <div
      className="flex flex-col gap-7"
      role="group"
      aria-label="Client sites this studio has built"
    >
      {/* The rail is scrolled from the timer and from nowhere else, so the
          overflow is hidden rather than automatic: a wheel, a drag and a swipe
          all find nothing to take hold of, and `scrollLeft` still moves it. */}
      <div
        ref={rail}
        className="work-deck flex items-start gap-6 overflow-x-hidden pb-14 pt-3 lg:gap-8"
      >
        {[0, 1].map(set =>
          projects.map((project, index) => (
            <div
              key={`${project.slug}-${set}`}
              className="w-[clamp(258px,78vw,420px)] shrink-0 lg:w-[clamp(340px,32vw,460px)]"
              // The second set exists to be scrolled onto and lifted off again,
              // so to anybody reading the page rather than looking at it it is
              // every site a second time. It is taken out of the document for
              // them, and out of the tab order with it.
              aria-hidden={set === 1 ? 'true' : undefined}
              inert={set === 1}
            >
              {/* Neither the turn nor the shade carries a transition. Both are
                  redrawn every frame the rail moves, so smoothing them only
                  drags them behind the scroll, and on the seam - where every
                  frame shifts a whole set at once - a transition is the thing
                  that would make the lift show. */}
              <div className="relative origin-left will-change-transform">
                <DesktopMockup
                  project={project}
                  index={index}
                  priority={set === 0 && index === 0}
                />
                <span
                  data-veil
                  aria-hidden="true"
                  className="device-window pointer-events-none absolute inset-0 bg-scrim opacity-0"
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
          ))
        )}
      </div>
    </div>
  )
}
