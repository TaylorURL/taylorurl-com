/**
 * The letters that carry a preview site to the business it was built for.
 *
 * A preview is a working site on a taylorurl.com subdomain, built in one
 * business's own logo, colours and photos and filed in `preview_sites`. It is
 * the third letter a cold business receives, after the introduction and the
 * meeting ask, and everything after it is about the same site: a follow-up a
 * week apart, each one a different reason to open the draft, until the
 * business has been sent ten letters in all, when it is taken off the list.
 * All of them are plain letters, rendered by lib/outreach/message.js the way
 * the cold letter is, so they carry the open square, the signature and the way
 * off the list.
 *
 * Each row may carry its own `letter`, written for that business: a subject and
 * the paragraphs, with `{url}` standing for the preview's address. A row
 * without one gets the letter below, which says nothing about the business that
 * the site itself does not show.
 */

import { firstNameOf } from './first-names.js'
import {
  homeUrl,
  renderPersonalHtml,
  renderPersonalText,
  renderPlainHtml,
  renderPlainText,
} from './message.js'

/** The parent the preview subdomains hang off. */
export const PREVIEW_HOST = 'taylorurl.com'

/** How long after each preview letter the next one is owed. */
export const PREVIEW_FOLLOW_UP_DAYS = 7

/** How many letters a business is sent in all, cold ones included, before it is taken off the list. */
export const LETTERS_IN_ALL = 10

/** How many letters come before the preview: the introduction and the meeting ask. */
export const LETTERS_BEFORE_PREVIEW = 2

/** How long after the second letter the preview may go. */
export const PREVIEW_WAIT_DAYS = 5

/**
 * Fewer Google reviews than this and the preview leaves the rating out, so the
 * letters say nothing about reviews either. It decides only what is said: a
 * business with no reviews at all still gets its preview.
 */
export const RATING_SHOWN_FROM = 5

/** Whether this business has enough Google reviews for the letters to mention them. */
export const hasReviews = site => Number(site?.rating_count) >= RATING_SHOWN_FROM

/** Where a preview lives. */
export const previewUrl = slug => `https://${slug}.${PREVIEW_HOST}`

const fill = (text, url) => String(text).replaceAll('{url}', url)

/** The letter a business with no written letter of its own is sent. */
function standardFirst(name, url) {
  return {
    subject: `A draft website for ${name}`,
    paragraphs: [
      `I put together a first draft of a new website for ${name}. It's live here so you can click through it:\n${url}`,
      'It uses your logo, colors and photos, and keeps your phone number one tap away on every screen.',
      "It's a draft, so tell me what you'd change: the wording, the photos, the services, anything that isn't right. Reply with your notes and I'll make the changes.",
    ],
  }
}

/**
 * The follow-ups, in the order they go. Each comes at the draft from a
 * different side, so a business that ignored one is not sent it again in other
 * words. None of them names a domain or says where the site would live.
 */
const FOLLOW_UPS = [
  (name, url) => [
    `Following up on the draft website I put together for ${name} last week. It's still up here:\n${url}`,
    "What would you change about it? Reply with anything you'd want different and I'll update the draft.",
  ],
  (name, url) => [
    `Most people who look up ${name} will do it on a phone, so that's the best place to try the draft:\n${url}`,
    "Open it on yours and try calling from the top of the page, finding a service, and getting to your hours. If anything takes more than a tap or two, tell me and I'll fix it.",
  ],
  (name, url) => [
    `If you've wondered what it would take to turn the draft for ${name} into your real site, it's mostly a back and forth. You send notes, I change the draft, and you look again until it reads right:\n${url}`,
    "Where it goes live and what it's called is your call. A short reply with what you want changed is enough to start.",
  ],
  (name, url, site) => [
    hasReviews(site)
      ? `Two things would make the draft for ${name} feel more like yours: photos of recent jobs, and the reviews you're proudest of. It has room for both:\n${url}`
      : `One thing would make the draft for ${name} feel more like yours: photos of recent jobs. It has room for them:\n${url}`,
    "Reply with whatever you have, even phone photos, and I'll put them in.",
  ],
  (name, url) => [
    `I may have been writing to the wrong person about this. If someone else at ${name} looks after the website, would you forward them the draft?\n${url}`,
    "Or reply with their email and I'll send it to them directly.",
  ],
  (name, url) => [
    `One question about the draft website for ${name}: is a new site something you're thinking about this year, or not right now?\n${url}`,
    "Either answer helps. If it's not right now, say so and I'll stop writing about it.",
  ],
  (name, url) => [
    `This is the last note I'll send about the draft website for ${name}. It stays up here if you want to look at it later:\n${url}`,
    "If you ever want it finished or changed, reply to this email and I'll pick it up from there.",
  ],
]

/** How many follow-ups there are to send after the first preview letter. */
export const FOLLOW_UP_COUNT = FOLLOW_UPS.length

/**
 * Renders one preview letter in both halves.
 *
 * @param {object} site Row from `preview_sites`, with its prospect's email,
 *   name, unsub_token and Google review count (`rating_count`) beside it.
 * @param {'first'|'follow_up'} kind The first letter or a follow-up.
 * @param {{track: string, unsubscribe: string|null, prior?: {subject: string}, nth?: number}} context
 *   `nth` is which follow-up, counted from zero; the last one is sent past the end.
 */
