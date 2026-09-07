/**
 * The last reading taken from Trustpilot, committed so the badge has a floor.
 *
 * `/api/trustpilot` serves this only when the live read fails, and only while
 * it is younger than the age below. A rating is the cheapest thing a buyer
 * checks, and an hour of Trustpilot being unreachable should not blank it.
 *
 * Past that age the handler stops serving this and answers 503 instead, so a
 * number nobody has refreshed cannot harden into a claim the profile no longer
 * supports.
 *
 * Written by `npm run refresh:trustpilot`.
 */
export const TRUSTPILOT_STANDING = {
  rating: 4.3,
  stars: 4.5,
  reviewCount: 7,
  label: 'Excellent',
  capturedAt: '2026-08-29',
}

export const STANDING_MAX_AGE_DAYS = 30
