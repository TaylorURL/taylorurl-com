import { ThumbsUp } from 'lucide-react'
import ReviewStars from '@components/reviews/ReviewStars'
import TrustpilotLogo from '@components/marks/TrustpilotLogo'
import { reviewSourceFill, reviewSourceMark } from '@components/marks/reviewMarks'
import { reviewSource } from '@data/reputation/reviews'

/** The wrapper geometry, shared by the placeholder and every badge, so none of
    them can drift from the others. */
const SHELL =
  'border-hair-paper-strong flex h-full w-full items-center justify-center gap-4 rounded-[var(--r-control)] border bg-paper px-5 py-3 text-ink-paper'

/**
 * The focus ring, drawn inside the badge rather than around it.
 *
 * A badge fills its slot on a rail that scrolls, and anything that scrolls
 * clips what its children paint outside themselves - on every side, because a
 * box told to scroll one axis becomes a scroll container on both. The site's
 * ring stands three pixels clear of what it marks, so around a badge it would
 * be cut off at the top and cut off again down the left the moment the badge it
 * marks is the one at the near edge. Turned inward it lands on the badge's own
 * paper, inside the same border, and a reader tabbing along the rail sees the
 * whole of it wherever the rail happens to be standing.
 */
const RING = 'focus-visible:outline-offset-[-4px]'

/**
 * The box the standing's own drawing sits in.
 *
 * It takes the width of whatever it is handed rather than holding one width for
 * every network, because the networks genuinely differ by a lot: a seal comes to
 * ninety-five pixels, five stars to a hundred and two, and a recommendation mark
 * to thirty. Padding every badge out to the widest would put a hole in the
 * shortest and push the longest line on the rail - a count of recommendations
 * with the network named after it - off the end of a phone. The badge is centred
 * in its box instead, so what a network has to say sits in the middle of the
 * same container whatever length it runs to.
 */
const GLYPH = 'flex shrink-0 items-center'

/**
 * A standing before it has arrived.
 *
 * It holds the same wrapper, the same gap and the same two stacked lines as a
 * badge, so the rail is laid out at its final height from the first paint and
 * nothing moves when a rating lands. The bars stand in for the two lines of
 * text at the heights those lines actually take.
 */
function StandingPlaceholder() {
  const bar = 'bg-[color:var(--wash-paper-strong)]'
  return (
    <div className={SHELL} data-loading="" aria-hidden="true">
      <div className={`${GLYPH} h-[18px] w-[102px] rounded ${bar}`} />
      <div className="flex w-[9.5rem] flex-col leading-tight">
        <div className={`h-[12px] rounded ${bar}`} />
        <div className={`mt-[3px] h-[12px] rounded ${bar}`} />
      </div>
    </div>
  )
}

/** How tall a seal is drawn. Wide enough that the lockup is still the shape
    BBB issued, and near enough the two lines beside it that the badge is the
    same height as every other one on the rail. */
const SEAL_HEIGHT = 30

/**
 * The standing, drawn the way the network that holds it draws its own.
 *
 * Three networks score out of five and hand the drawing to `ReviewStars`, which
 * already knows that Trustpilot's five is filled tiles and everybody else's is
 * loose stars. The other two do not score out of five at all, and neither gets
 * five stars invented for it.
 *
 * BBB issues a seal instead, and the seal is the drawing: it is shown whole,
 * unaltered and at its own proportions, because that is the condition it is
 * licensed on and because a lockup redrawn to fit stops being the thing a
 * reader recognises. Facebook publishes no artwork and no score, only whether
 * somebody recommends a business, so it gets a chip in its own blue carrying
 * the mark that question is asked with.
 *
 * @param {{ standing: object }} props A standing carrying the network's key.
 */
function StandingRating({ standing }) {
  const { key, rating, stars, seal } = standing
  if (typeof rating === 'number') {
    return <ReviewStars rating={stars ?? rating} source={key} size={18} />
  }
  if (seal) {
    return (
      // On a white tile in both settings rather than on the card, which is the
      // rule the footer already ships this artwork under and the reason it
      // gives: the lockup is drawn for a light ground, it carries its own
      // lettering and its own blue, and on the dark setting's near-black field
      // its teal half falls to under three to one against what it sits on. The
      // tile is also what keeps one mark from reading two ways on one page.
      //
      // It hugs the seal and takes the seal's own corner, which is the other
      // half of that rule. A tile wider than the artwork is white the network
      // did not issue, and on a dark card it is the lit thing in a row of
      // muted ones - the badge beside it draws five stars and nothing behind
      // them. Cutting the tile to the file's own curve leaves the seal reading
      // as the seal rather than as a sticker on the rail.
      <span
        className="flex bg-white"
        style={{ borderRadius: `${(SEAL_HEIGHT * seal.radius) / seal.height}px` }}
      >
        <img
          src={seal.src}
          alt=""
          width={seal.width}
          height={seal.height}
          loading="lazy"
          decoding="async"
          style={{ height: `${SEAL_HEIGHT}px`, width: 'auto' }}
        />
      </span>
    )
  }
  return (
    <span
      className="flex h-[18px] items-center rounded-[var(--r-tiny)] px-2 leading-none"
      style={{ backgroundColor: reviewSourceFill(key), color: 'var(--on-accent)' }}
    >
      <ThumbsUp className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
    </span>
  )
}

