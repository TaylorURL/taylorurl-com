/**
 * Rewrites the committed Trustpilot standing from the live profile.
 *
 * The standing is what `/api/trustpilot` serves while Trustpilot is
 * unreachable, and the endpoint stops serving it once it passes its age cap.
 * Running this is what moves that cap forward, and it is also the quickest way
 * to answer whether the endpoint's source still works at all.
 *
 *   npm run refresh:trustpilot
 */
import { writeFileSync } from 'node:fs'
import { readingFrom } from '../api/trustpilot.js'
import { TRUSTPILOT_DATA_URL } from '../src/app/data/trustpilot.js'
import { STANDING_MAX_AGE_DAYS } from '../src/app/data/trustpilot-standing.js'
import { dayIn } from '../lib/time/zone.js'

const target = new URL('../src/app/data/trustpilot-standing.js', import.meta.url)

const response = await fetch(TRUSTPILOT_DATA_URL, { headers: { Accept: 'application/json' } })
if (!response.ok) {
  console.error(`Trustpilot answered ${response.status} for ${TRUSTPILOT_DATA_URL}`)
  process.exit(1)
}

const reading = readingFrom(await response.json())
if (!reading) {
  console.error(`No aggregate in the TrustBox payload from ${TRUSTPILOT_DATA_URL}`)
  process.exit(1)
}
if (reading.reviewCount < 1) {
  console.error('Trustpilot reports no reviews, which is not a standing worth committing')
  process.exit(1)
}

const capturedAt = dayIn()
const file = `/**
 * The last reading taken from Trustpilot, committed so the badge has a floor.
 *
 * \`/api/trustpilot\` serves this only when the live read fails, and only while
 * it is younger than the age below. A rating is the cheapest thing a buyer
 * checks, and an hour of Trustpilot being unreachable should not blank it.
 *
 * Past that age the handler stops serving this and answers 503 instead, so a
 * number nobody has refreshed cannot harden into a claim the profile no longer
 * supports.
 *
 * Written by \`npm run refresh:trustpilot\`.
 */
export const TRUSTPILOT_STANDING = {
  rating: ${reading.rating},
  stars: ${reading.stars},
  reviewCount: ${reading.reviewCount},
  label: '${reading.label.replace(/'/g, "\\'")}',
  capturedAt: '${capturedAt}',
}

export const STANDING_MAX_AGE_DAYS = ${STANDING_MAX_AGE_DAYS}
`

writeFileSync(target, file)
console.log(
  `Trustpilot standing is ${reading.label} ${reading.rating}/5 ` +
    `from ${reading.reviewCount} reviews, captured ${capturedAt}`
)
