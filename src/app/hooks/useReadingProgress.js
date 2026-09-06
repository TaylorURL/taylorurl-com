import { useEffect, useRef, useState } from 'react'

/** Where the fold sits for the purpose of naming the section being read. */
const ACTIVE_LINE = 0.3

/**
 * How far through an article the reader is, and which section they are in.
 *
 * The gauge and the contents list both need this and both need it to agree, so
 * it is measured once per frame from one set of rectangles rather than by two
 * observers that can disagree about which heading is current.
 *
 * The section is named by the last heading to have crossed a line near the top
 * of the viewport, not by whichever heading is on screen. A reader halfway
 * down a long section can see no heading at all, and an observer keyed on
 * visibility has nothing to report there; the line has an answer at every
 * scroll position, including that one.
 *
 * Nothing is measured until the effect runs, so the prerendered page carries
 * the article's first section and a gauge at zero, which is what it should say
 * before anyone has scrolled it.
 *
 * @param {{ current: HTMLElement | null }} bodyRef - The element holding the
 *   article body, whose height is the distance being tracked.
 * @param {Array<{ id: string }>} sections - The article's sections in order.
 * @returns {{ progress: number, activeId: (string | null), activeIndex: number }}
 *   How much of the body has passed, from 0 to 1, and the section being read.
 */
export function useReadingProgress(bodyRef, sections) {
  const [reading, setReading] = useState({
    progress: 0,
    activeId: sections.length ? sections[0].id : null,
    activeIndex: 0,
  })
  // The measure runs on every scroll frame and the state it writes is a new
  // object each time, so the last reading is held here as well to compare
  // against: without it every frame of a scroll would re-render the rail.
  const last = useRef(reading)

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return undefined

    const headings = sections.map(section => document.getElementById(section.id))
    let frame = 0

    const measure = () => {
      frame = 0
      const box = body.getBoundingClientRect()
      const travel = box.height - window.innerHeight
      const progress =
        travel > 0
          ? Math.min(1, Math.max(0, -box.top / travel))
          : box.bottom <= window.innerHeight
            ? 1
            : 0

      const line = window.innerHeight * ACTIVE_LINE
      let activeIndex = 0
      headings.forEach((heading, index) => {
        if (heading && heading.getBoundingClientRect().top <= line) activeIndex = index
      })

      const next = {
        progress,
        activeId: sections.length ? sections[activeIndex].id : null,
        activeIndex,
      }
      if (
        Math.abs(next.progress - last.current.progress) < 0.001 &&
        next.activeId === last.current.activeId
      ) {
        return
      }
      last.current = next
      setReading(next)
    }

    // Scroll fires far more often than the screen redraws, so the work is
    // deferred to the frame the reading would be painted in and coalesced when
    // several events land inside one.
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [bodyRef, sections])

  return reading
}
