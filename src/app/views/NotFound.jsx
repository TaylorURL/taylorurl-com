import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, Bug } from 'lucide-react'
import Seo from '@components/Seo'

const BUG_SIZE = 28
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
    <div className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden bg-bg px-6 pb-16 pt-32 text-ink sm:pb-20 sm:pt-44">
      <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
      <Seo title="Page Not Found" path="/404" noIndex />

      <div className="relative mx-auto grid w-full max-w-[1080px] items-center gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
            <span className="h-px w-8 bg-accent" />
            // Page not found — 404
          </p>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="font-mono text-[clamp(5rem,16vw,12rem)] font-semibold leading-none tracking-tightest text-ink"
          >
            404
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tightest text-ink"
          >
            Page not found.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-soft"
          >
            This page doesn&apos;t exist. Catch a few bugs while you&apos;re here, or head
            back to the home page.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Link
              to="/"
              className="group inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
            >
              Return to home
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/contact"
              className="group inline-flex items-center gap-2.5 rounded-sm border border-hair-strong px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-ink transition duration-200 ease-out hover:bg-ink hover:text-bg active:scale-[0.98]"
            >
              Get in touch
            </Link>
          </motion.div>
        </div>

        {/* Bug catching panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[320px] justify-self-center lg:justify-self-end"
        >
          <div className="border border-hair p-5">
            <div className="mb-4 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              <span>// Bug catcher</span>
              <span className="text-accent">
                Caught · <span className="font-semibold text-ink">{String(score).padStart(2, '0')}</span>
              </span>
            </div>
            <div
              ref={gridRef}
              className="relative mx-auto w-full overflow-hidden border border-dashed border-hair-strong bg-surface-1"
              style={{ aspectRatio: '1 / 1' }}
            >
              <div className="grid-blueprint-fine absolute inset-0 opacity-60" aria-hidden="true" />
              <motion.button
                onClick={catchBug}
                animate={{ x: bugPos.x, y: bugPos.y }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                className="absolute cursor-pointer text-accent transition-colors hover:text-[color:var(--accent-hi)]"
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.78 }}
                aria-label="Catch the bug"
              >
                <Bug className="h-7 w-7" strokeWidth={1.5} />
              </motion.button>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              Click the bug to debug
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
