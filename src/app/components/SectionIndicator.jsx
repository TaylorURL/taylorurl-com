import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnDarkBackground } from '@hooks/useOnDarkBackground'

const SECTIONS = [
  { id: 'hero', label: 'Index', num: '00' },
  { id: 'why', label: 'Why', num: '01' },
  { id: 'data', label: 'Data', num: '02' },
  { id: 'testimonials', label: 'Voices', num: '03' },
  { id: 'how', label: 'Process', num: '04' },
  { id: 'cta', label: 'Contact', num: '05' },
]

export default function SectionIndicator() {
  const [active, setActive] = useState('hero')
  const [visible, setVisible] = useState(false)
  const wrapperRef = useRef(null)
  const probeRef = useRef(null)
  const [onDark] = useOnDarkBackground(probeRef, [wrapperRef])

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 320)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        }
      },
      { rootMargin: '-30% 0px -65% 0px' }
    )

    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [])

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const activeText = onDark ? 'text-ink' : 'text-ink-paper'
  const inactiveText = onDark ? 'text-ink-faint' : 'text-paper-faint'
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
          <motion.div
            ref={wrapperRef}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex"
          >
            {SECTIONS.map(section => {
              const isActive = active === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollTo(section.id)}
                  className="group flex items-center gap-3"
                  aria-label={`Go to ${section.label} section`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.22em] transition-colors duration-300 ease-out ${
                      isActive
                        ? `${activeText} opacity-100`
                        : `${inactiveText} opacity-0 group-hover:opacity-100`
                    }`}
                  >
                    {section.num} {section.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`block h-px transition-[width,background-color] duration-300 ease-out ${
                      isActive
                        ? 'w-7 bg-accent'
                        : `w-3 ${inactiveLine} group-hover:w-5 ${hoverLine}`
                    }`}
                  />
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
