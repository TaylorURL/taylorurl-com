import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { BTN_PRIMARY, SECTION_H2, SECTION_H2_DARK } from '@constants/ui'

/**
 * Decorative closing call-to-action shared by the marketing pages: a
 * grid-pattern backdrop, centered heading + blurb, and the "Get in Touch"
 * primary action. The `light` variant sits on a card surface; `dark` is the
 * full-bleed band.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title - heading content; include the
 *   accent <span> (logo-wave / logo-wave-dark) exactly as the page needs it
 * @param {string} props.description - supporting paragraph
 * @param {'light' | 'dark'} [props.variant] - visual treatment
 */
export default function CtaSection({ title, description, variant = 'light' }) {
  const isDark = variant === 'dark'
  return (
    <section
      className={`relative overflow-hidden py-12 sm:py-20 ${
        isDark ? 'bg-gray-950' : 'border-t border-gray-200 bg-surface-base'
      }`}
    >
      <div
        className={`absolute inset-0 ${
          isDark ? 'grid-pattern-blue opacity-[0.05]' : 'grid-pattern opacity-[0.015]'
        }`}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
          <h2 className={`mb-4 ${isDark ? SECTION_H2_DARK : SECTION_H2}`}>{title}</h2>
          <p className={`mb-8 text-base sm:text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {description}
          </p>
          <div className="flex justify-center">
            <Link to="/contact" className={`group ${BTN_PRIMARY}`}>
              Get in Touch
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
