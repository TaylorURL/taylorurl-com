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

export default function TypingRotator() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % WORDS.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <span className="relative inline-flex min-w-[8ch] items-baseline">
      <span aria-hidden="true" className="mr-2 text-accent">
        ⟶
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={WORDS[index]}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block text-accent"
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
