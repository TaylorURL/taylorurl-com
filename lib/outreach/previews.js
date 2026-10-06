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
import { homeUrl, renderPlainHtml, renderPlainText } from './message.js'

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
  (name, url) => [
    `Two things would make the draft for ${name} feel more like yours: photos of recent jobs, and the reviews you're proudest of. It has room for both:\n${url}`,
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
 *   name and unsub_token beside it.
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
    paragraphs = (own ?? write(name, url)).map(text => fill(text, url))
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
