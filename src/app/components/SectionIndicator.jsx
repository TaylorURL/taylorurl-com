import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
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
                onClick={() => scrollTo(section.id)}
                className="group flex items-center gap-3"
                aria-label={`Go to ${section.label} section`}
                aria-current={isActive ? 'true' : undefined}
              >
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.22em] transition-all duration-200 ${
                    isActive
                      ? 'text-ink-paper opacity-100'
                      : 'text-paper-faint opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {section.num} {section.label}
                </span>
                <span
                  aria-hidden="true"
                  className={`block h-px transition-all duration-300 ${
                    isActive
                      ? 'w-7 bg-accent'
                      : 'w-3 bg-paper-faint group-hover:w-5 group-hover:bg-ink-paper'
                  }`}
                />
              </button>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
