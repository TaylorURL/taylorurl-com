import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { fadeInUp } from '@constants/animations'

/**
 * Closing call-to-action band shared across marketing routes. Two visual
 * treatments map to the section above: `dark` (cinematic, ink-on-black) and
 * `light` (paper). Both layouts share the same engineering eyebrow, oversized
 * display title, and single primary action — restraint over decoration.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title - heading content
 * @param {string} props.description - supporting paragraph
 * @param {string} [props.eyebrow] - mono label above the title
 * @param {'light' | 'dark'} [props.variant] - visual treatment
 */
export default function CtaSection({ title, description, eyebrow = '// Next', variant = 'dark' }) {
  const isDark = variant === 'dark'

  return (
    <section
      className={`relative overflow-hidden ${isDark ? 'bg-bg text-ink' : 'border-hair-paper border-t bg-paper text-ink-paper'}`}
    >
      <div
        className={`absolute inset-0 ${isDark ? 'grid-blueprint opacity-50' : 'grid-blueprint-paper opacity-50'}`}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${isDark ? 'via-accent/40' : 'via-accent/30'} to-transparent`}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-[1280px] px-6 py-28 sm:px-10 sm:py-36 lg:px-16">
        <motion.div {...fadeInUp} className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              {eyebrow}
            </p>
            <h2
              className={`text-[clamp(2.2rem,5.2vw,4.2rem)] font-semibold leading-[1.02] tracking-tightest ${isDark ? 'text-ink' : 'text-ink-paper'}`}
            >
              {title}
            </h2>
          </div>
          <div className="flex flex-col items-start gap-8 lg:items-end lg:text-right">
            <p
              className={`max-w-md text-[16px] leading-relaxed ${isDark ? 'text-ink-soft' : 'text-paper-soft'}`}
            >
              {description}
            </p>
            <Link
              to="/contact"
              className="group inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
            >
              Start a project
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
