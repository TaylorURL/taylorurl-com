/**
 * The one line in a preview letter that sends the owner somewhere other than
 * the studio to find out whether the studio is real.
 *
 * An owner who likes the draft looks the sender up before they answer, and
 * what a search turns up on its own is thin. So every preview letter closes on
 * a postscript naming the two places that say so in somebody else's words:
 * the Trustpilot profile, with its rating and how many reviews stand behind
 * it, and the BBB accreditation. Google joins them once its listing holds more
 * reviews than Trustpilot does, because until then the bigger number is the
 * one already in the line and the smaller one only reads as thin.
 *
 * Every figure is read when the letter is drafted, never written down here.
 * A rating that was true in the spring is a claim the profile may no longer
 * support by the time a letter lands, and the owner reading it is about to go
 * and check. So a reading that cannot be taken says less rather than saying
 * something old: a Trustpilot read that fails still names the profile, with
 * no number on it; a Google read that fails leaves Google out; and the
 * committed Trustpilot standing the home page badge falls back on is not used
 * at all, since it is a floor for a badge and not something to quote to a
 * stranger. The accreditation is the one fact held rather than read, because
 * `bbbAccredited()` reads the seal BBB issued, and holding the seal is the
 * claim.
 *
 * What the line must not do is change how the letter is received. It adds
 * words and at most two links, both to the profiles themselves rather than a
 * hop through a counter, and no picture: the letter's own open square stays
 * the only thing in it that reports back. The links carry the preview tags,
 * `utm_campaign` naming the letter the click came out of, so wherever the
 * arrival is counted it is counted against the letter that sent it rather
 * than as somebody who found the profile on their own. The plain half has
 * nowhere to hide a tag, so it gives each address whole under the sentence,
 * which is what a typed note with two links in it looks like.
 *
 * Google is read through the Places API on the server's own key, asking for
 * the rating and the count and nothing else, and the reading is kept for an
 * hour per warm instance: a run sending thirty first letters asks Google once,
 * not thirty times.
 */

import { standing as trustpilotStanding } from '../../api/trustpilot.js'
import { BBB_PROFILE_URL, bbbAccredited } from '../../src/app/data/reputation/bbb.js'
import { GOOGLE_PLACE_ID } from '../../src/app/data/reputation/google.js'
import { TRUSTPILOT_PROFILE_URL } from '../../src/app/data/reputation/trustpilot.js'

/** Where a click out of a preview letter says it came from. */
const TAGS = { source: 'preview', medium: 'outreach' }

const PLACE_DETAILS = 'https://places.googleapis.com/v1/places/'

/** How long the Places read is given before the line goes on without Google. */
const PLACES_TIMEOUT_MS = 4000

/**
 * How long one reading stands for every letter drafted on the same instance.
 *
 * An hour is the same hour the Trustpilot endpoint is cached at the edge for,
 * so a letter never quotes a figure older than the badge on the home page
 * would. A reading with a part missing is kept for five minutes instead, so a
 * service that has recovered is back in the line by the next few letters.
 */
const READING_TTL_MS = 60 * 60 * 1000
const PARTIAL_TTL_MS = 5 * 60 * 1000

/**
 * The opening of the postscript, by where the letter falls in its thread.
 *
 * The first letter asks the owner to look the studio up; the follow-ups take
 * the other two in turn, so a business that reads the whole thread is not
 * handed the same sentence five times over.
 */
const LEADS = ['If you want to look me up first,', 'In case it helps,', "For what it's worth,"]

/**
 * One count of reviews as a reader says it.
 *
 * @param {number} count
 */
const reviews = count => `${count} ${count === 1 ? 'review' : 'reviews'}`

/** A rating to one decimal, the way both networks print theirs. */
const score = rating => Number(rating).toFixed(1)

/**
 * A profile address carrying the tags that say which letter a click came out of.
 *
 * The tags are added to whatever query the address already has, which is what
 * keeps the BBB profile and a Facebook-style `?id=` address both intact.
 *
 * @param {string} href The profile.
 * @param {string} campaign The letter, as `previewCampaign` names it.
 */
export function taggedProfile(href, campaign) {
  const url = new URL(href)
  url.searchParams.set('utm_source', TAGS.source)
  url.searchParams.set('utm_medium', TAGS.medium)
  if (campaign) url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}

/**
 * The Trustpilot reading, live or not at all.
 *
 * The endpoint's own `standing` is what decides whether Trustpilot answered,
 * so the letter and the badge read the profile through one door. Only a live
 * answer counts here; the committed floor it falls back on is a figure from
 * whenever somebody last refreshed it.
 *
 * @returns {Promise<{rating: number, reviewCount: number} | null>}
 */
async function readTrustpilot(fetchImpl, now) {
  try {
    const answer = await trustpilotStanding({ fetchImpl, now })
    const body = answer?.body
    if (body?.source !== 'trustpilot' || !Number.isInteger(body.reviewCount)) return null
    return { rating: body.rating, reviewCount: body.reviewCount }
  } catch {
    return null
  }
}

/**
 * The Google rating and how many reviews it averages, or null when it cannot be read.
 *
 * Google's refusal is not carried anywhere: the body can echo the request and
 * the request carries the key, and the letter has a line to send either way.
 *
 * @returns {Promise<{rating: number, reviewCount: number} | null>}
 */
