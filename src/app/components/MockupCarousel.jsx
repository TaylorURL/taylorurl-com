import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrowserMockup from './BrowserMockup'

const MOCKUPS = [
  { url: 'yourbusiness.com', variant: 'default' },
  { url: 'yourbusiness.com/analytics', variant: 'analytics' },
  { url: 'yourbusiness.com/code', variant: 'code' },
]

// Three positions in the orbit: center-front, back-left, back-right
const POSITIONS = [
  { x: 0, y: 0, scale: 1, zIndex: 3, opacity: 1 },
  { x: -120, y: 30, scale: 0.78, zIndex: 1, opacity: 0.5 },
  { x: 120, y: 30, scale: 0.78, zIndex: 2, opacity: 0.5 },
]

export default function MockupCarousel() {
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => prev + 1)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative h-[320px] w-[400px]">
      {MOCKUPS.map((mockup, i) => {
        const posIndex = (i + rotation) % 3
        const pos = POSITIONS[posIndex]

        return (
          <motion.div
            key={mockup.variant}
            className="absolute left-1/2 top-1/2 w-[320px]"
            animate={{
              x: pos.x - 160,
              y: pos.y - 140,
              scale: pos.scale,
              zIndex: pos.zIndex,
              opacity: pos.opacity,
            }}
            transition={{
              duration: 0.8,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <BrowserMockup url={mockup.url} variant={mockup.variant} />
          </motion.div>
        )
      })}
    </div>
  )
}
