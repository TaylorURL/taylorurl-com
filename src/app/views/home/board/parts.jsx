import { TYPE } from '@components/kit/styles'
import { leadOf } from './boardData'

/**
 * The row of four short facts under the opening screen: the speed score, the
 * accreditation, the rating and the turnaround. Each is a figure and a few
 * words, read across in one glance.
 */
export function ProofRow({ items, className = '' }) {
  return (
    <dl
      className={`grid grid-cols-2 gap-x-6 gap-y-6 border-y border-[var(--line)] py-6 sm:grid-cols-4 ${className}`.trim()}
    >
      {items.map(({ value, label }) => (
        <div key={label}>
          <dt className="sr-only">{label}</dt>
          <dd>
            <span className={`${TYPE.h3} block`}>{value}</span>
            <span className={`${TYPE.small} mt-0.5 block`}>{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * One reason to pick the studio: a short heading and a sentence or two.
 */
export function Reason({ title, children }) {
  return (
    <div>
      <h3 className={TYPE.h3}>{title}</h3>
      <p className={`${TYPE.body} mt-2`}>{children}</p>
    </div>
  )
}

/**
 * A review, quoted as its first sentences, with who wrote it and where. A
 * network that rates out of five gets its score; one that only recommends says
 * so. The score is always the review's own.
 */
export function Quote({ review, sentences = 1, className = '' }) {
  const lead = leadOf(review.quote, sentences)
  return (
    <figure className={className}>
      <blockquote className="text-[20px] leading-[1.5] text-ink sm:text-[22px] [text-wrap:pretty]">
        “{lead}”
      </blockquote>
      <figcaption className={`${TYPE.small} mt-3`}>
        {review.name}, {review.business} ·{' '}
        {review.rating
          ? `${review.rating}/5 on ${review.network}`
          : `Recommends on ${review.network}`}
      </figcaption>
    </figure>
  )
}
