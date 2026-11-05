/**
 * The one line in a first preview letter that sends the owner somewhere other
 * than the studio to find out whether the studio is real.
 *
 * An owner who likes the draft looks the sender up before they answer, and
 * what a search turns up on its own is thin. So the first letter closes on a
 * postscript naming the two places that say so in somebody else's words: the
 * BBB accreditation and the Trustpilot profile. It names them and nothing
 * more. A rating quoted in a cold letter reads like a badge pasted under a
 * signature, and seven reviews read thinner as a figure than as a place to
 * go and look. The follow-ups carry no postscript at all: a person does not
 * close every reply in a thread on the same line.
 *
 * Whether Trustpilot is there to name is read when the letter is drafted,
 * never written down here, because sending a stranger to a profile nobody has
 * reviewed is worse than not mentioning it. A read that fails still names the
 * profile, which exists whatever the endpoint answered, and the committed
 * standing the home page badge falls back on is not used, since it is a floor
 * for a badge and not something to point a stranger at. The accreditation is
 * the one fact held rather than read, because `bbbAccredited()` reads the
 * seal BBB issued, and holding the seal is the claim.
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
 */

import { standing as trustpilotStanding } from '../../api/trustpilot.js'
import { BBB_PROFILE_URL, bbbAccredited } from '../../src/app/data/reputation/bbb.js'
import { TRUSTPILOT_PROFILE_URL } from '../../src/app/data/reputation/trustpilot.js'

/** Where a click out of a preview letter says it came from. */
const TAGS = { source: 'preview', medium: 'outreach' }

/**
 * How long one reading stands for every letter drafted on the same instance.
 *
 * An hour is the same hour the Trustpilot endpoint is cached at the edge for,
 * so a letter never judges the profile on an older reading than the badge on
 * the home page would. A failed reading is kept for five minutes instead, so
 * a service that has recovered is read again within the next few letters.
 */
const READING_TTL_MS = 60 * 60 * 1000
const PARTIAL_TTL_MS = 5 * 60 * 1000

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
 * What the postscript may say, read now.
 *
 * The Trustpilot part is a reading or null, and null means the endpoint did
 * not answer, which still leaves the profile there to be named.
 *
 * @param {{fetchImpl?: typeof fetch, now?: number}} [options]
 * @returns {Promise<{trustpilot: object|null, bbb: boolean, readAt: string}>}
 */
export async function readProof({ fetchImpl = fetch, now = Date.now() } = {}) {
  const trustpilot = await readTrustpilot(fetchImpl, now)
  return { trustpilot, bbb: bbbAccredited(), readAt: new Date(now).toISOString() }
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
  held = { proof, until: now + (proof.trustpilot ? READING_TTL_MS : PARTIAL_TTL_MS) }
  return proof
}

/**
 * The name a draft preview letter's clicks are counted under.
 *
 * @param {number} nth -1 for the first letter, 0 onward for each follow-up.
 * @param {number[]} days The days the follow-ups fall on.
 */
export function previewCampaign(nth, days) {
  return nth < 0 ? 'preview-first' : `preview-first-day-${days[nth]}`
}

/**
 * The postscript, as runs of text and links, or null when there is nothing
 * true to say or the letter is a follow-up.
 *
 * Every place named is a link, the phrase a reader would expect to click:
 * "the BBB" while the seal is held, and Trustpilot unless the reading says
 * nobody has reviewed the studio there.
 *
 * @param {{trustpilot: object|null, bbb: boolean}|null|undefined} proof
 *   A reading from `readProof`. Anything falsy leaves the letter without a postscript.
 * @param {{campaign: string, nth?: number}} where The letter, and its place in the thread.
 * @returns {{parts: Array<string|{text: string, href: string}>}|null}
 */
export function proofLine(proof, { campaign, nth = -1 }) {
  if (!proof || nth >= 0) return null
  const link = (text, href) => ({ text, href: taggedProfile(href, campaign) })
  const reviewed = !proof.trustpilot || proof.trustpilot.reviewCount > 0
  const places = []
  if (proof.bbb) places.push(['the ', link('BBB', BBB_PROFILE_URL)])
  if (reviewed) places.push([link('Trustpilot', TRUSTPILOT_PROFILE_URL)])
  if (!places.length) return null
  const parts = ["P.S. If you want to look me up first, I'm on "]
  places.forEach((place, index) => {
    if (index) parts.push(' and ')
    parts.push(...place)
  })
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
