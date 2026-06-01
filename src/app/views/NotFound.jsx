import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Bug } from 'lucide-react'
import Seo from '@components/Seo'
import { BTN_PRIMARY, BTN_SECONDARY } from '@constants/ui'

const GRID_SIZE = 280
const BUG_SIZE = 32
const MOVE_INTERVAL_MS = 1200

function randomPos() {
  return {
    x: Math.random() * (GRID_SIZE - BUG_SIZE),
    y: Math.random() * (GRID_SIZE - BUG_SIZE),
  }
}

export default function NotFound() {
  const [score, setScore] = useState(0)
  const [bugPos, setBugPos] = useState(randomPos)
  const intervalRef = useRef(null)

  const moveBug = useCallback(() => setBugPos(randomPos()), [])

  useEffect(() => {
    intervalRef.current = setInterval(moveBug, MOVE_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
  }, [moveBug])

  const catchBug = () => {
    setScore(prev => prev + 1)
    moveBug()
  }

  return (
    <div className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden bg-gray-50 px-4 pb-16 pt-40">
      <div className="grid-pattern absolute inset-0 opacity-[0.03]" />
      <Seo title="Page Not Found" path="/404" />

      <div className="relative mx-auto max-w-lg text-center">
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="logo-wave-dark text-[8rem] font-bold leading-none"
        >
          404
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-4 text-3xl font-bold text-gray-900"
        >
          Page not found
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-4 text-lg text-gray-600"
        >
          This page doesn&apos;t exist. But while you&apos;re here, catch some bugs.
        </motion.p>

        {/* Bug catching game */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mx-auto mb-8 mt-8"
        >
          <div className="mb-3 text-sm font-medium text-gray-500">
            Bugs squashed: <span className="font-bold text-blue-600">{score}</span>
          </div>
          <div
            className="relative mx-auto rounded-xl border-2 border-dashed border-gray-300 bg-white"
            style={{ width: GRID_SIZE, height: GRID_SIZE }}
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
            Go Home
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/pricing" className={BTN_SECONDARY}>
            Get a Quote
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
