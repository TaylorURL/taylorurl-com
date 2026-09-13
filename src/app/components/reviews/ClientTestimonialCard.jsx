import { useState } from 'react'
import { m } from 'framer-motion'
import { ThumbsUp } from 'lucide-react'
import ReviewStars from '@components/reviews/ReviewStars'
import TrustpilotLogo from '@components/marks/TrustpilotLogo'
import { reviewSourceInk, reviewSourceMark } from '@components/marks/reviewMarks'
import { staggerChild } from '@constants/animations'
import { reviewLogoSrc, reviewSource } from '@data/reputation/reviews'

/**
 * The network the words were published on, named in the card's top corner and
 * linking to the profile they can be read on.
 *
 * Trustpilot publishes a wordmark, and a reader picks that shape out before
 * they have read a letter of it, so that is what is drawn for it. The rest get
 * their mark beside their name in their own colour, which is the form each of
 * them uses for itself. The point of the corner is the same either way: these
 * words are somewhere else, under a name that is not this site's, and the
 * corner is the way there. It is the same place the capability cards above
 * keep their way in, so a card on this page has one shape wherever it is.
 *
 * @param {{ source: string }} props A `REVIEW_SOURCES` key.
 */
function ReviewSourceName({ source }) {
  const network = reviewSource(source)
  if (!network) return null
  const Mark = reviewSourceMark(source)
  return (
    <a
      href={network.reads}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={network.longLabel}
      /* The mark is small and is the one thing in the corner a reader can
         press, so the drawing stays at its size and the reach around it is
         opened to the forty-four a thumb needs. */
      className="relative flex shrink-0 touch-manipulation items-center gap-2 text-[14px] font-semibold text-ink-paper transition-colors duration-200 before:absolute before:-inset-3 before:content-[''] hover:text-[color:var(--review-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] active:scale-[0.97]"
    >
      {source === 'trustpilot' ? (
        <TrustpilotLogo className="h-[15px] w-auto shrink-0" />
      ) : (
        <>
          {Mark && <Mark className="h-4 w-4" style={{ color: 'var(--mark-brand)' }} />}
          {network.label}
        </>
      )}
    </a>
  )
}

/**
 * What a network puts where a rating would go when it does not collect one.
 *
 * Facebook asks whether somebody recommends a business rather than for a score
 * out of five, so a Facebook card has nothing to draw five of. It draws the
 * thing Facebook actually draws instead. The alternative is filling the row
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
 * The reviewer's own mark, standing on the card.
 *
 * It stood on a white tile for a while, on the reasoning that these are logos
 * drawn for a light ground. The tile went with the network tint: a white
 * square is the one thing on an ivory card that reads as pasted on, and on the
 * charcoal it is a lamp. The mark takes the box the tile had and nothing
 * behind it; a logo that carries its own ground carries it, which is that
 * business's mark and not this page's to recolour.
 *
 * The initials stand in only where no logo arrives, rather than underneath
 * the image, because a logo with a transparent ground would show them through
 * itself.
 */
function ClientAvatar({ name, business, displayUrl }) {
  const [missing, setMissing] = useState(false)
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-paper">
      {missing ? (
        initials
      ) : (
        <img
          src={reviewLogoSrc(displayUrl)}
          alt={`${business} logo`}
          width="44"
          height="44"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setMissing(true)}
        />
      )}
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
 * It is the same object as the capability card in the band above it: the
 * page's own paper, the one hairline ring and lift, the same corner and the
 * same padding. For a while it was a card in the network's colours, tinted and
 * keylined in Trustpilot green or Google blue, and three of those in a row
 * under a band of plain cards read as three widgets pasted onto the page. What
 * belongs to the network is the rating, which is drawn the way the network
 * draws it, and the name in the corner, which is the way to the profile. That
 * is one custom property set on the card and read by both, so a network added
 * to the registry arrives with its own colour rather than with a branch here.
 *
 * The caption comes first, the way the capability card opens on its heading:
 * who is speaking, the site they are talking about, and the mark of the
 * network that says the words can be found on a profile. The rating follows
 * and the quote runs under it. The caption stays on the case-study page even
 * though the page already names the business, because a quote a reader cannot
 * trace is worth less than the space it takes.
 *
 * The card takes the height it is given rather than the height its quote asks
 * for. The rail stands its columns to the height of the row and the column
 * hands that down to the figure, so three reviews of three lengths come out as
 * one row with one bottom edge, and what a short quote leaves over is air
 * under its last line. Where there is no height to take - the single card on
 * a case study - the figure is as tall as what is in it.
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
      className={`review-card card-lift relative flex flex-1 flex-col gap-6 overflow-hidden bg-paper p-8 sm:p-10 ${className}`.trim()}
      data-source={review.source}
      style={{ '--review-ink': reviewSourceInk(review.source) }}
    >
      {/* The caption reserves the height of a name over three label lines,
          which is what a business whose name runs to two lines takes. Without
          it that one card starts its rating and its quote a line lower than
          the cards beside it, and a row that lines up everywhere else reads
          as lined up nowhere. */}
      <figcaption className="flex min-h-[4.0625rem] items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
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
        </div>
        <ReviewSourceName source={review.source} />
      </figcaption>
      {/* Eighteen rather than twenty-two, which takes about a third off the
          area the rating lights up without touching a colour. The row still
          reads as five stars from across the room; it just stops arriving
          before the quote does. */}
      {typeof review.rating === 'number' ? (
        <ReviewStars rating={review.rating} source={review.source} size={18} />
      ) : (
        <ReviewEndorsement source={review.source} />
      )}
      <blockquote className="text-[17px] leading-[1.55] tracking-tight text-ink-paper">
        &ldquo;{review.quote}&rdquo;
      </blockquote>
    </m.figure>
  )
}
