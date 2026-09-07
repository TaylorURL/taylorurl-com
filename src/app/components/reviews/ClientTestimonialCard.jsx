import { m } from 'framer-motion'
import { ThumbsUp } from 'lucide-react'
import ReviewStars from '@components/reviews/ReviewStars'
import TrustpilotLogo from '@components/marks/TrustpilotLogo'
import { reviewSourceInk, reviewSourceMark } from '@components/marks/reviewMarks'
import { staggerChild } from '@constants/animations'
import { reviewLogoSrc, reviewSource } from '@data/reputation/reviews'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'

/**
 * The network the words were published on, named in the card's top corner.
 *
 * Trustpilot publishes a wordmark, and a reader picks that shape out before
 * they have read a letter of it, so that is what is drawn for it. The rest get
 * their mark beside their name in their own colour, which is the form each of
 * them uses for itself. The point of the corner is the same either way: these
 * words are somewhere else, under a name that is not this site's.
 *
 * @param {{ source: string }} props A `REVIEW_SOURCES` key.
 */
function ReviewSourceName({ source }) {
  if (source === 'trustpilot') {
    return <TrustpilotLogo className="h-[15px] w-auto shrink-0 text-ink-paper" />
  }
  const network = reviewSource(source)
  if (!network) return null
  const Mark = reviewSourceMark(source)
  return (
    <span className="flex shrink-0 items-center gap-2 text-[14px] font-semibold text-ink-paper">
      {Mark && <Mark className="h-4 w-4" style={{ color: 'var(--mark-brand)' }} />}
      {network.label}
    </span>
  )
}

/**
 * What a network puts where a rating would go when it does not collect one.
 *
 * Facebook asks whether somebody recommends a business rather than for a score
 * out of five, so a Facebook card has nothing to draw five of. It draws the
 * thing Facebook actually draws instead. The alternative is filling the corner
 * with five stars nobody left, which is the one thing a review card must never
 * do.
 *
 * @param {{ source: string }} props A `REVIEW_SOURCES` key.
 */
function ReviewEndorsement({ source }) {
  const word = reviewSource(source)?.endorses
  if (!word) return null
  return (
    <span
      className="flex items-center gap-2 text-[15px] font-semibold"
      style={{ color: 'var(--review-ink)' }}
    >
      <ThumbsUp className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
      {word}
    </span>
  )
}

/**
 * The reviewer's own mark, on a white tile.
 *
 * The ground is white in both themes rather than the section's, because these
 * are logos drawn for a light background and one of them is mostly black. A
 * tile that followed the theme would take that mark down to a silhouette of
 * itself on the dark side.
 *
 * The initials stay underneath as the fallback, so a logo that has not been
 * captured yet leaves a labelled tile rather than a hole.
 */
function ClientAvatar({ name, business, displayUrl }) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
  return (
    <div className="border-hair-paper-strong relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)] border bg-white text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--on-white)]">
      {initials}
      <img
        src={reviewLogoSrc(displayUrl)}
        alt={`${business} logo`}
        width="44"
        height="44"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain p-1"
        onError={event => {
          event.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}

/**
 * One client review, drawn the same wherever it is shown.
 *
 * The home page shows every review together and a case study shows the one
 * about that build, so the card is held here rather than in either. Two copies
 * would drift, and a reader who met the same quote under two different marks
 * has been given a reason to doubt both.
 *
 * The figcaption is the whole claim: the reviewer's name, the site they are
 * talking about, and the mark of the network that says the words can be found
 * on a profile. It stays on the case-study page even though the page already
 * names the business, because a quote a reader cannot trace is worth less than
 * the space it takes.
 *
 * The card takes its accent from the network the review was left on rather than
 * from the site, so a row of cards from three networks reads as three places
 * somebody went and wrote something rather than as one styled list. That is one
 * custom property set on the card and read by everything inside it, so a
 * network added to the registry arrives with its own colour rather than with a
 * branch in here.
 *
 * @param {object} props
 * @param {{displayUrl: string, name: string, business: string, quote: string,
 *   rating?: number, place?: string, source: string}} props.review An entry
 *   from `CLIENT_REVIEW_LIST`.
 * @param {number} [props.index] Position in its row, which sets how long the
 *   card waits before it arrives.
 * @param {string} [props.className] Passed to the figure, so the surface
 *   showing it decides its width.
 */
export default function ClientTestimonialCard({ review, index = 0, className = '' }) {
  return (
    <m.figure
      {...staggerChild(index, 0.06)}
      className={className || undefined}
      data-source={review.source}
      style={{ '--review-ink': reviewSourceInk(review.source) }}
    >
      <SpotlightCard
        className="review-card card-lift group flex flex-col gap-6 p-6 sm:p-7"
        spotlightColor="color-mix(in srgb, var(--review-ink) 14%, transparent)"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Eighteen rather than twenty-two, which takes about a third off the
              area the rating lights up without touching a colour. The row still
              reads as five stars from across the room; it just stops arriving
              before the quote does. */}
          {typeof review.rating === 'number' ? (
            <ReviewStars rating={review.rating} source={review.source} size={18} />
          ) : (
            <ReviewEndorsement source={review.source} />
          )}
          <ReviewSourceName source={review.source} />
        </div>
        <blockquote className="text-[17px] leading-[1.55] tracking-tight text-ink-paper">
          &ldquo;{review.quote}&rdquo;
        </blockquote>
        <figcaption className="border-hair-paper mt-auto flex items-center gap-4 border-t pt-4">
          <ClientAvatar
            name={review.name}
            business={review.business}
            displayUrl={review.displayUrl}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-[14px] font-semibold text-ink-paper">{review.name}</div>
            <a
              href={`https://${review.displayUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              /* The name is set at the small label size and is the only thing
                 in the caption a reader can press, so the drawing stays at its
                 twelve pixels and the reach around it is opened to the forty-four
                 a thumb needs. The two lines it grows over carry no action of
                 their own, so nothing is taken from them. */
              className="section-label-sm text-paper-faint relative touch-manipulation transition-colors duration-200 before:absolute before:-inset-y-4 before:inset-x-0 before:content-[''] hover:text-[color:var(--review-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] active:scale-[0.97]"
            >
              {review.business}
            </a>
            {review.place && (
              <div className="section-label-sm text-paper-faint">{review.place}</div>
            )}
          </div>
        </figcaption>
      </SpotlightCard>
    </m.figure>
  )
}
