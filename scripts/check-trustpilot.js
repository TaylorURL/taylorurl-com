/**
 * The rating endpoint, driven through every answer it can give.
 *
 * A badge that hides itself is indistinguishable from a business with no
 * reviews, so the failure that matters here is silent by construction: the
 * endpoint answers, the page renders, and the only thing missing is the one
 * signal a buyer was looking for. Trustpilot puts its profile pages behind a
 * WAF that refuses a program, which makes a 403 the live shape of that failure
 * and the branch most worth holding.
 *
 * So every branch is driven from a fake Trustpilot rather than the real one:
 * a reading, a profile Trustpilot itself reports as empty, a refusal, a
 * request that never lands, a body that is not JSON, and JSON whose shape no
 * longer carries a rating. Each is checked for the status, the source and the
 * failure it should name, and all of them are checked against the one rule the
 * endpoint exists to keep — that it never answers with nothing.
 *
 * Nothing here touches the network, so this runs anywhere.
 *
 *   npm run check:trustpilot
 */
import { readFileSync } from 'node:fs'
import { readingFrom, standing, standingWithin } from '../api/trustpilot.js'
import {
  TRUSTPILOT_BUSINESS_UNIT_ID,
  TRUSTPILOT_DATA_URL,
  TRUSTPILOT_PROFILE_URL,
  TRUSTPILOT_TRUSTBOX_ID,
} from '../src/app/data/trustpilot.js'
import { STANDING_MAX_AGE_DAYS, TRUSTPILOT_STANDING } from '../src/app/data/trustpilot-standing.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse(`${TRUSTPILOT_STANDING.capturedAt}T12:00:00Z`)
const AGED_OUT = NOW + (STANDING_MAX_AGE_DAYS + 1) * DAY_MS

let failed = 0
function fail(message) {
  failed += 1
  console.error(`FAIL ${message}`)
}

