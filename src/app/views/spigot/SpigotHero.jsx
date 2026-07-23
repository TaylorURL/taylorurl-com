import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { BlockMotif, TriTick } from './SpigotArt'

const EASE = [0.22, 1, 0.36, 1]

const HERO_META = [
  { k: 'Studio', v: 'TaylorURL', c: 'var(--c-blue)' },
  { k: 'Platform', v: 'Minecraft', c: 'var(--c-green)' },
  { k: 'Tool', v: 'Spigot / Paper', c: 'var(--c-orange)' },
  { k: 'Language', v: 'Java / Kotlin', c: 'var(--ink-faint)' },
]

/**
 * Refined hero for the Spigot page. Keeps the site's cinematic dark canvas and
 * scroll parallax, and introduces the blue-green-orange spectrum as the
 * signature: a tri-tick eyebrow, a gradient headline word, a gradient primary
 * CTA, and the isometric block motif. Reduced-motion collapses every transform.
 */
export default function SpigotHero() {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 80])
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.2])

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-[100svh] items-stretch overflow-hidden bg-bg pt-24 text-ink"
    >
      <div className="grid-blueprint absolute inset-0 opacity-50" aria-hidden="true" />
      {/* Tri-colour ambient wash */}
      <div
        className="pointer-events-none absolute -left-40 top-10 h-[620px] w-[620px] rounded-full opacity-[0.14]"
        style={{ background: 'radial-gradient(circle at center, var(--c-blue), transparent 68%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-0 top-1/3 h-[560px] w-[560px] rounded-full opacity-[0.14]"
        style={{ background: 'radial-gradient(circle at center, var(--c-orange), transparent 68%)' }}
        aria-hidden="true"
      />
      <div
        className="via-hair-strong absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent"
        aria-hidden="true"
      />

      <motion.div
        style={{ y, opacity }}
        className="relative mx-auto flex w-full max-w-[1280px] flex-col px-6 pb-16 pt-12 will-change-transform sm:px-10 sm:pb-24 lg:px-16"
      >
        {/* Eyebrow strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="border-hair flex flex-wrap items-center gap-x-6 gap-y-2 border-b pb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
        >
          <span className="flex items-center gap-2 text-ink-soft">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ backgroundColor: 'var(--c-orange)' }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--c-orange)' }}
              />
            </span>
            Open for plugin commissions
          </span>
          <span className="hidden sm:inline">·</span>
          <span>A TaylorURL practice</span>
          <span className="ml-auto hidden sm:inline">/spigot</span>
        </motion.div>

        <div className="mt-12 grid flex-1 items-center gap-12 lg:mt-12 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
          {/* Copy column */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: EASE }}
              className="mb-8 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-mute"
            >
              <TriTick />
              Minecraft plugin development
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
              className="text-[clamp(2.6rem,6.2vw,5.2rem)] font-semibold leading-[0.98] tracking-tightest text-ink"
            >
              Minecraft plugins,
              <br />
              built <span style={{ color: 'var(--c-orange)' }}>from scratch.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2, ease: EASE }}
              className="mt-9 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
            >
              I&apos;m Trenton. Under TaylorURL, I write custom server plugins in Java on Spigot and
              Paper — gameplay, minigames, economies, the works. If your server needs something you
              can&apos;t get off a marketplace, I&apos;ll build it, tune it so it holds tick rate,
              and hand you the source.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3, ease: EASE }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Link
                to="/contact"
                className="group inline-flex items-center gap-2.5 rounded-sm px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--c-orange)' }}
              >
                Start a plugin
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#what-i-build"
                className="border-hair-strong group inline-flex items-center gap-2.5 rounded-sm border px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-ink transition duration-200 ease-out hover:bg-ink hover:text-bg active:scale-[0.98]"
              >
                See what I build
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </motion.div>
          </div>

          {/* Artwork column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
            className="relative"
          >
            <BlockMotif className="mx-auto w-full max-w-[440px]" />

            <div className="border-hair bg-[color:var(--bg)]/55 relative mx-auto -mt-2 w-full max-w-sm border p-5 backdrop-blur-sm">
              <span
                aria-hidden
                className="absolute -top-px left-4 bg-[color:var(--bg)] px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
              >
                The stack, in short
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 font-mono text-[11px] uppercase tracking-[0.18em]">
                {HERO_META.map(item => (
                  <div key={item.k} className="contents">
                    <dt className="flex items-center gap-2 text-ink-faint">
                      <span
                        className="h-1.5 w-1.5 rounded-[1px]"
                        style={{ backgroundColor: item.c }}
                      />
                      {item.k}
                    </dt>
                    <dd className="text-right text-ink">{item.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="border-hair mt-12 flex items-center justify-between border-t pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
        >
          <span>Scroll to explore</span>
          <span className="hidden sm:inline">Custom code · full source · one developer</span>
          <span className="text-ink-soft">↓</span>
        </motion.div>
      </motion.div>
    </section>
  )
}