/**
 * The network's own name, at the end of the line that counts its reviews.
 *
 * Trustpilot publishes a wordmark and a reader picks that shape out before they
 * have read a letter of it, so that is what is drawn for it. The rest get their
 * mark beside their name in their own colour, which is the form each of them
 * uses for itself.
 *
 * @param {{ source: object }} props An entry from `REVIEW_SOURCES`.
 */
function StandingNetwork({ source }) {
  if (source.key === 'trustpilot') return <TrustpilotLogo className="h-3 w-auto" />
  const Mark = reviewSourceMark(source.key)
  return (
    <span className="inline-flex items-center gap-1">
      {Mark && <Mark className="h-3 w-3" style={{ color: 'var(--mark-brand)' }} />}
      {source.label}
    </span>
  )
}

/**
 * The standing itself, said in as few words as the network says it in.
 *
 * Two parts, either of which a network may not have. The score is the number it
 * counts in, which for the four networks that count is out of five. The verdict
 * is the words the network puts on that standing, and only two publish any:
 * Trustpilot bands a trust score and names the band, and BBB names what it has
 * accredited a business as. Where both exist the words lead and the number
 * follows, which is the order Trustpilot prints it in.
 *
 * A network with neither has still said something, or there would be no badge:
 * Facebook asks whether somebody recommends a business rather than for a score,
 * and the word it uses for yes is the one the registry already holds.
 *
 * @param {object} standing A standing carrying the network's key.
 * @param {object} source The entry from `REVIEW_SOURCES` it belongs to.
 * @returns {string} One short line.
 */
function verdictOf(standing, source) {
  const score = typeof standing.rating === 'number' ? `${standing.rating.toFixed(1)} / 5` : ''
  if (!score) return standing.verdict ?? source.endorses ?? source.longLabel
  return standing.verdict ? `${standing.verdict} · ${score}` : score
}

/**
 * How many people said it, and what the network calls what they left.
 *
 * A network that has accredited a business nobody has yet written about says
 * who did the rating rather than reading out a count of zero, which is the one
 * number on a badge like this that argues against the business showing it.
 *
 * @param {object} standing A standing carrying the network's key.
 * @param {object} source The entry from `REVIEW_SOURCES` it belongs to.
 * @returns {string} The lead of the second line, ending in the word before the
 *   network's name.
 */
function countOf(standing, source) {
  const count = standing.reviewCount
  if (!(count > 0)) return 'Rated by'
  const word = source.endorses ? 'recommendation' : 'review'
  return `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'} on`
}

/**
 * The whole claim in one sentence, for a reader who is listening rather than
 * looking. The badge itself is a link out to the profile, and its label has to
 * say what is on the other end of it.
 *
 * @param {object} standing A standing carrying the network's key.
 * @param {object} source The entry from `REVIEW_SOURCES` it belongs to.
 * @returns {string} The link's label.
 */
function labelOf(standing, source) {
  const count = standing.reviewCount
  const on = source.label
  if (typeof standing.rating === 'number') {
    return `${standing.rating} out of 5 based on ${count.toLocaleString()} ${on} review${
      count === 1 ? '' : 's'
    }`
  }
  if (standing.seal) return `${standing.verdict}, on the ${on} profile`
  return `Recommended by ${count.toLocaleString()} ${count === 1 ? 'person' : 'people'} on ${on}`
}

/**
 * One network's standing, in the box every network's standing is shown in.
 *
 * A rating is the cheapest thing a buyer checks and the easiest thing for a
 * site to make up, so every one of these is a link to the page it was read off
 * and is drawn in that network's own colours. Five badges in this site's accent
 * would read as five scores this site awarded itself.
 *
 * @param {object} props
 * @param {object} props.standing A showable standing, carrying the key of the
 *   network it belongs to. `pending` instead draws the placeholder, which is
 *   what a live reading that has not arrived yet holds its place with.
 */
export default function ReviewStandingBadge({ standing }) {
  if (standing.pending) return <StandingPlaceholder />
  const source = reviewSource(standing.key)
  if (!source) return null

  return (
    <a
      href={source.reads}
      target="_blank"
      rel="noopener noreferrer"
      className={`group transition duration-200 ease-out hover:border-accent/60 ${SHELL} ${RING}`}
      aria-label={labelOf(standing, source)}
    >
      <span className={GLYPH}>
        <StandingRating standing={standing} />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="section-label-sm text-accent">{verdictOf(standing, source)}</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-paper-soft">
          {countOf(standing, source)}
          <StandingNetwork source={source} />
        </span>
      </span>
    </a>
  )
}