async function readGoogle(fetchImpl, key) {
  if (!key) return null
  try {
    const answer = await fetchImpl(`${PLACE_DETAILS}${encodeURIComponent(GOOGLE_PLACE_ID)}`, {
      signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount' },
    })
    if (!answer.ok) return null
    const body = await answer.json()
    const reviewCount = body?.userRatingCount ?? 0
    if (!Number.isInteger(reviewCount) || reviewCount < 0) return null
    if (reviewCount === 0) return { rating: 0, reviewCount: 0 }
    const rating = body?.rating
    if (!Number.isFinite(rating) || rating <= 0 || rating > 5) return null
    return { rating, reviewCount }
  } catch {
    return null
  }
}

/**
 * What the postscript may say, read now.
 *
 * Each part is either a reading or null, and null means the line says nothing
 * about that network that needs a number.
 *
 * @param {{fetchImpl?: typeof fetch, key?: string, now?: number}} [options]
 * @returns {Promise<{trustpilot: object|null, google: object|null, bbb: boolean, readAt: string}>}
 */
export async function readProof({
  fetchImpl = fetch,
  key = process.env.GOOGLE_PLACES_API_KEY || '',
  now = Date.now(),
} = {}) {
  const [trustpilot, google] = await Promise.all([
    readTrustpilot(fetchImpl, now),
    readGoogle(fetchImpl, key),
  ])
  return { trustpilot, google, bbb: bbbAccredited(), readAt: new Date(now).toISOString() }
}

let held = null

/**
 * The reading every letter on this instance is drafted with, taken at most
 * once an hour.
 *
 * @param {{now?: number}} [options]
 */
export async function proofNow({ now = Date.now() } = {}) {
  if (held && now < held.until) return held.proof
  const proof = await readProof({ now })
  const whole = proof.trustpilot && proof.google
  held = { proof, until: now + (whole ? READING_TTL_MS : PARTIAL_TTL_MS) }
  return proof
}

/**
 * The name a letter's clicks are counted under.
 *
 * @param {'first'|'preview'} family The preview-first thread, or the older one
 *   whose preview is the third letter.
 * @param {number} nth -1 for the first letter of either, 0 onward for each follow-up.
 * @param {number[]} [days] The days the preview-first follow-ups fall on.
 */
export function previewCampaign(family, nth, days = []) {
  if (family === 'first') return nth < 0 ? 'preview-first' : `preview-first-day-${days[nth]}`
  return nth < 0 ? 'preview-letter' : `preview-follow-up-${nth + 1}`
}

/**
 * The postscript, as runs of text and links, or null when there is nothing
 * true to say.
 *
 * The sentence is assembled from whichever facts were read, in one order:
 * the accreditation, then the ratings. Every part that is a link is the phrase
 * a reader would expect to click, and Google is said without one, since its
 * figure is there to be compared rather than visited and a third address is a
 * third domain in a cold letter.
 *
 * @param {{trustpilot: object|null, google: object|null, bbb: boolean}|null|undefined} proof
 *   A reading from `readProof`. Anything falsy leaves the letter without a postscript.
 * @param {{campaign: string, nth?: number}} where The letter, and its place in the thread.
 * @returns {{parts: Array<string|{text: string, href: string}>}|null}
 */
export function proofLine(proof, { campaign, nth = -1 }) {
  if (!proof) return null
  const link = (text, href) => ({ text, href: taggedProfile(href, campaign) })
  const trustpilot = proof.trustpilot
  const google = proof.google
  const counted = Number.isInteger(trustpilot?.reviewCount)
  const withGoogle =
    counted && google?.reviewCount > 0 && google.reviewCount > trustpilot.reviewCount

  // The ratings, as the run that follows "is" or "has". Two networks already
  // carry an "and" between them, so the accreditation is joined to them by a
  // comma rather than a second one.
  let ratings = null
  let verb = 'is'
  let joiner = ' and '
  if (withGoogle && trustpilot.reviewCount > 0) {
    joiner = ', '
    ratings = [
      `rated ${score(google.rating)} out of 5 from ${reviews(google.reviewCount)} on Google and `,
      link(
        `${score(trustpilot.rating)} from ${trustpilot.reviewCount} on Trustpilot`,
        TRUSTPILOT_PROFILE_URL
      ),
    ]
  } else if (withGoogle) {
    ratings = [
      `rated ${score(google.rating)} out of 5 from ${reviews(google.reviewCount)} on Google`,
    ]
  } else if (counted && trustpilot.reviewCount > 0) {
    ratings = [
      link(
        `rated ${score(trustpilot.rating)} out of 5 from ${reviews(trustpilot.reviewCount)} on Trustpilot`,
        TRUSTPILOT_PROFILE_URL
      ),
    ]
  } else if (!counted) {
    // Trustpilot did not answer, so the profile is named with no figure on it.
    ratings = ['has ', link('reviews on Trustpilot', TRUSTPILOT_PROFILE_URL)]
    verb = 'has'
  }

  const accredited = proof.bbb ? link('BBB accredited', BBB_PROFILE_URL) : null
  if (!accredited && !ratings) return null

  const lead = LEADS[nth < 0 ? 0 : 1 + (nth % (LEADS.length - 1))]
  const parts = [`P.S. ${lead} TaylorURL `]
  if (accredited) {
    parts.push('is ', accredited)
    if (ratings) parts.push(joiner, ...ratings)
  } else if (verb === 'has') {
    parts.push(...ratings)
  } else {
    parts.push('is ', ...ratings)
  }
  parts.push('.')
  return { parts: merged(parts) }
}

/** Adjacent runs of text joined, so a renderer meets text, link, text. */
function merged(parts) {
  const out = []
  for (const part of parts) {
    if (typeof part === 'string' && typeof out.at(-1) === 'string') out[out.length - 1] += part
    else out.push(part)
  }
  return out
}
