import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { fadeInUp } from '@constants/animations'

/**
 * Reusable closing CTA band. Mirrors the contract used by `CtaSection` but
 * exposes optional secondary actions and an `accentText` slot for routes that
 * want a phrase rendered in the accent color (e.g. "Ready to get started?").
 *
 * @param {object} props
 * @param {string} props.heading - main heading text
 * @param {string} [props.accentText] - text rendered in the accent color
 * @param {string} props.description - supporting paragraph
 * @param {string} [props.primaryLabel] - primary button text
 * @param {string} [props.primaryTo] - primary button route
 * @param {string} [props.secondaryLabel] - secondary button text
 * @param {string} [props.secondaryTo] - secondary button route
 * @param {string} [props.eyebrow] - mono label rendered above the title
 * @param {'light' | 'dark'} [props.variant] - visual treatment
 */
export default function CtaBanner({
  heading,
  accentText,
  description,
  primaryLabel = 'Start a project',
  primaryTo = '/contact',
  secondaryLabel,
  secondaryTo,
  eyebrow = '// Next',
  variant = 'dark',
}) {
  const isDark = variant === 'dark'

  return (
    <section
      className={`relative overflow-hidden ${isDark ? 'bg-bg text-ink' : 'bg-paper text-ink-paper border-t border-hair-paper'}`}
    >
      <div
        className={`absolute inset-0 ${isDark ? 'grid-blueprint opacity-50' : 'grid-blueprint-paper opacity-50'}`}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${isDark ? 'via-accent/40' : 'via-accent/30'} to-transparent`}
        aria-hidden="true"
      />

      <motion.div
        {...fadeInUp}
        className="relative mx-auto w-full max-w-[1280px] px-6 py-28 sm:px-10 sm:py-36 lg:px-16"
      >
        <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              {eyebrow}
            </p>
            <h2
              className={`text-[clamp(2.2rem,5.2vw,4.2rem)] font-semibold leading-[1.02] tracking-tightest ${isDark ? 'text-ink' : 'text-ink-paper'}`}
            >
              {heading}
              {accentText && (
                <>
                  {' '}
                  <span className="text-accent">{accentText}</span>
                </>
              )}
            </h2>
          </div>
          <div className="flex flex-col items-start gap-7 lg:items-end lg:text-right">
            <p
              className={`max-w-md text-[16px] leading-relaxed ${isDark ? 'text-ink-soft' : 'text-paper-soft'}`}
            >
              {description}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to={primaryTo}
                className="group inline-flex items-center justify-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] font-semibold text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
              >
                {primaryLabel}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              {secondaryLabel && secondaryTo && (
                <Link
                  to={secondaryTo}
                  className={`inline-flex items-center justify-center gap-2.5 rounded-sm px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] font-semibold transition duration-200 ease-out active:scale-[0.98] ${
                    isDark
                      ? 'border border-hair-strong text-ink hover:bg-ink hover:text-bg'
                      : 'border border-hair-paper-strong text-ink-paper hover:bg-ink-paper hover:text-paper'
                  }`}
                >
                  {secondaryLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
