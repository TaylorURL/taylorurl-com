import { useEffect, useRef, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { useOnDarkBackground } from '@hooks/theme/useOnDarkBackground'
import { useScrolledPast } from '@hooks/scroll/useScrolledPast'
import { chromeSlideIn } from '@constants/animations'

const SHOW_THRESHOLD = 320

const SECTIONS = [
  { id: 'hero', label: 'Index', num: '00' },
  { id: 'capabilities', label: 'Work', num: '01' },
  { id: 'testimonials', label: 'Voices', num: '02' },
  { id: 'how', label: 'Process', num: '03' },
  { id: 'cta', label: 'Contact', num: '04' },
]

// Where down the window the marker reads the page from. A third of the way in
// is the line the eye is on while scrolling, and it is the same line the band
// below is cut at.
const READ_LINE = 0.35

// The band the sections are watched through: the five per cent of the window
// that sits on the read line. A section entering or leaving it is a section
// boundary crossing the line, which is the only moment the answer can change.
const BAND = '-30% 0px -65% 0px'

/**
 * Which section the read line is standing in.
 *
 * Asked of the page rather than remembered from the last thing that crossed
 * the band, because the two are not the same answer and the difference is
 * exactly what the reader sees at the foot of the page. Below the last section
 * - the whole of the footer, which is most of a screen - nothing is in the
 * band, so a marker that only ever moves on an entry event has nothing to move
 * to and holds whatever it was last told. Landing there without having scrolled
 * through, on a reload or a link into the bottom of the page, that is still the
 * initial state: the marker sits on 00 Index while the reader is looking at the
 * foot of the page.
 *
 * Reading position answers everywhere: it names the last section the line has
 * passed, which below the end of the page is the last section, and it is right
 * the first time it is asked rather than after the first crossing.
 *
 * @returns {string} The id of the section the line is in.
 */
function sectionAtReadLine() {
  const line = window.innerHeight * READ_LINE
  let current = SECTIONS[0].id
  for (const section of SECTIONS) {
    const el = document.getElementById(section.id)
    if (el && el.getBoundingClientRect().top <= line) current = section.id
  }
  return current
}

export default function SectionIndicator() {
  const [active, setActive] = useState(SECTIONS[0].id)
  const visible = useScrolledPast(SHOW_THRESHOLD)
  const wrapperRef = useRef(null)
  const probeRef = useRef(null)
  const onDark = useOnDarkBackground(probeRef, [wrapperRef])

  useEffect(() => {
    const read = () => setActive(sectionAtReadLine())

    // The band says when to look; the page says what to say. An observer costs
    // nothing on the frames where no boundary is crossed, which is nearly all
    // of them, so it stays the trigger rather than a scroll handler.
    const observer = new IntersectionObserver(read, { rootMargin: BAND })
    SECTIONS.forEach(section => {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    })

    // A resize moves the read line without moving the page under it, and the
    // observer has no crossing to report for it.
    window.addEventListener('resize', read)
    read()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', read)
    }
  }, [])

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const activeText = onDark ? 'text-ink' : 'text-ink-paper'
  const inactiveText = onDark ? 'text-ink-faint' : 'text-[color:var(--paper-ink-faint)]'
  const inactiveLine = onDark ? 'bg-ink-faint' : 'bg-[color:var(--paper-ink-faint)]'
  const hoverLine = onDark ? 'group-hover:bg-ink' : 'group-hover:bg-ink-paper'

  return (
    <>
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none fixed right-10 top-1/2 h-1 w-1 -translate-y-1/2"
      />
      <AnimatePresence>
        {visible && (
          <m.div
            ref={wrapperRef}
            initial={chromeSlideIn.initial}
            animate={chromeSlideIn.animate}
            exit={chromeSlideIn.exit}
            transition={chromeSlideIn.transition}
            className="fixed right-6 top-1/2 z-[var(--z-float)] hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex"
          >
            {SECTIONS.map(section => {
              const isActive = active === section.id
              return (
                <button
                  className="group flex items-center gap-3 transition-transform duration-300 ease-out-soft hover:-translate-x-0.5"
                  key={section.id}
                  type="button"
                  onClick={() => scrollTo(section.id)}
                  aria-label={`Go to ${section.label} section`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span
                    className={`section-label-sm transition-colors duration-300 ease-out-soft ${
                      isActive
                        ? `${activeText} opacity-100`
                        : `${inactiveText} opacity-0 group-hover:opacity-100`
                    }`}
                  >
                    {section.num} {section.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`block h-px transition-[width,background-color] duration-300 ease-out-soft ${
                      isActive
                        ? 'w-7 bg-accent'
                        : `w-3 ${inactiveLine} group-hover:w-5 ${hoverLine}`
                    }`}
                  />
                </button>
              )
            })}
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
