import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'

const SHOW_THRESHOLD = 400

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > SHOW_THRESHOLD)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          whileTap={{ scale: 0.94 }}
          onClick={scrollToTop}
          className="group fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-sm border border-hair-paper-strong bg-paper text-ink-paper transition-colors duration-200 hover:bg-ink-paper hover:text-paper"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
