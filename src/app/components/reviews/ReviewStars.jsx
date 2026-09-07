import { Star } from 'lucide-react'
import TrustpilotStars from '@components/reviews/TrustpilotStars'
import { reviewSourceStarInk } from '@components/marks/reviewMarks'
import { reviewSource } from '@data/reputation/reviews'

/** How far the rating carries into one star, clamped to that star. */
function reachInto(rating, index) {
  return Math.max(0, Math.min(1, rating - index))
}

/**
 * A rating, drawn the way the network that holds it draws its own.
 *
 * Every network is scored out of five and every one of them draws that five
 * differently, and the difference is the part a reader recognises before they
 * read a word. Trustpilot's is five filled tiles with a white star cut out of
 * each, and it is drawn by the component that owns that form. The rest set
 * loose stars in their own ink against a ghosted rest, which is the form Google
 * and BBB both publish.
 *
 * Flattening all of them into one house style would be the tidier page and the
 * weaker claim: a rating in this site's own shape is a rating this site drew,
 * and the whole point of the row is that somebody else did.
 *
 * @param {object} props
 * @param {number} [props.rating] The score out of five, drawn to the half star.
 * @param {string} [props.source] A `REVIEW_SOURCES` key.
 * @param {number} [props.size] The height of one star in pixels.
 * @param {string} [props.className] Passed to the row.
 */
export default function ReviewStars({
  rating = 5,
  source = 'trustpilot',
  size = 22,
  className = '',
}) {
  if (source === 'trustpilot') {
    return <TrustpilotStars rating={rating} size={size} className={className} />
  }

  const ink = reviewSourceStarInk(source)
  const label = reviewSource(source)?.label ?? 'this listing'

  return (
    <div
      className={`flex gap-[3px] ${className}`}
      role="img"
      aria-label={`Rated ${rating} out of 5 on ${label}`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="relative block shrink-0"
          style={{ width: `${size}px`, height: `${size}px` }}
        >
          <Star
            className="absolute inset-0"
            strokeWidth={1.5}
            style={{ width: `${size}px`, height: `${size}px`, color: 'var(--paper-ink-ghost)' }}
          />
          {/* The filled star is laid over the ghosted one and cropped to how
              far the rating carries, so a half is a half rather than the
              nearest whole. */}
          <span
            className="absolute inset-y-0 left-0 block overflow-hidden"
            style={{ width: `${reachInto(rating, index) * 100}%` }}
          >
            <Star
              strokeWidth={0}
              style={{ width: `${size}px`, height: `${size}px`, color: ink, fill: ink }}
            />
          </span>
        </span>
      ))}
    </div>
  )
}
