import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SECTIONS = [
  { id: 'hero', label: 'Top' },
  { id: 'stats', label: 'Stats' },
  { id: 'why', label: 'Why' },
  { id: 'data', label: 'Data' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'how', label: 'Process' },
  { id: 'cta', label: 'Contact' },
]

export default function SectionIndicator() {
  const [active, setActive] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400)

      const sections = SECTIONS.map(s => ({
        ...s,
        el: document.getElementById(s.id),
      })).filter(s => s.el)

      const viewportCenter = window.scrollY + window.innerHeight / 3

      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].el.offsetTop <= viewportCenter) {
          setActive(sections[i].id)
          return
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-2 lg:flex"
        >
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => scrollTo(section.id)}
              className="group flex items-center gap-2"
            >
              <span
                className={`text-[10px] font-medium uppercase tracking-wider transition-all ${
                  active === section.id
                    ? 'text-blue-600 opacity-100'
                    : 'text-gray-400 opacity-0 group-hover:opacity-100'
                }`}
              >
                {section.label}
              </span>
              <span
                className={`block rounded-full transition-all ${
                  active === section.id
                    ? 'h-3 w-3 bg-blue-600'
                    : 'h-1.5 w-1.5 bg-gray-300 group-hover:bg-gray-500'
                }`}
              />
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
