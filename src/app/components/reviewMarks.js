import { MarkBbb, MarkFacebook, MarkGoogle, MarkTrustpilot, MarkYelp } from '@components/brandMarks'

/**
 * How each review network is drawn, keyed the way `REVIEW_SOURCES` keys them.
 *
 * The registry itself is data and is read by the outreach mailer and by two
 * checks that run under plain node, so it holds no components and no colours.
 * This is the one place the two halves are joined, and every surface that draws
 * a network reaches it through here rather than keeping a map of its own.
 *
 * `ink` is the colour a network sets its own name in, `stars` is the colour it
 * fills a rating star with, and `fill` is the step of it that carries white
 * type on a filled button. They are three fields rather than one because for
 * two of these networks they genuinely differ: Google's mark is blue and its
 * review stars are gold, and the green Trustpilot fills a star tile with is a
 * shape rather than something type can sit on.
 */
export const REVIEW_SOURCE_DRAWING = {
  bbb: { mark: MarkBbb, ink: 'var(--bbb-blue)', fill: 'var(--bbb-fill)' },
  trustpilot: { mark: MarkTrustpilot, ink: 'var(--tp-ink)', fill: 'var(--tp-fill)' },
  google: {
    mark: MarkGoogle,
    ink: 'var(--google-blue)',
    stars: 'var(--google-gold)',
    fill: 'var(--google-blue)',
  },
  yelp: { mark: MarkYelp, ink: 'var(--yelp-red)', fill: 'var(--yelp-red)' },
  facebook: { mark: MarkFacebook, ink: 'var(--fb-blue)', fill: 'var(--fb-blue)' },
}

/** The marks alone, for the surfaces that only want the glyph. */
export const REVIEW_SOURCE_MARKS = Object.fromEntries(
  Object.entries(REVIEW_SOURCE_DRAWING).map(([key, drawing]) => [key, drawing.mark])
)

/**
 * The mark for one network.
 *
 * @param {string} key A `REVIEW_SOURCES` key.
 * @returns {Function | undefined} The mark, or nothing for a key with no glyph.
 */
export function reviewSourceMark(key) {
  return REVIEW_SOURCE_DRAWING[key]?.mark
}

/**
 * The colour a network's own type and rating are set in.
 *
 * A network nobody has drawn yet falls back to the page's accent, which keeps
 * a card readable rather than leaving it to inherit whatever is around it.
 *
 * @param {string} key A `REVIEW_SOURCES` key.
 * @returns {string} A CSS colour.
 */
export function reviewSourceInk(key) {
  return REVIEW_SOURCE_DRAWING[key]?.ink ?? 'var(--accent)'
}

/**
 * The colour a network fills one of its own rating stars with, which is not
 * always the colour it sets its name in.
 *
 * @param {string} key A `REVIEW_SOURCES` key.
 * @returns {string} A CSS colour.
 */
export function reviewSourceStarInk(key) {
  const drawing = REVIEW_SOURCE_DRAWING[key]
  return drawing?.stars ?? drawing?.ink ?? 'var(--accent)'
}

/**
 * The colour a filled button in a network's name is set in.
 *
 * @param {string} key A `REVIEW_SOURCES` key.
 * @returns {string} A CSS colour that carries white type.
 */
export function reviewSourceFill(key) {
  return REVIEW_SOURCE_DRAWING[key]?.fill ?? 'var(--accent)'
}
