import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Bug } from 'lucide-react'
import Seo from '@components/Seo'
import { BTN_PRIMARY, BTN_SECONDARY } from '@constants/ui'

const BUG_SIZE = 32
const MOVE_INTERVAL_MS = 1200

export default function NotFound() {
  const [score, setScore] = useState(0)
  const [bugPos, setBugPos] = useState({ x: 0, y: 0 })
  const intervalRef = useRef(null)
  const gridRef = useRef(null)

  const moveBug = useCallback(() => {
    const el = gridRef.current
    const size = el ? el.offsetWidth : 280
    setBugPos({
      x: Math.random() * (size - BUG_SIZE),
      y: Math.random() * (size - BUG_SIZE),
    })
  }, [])

  useEffect(() => {
    moveBug()
    intervalRef.current = setInterval(moveBug, MOVE_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
  }, [moveBug])

  const catchBug = () => {
    setScore(prev => prev + 1)
    moveBug()
  }

  return (
    <div className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden bg-gray-50 px-4 pb-12 pt-28 sm:pb-16 sm:pt-40">
      <div className="grid-pattern absolute inset-0 opacity-[0.03]" />
      <Seo title="Page Not Found" path="/404" />

      <div className="relative mx-auto max-w-lg text-center">
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="logo-wave-dark text-[5rem] font-bold leading-none sm:text-[8rem]"
        >
          404
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl"
        >
          Page not found
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-4 text-lg text-gray-600"
        >
          This page does not exist. Catch a few bugs while you are here.
        </motion.p>

        {/* Bug catching game */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mx-auto mb-8 mt-8"
        >
          <div className="mb-3 text-sm font-medium text-gray-500">
            Bugs caught: <span className="font-bold text-blue-600">{score}</span>
          </div>
          <div
            ref={gridRef}
            className="relative mx-auto w-full max-w-[280px] rounded-xl border-2 border-dashed border-gray-300 bg-surface-overlay"
            style={{ aspectRatio: '1 / 1' }}
          >
            <div className="grid-pattern absolute inset-0 rounded-xl opacity-[0.03]" />
            <motion.button
              onClick={catchBug}
              animate={{ x: bugPos.x, y: bugPos.y }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="absolute cursor-pointer text-red-500 transition-colors hover:text-red-600"
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.7 }}
              aria-label="Catch the bug"
            >
              <Bug className="h-8 w-8" />
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <Link to="/" className={`group ${BTN_PRIMARY}`}>
            Back to home
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/contact" className={BTN_SECONDARY}>
            Get in Touch
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
