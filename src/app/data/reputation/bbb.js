/**
 * The BBB listing, and the seal that goes with being accredited.
 *
 * These are two different claims and the file keeps them apart, because
 * conflating them is the expensive mistake here. BBB opens a Business Profile
 * on a company whether or not it has ever asked BBB for anything, and that
 * profile carries a rating, customer reviews and a complaints history. Being
 * BBB Accredited is a separate thing a business applies and pays for, passes a
 * vetting process to get, and is issued a seal for. A profile is not
 * accreditation, and a page that shows the seal over a profile BBB is
 * publishing as unaccredited is making a claim its own source refuses.
 *
 * So the address below is the listing, and the seal is the accreditation.
 * `bbbAccredited()` reads the seal rather than a flag anybody can flip: BBB
 * issues the artwork only to accredited businesses and the licence to show it
 * lasts exactly as long as the accreditation does, which makes holding the file
 * the same fact as being entitled to the claim. There is no way to spell
 * "accredited" on this site without the seal BBB handed over for it.
 *
 * An empty address means the surface draws nothing rather than a row that leads
 * nowhere, which is the rule every other network here answers to.
 */

/** The Business Profile BBB publishes for this business. */
export const BBB_PROFILE_URL =
  'https://www.bbb.org/us/tx/houston/profile/web-design/taylorurl-web-development-0915-90077696'

/** The box a customer review is written in, off the profile. */
export const BBB_EVALUATE_URL = `${BBB_PROFILE_URL}/leave-a-review`

/**
 * The Accredited Business seal, as BBB issued it.
 *
 * Committed under `/images/` rather than hotlinked from `seal-*.bbb.org`: the
 * seal host is a third party in the critical path of the footer, it is not on
 * the site's own CDN, and a request to it on every page is a request that says
 * who is reading this site to somebody who did not need telling.
 *
 * It is the horizontal colour lockup, resized and nothing else. BBB licenses
 * the artwork on the condition it is shown whole and unaltered, so the file is
 * BBB's own pixels down to the rounded corners the transparency carries, and
 * the footer sizes it in CSS rather than the file being redrawn to fit.
 */
export const BBB_SEAL_SRC = '/images/bbb-accredited-business.png'

/** The seal artwork's own proportions, so the footer reserves its box. */
export const BBB_SEAL_WIDTH = 384
export const BBB_SEAL_HEIGHT = 137

/**
 * The corner BBB rounded the lockup to, in the file's own pixels.
 *
 * It is here rather than in the component for the reason the width and the
 * height are: it is a measurement off the artwork, and a surface that seats the
 * seal on a tile has to cut that tile to the same curve or the corner shows -
 * white nubs outside the lockup where the tile is squarer, a clipped keyline
 * where it is rounder. Scaled against `BBB_SEAL_WIDTH` it holds at whatever
 * width the seal is drawn.
 */
export const BBB_SEAL_RADIUS = 9

/**
 * Whether this business may call itself BBB Accredited.
 *
 * @returns {boolean} True while the seal BBB issues for it is held.
 */
export function bbbAccredited() {
  return Boolean(BBB_SEAL_SRC)
}
