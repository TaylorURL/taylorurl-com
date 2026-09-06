import ReviewStandingBadge from '@components/ReviewStandingBadge'
import useGlidingRail from '@hooks/useGlidingRail'
import useReviewStandings from '@hooks/useReviewStandings'

/**
 * How long one badge holds before the rail moves itself on.
 *
 * Shorter than the reviews rail below it, and not a multiple of it, because two
 * rows in the same section stepping together read as the page twitching rather
 * than as two things each getting on with their own.
 */
const DWELL_MS = 4400

/**
 * Every rating this business carries, one network at a time.
 *
 * The proof is spread across five listings and no reader is going to visit five
 * profiles, so the badges come to them. Each is the same box in a different
 * network's colours, linked to the page it was read off, and the rail moves
 * through them on its own because the column it stands in has room for one.
 *
 * The order is the registry's, which puts the accreditation first: it is the
 * one a buyer checks to find out whether a company is real. A network with
 * nothing published on it yet is not on the rail at all, rather than being a
 * badge that reads zero.
 */
export default function ReviewStandingRail() {
  const standings = useReviewStandings()
  const { rail, at, lastStop, goTo, hold } = useGlidingRail({
    count: standings.length,
    dwellMs: DWELL_MS,
    // The column is narrower than two badges and wider than one, so a badge
    // half in view is half out of it. Counting only whole badges is what keeps
    // the last stop from landing with one cut down the middle.
    fit: 'floor',
  })

  if (standings.length === 0) return null

  return (
    <div
      className="flex w-full flex-col gap-3"
      role="group"
      aria-roledescription="carousel"
      aria-label="Ratings on the listings this business is reviewed on"
      {...hold}
    >
      <div
        ref={rail}
        className="review-rail flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-1"
      >
        {/* Wide enough that the longest of these lines - a count of
            recommendations with the network named after it - stays on one line,
            and never wider than the column it stands in, so a narrow screen
            gets one whole badge rather than one badge and a sliver. */}
        {standings.map(standing => (
          <div key={standing.key} className="w-[min(100%,22rem)] shrink-0 snap-start">
            <ReviewStandingBadge standing={standing} />
          </div>
        ))}
      </div>

      {/* Dots and nothing else. The row is a third of the page wide and sits
          above a carousel that already carries a pair of arrows; a second pair
          here would be more chrome than badges. */}
      {lastStop > 0 && (
        <div className="flex items-center gap-2 lg:justify-end">
          {Array.from({ length: lastStop + 1 }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show rating ${index + 1} of ${lastStop + 1}`}
              aria-current={index === at ? 'true' : undefined}
              data-on={index === at ? 'true' : undefined}
              className="review-rail-dot"
            />
          ))}
        </div>
      )}
    </div>
  )
}
