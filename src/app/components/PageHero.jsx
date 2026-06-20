import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

/**
 * Cinematic page hero used by every secondary view. Full-bleed black canvas
 * with a faint blueprint grid, monumental ink-on-black title, monospace
 * coordinate plate, and parallax fade as the user scrolls into the next
 * section. Optional `eyebrow` lets each route stamp its own section label
 * (e.g. "// 03 — Process"); falls back to a generic "// Document" when omitted.
 */
export default function PageHero({ title, description, eyebrow }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 80])
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.2])

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden bg-bg pb-20 pt-32 text-ink sm:pb-28 sm:pt-44"
    >
      <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-hair-strong to-transparent"
        aria-hidden="true"
      />

      <motion.div
        style={{ y, opacity }}
        className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16"
      >
        <div className="grid items-end gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mb-8 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent"
            >
              <span className="h-px w-8 bg-accent" />
              {eyebrow || '// Document'}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl text-[clamp(2.4rem,6.4vw,5rem)] font-semibold leading-[0.98] tracking-tightest text-ink"
            >
              {title}
            </motion.h1>

            {description && (
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
              >
                {description}
              </motion.p>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <div className="relative border border-hair p-5">
              <span
                aria-hidden
                className="absolute -top-px left-4 bg-bg px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
              >
                Origin
              </span>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em]">
                <dt className="text-ink-faint">Lat</dt>
                <dd className="text-ink">29.7355°N</dd>
                <dt className="text-ink-faint">Lon</dt>
                <dd className="text-ink">94.9774°W</dd>
                <dt className="text-ink-faint">Region</dt>
                <dd className="text-ink">TX, US</dd>
                <dt className="text-ink-faint">Status</dt>
                <dd className="flex items-center gap-2 text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Nominal
                </dd>
              </dl>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
