import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export default function CursorGlow() {
  const [isDesktop, setIsDesktop] = useState(false)

  const cursorX = useMotionValue(-200)
  const cursorY = useMotionValue(-200)

  const springConfig = { damping: 25, stiffness: 150, mass: 0.5 }
  const x = useSpring(cursorX, springConfig)
  const y = useSpring(cursorY, springConfig)

  useEffect(() => {
    // Only show on non-touch desktop devices
    const mediaQuery = window.matchMedia('(pointer: fine) and (min-width: 768px)')
    const handleChange = e => setIsDesktop(e.matches)

    setIsDesktop(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!isDesktop) return

    const handleMouseMove = e => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isDesktop, cursorX, cursorY])

  if (!isDesktop) return null

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-10"
      style={{
        background: 'transparent',
      }}
    >
      <motion.div
        className="pointer-events-none"
        style={{
          position: 'fixed',
          width: 350,
          height: 350,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(59, 130, 246, 0.10) 0%, rgba(59, 130, 246, 0.05) 35%, rgba(59, 130, 246, 0) 70%)',
          x,
          y,
          translateX: '-50%',
          translateY: '-50%',
          mixBlendMode: 'screen',
        }}
      />
    </motion.div>
  )
}
