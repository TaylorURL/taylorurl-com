import { Star } from 'lucide-react'

// The two grounds Trustpilot fills a rating tile with: green for a star the
// rating reached, and the page's own quietest step for one it did not. The
// green is theirs and is only held back as far as the ground it lands on asks,
// so the tile is still the shape a reader recognises. The empty tile is not
// theirs to keep: it carries no part of the rating, and the #dcdce6 they
// publish is a near-white square that outshines every filled tile beside it
// once the page goes dark.
const FILLED = 'var(--tp-tile)'
const EMPTY = 'var(--tp-tile-empty)'

/**
 * The ground for one tile, given how far the rating carries into it.
 *
 * Trustpilot quantises a score to the nearest half star, so a tile is whole,
 * half or empty and never anything between.
 *
 * @param {number} reach How much of this tile the rating covers, 0 to 1.
 * @returns {string} A CSS background.
 */
function tileGround(reach) {
  if (reach >= 1) return FILLED
  if (reach >= 0.5) return `linear-gradient(to right, ${FILLED} 50%, ${EMPTY} 50%)`
  return EMPTY
}

/**
 * A Trustpilot rating: white stars on filled tiles, five across.
 *
 * Loose stars in the site's own accent read as a score the site awarded
 * itself. The boxed form is the part of Trustpilot a reader recognises before
 * reading a word, which is the reason to draw it rather than approximate it.
 *
 * @param {{ rating?: number, size?: number, className?: string }} props
 *   `rating` out of five, drawn to the half tile; omit for a full five.
 */
export default function TrustpilotStars({ rating = 5, size = 22, className = '' }) {
  return (
    <div
      className={`flex gap-[3px] ${className}`}
      role="img"
      aria-label={`Rated ${rating} out of 5 on Trustpilot`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="flex items-center justify-center"
          style={{
            background: tileGround(rating - index),
            width: `${size}px`,
            height: `${size}px`,
          }}
        >
          <Star
            className="fill-white text-white"
            strokeWidth={0}
            style={{
              width: `${Math.round(size * 0.68)}px`,
              height: `${Math.round(size * 0.68)}px`,
            }}
          />
        </span>
      ))}
    </div>
  )
}
