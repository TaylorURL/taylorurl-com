import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const WORDS = [
  'Restaurants',
  'Plumbers',
  'Contractors',
  'Auto shops',
  'Law firms',
  'Salons',
  'Dentists',
  'Realtors',
]

const ROTATE_INTERVAL_MS = 2400

const LONGEST_WORD = WORDS.reduce((a, b) => (b.length > a.length ? b : a), '')

export default function TypingRotator() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % WORDS.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <span className="relative inline-flex items-baseline align-baseline">
      <span aria-hidden="true" className="mr-2 text-accent">
        ⟶
      </span>
      <span className="sr-only">
        {WORDS.join(', ')}
      </span>
      <span aria-hidden="true" className="relative inline-grid">
        <span className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {LONGEST_WORD}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={WORDS[index]}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="col-start-1 row-start-1 whitespace-nowrap text-accent"
          >
            {WORDS[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  )
}
