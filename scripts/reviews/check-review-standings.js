/**
 * The ratings the home page shows for the networks that will not answer a
 * program, held to what those networks actually publish.
 *
 * Every number on that rail except Trustpilot's was typed in by a person, and a
 * number typed by a person is a number that goes stale. A rating a profile no
 * longer supports is the most expensive wrong thing this site can say, because
 * it is exactly the claim a buyer went to check. So this is the counterweight:
 * a reading that has aged past the cap fails the build rather than sitting on
 * the page until somebody happens to look.
 *
 * The rest of the checks are about shape, and each one is a way the rail could
 * draw a claim nobody made: a score with no reviews behind it, a count with no
 * network to send a reader to, a seal whose artwork was never committed, or the
 * words "BBB Accredited Business" over a business that is not one.
 *
 * Nothing here touches the network, so this runs anywhere.
 *
 *   npm run check:review-standings
 */
import { existsSync, readFileSync } from 'node:fs'
import { BBB_SEAL_SRC, bbbAccredited } from '../../src/app/data/reputation/bbb.js'
import { REVIEW_SOURCES, reviewSource } from '../../src/app/data/reputation/reviews.js'
import {
  REVIEW_STANDINGS,
  REVIEW_STANDING_MAX_AGE_DAYS,
  committedStanding,
  standingShows,
} from '../../src/app/data/reputation/review-standings.js'
import { dayIn } from '../../lib/time/zone.js'
import { fail, finish } from '../harness/checks.js'

const DAY_MS = 24 * 60 * 60 * 1000

const today = Date.parse(`${dayIn()}T00:00:00Z`)

for (const [key, standing] of Object.entries(REVIEW_STANDINGS)) {
  const source = reviewSource(key)
  if (!source) {
    fail(`${key}: a standing for a network the registry does not hold`)
    continue
  }

  // Trustpilot is the one network that answers a program, and its reading is
  // fetched live with `trustpilot-standing.js` under it. A second copy here
  // would be a third number for the same profile and the one nobody refreshes.
  if (key === 'trustpilot') {
    fail('trustpilot: read live, so it has no business being written down here')
  }

  const captured = Date.parse(`${standing.capturedAt}T00:00:00Z`)
  if (!Number.isFinite(captured)) {
    fail(`${key}: capturedAt is ${JSON.stringify(standing.capturedAt)}, which is not a day`)
  } else if (captured > today) {
    fail(`${key}: capturedAt is ${standing.capturedAt}, which has not happened yet`)
  } else if (today - captured > REVIEW_STANDING_MAX_AGE_DAYS * DAY_MS) {
    const days = Math.round((today - captured) / DAY_MS)
    fail(
      `${key}: last read ${days} days ago, past the ${REVIEW_STANDING_MAX_AGE_DAYS}-day cap. ` +
        `Open ${source.reads}, read what it publishes now, and write the day beside it`
    )
  }

  const { rating, reviewCount, seal } = standing
  if (rating !== undefined) {
    if (!Number.isFinite(rating) || rating <= 0 || rating > 5) {
      fail(`${key}: a rating of ${JSON.stringify(rating)}, which is not a score out of five`)
    }
    // A score is an average of something. Publishing one with nothing under it
    // is the page inventing the reviews it is averaging.
    if (!(reviewCount > 0)) {
      fail(`${key}: a rating of ${rating} with ${reviewCount} reviews behind it`)
    }
  }
  if (reviewCount !== undefined && (!Number.isInteger(reviewCount) || reviewCount < 0)) {
    fail(`${key}: a review count of ${JSON.stringify(reviewCount)}`)
  }
  // A seal is artwork the network issued and this site was licensed to show.
  // A badge pointing at a file nobody committed is a hole where the strongest
  // claim on the rail was supposed to be, and it fails nowhere a person looks.
  if (seal !== undefined) {
    if (!(seal.width > 0) || !(seal.height > 0)) {
      fail(`${key}: a seal with no proportions, so nothing can reserve its box`)
    }
    const file = new URL(`../../public${seal.src}`, import.meta.url)
    if (!seal.src || !existsSync(file)) {
      fail(`${key}: the seal names ${JSON.stringify(seal.src)}, which is not in public/`)
    }
    if (!standing.verdict) {
      fail(`${key}: a seal with nothing beside it saying in words what it certifies`)
    }
  }
  // A badge is a link out to the page the reading was taken off. A network with
  // no address to send a reader to has nothing this site can vouch for.
  if (standingShows(standing) && !source.reads) {
    fail(`${key}: a standing worth drawing on a network with nowhere to send a reader`)
  }
}

// The accreditation is the seal BBB issued, not a word anybody may type. The
// standing carries both the artwork and the words so the badge has no branch
// per network in it, and this is what keeps the two tied to the one thing that
// entitles the site to either of them.
const bbb = REVIEW_STANDINGS.bbb
if (Boolean(bbb?.seal) !== bbbAccredited()) {
  fail(
    bbbAccredited()
      ? 'bbb: accredited, but the standing draws no seal'
      : 'bbb: draws the seal over a business BBB publishes as unaccredited'
  )
}
if (bbb?.seal && bbb.seal.src !== BBB_SEAL_SRC) {
  fail(`bbb: a second copy of the seal path, ${JSON.stringify(bbb.seal.src)}`)
}

// The rail draws the registry's order and skips whatever has nothing published
// on it yet, so what a reader is shown is decided here rather than in markup.
const showing = REVIEW_SOURCES.filter(source => committedStanding(source.key)).map(
  source => source.key
)
const expected = REVIEW_SOURCES.filter(source => standingShows(REVIEW_STANDINGS[source.key])).map(
  source => source.key
)
if (showing.join(',') !== expected.join(',')) {
  fail(`the rail would draw ${showing.join(', ')} rather than ${expected.join(', ')}`)
}

// The badge is the only thing that draws one of these, and it reads the shared
// registry for the mark, the colour and the address. A second copy of any of
// that is how a network ends up on the page in somebody else's blue.
const badge = readFileSync(
  new URL('../../src/app/components/reviews/ReviewStandingBadge.jsx', import.meta.url),
  'utf8'
)
for (const name of ['reviewSource', 'reviewSourceFill', 'reviewSourceMark']) {
  if (!badge.includes(name)) fail(`the badge no longer reads ${name} from the shared registry`)
}
if (/'(bbb|google|yelp|facebook)'/.test(badge)) {
  fail('the badge names a network of its own rather than drawing whatever it is handed')
}

await finish()

const drawn = REVIEW_SOURCES.map(source => committedStanding(source.key))
  .filter(Boolean)
  .map(standing =>
    `${standing.key} ${standing.verdict ?? standing.rating ?? standing.reviewCount}`.trim()
  )
  .join(', ')
console.log(`Hand-read standings within ${REVIEW_STANDING_MAX_AGE_DAYS} days: ${drawn}`)
