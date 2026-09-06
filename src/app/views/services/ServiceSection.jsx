import { m } from 'framer-motion'
import { fadeInUp } from '@constants/animations'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'

/**
 * One section of a service page: a full-width ground, a ruled header carrying
 * its label, its heading, and anything the section keeps beside it, then the
 * section's own content.
 *
 * The heading carries the section's accessible name, so each one reads as its
 * own landmark and a screen reader lands on the heading rather than on an
 * unnamed region.
 *
 * An anchored section adds no scroll offset of its own: the document already
 * clears the fixed bar with `scroll-padding-top`, and a margin on top of that
 * lands the section lower than every other anchor target on the site.
 *
 * @param {object} props
 * @param {string} props.id - Section id, and the stem of its heading's id.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the section sits on.
 * @param {string} props.eyebrow - The label standing over the heading.
 * @param {string} props.title - The section heading.
 * @param {string} [props.lede] - A paragraph under the heading.
 * @param {import('react').ReactNode} [props.meta] - Content set beside the heading.
 */
export default function ServiceSection({
  id,
  ground = 'paper',
  eyebrow,
  draft = 'plan',
  seam = 'band',
  title,
  lede,
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
      className={`section-y relative overflow-hidden border-t ${tone.section}`}
    >
      <div
        className={`absolute inset-0 ${tone.grid} ${DRAFTS[draft]} ${SEAMS[seam]}`.trimEnd()}
        aria-hidden="true"
      />
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
            {meta}
          </div>
          {lede && (
            <p className={`mt-6 max-w-2xl text-[16px] leading-relaxed ${tone.body}`}>{lede}</p>
          )}
        </header>
        {children}
      </div>
    </m.section>
  )
}
