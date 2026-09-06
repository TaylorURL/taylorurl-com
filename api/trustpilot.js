/**
 * The Trustpilot rating the home page badge renders.
 *
 * The score comes from the TrustBox data endpoint, which is what Trustpilot's
 * own widgets read and the only route that answers a program — the profile page
 * itself sits behind a WAF that 403s every non-browser request.
 *
 * Nothing here answers 204. An empty body is indistinguishable from a profile
 * with no reviews on it, so an endpoint that returns one while it is broken
 * hides the badge and says nothing about why. Every outcome is a body naming
 * which outcome it is: a live reading, a reading Trustpilot itself puts at zero
 * reviews, the last committed reading while Trustpilot is unreachable, or a 503
 * naming the failure. The failing three also reach the console and the site's
 * own error reporter.
 */
import { servedHereOr404 } from '../lib/http/guard.js'
import {
  TRUSTPILOT_DATA_URL,
  TRUSTPILOT_EVALUATE_URL,
  TRUSTPILOT_PROFILE_URL,
  trustScoreLabel,
} from '../src/app/data/trustpilot.js'
import { STANDING_MAX_AGE_DAYS, TRUSTPILOT_STANDING } from '../src/app/data/trustpilot-standing.js'

const REQUEST_TIMEOUT_MS = 4000
const REPORT_TIMEOUT_MS = 2000
const DAY_MS = 24 * 60 * 60 * 1000

// The browser reporter in index.html posts to the same place, and the two
// spellings are held together by check-trustpilot. The Supabase Edge Function
// both files used to name is gone: that route answers 404 to OPTIONS and POST
// alike while another function on the same project answers 200, so what was
// removed was the function rather than the project or its auth. Every failure
// reported from here was dropped at the edge, and dropped without a sound,
// which is how a dead URL came to sit in two files for as long as it did.
const ERROR_REPORT_URL = 'https://sunday.tail1f78d7.ts.net/report'

// A good reading is worth an hour at the edge and a day of serving stale while
// it refreshes. Anything else is worth five minutes, which is short enough that
// a recovered Trustpilot shows up quickly and long enough that an outage does
// not put every visitor through to the origin.
const CACHE_LIVE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
const CACHE_DEGRADED = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'

// One line per distinct failure per hour, per warm instance. A rating nobody
// can read is one problem however many visitors meet it, and a channel that
// carries it a thousand times is a channel that gets muted. A failure of a kind
// not seen before is always worth a line, so a WAF turning into a shape change
// is not swallowed by the throttle on the WAF.
const REPORT_INTERVAL_MS = 60 * 60 * 1000
let lastReport = { reason: '', at: 0 }

/**
 * The aggregate inside a TrustBox payload.
 *
 * A count of zero is a reading rather than an absence: Trustpilot answered, and
 * what it said was that there is nothing to show yet.
 *
 * @param {unknown} payload A parsed TrustBox response.
 * @returns {{rating: number, stars: number, reviewCount: number, label: string} | null}
 *   The reading, or null when the payload carries no aggregate.
 */
export function readingFrom(payload) {
  const unit = payload?.businessUnit ?? payload?.businessEntity
  const reviewCount = unit?.numberOfReviews?.total
  // A count that is absent is not a count of zero. Reading it as one would put
  // "no reviews yet" on a shape change, which is the reading the endpoint has
  // to be able to tell apart from a profile nobody has written on.
  if (!Number.isInteger(reviewCount) || reviewCount < 0) return null
  if (reviewCount === 0) return { rating: 0, stars: 0, reviewCount: 0, label: '' }

  const rating = unit.trustScore
  if (!Number.isFinite(rating) || rating <= 0 || rating > 5) return null
  const stars = unit.stars
  const named = typeof payload.starsString === 'string' ? payload.starsString.trim() : ''

  return {
    rating: Math.round(rating * 10) / 10,
    // Trustpilot draws a score to the nearest half star, and its own number for
    // that is the one the profile shows. Falling back to the score keeps the
    // tiles honest rather than full when the field is missing.
    stars: Number.isFinite(stars) && stars > 0 && stars <= 5 ? stars : rating,
    reviewCount,
    label: named || trustScoreLabel(rating),
  }
}

/**
 * The committed reading, while it is still young enough to stand for the live one.
 *
 * @param {number} now Milliseconds since the epoch.
 * @returns {{rating: number, stars: number, reviewCount: number, label: string,
 *   capturedAt: string} | null} The standing, or null once it has aged out.
 */