function is(where, got, want) {
  if (got !== want) fail(`${where}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
}

/** The payload the TrustBox endpoint serves, with the aggregate overridable. */
function trustbox(numberOfReviews, unit = {}) {
  const businessUnit = {
    stars: 4.5,
    trustScore: 4.3,
    displayName: 'TaylorURL',
    numberOfReviews,
    identifyingName: 'taylorurl.com',
    ...unit,
  }
  return { businessUnit, businessEntity: businessUnit, starsString: 'Excellent' }
}

const SEVEN = { total: 7, oneStar: 0, twoStars: 0, threeStars: 0, fourStars: 0, fiveStars: 7 }
const NONE = { total: 0, oneStar: 0, twoStars: 0, threeStars: 0, fourStars: 0, fiveStars: 0 }

const serves = body => async () => new Response(JSON.stringify(body), { status: 200 })
const answers = code => async () => new Response(null, { status: code })
const sends = text => async () => new Response(text, { status: 200 })
const refuses = message => async () => {
  throw new Error(message)
}
const stalls = () => async () => {
  const error = new Error('the request was aborted')
  error.name = 'TimeoutError'
  throw error
}

// Every way the endpoint can be asked, and what it owes in return. `reason` is
// the failure it should name, or null where the answer is a real reading.
const CASES = [
  {
    where: 'a live reading',
    fetchImpl: serves(trustbox(SEVEN)),
    status: 200,
    source: 'trustpilot',
    reason: null,
  },
  {
    where: 'a profile with no reviews yet',
    fetchImpl: serves(trustbox(NONE, { trustScore: 0, stars: 0 })),
    status: 200,
    source: 'trustpilot',
    reason: null,
  },
  {
    where: 'the WAF refusing the request',
    fetchImpl: answers(403),
    status: 200,
    source: 'standing',
    reason: 'refused',
  },
  {
    where: 'Trustpilot answering 500',
    fetchImpl: answers(500),
    status: 200,
    source: 'standing',
    reason: 'refused',
  },
  {
    where: 'a request that never lands',
    fetchImpl: refuses('getaddrinfo ENOTFOUND'),
    status: 200,
    source: 'standing',
    reason: 'unreachable',
  },
  {
    where: 'a request that runs out of time',
    fetchImpl: stalls(),
    status: 200,
    source: 'standing',
    reason: 'timed out',
  },
  {
    where: 'a challenge page in place of the payload',
    fetchImpl: sends('<!doctype html><title>Verifying Connection</title>'),
    status: 200,
    source: 'standing',
    reason: 'unreadable',
  },
  {
    where: 'a payload that no longer carries the aggregate',
    fetchImpl: serves({ businessUnit: { displayName: 'TaylorURL' } }),
    status: 200,
    source: 'standing',
    reason: 'unrecognised',
  },
  {
    where: 'a payload of nothing at all',
    fetchImpl: serves({}),
    status: 200,
    source: 'standing',
    reason: 'unrecognised',
  },
]

for (const expected of CASES) {
  const answer = await standing({ fetchImpl: expected.fetchImpl, now: NOW })
  is(expected.where, answer.status, expected.status)
  is(`${expected.where}: source`, answer.body.source, expected.source)
  is(`${expected.where}: failure`, answer.failure?.reason ?? null, expected.reason)

  // The rule the whole endpoint exists to keep. A 204, or a body with nothing
  // in it, is read by the badge as a business nobody has reviewed.
  if (answer.status === 204) fail(`${expected.where}: answered 204`)
  if (Object.keys(answer.body).length === 0) fail(`${expected.where}: answered an empty body`)
  if (!answer.cache) fail(`${expected.where}: named no cache policy`)
  is(`${expected.where}: profile link`, answer.body.profileUrl, TRUSTPILOT_PROFILE_URL)

  // A failure that is served rather than raised has to carry a detail, or the
  // report it produces names a problem without naming what happened.
  if (expected.reason && !answer.failure?.detail) {
    fail(`${expected.where}: named a failure with no detail`)
  }
}

// A failure the committed standing can no longer cover is a 503 saying so,
// rather than a rating nobody has checked in a month.
const stale = await standing({ fetchImpl: answers(403), now: AGED_OUT })
is('an aged-out standing', stale.status, 503)
is('an aged-out standing: source', stale.body.source, 'none')
if (!stale.body.error) fail('an aged-out standing: answered 503 without naming the failure')
if (standingWithin(AGED_OUT)) fail('standingWithin: served a standing past its age cap')
if (!standingWithin(NOW)) fail('standingWithin: withheld a standing inside its age cap')

// The live case is the one a visitor sees, so its numbers are read back rather
// than assumed from the status.
const live = await standing({ fetchImpl: serves(trustbox(SEVEN)), now: NOW })
is('a live reading: rating', live.body.rating, 4.3)
is('a live reading: stars', live.body.stars, 4.5)
is('a live reading: count', live.body.reviewCount, 7)
is('a live reading: label', live.body.label, 'Excellent')

const empty = await standing({ fetchImpl: serves(trustbox(NONE, { trustScore: 0 })), now: NOW })
is('a profile with no reviews: count', empty.body.reviewCount, 0)

// The readings that must be turned away, because each would put a number on
// the badge that the profile does not support.
const NOT_A_READING = [
  ['a rating above five', trustbox(SEVEN, { trustScore: 7.2 })],
  ['a rating of nothing', trustbox(SEVEN, { trustScore: null })],
  ['a rating that is text', trustbox(SEVEN, { trustScore: 'Excellent' })],
  ['a count that is not whole', trustbox({ total: 2.5 })],
  ['a negative count', trustbox({ total: -1 })],
  ['a count of nothing', trustbox({ total: null })],
  ['an aggregate that is absent', {}],
  ['a payload that is null', null],
  ['a payload that is a string', 'no'],
]
for (const [where, payload] of NOT_A_READING) {
  if (readingFrom(payload) !== null) fail(`readingFrom: took ${where}`)
}

// A star count Trustpilot did not send falls back to the score, which draws
// fewer tiles rather than more.
const noStars = readingFrom(trustbox(SEVEN, { stars: undefined }))
is('a reading with no star count', noStars.stars, 4.3)

// The committed standing is what a visitor sees while Trustpilot is down, so
// it is held to the same shape a live reading has to satisfy.
const held = TRUSTPILOT_STANDING
if (!(held.rating > 0 && held.rating <= 5)) fail(`the committed standing: rating ${held.rating}`)
if (!(held.stars > 0 && held.stars <= 5)) fail(`the committed standing: stars ${held.stars}`)
if (!Number.isInteger(held.reviewCount) || held.reviewCount < 1) {
  fail(`the committed standing: count ${held.reviewCount}`)
}
if (!held.label) fail('the committed standing: no label')
if (!/^\d{4}-\d{2}-\d{2}$/.test(held.capturedAt)) {
  fail(`the committed standing: capturedAt ${held.capturedAt}`)
}

// The source Trustpilot actually answers. A business unit or TrustBox edited
// by hand into something else returns `BusinessUnit does not have access to
// that trustbox`, which arrives as a 400 and reads as an outage.
if (!TRUSTPILOT_DATA_URL.startsWith('https://widget.trustpilot.com/trustbox-data/')) {
  fail(`the data URL is not a TrustBox route: ${TRUSTPILOT_DATA_URL}`)
}
for (const id of [TRUSTPILOT_BUSINESS_UNIT_ID, TRUSTPILOT_TRUSTBOX_ID]) {
  if (!/^[0-9a-f]{24}$/.test(id)) fail(`not a Trustpilot id: ${id}`)
  if (!TRUSTPILOT_DATA_URL.includes(id)) fail(`the data URL does not carry ${id}`)
}

// The endpoint and the browser reporter have to post to the same collector, or
// half the site's failures land somewhere nobody is watching. Each URL is read
// by the name its own file gives it rather than by the path inside it. Matching
// on a path is how this check went on passing while both files named a Supabase
// function that had been deleted — the path was the one thing about a dead
// collector that still looked exactly right.
const handlerSource = readFileSync(new URL('../api/trustpilot.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const collector = handlerSource.match(/ERROR_REPORT_URL\s*=\s*'([^']+)'/)?.[1]
const reporter = page.match(/var endpoint\s*=\s*'([^']+)'/)?.[1]
if (!collector) fail('the endpoint names no error collector')
if (!reporter) fail('the browser reporter names no error collector')
if (collector && reporter && collector !== reporter) {
  fail(`the endpoint reports to ${collector}, the browser reporter to ${reporter}`)
}

// Agreeing on the wrong URL is the failure that got through, so agreement is not
// the only thing held here. Liveness is not what is asserted and cannot be:
// nothing in this file touches the network, and a check that failed the build
// whenever a collector was briefly unreachable would be failing commits for
// something no commit caused. What is held is the shape a collector needs before
// it could answer at all — an absolute https URL, a real host, and a path to
// POST to. A bare origin, a relative path or a leftover placeholder fails, where
// before any string the regex happened to match was accepted.
if (collector) {
  let parsed = null
  try {
    parsed = new URL(collector)
  } catch {
    fail(`the error collector is not a URL: ${collector}`)
  }
  if (parsed) {
    if (parsed.protocol !== 'https:') fail(`the error collector is not https: ${collector}`)
    if (!parsed.hostname.includes('.')) fail(`the error collector has no host: ${collector}`)
    if (parsed.pathname.length < 2) fail(`the error collector has no path: ${collector}`)
  }
}

if (failed) {
  console.error(`\n${failed} Trustpilot ${failed === 1 ? 'check' : 'checks'} failed`)
  process.exit(1)
}

console.log(
  `Trustpilot endpoint holds across ${CASES.length} answers, ` +
    `never 204; standing ${held.rating}/5 from ${held.reviewCount} reviews, ` +
    `captured ${held.capturedAt}, good for ${STANDING_MAX_AGE_DAYS} days`
)
