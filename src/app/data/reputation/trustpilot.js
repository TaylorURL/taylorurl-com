/**
 * The Trustpilot profile, and the one endpoint that will hand over its score.
 *
 * The profile page cannot be read by a program. Trustpilot fronts
 * `trustpilot.com` with a WAF that answers every non-browser request with a
 * challenge page and a 403, whatever user agent is sent, so scraping the
 * server-rendered JSON-LD off it fails from any host.
 *
 * The TrustBox data endpoint is the supported way in: it is what Trustpilot's
 * own embeddable widgets read, it is public, it takes no key, and it sits on a
 * CDN outside the WAF. It is keyed by business unit rather than by domain,
 * which is why the id below is held here rather than derived.
 */

export const TRUSTPILOT_DOMAIN = 'taylorurl.com'
export const TRUSTPILOT_PROFILE_URL = `https://www.trustpilot.com/review/${TRUSTPILOT_DOMAIN}`
export const TRUSTPILOT_EVALUATE_URL = `https://www.trustpilot.com/evaluate/${TRUSTPILOT_DOMAIN}`

/** The profile's own id, as it appears in the asset URLs on the profile page. */
export const TRUSTPILOT_BUSINESS_UNIT_ID = '6a333a31deb2e4ff01db2e3b'

/**
 * The Review Collector TrustBox.
 *
 * A business unit may only read the TrustBoxes its plan grants, and every other
 * template answers `BusinessUnit does not have access to that trustbox`. This
 * one is granted on the free plan, and its payload carries the whole aggregate:
 * trust score, star display, and the review count broken down by star.
 */
export const TRUSTPILOT_TRUSTBOX_ID = '56278e9abfbbba0bdcd568bc'

export const TRUSTPILOT_DATA_URL =
  `https://widget.trustpilot.com/trustbox-data/${TRUSTPILOT_TRUSTBOX_ID}` +
  `?businessUnitId=${TRUSTPILOT_BUSINESS_UNIT_ID}&locale=en-US`

/**
 * The word Trustpilot puts on a score, lowest bound first.
 *
 * The live payload carries the word itself, so this only decides the label for
 * a reading that arrived without one.
 */
const TRUSTSCORE_BANDS = [
  { min: 4.3, label: 'Excellent' },
  { min: 3.5, label: 'Great' },
  { min: 2.7, label: 'Average' },
  { min: 1.9, label: 'Poor' },
  { min: 0, label: 'Bad' },
]

/**
 * @param {number} score A trust score out of five.
 * @returns {string} The band the score falls in.
 */
export function trustScoreLabel(score) {
  return TRUSTSCORE_BANDS.find(({ min }) => score >= min)?.label ?? ''
}
