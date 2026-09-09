import { m } from 'framer-motion'
import { fadeInUp } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'

/**
 * A full-width band on one of the two grounds: a faint backdrop, a ruled header
 * carrying the label, the heading and whatever meta sits beside it, then the
 * band's own content.
 *
 * The heading carries the section's accessible name, so each band reads as its
 * own landmark and a screen reader lands on the heading rather than on an
 * unnamed region.
 *
 * An anchored band adds no scroll offset of its own: the document already
 * clears the fixed bar with `scroll-padding-top`, and a margin on top of that
 * lands the band lower than every other anchor target on the site.
 *
 * @param {object} props
 * @param {string} props.id - Anchor, and the base of the heading's own id.
 * @param {'paper' | 'sheet' | 'dark' | 'band'} [props.ground] - Which ground
 *   the band sits on.
 * @param {string} props.eyebrow - Standing label above the heading.
 * @param {import('react').ReactNode} props.title - Heading content.
 * @param {string} [props.description] - Supporting line under the heading.
 * @param {import('react').ReactNode} [props.meta] - Set opposite the heading.
 * @param {import('react').ReactNode} props.children - The band's content.
 */
export default function RuledSection({
  id,
  ground = 'paper',
  eyebrow,
  title,
  description,
  meta,
  children,
}) {
  const tone = GROUNDS[ground]

  return (
    <m.section
      id={id}
      aria-labelledby={`${id}-title`}
      {...fadeInUp}
      {...tone.attrs}
      className={`relative overflow-hidden border-t py-20 sm:py-28 ${tone.section}`}
    >
      <div className="container-rail relative">
        <header className={`mb-12 border-b pb-8 ${tone.rule}`}>
          <p className="section-label mb-4 text-accent">{eyebrow}</p>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <h2
              id={`${id}-title`}
              className={`display-4 max-w-2xl font-semibold leading-[1.05] tracking-tightest [text-wrap:balance] ${tone.title}`}
            >
              {title}
            </h2>
            {meta && <span className={`section-label-sm ${tone.meta} lg:text-right`}>{meta}</span>}
          </div>
          {description && (
            <p className={`mt-6 max-w-2xl text-[16px] leading-relaxed ${tone.body}`}>
              {description}
            </p>
          )}
        </header>
        {children}
      </div>
    </m.section>
  )
}
