import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import MockupCarousel from '@components/MockupCarousel'
import TypingRotator from '@components/TypingRotator'

const HERO_META = [
  { k: 'Based in', v: 'Baytown, TX' },
  { k: 'Built by', v: 'Trenton Taylor' },
]

const AVATAR_INITIALS = ['MR', 'JM', 'SC', 'DK']

export default function HeroSection() {
  return (
    <section className="relative isolate flex min-h-[100svh] items-stretch overflow-hidden bg-bg pt-24 text-ink">
      <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[640px] w-[1100px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/15 blur-[160px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[640px] rounded-full bg-accent/10 blur-[140px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col px-6 pb-16 pt-12 sm:px-10 sm:pb-24 lg:px-16">
        {/* Eyebrow strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-hair pb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
        >
          <span className="flex items-center gap-2 text-accent">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Online — Baytown, TX
          </span>
          <span className="hidden sm:inline">·</span>
          <span>TaylorURL LLC</span>
          <span className="hidden sm:inline">·</span>
          <span>v5 — 2026</span>
          <span className="ml-auto hidden sm:inline">// 00 — Index</span>
        </motion.div>

        {/* Headline grid */}
        <div className="mt-12 grid flex-1 items-center gap-12 lg:mt-20 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="text-[clamp(2.7rem,7.4vw,6.2rem)] font-semibold leading-[0.95] tracking-tightest text-ink"
            >
              Custom websites
              <br />
              for local{' '}
              <TypingRotator />
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
            >
              I&apos;m Trenton — I build websites for small businesses around Baytown, Mont
              Belvieu, Pasadena, Deer Park, La Porte, and the greater Houston area.
              Custom-built to help you get found on Google, look professional, and bring in
              more customers. You work with me directly, every step of the way.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-12 flex items-center gap-5 border-l-2 border-accent/60 pl-5"
            >
              <div className="flex -space-x-2">
                {AVATAR_INITIALS.map(i => (
                  <div
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-sm border border-hair-strong bg-surface-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink"
                  >
                    {i}
                  </div>
                ))}
              </div>
              <div className="text-[13px] text-ink-soft">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  Operating contract
                </p>
                <p>
                  <span className="font-semibold text-ink">50+</span> local businesses, one
                  operator, zero handoffs.
                </p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:flex lg:flex-col lg:items-end lg:gap-8"
          >
            <MockupCarousel />

            <div className="relative w-full max-w-sm border border-hair p-5">
              <span
                aria-hidden
                className="absolute -top-px left-4 bg-bg px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
              >
                Spec sheet
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
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-16 flex items-center justify-between border-t border-hair pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
        >
          <span>Scroll — 06 sections</span>
          <span className="hidden sm:inline">A real person · a direct line · craft you can feel</span>
          <span className="text-accent">↓</span>
        </motion.div>
      </div>
    </section>
  )
}
