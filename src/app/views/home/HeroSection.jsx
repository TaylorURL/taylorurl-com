import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Maximize2, Minimize2 } from 'lucide-react'
import MockupCarousel from '@components/MockupCarousel'
import TypingRotator from '@components/TypingRotator'
import BaytownMap, { HERO_INTRO_END_S } from './BaytownMap'

const HERO_META = [
  { k: 'Based in', v: 'Baytown, TX' },
  { k: 'Built by', v: 'Trenton Taylor' },
]

const AVATAR_INITIALS = ['MR', 'JM', 'SC', 'DK']

const EASE_REVEAL = [0.22, 1, 0.36, 1]

export default function HeroSection() {
  const reduced = useReducedMotion()
  const [contentHidden, setContentHidden] = useState(false)

  // Hero copy waits for the BaytownMap intro to settle before revealing. With
  // reduced motion, the offset collapses and everything is shown at once.
  const after = step => (reduced ? 0 : HERO_INTRO_END_S + step)

  const toggleTransition = reduced
    ? { duration: 0 }
    : { duration: 0.5, ease: EASE_REVEAL }

  return (
    <section className="hero-surface relative isolate flex min-h-[100svh] items-stretch overflow-hidden pt-24">
      <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
      <BaytownMap />

      {/* Soft scrim behind the headline column so the bolder map stays
          readable under the type without dimming the right side. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 right-[35%] bg-gradient-to-r from-[color:var(--bg)]/65 via-[color:var(--bg)]/30 to-transparent"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[640px] w-[1100px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/15 blur-[160px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[640px] rounded-full bg-accent/10 blur-[140px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col px-6 pb-16 pt-12 sm:px-10 sm:pb-24 lg:px-16">
        {/* Map / content toggle — stays interactive in both states so the
            user can always restore the central content. */}
        <button
          type="button"
          onClick={() => setContentHidden(prev => !prev)}
          aria-label={
            contentHidden
              ? 'Show hero content'
              : 'Hide hero content to reveal the full map'
          }
          aria-pressed={contentHidden}
          className="pointer-events-auto absolute right-6 top-2 z-20 inline-flex items-center gap-2 border border-hair bg-[color:var(--bg)]/55 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint backdrop-blur-sm transition duration-200 ease-out hover:border-hair-strong hover:text-ink sm:right-10 lg:right-16"
        >
          {contentHidden ? (
            <Maximize2 className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Minimize2 className="h-3 w-3" aria-hidden="true" />
          )}
          <span>{contentHidden ? 'Show' : 'Hide'}</span>
        </button>

        <motion.div
          initial={false}
          animate={{
            opacity: contentHidden ? 0 : 1,
            y: contentHidden ? -8 : 0,
          }}
          transition={toggleTransition}
          aria-hidden={contentHidden}
          className={`flex flex-1 flex-col ${contentHidden ? 'pointer-events-none' : ''}`}
        >
        {/* Eyebrow strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: after(0), ease: EASE_REVEAL }}
          className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-hair pb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
        >
          <span className="flex items-center gap-2 text-accent">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Open for new projects
          </span>
          <span className="hidden sm:inline">·</span>
          <span>TaylorURL LLC</span>
          <span className="hidden sm:inline">·</span>
          <span>Baytown, TX</span>
          <span className="ml-auto hidden sm:inline">Home</span>
        </motion.div>

        {/* Headline grid */}
        <div className="mt-12 grid flex-1 items-center gap-12 lg:mt-20 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: after(0.1), ease: EASE_REVEAL }}
              className="text-[clamp(2.7rem,7.4vw,6.2rem)] font-semibold leading-[0.95] tracking-tightest text-ink"
            >
              Real websites
              <br />
              for local{' '}
              <TypingRotator />
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: after(0.25), ease: EASE_REVEAL }}
              className="mt-10 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
            >
              I&apos;m Trenton. I build custom websites for local businesses around Baytown,
              Mont Belvieu, Pasadena, Deer Park, La Porte, and the greater Houston area —
              the kind that show up on Google, look like you know what you&apos;re doing,
              and bring in real customers. You talk to me directly. No agency, no runaround.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: after(0.4), ease: EASE_REVEAL }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Link
                to="/contact"
                className="group inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
              >
                Start a project
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/services"
                className="group inline-flex items-center gap-2.5 rounded-sm border border-hair-strong px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-ink transition duration-200 ease-out hover:bg-ink hover:text-bg active:scale-[0.98]"
              >
                See services
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: after(0.6) }}
              className="mt-12 flex items-center gap-5 border-l-2 border-accent/60 pl-5"
            >
              <div className="flex -space-x-2">
                {AVATAR_INITIALS.map(i => (
                  <div
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-sm border border-hair-strong bg-[color:var(--bg)] text-[10px] font-semibold uppercase tracking-[0.14em] text-ink"
                  >
                    {i}
                  </div>
                ))}
              </div>
              <div className="text-[13px] text-ink-soft">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  What you get
                </p>
                <p>
                  <span className="font-semibold text-ink">50+</span> local businesses
                  served. One person to call. No handoffs.
                </p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: after(0.5), ease: EASE_REVEAL }}
            className="hidden lg:flex lg:flex-col lg:items-end lg:gap-8"
          >
            <MockupCarousel />

            <div className="relative w-full max-w-sm border border-hair bg-[color:var(--bg)]/55 p-5 backdrop-blur-sm">
              <span
                aria-hidden
                className="absolute -top-px left-4 bg-[color:var(--bg)] px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
              >
                The basics
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 font-mono text-[11px] uppercase tracking-[0.18em]">
                {HERO_META.map(item => (
                  <div key={item.k} className="contents">
                    <dt className="text-ink-faint">{item.k}</dt>
                    <dd className="text-right text-ink">{item.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: after(0.85) }}
          className="mt-16 flex items-center justify-between border-t border-hair pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
        >
          <span>Scroll to keep reading</span>
          <span className="hidden sm:inline">A real person · a direct line · work you can be proud of</span>
          <span className="text-accent">↓</span>
        </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
