import { motion } from 'framer-motion'
import PageHero from './PageHero'
import { pageTransition, staggerChild } from '@constants/animations'

/**
 * Shared layout for legal pages (Privacy, Terms, License).
 * Eliminates ~180 lines of structural duplication across three views.
 * @param {object} props
 * @param {string} props.title - Page heading
 * @param {string} props.description - Subtitle text
 * @param {string} [props.effectiveDate] - "Last Updated" or "Effective Date" text
 * @param {string} [props.introText] - Introductory paragraph before sections
 * @param {Array<{title: string, content: string | React.ReactNode}>} props.sections - Content sections
 * @param {{heading: string, body: React.ReactNode}} [props.footer] - Optional footer card
 * @param {React.ReactNode} [props.children] - Additional content after sections
 */
export default function LegalPage({
  title,
  description,
  effectiveDate,
  introText,
  sections,
  footer,
  children,
}) {
  return (
    <motion.div {...pageTransition}>
      <PageHero title={title} description={description} />

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            {effectiveDate && <p className="mb-8 text-sm text-gray-500">{effectiveDate}</p>}

            <div className="prose prose-gray max-w-none">
              {introText && <p className="mb-8 text-gray-600">{introText}</p>}

              {children}

              {sections.map((section, index) => (
                <motion.div
                  key={section.title}
                  {...staggerChild(index, 0.05)}
                  className="mb-8"
                >
                  <h2 className="mb-4 text-xl font-semibold text-gray-900">{section.title}</h2>
                  {typeof section.content === 'string' ? (
                    <p className="text-gray-600">{section.content}</p>
                  ) : (
                    section.content
                  )}
                </motion.div>
              ))}

              {footer && (
                <div className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-6">
                  <h3 className="mb-2 font-semibold text-gray-900">{footer.heading}</h3>
                  <p className="text-gray-600">{footer.body}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  )
}