export function previewLetter(
  site,
  kind,
  { track, unsubscribe, prior = null, at = new Date(), nth = 0 }
) {
  const url = previewUrl(site.slug)
  const name = site.name
  let subject
  let paragraphs
  if (kind === 'first') {
    const own = site.letter?.paragraphs?.length ? site.letter : null
    const base = own ?? standardFirst(name, url)
    subject = fill(base.subject || `A new website for ${name}`, url)
    paragraphs = base.paragraphs.map(text => fill(text, url))
  } else {
    subject = prior?.subject
      ? `Re: ${prior.subject.replace(/^Re:\s*/i, '')}`
      : `Re: A new website for ${name}`
    // A row's own follow-up stands in for the first one only; the rest are the
    // different reasons below, which say nothing the site does not show.
    const own = nth === 0 && site.letter?.follow_up?.length ? site.letter.follow_up : null
    const write = FOLLOW_UPS[Math.min(nth, FOLLOW_UPS.length - 1)]
    paragraphs = (own ?? write(name, url, site)).map(text => fill(text, url))
  }
  const message = {
    subject,
    greeting: firstNameOf(site.email),
    at,
    paragraphs,
    // The picture of the site goes under the first paragraph, which is the one
    // that gives its address, and opens the same address.
    shot: site.shot_url
      ? { src: site.shot_url, href: url, alt: `The draft website for ${name}`, after: 0 }
      : null,
    track,
    contact: { unsubscribe, site: homeUrl(track) },
    styled: true,
  }
  return { subject, text: renderPlainText(message), html: renderPlainHtml(message) }
}

/**
 * The preview-first letters: the preview as the first thing a business ever
 * hears from the studio, then three follow-ups, then the draft comes down.
 *
 * Each business's letters are written for it on the Pi, from what its own
 * website and Google listing say, and filed on the row as `letter` with
 * `version: 2`. The site renders them and nothing more: the words, the
 * pictures and the subject all come from the row, so a letter is never padded
 * out with a sentence that would fit any business. A row without a written set
 * is not sent at all, rather than sent something generic.
 *
 * The days are counted from the first letter, so a follow-up held back over a
 * weekend does not push the ones after it later. The last letter says the draft
 * comes down, and `expires_at` is when it does.
 */

/** Days after the first letter that each follow-up is owed. */
export const PREVIEW_FIRST_DAYS = [3, 8, 18]

/** Days after the first letter that an unclaimed draft comes down. */
export const PREVIEW_LIFETIME_DAYS = 21

/** The name the preview-first letters are sent under. */
export const PREVIEW_FIRST_SENDER = 'Trenton Taylor'

/** Whether this row carries a written preview-first set. */
export function isPreviewFirst(site) {
  const letter = site?.letter
  return (
    letter?.version === 2 &&
    typeof letter.subject === 'string' &&
    Array.isArray(letter.first) &&
    letter.first.length > 0 &&
    Array.isArray(letter.follow_ups) &&
    letter.follow_ups.length === PREVIEW_FIRST_DAYS.length
  )
}

const IMAGE_TOKEN = /^\{image:([a-z0-9_-]+)\}$/i

/**
 * Turns one written paragraph into the block the personal renderer draws.
 * `{image:key}` is that picture, `{link}` is the preview's address on its own
 * line, and `{url}` inside a sentence is the address itself.
 */
function blockOf(paragraph, url, images) {
  const text = String(paragraph).trim()
  const picture = text.match(IMAGE_TOKEN)
  if (picture) {
    const image = images?.[picture[1]]
    if (!image?.src) throw new Error(`the letter names a picture it does not carry: ${picture[1]}`)
    return {
      image: { src: image.src, href: url, alt: image.alt || '', width: image.width || 560 },
    }
  }
  if (text === '{link}') return { link: url }
  const lead = text.match(/^(.*?)\{url\}$/)
  if (lead && !lead[1].includes('{url}')) return { link: url, lead: lead[1] }
  return { text: fill(text, url) }
}

/**
 * Renders one preview-first letter in both halves.
 *
 * @param {object} site Row from `preview_sites` carrying a version 2 `letter`.
 * @param {number} nth -1 for the first letter, 0 onward for each follow-up.
 * @param {{track: string, prior?: {subject: string}}} context
 */
export function previewFirstLetter(site, nth, { track, prior = null }) {
  if (!isPreviewFirst(site)) throw new Error(`${site?.slug} carries no preview-first letter`)
  const url = previewUrl(site.slug)
  const { letter } = site
  const paragraphs = nth < 0 ? letter.first : letter.follow_ups[nth]
  if (!Array.isArray(paragraphs) || !paragraphs.length) {
    throw new Error(`${site.slug} has no follow-up ${nth + 1} written`)
  }
  const base = String(prior?.subject || letter.subject).replace(/^Re:\s*/i, '')
  const subject = nth < 0 ? letter.subject : `Re: ${base}`
  const message = {
    subject,
    blocks: paragraphs.map(paragraph => blockOf(paragraph, url, letter.images)),
    track,
  }
  return { subject, text: renderPersonalText(message), html: renderPersonalHtml(message) }
}
