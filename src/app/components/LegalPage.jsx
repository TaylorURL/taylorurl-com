import { motion } from 'framer-motion'
import PageHero from './PageHero'
import { pageTransition, staggerChild } from '@constants/animations'

/**
 * Shared layout for legal pages (Privacy, Terms, License). Sets the cinematic
 * page hero, then renders dense long-form copy in a centred prose rail with
 * mono-numbered section headings to keep the engineering tone consistent.
 *
 * @param {object} props
 * @param {string} props.title - page heading
 * @param {string} props.description - subtitle text
 * @param {string} [props.eyebrow] - mono label for the hero ("// Legal" etc.)
 * @param {string} [props.effectiveDate] - "Last Updated" or "Effective Date" text
 * @param {string} [props.introText] - introductory paragraph before sections
 * @param {Array<{title: string, content: string | React.ReactNode}>} props.sections - content sections
 * @param {{heading: string, body: React.ReactNode}} [props.footer] - optional footer card
 * @param {React.ReactNode} [props.children] - additional content after sections
 */
export default function LegalPage({
  title,
  description,
  eyebrow = '// Legal',
  effectiveDate,
  introText,
  sections,
  footer,
  children,
}) {
  return (
    <motion.div {...pageTransition}>
      <PageHero title={title} description={description} eyebrow={eyebrow} />

      <section className="bg-paper py-20 sm:py-28">
        <div className="container-rail-tight">
          <div className="mx-auto max-w-[760px]">
            {effectiveDate && (
              <p className="text-paper-faint mb-10 font-mono text-[11px] uppercase tracking-[0.22em]">
                {effectiveDate}
              </p>
            )}

            {introText && (
              <p className="mb-10 text-[17px] leading-relaxed text-paper-soft">{introText}</p>
            )}

            {children}

            <div className="space-y-12">
              {sections.map((section, index) => (
                <motion.div key={section.title} {...staggerChild(index, 0.04)}>
                  <div className="mb-4 flex items-baseline gap-4">
                    <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2 className="text-[22px] font-semibold tracking-tight text-ink-paper sm:text-[26px]">
                      {section.title}
                    </h2>
                  </div>
                  {typeof section.content === 'string' ? (
                    <p className="text-[16px] leading-relaxed text-paper-soft">{section.content}</p>
                  ) : (
                    section.content
                  )}
                </motion.div>
              ))}
            </div>

            {footer && (
              <div className="border-hair-paper-strong mt-16 rounded-sm border p-6 sm:p-8">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                  {footer.heading}
                </p>
                <p className="text-[15px] leading-relaxed text-paper-soft">{footer.body}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  )
}
