import { ChevronLeft, ChevronRight } from 'lucide-react'
import ClientTestimonialCard from '@components/reviews/ClientTestimonialCard'
import useGlidingRail from '@hooks/reviews/useGlidingRail'

/** How long a column holds before the rail moves itself on. */
const DWELL_MS = 5200

/**
 * The quote length under which a review is short enough to share a column.
 *
 * Two stacked cards have to come out near the height of one, or the pair is the
 * tallest thing in the rail and every solo review beside it stands in a column
 * of air. That is what a generous threshold bought: two reviews of ninety and a
 * hundred and twenty-five characters paired to five hundred and seventy pixels
 * beside solo cards of three hundred and thirty.
 *
 * A card is about a hundred and ninety pixels before its quote, so pairing only
 * pays where both quotes run to a line or two. Below this they do. Above it the
 * review takes a column to itself, which is why most of them currently do.
 *
 * It is a count of characters rather than a measured height because the
 * measurement is only available after a layout the packing happens before.
 */
const SHORT_QUOTE = 100

/**
 * The reviews packed into columns, in the order they are held.
 *
 * A long review takes a column to itself. A short one opens a column, and the
 * next short review joins it, however many long ones stand between the two. The
 * pair lands at the position of its first member rather than its second, so the
 * rail reads in the order the reviews are written down and packing never
 * silently reorders them.
 *
 * Only a short review may join an open pair. Letting the next review in
 * whatever its length is the same bug in a friendlier shape: a long quote
 * stacked under a short one is the tall column the packing exists to avoid.
 *
 * @param {object[]} reviews Entries from `CLIENT_REVIEW_LIST`.
 * @returns {object[][]} Columns of one or two reviews.
 */
function packColumns(reviews) {
  const columns = []
  let openPair = null
  for (const review of reviews) {
    const short = review.quote.length <= SHORT_QUOTE
    if (short && openPair) {
      openPair.push(review)
      openPair = null
      continue
    }
    const column = [review]
    columns.push(column)
    if (short) openPair = column
  }
  return columns
}

/**
 * The reviews on a rail that moves itself along.
 *
 * The moving is `useGlidingRail`, which the ratings row above it rides too.
 * What is left here is the part that is about reviews: how two short quotes
 * come to share a column, and the arrows and dots a full-width row can afford.
 *
 * @param {object} props
 * @param {object[]} props.reviews Entries from `CLIENT_REVIEW_LIST`.
 */
export default function ReviewCarousel({ reviews }) {
  const columns = packColumns(reviews)
  const { rail, at, lastStop, goTo, step, hold } = useGlidingRail({
    count: columns.length,
    dwellMs: DWELL_MS,
  })

  return (
    <div
      className="flex flex-col gap-6"
      role="group"
      aria-roledescription="carousel"
      aria-label="Reviews clients have left"
      {...hold}
    >
      <div
        ref={rail}
        className="review-rail flex snap-x snap-mandatory items-start gap-5 overflow-x-auto pb-1"
      >
        {columns.map(column => (
          <div
            key={column[0].displayUrl}
            className="flex w-full shrink-0 snap-start flex-col gap-5 md:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
          >
            {column.map((review, index) => (
              <ClientTestimonialCard key={review.displayUrl} review={review} index={index} />
            ))}
          </div>
        ))}
      </div>

      {/* The controls only exist where there is somewhere to go. One screenful
          of reviews is a row, and a row with a disabled arrow at each end is a
          carousel apologising for not being one. */}
      {lastStop > 0 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={at === 0}
            aria-label="Previous reviews"
            className="review-rail-step"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: lastStop + 1 }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show reviews from position ${index + 1} of ${lastStop + 1}`}
                aria-current={index === at ? 'true' : undefined}
                data-on={index === at ? 'true' : undefined}
                className="review-rail-dot"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={at === lastStop}
            aria-label="Next reviews"
            className="review-rail-step"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