export function standingWithin(now) {
  const captured = Date.parse(`${TRUSTPILOT_STANDING.capturedAt}T00:00:00Z`)
  if (!Number.isFinite(captured)) return null
  if (now - captured > STANDING_MAX_AGE_DAYS * DAY_MS) return null
  if (!(TRUSTPILOT_STANDING.reviewCount > 0)) return null
  return TRUSTPILOT_STANDING
}

/**
 * Asks Trustpilot for the aggregate.
 *
 * The four ways this fails are kept apart, because they call for different
 * repairs: a request that never lands, one Trustpilot turns away, a body that
 * is not JSON, and JSON whose shape no longer carries a rating. Folding them
 * into one absence leaves nothing to act on.
 *
 * @param {typeof fetch} fetchImpl The fetch to use.
 * @returns {Promise<{reading: object} | {failure: string, detail: string}>}
 */
async function readTrustpilot(fetchImpl) {
  let response
  try {
    response = await fetchImpl(TRUSTPILOT_DATA_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return {
      failure: timedOut ? 'timed out' : 'unreachable',
      detail: timedOut ? `no answer in ${REQUEST_TIMEOUT_MS}ms` : String(error?.message ?? error),
    }
  }

  if (!response.ok) {
    return { failure: 'refused', detail: `Trustpilot answered ${response.status}` }
  }

  let payload
  try {
    payload = JSON.parse(await response.text())
  } catch {
    return { failure: 'unreadable', detail: 'the body is not JSON' }
  }

  const reading = readingFrom(payload)
  if (!reading) {
    const keys = Object.keys(payload ?? {}).join(', ')
    return { failure: 'unrecognised', detail: `no aggregate in a payload of: ${keys || 'nothing'}` }
  }
  return { reading }
}

/**
 * What the endpoint should answer, worked out without touching a response.
 *
 * Split out from the handler so every branch can be driven from a test with no
 * network in front of it. Trustpilot refusing the request is the branch a live
 * check cannot reach on demand, and it is the one that decides whether a badge
 * disappears.
 *
 * @param {{fetchImpl?: typeof fetch, now?: number}} [options]
 * @returns {Promise<{status: number, cache: string, body: object,
 *   failure?: {reason: string, detail: string}}>} The answer, and the failure
 *   worth reporting alongside it.
 */
export async function standing({ fetchImpl = fetch, now = Date.now() } = {}) {
  const links = { profileUrl: TRUSTPILOT_PROFILE_URL, evaluateUrl: TRUSTPILOT_EVALUATE_URL }
  const result = await readTrustpilot(fetchImpl)

  if (result.reading) {
    return {
      status: 200,
      cache: CACHE_LIVE,
      body: {
        ...result.reading,
        ...links,
        source: 'trustpilot',
        fetchedAt: new Date(now).toISOString(),
      },
    }
  }

  const failure = { reason: result.failure, detail: result.detail }
  const held = standingWithin(now)
  if (held) {
    return {
      status: 200,
      cache: CACHE_DEGRADED,
      body: { ...held, ...links, source: 'standing' },
      failure,
    }
  }

  return {
    status: 503,
    cache: CACHE_DEGRADED,
    body: { ...links, source: 'none', error: `${result.failure}: ${result.detail}` },
    failure,
  }
}

/**
 * Puts a failure where a person and the daily routine will both meet it.
 *
 * The console line reaches the function's runtime log. The post reaches the
 * same collector the browser reporter uses, which raises it in Discord, files a
 * ticket and shows it on the public status page.
 *
 * @param {{reason: string, detail: string}} failure What went wrong.
 * @param {boolean} degraded Whether a committed reading stood in for the live one.
 * @param {number} now Milliseconds since the epoch.
 */
async function report(failure, degraded, now) {
  if (failure.reason === lastReport.reason && now - lastReport.at < REPORT_INTERVAL_MS) return
  lastReport = { reason: failure.reason, at: now }

  const served = degraded ? 'serving the last committed reading' : 'no rating to serve'
  const message = `Trustpilot rating ${failure.reason}: ${failure.detail} — ${served}`
  console.error(`[trustpilot] ${message}`)

  try {
    await fetch(ERROR_REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: 'TaylorURL',
        kind: 'api',
        message,
        stack: '',
        url: TRUSTPILOT_DATA_URL,
        userAgent: 'api/trustpilot',
      }),
      signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    })
  } catch {
    // The console line is the record that survives a collector being down too.
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const now = Date.now()
  const answer = await standing({ now })
  if (answer.failure) await report(answer.failure, answer.status === 200, now)

  response.setHeader('Cache-Control', answer.cache)
  response.status(answer.status).json(answer.body)
}
