import {
  BBB_SEAL_HEIGHT,
  BBB_SEAL_RADIUS,
  BBB_SEAL_SRC,
  BBB_SEAL_WIDTH,
  bbbAccredited,
} from './bbb.js'

/**
 * What each network currently publishes about this business, for the networks
 * that will not tell a program.
 *
 * Trustpilot is deliberately absent. It answers a program through the TrustBox
 * endpoint, so its standing is read live and `trustpilot-standing.js` is the
 * floor under that read. The four below answer nothing a page can ask: Google's
 * aggregate sits behind a key issued per listing, BBB publishes its grade as a
 * page and nothing else, Yelp turns away every request that is not a browser,
 * and Facebook's page rating is behind a token that expires. So each of them is
 * read by a person off the profile itself and written down here, with the day
 * it was read beside it.
 *
 * A number typed by hand is a number that goes stale, and a stale rating is a
 * claim the profile no longer supports. `check-review-standings` is what stops
 * that: it refuses a reading older than the cap below, so the repair is a check
 * that fails rather than a badge nobody noticed had drifted. That is the same
 * bargain the Trustpilot standing makes, arrived at from the other side: there
 * the endpoint stops serving an old reading, here the build stops accepting one.
 *
 * Nothing is written here that the network does not publish, and a network with
 * nothing to show yet is held at the zero it actually has rather than left out.
 * The zero is a fact with a date on it, which is what has to be re-read later;
 * leaving the row out would make an unread profile and an empty one the same
 * thing. Every surface draws nothing for it either way.
 */
export const REVIEW_STANDINGS = {
  // BBB is the one network here that does not publish a score at all. What it
  // publishes about an accredited business is the seal, and the seal is not
  // read off the profile: `bbb.js` holds the artwork BBB issued, and holding it
  // is the same fact as being entitled to the claim. So the badge draws the
  // seal where the other networks draw their stars, and the count beside it is
  // the separate reading of how many customers have written a review.
  bbb: {
    seal: bbbAccredited()
      ? {
          src: BBB_SEAL_SRC,
          width: BBB_SEAL_WIDTH,
          height: BBB_SEAL_HEIGHT,
          radius: BBB_SEAL_RADIUS,
        }
      : undefined,
    verdict: bbbAccredited() ? 'BBB Accredited Business' : undefined,
    reviewCount: 0,
    capturedAt: '2026-09-04',
  },
  google: { rating: 5, reviewCount: 2, capturedAt: '2026-09-04' },
  // The listing is claimed and carries no recommended reviews yet, so Yelp
  // publishes no rating for it and this site has none to show.
  yelp: { reviewCount: 0, capturedAt: '2026-09-04' },
  // Facebook asks whether somebody recommends a business rather than for a
  // score out of five, so this is a count with no rating beside it on purpose.
  facebook: { reviewCount: 2, capturedAt: '2026-09-04' },
}

/** How old a hand-read standing may be before the check refuses it. */
export const REVIEW_STANDING_MAX_AGE_DAYS = 180

/**
 * Whether a standing carries something the network actually publishes.
 *
 * Three shapes count, and each is one of the networks' own: a score out of five
 * that somebody actually left, a seal the network issued, and a count of
 * recommendations from a network that collects no score. A profile nobody has
 * written on yet is none of them, and it draws nothing rather than a badge
 * reading zero.
 *
 * Held here rather than in the badge so the check and the page agree on what a
 * showable standing is.
 *
 * @param {object | undefined} standing An entry from `REVIEW_STANDINGS`, or the
 *   live Trustpilot reading in the same shape.
 * @returns {boolean} True when there is a standing worth drawing.
 */
export function standingShows(standing) {
  if (!standing) return false
  if (standing.seal) return true
  return standing.reviewCount > 0
}

/**
 * One network's hand-read standing, in the shape the badge draws.
 *
 * @param {string} key A `REVIEW_SOURCES` key.
 * @returns {object | null} The standing carrying its own key, or null for a
 *   network that is read live, has nothing published yet, or is not held here.
 */
export function committedStanding(key) {
  const standing = REVIEW_STANDINGS[key]
  return standingShows(standing) ? { key, ...standing } : null
}
