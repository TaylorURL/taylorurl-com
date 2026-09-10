import { useEffect } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Damped scrolling for the wheel, quick across the seams between sections.
 *
 * A wheel hands the page a step. Native scrolling spends that step over a few
 * frames and stops dead, so a long page is read as a run of small arrivals
 * rather than as one movement. This puts a target between the wheel and the
 * page: the notch moves the target, and the page eases toward it every frame,
 * so the same distance is travelled as one glide.
 *
 * The rate is not constant, because the two things a reader does on a page are
 * not the same thing. Inside a section they are reading and the page should
 * move under them slowly. Between two sections there is nothing to read, and
 * the same slow rate spends seconds on the part of the page nobody came for.
 * So the glide runs at `BASE` inside a section and `SEAM` while a boundary is
 * going past, which is what makes the page cross its own joins quickly.
 *
 * Only the wheel is taken. A touch screen already has momentum of its own and
 * is better at it than this, the keyboard and the browser's own find-on-page
 * move the window directly, and all three are followed rather than fought - any
 * scroll this did not write is adopted as the new position, so the glide
 * continues from wherever the page actually is.
 *
 * Honors `prefers-reduced-motion` by not attaching at all, which leaves native
 * scrolling exactly as the browser ships it.
 */

/**
 * Share of the distance still to go that is covered each frame inside a
 * section, for a wheel that arrives in notches. Lower is slower and more
 * floating; this settles a notch in about a third of a second.
 */
const BASE = 0.12

/**
 * The same share for an input that is already continuous.
 *
 * A trackpad does not deliver notches. It delivers a fine stream that the
 * operating system has already given momentum to, and damping that a second
 * time does not smooth anything - there is nothing left to smooth - it only
 * puts the page behind the fingers moving it. So a fine stream is passed
 * through nearly as it comes, and the slow glide is kept for the input that
 * actually arrives in steps.
 */
const FINE_BASE = 0.34

/**
 * The delta below which a wheel is a stream rather than a notch. A mouse notch
 * is worth a hundred pixels or more and a line-reporting mouse more again,
 * while a trackpad reports single figures for most of a gesture.
 */
const FINE = 40

/**
 * The same share while a section boundary is going past. High enough that a
 * seam is crossed in a couple of tenths, which is the "moves fast between
 * sections" this exists for, and short of 1, which would be no glide at all.
 */
const SEAM = 0.35

/**
 * How near the top of the window a boundary has to be before it counts as
 * going past, as a share of the window height. It is measured from the top
 * rather than the middle because a section arriving is what a reader is waiting
 * through, and the wait is over once its opening is on the screen.
 *
 * A band is twice this wide and there is one on every join, so widening it eats
 * the page it is meant to be moving between: at four tenths of a window, near
 * half of the home page was being crossed at the fast rate, which is not a page
 * with quick seams but a fast page with slow patches. A quarter leaves about
 * two thirds of the scroll at reading pace.
 */
const BAND = 0.25

/** Below this much left to travel the glide is over and the loop stops. */
const REST = 0.5

/** What one line of wheel delta is worth, for a mouse that reports lines. */
const LINE = 16

/** Two boundaries closer together than this are the same seam. */
const SAME_SEAM = 120

/**
 * Where one section ends and the next begins, in document coordinates.
 *
 * Read at the start of each glide rather than held, because the page these run
 * on changes height as pictures land and as a section opens, and a boundary
 * list that is one layout out of date speeds the page up over the wrong part of
 * it.
 */
function seams() {
  const found = [...document.querySelectorAll('main section')]
    .map(el => el.getBoundingClientRect().top + window.scrollY)
    .sort((a, b) => a - b)
  // Sections nest, so the same join is reported by the wrapper and by the
  // section inside it a pixel later.
  return found.filter((at, i) => i === 0 || at - found[i - 1] > SAME_SEAM)
}

/**
 * Whether something under the pointer can take this wheel itself.
 *
 * A drawer, a console pane and the assistant's transcript are all scrollers
 * inside the page, and a wheel over one of them belongs to it. Only a scroller
 * with room left in the direction being asked for counts: one already at its
 * end is passing the wheel on, which is the page's again.
 */
function nestedScroller(from, delta) {
  for (let el = from; el instanceof Element && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue
    if (!/(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)) continue
    const room = delta > 0 ? el.scrollTop < el.scrollHeight - el.clientHeight - 1 : el.scrollTop > 1
    if (room) return true
  }
  return false
}

/** What a wheel event is worth in pixels, whichever unit the mouse reports in. */
const pixels = event =>
  event.deltaMode === 1
    ? event.deltaY * LINE
    : event.deltaMode === 2
      ? event.deltaY * window.innerHeight
      : event.deltaY

/**
 * @param {boolean} [enabled] Whether the page this is on scrolls as one. The
 *   console and the sign-in screens hold their own scrollers and are left
 *   alone.
 */
export function useSmoothScroll(enabled = true) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!enabled || reduced) return undefined

    let target = window.scrollY
    let current = target
    let wrote = target
    let frame = 0
    let boundaries = []
    // Whether the wheel feeding this glide is a stream rather than a notch.
    let fine = false

    const limit = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)

    const crossing = at => {
      const band = window.innerHeight * BAND
      return boundaries.some(seam => Math.abs(seam - at) < band)
    }

    const step = () => {
      const rate = crossing(current) ? SEAM : fine ? FINE_BASE : BASE
      current += (target - current) * rate
      if (Math.abs(target - current) < REST) current = target
      wrote = Math.round(current)
      window.scrollTo({ top: wrote, behavior: 'instant' })
      frame = current === target ? 0 : requestAnimationFrame(step)
    }

    const onWheel = event => {
      if (event.ctrlKey || event.defaultPrevented) return
      // A panel that has taken the page over hides the overflow while it is
      // open. The page is not the thing being scrolled then.
      if (document.body.style.overflow === 'hidden') return
      const delta = pixels(event)
      if (!delta || nestedScroller(event.target, delta)) return

      event.preventDefault()
      fine = Math.abs(delta) < FINE
      if (!frame) {
        boundaries = seams()
        current = window.scrollY
        target = current
      }
      target = Math.min(limit(), Math.max(0, target + delta))
      if (!frame) frame = requestAnimationFrame(step)
    }

    // Anything that moved the page without going through here - a keypress, an
    // anchor, the browser restoring a position - is where the page now is.
    const onScroll = () => {
      if (Math.abs(window.scrollY - wrote) <= 1) return
      current = window.scrollY
      target = current
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled, reduced])
}
