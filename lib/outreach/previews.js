/**
 * The letters that carry a preview site to the business it was built for.
 *
 * A preview is a working site on a taylorurl.com subdomain, built in one
 * business's own logo, colours and photos and filed in `preview_sites`. Two
 * letters go with it and no more: the one that hands over the address, and a
 * follow-up a week later that points at the same address again. Both are plain
 * letters, rendered by lib/outreach/message.js the way the cold letter is, so
 * they carry the open square, the signature and the way off the list.
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

/** How long after the first letter the follow-up is owed. */
export const PREVIEW_FOLLOW_UP_DAYS = 7

/** Where a preview lives. */
export const previewUrl = slug => `https://${slug}.${PREVIEW_HOST}`

const fill = (text, url) => String(text).replaceAll('{url}', url)

/** The letter a business with no written letter of its own is sent. */
function standardFirst(name, url) {
  return {
    subject: `A new website for ${name}`,
    paragraphs: [
      `I built a new website for ${name}, and it's live here so you can see it before deciding anything:\n${url}`,
      'It uses your logo, colors and photos, keeps your phone number one tap away on every screen, and loads fast on a phone.',
      "If you like it, reply and I'll put it on your own domain.",
    ],
  }
}

function standardFollowUp(name, url) {
  return [
    `Following up on the site I built for ${name} last week. It's still up here:\n${url}`,
    "If you'd change anything before it goes on your domain, reply with what you want different and I'll make the changes.",
  ]
}

/**
 * Renders one preview letter in both halves.
 *
 * @param {object} site Row from `preview_sites`, with its prospect's email,
 *   name and unsub_token beside it.
 * @param {'first'|'follow_up'} kind Which of the two letters.
 * @param {{track: string, unsubscribe: string|null, prior?: {subject: string}}} context
 */
export function previewLetter(site, kind, { track, unsubscribe, prior = null, at = new Date() }) {
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
    const own = site.letter?.follow_up?.length ? site.letter.follow_up : null
    paragraphs = (own ?? standardFollowUp(name, url)).map(text => fill(text, url))
  }
  const message = {
    subject,
    greeting: firstNameOf(site.email),
    at,
    paragraphs,
    track,
    contact: { unsubscribe, site: homeUrl(track) },
    styled: true,
  }
  return { subject, text: renderPlainText(message), html: renderPlainHtml(message) }
}
