import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

/**
 * Reusable call-to-action banner used across multiple views.
 * @param {object} props
 * @param {string} props.heading - Main heading text
 * @param {string} [props.accentText] - Text rendered with brand gradient
 * @param {string} props.description - Supporting paragraph
 * @param {string} [props.primaryLabel] - Primary button text
 * @param {string} [props.primaryTo] - Primary button route
 * @param {string} [props.secondaryLabel] - Secondary button text
 * @param {string} [props.secondaryTo] - Secondary button route
 * @param {'light' | 'dark'} [props.variant] - Visual variant
 */
export default function CtaBanner({
  heading,
  accentText,
  description,
  primaryLabel = 'Get a Quote',
  primaryTo = '/pricing',
  secondaryLabel,
  secondaryTo,
  variant = 'dark',
}) {
  const isDark = variant === 'dark'

  return (
    <section className={`border-t border-gray-200 py-20 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2
            className={`mb-4 text-3xl font-bold md:text-4xl ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            {heading}{' '}
            {accentText && (
              <span className={isDark ? 'logo-wave' : 'logo-wave-dark'}>{accentText}</span>
            )}
          </h2>
          <p className={`mb-8 text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {description}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={primaryTo}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-4 font-semibold text-white transition-all hover:bg-blue-700"
            >
              {primaryLabel}
              <ArrowRight className="h-5 w-5" />
            </Link>
            {secondaryLabel && secondaryTo && (
              <Link
                to={secondaryTo}
                className={`inline-flex items-center gap-2 rounded-lg border px-8 py-4 font-semibold transition-all ${
                  isDark
                    ? 'border-gray-700 text-white hover:border-gray-500 hover:bg-gray-800'
                    : 'border-gray-900 text-gray-900 hover:scale-105 hover:bg-gray-200'
                }`}
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
