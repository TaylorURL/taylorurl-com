/**
 * The email a new business is sent, once its own site has given an address.
 *
 * It opens on the one thing known about the reader that nobody else writing
 * to them is likely to know: the company was registered with the state a few
 * weeks ago. Every company this goes to has a site already, since the address
 * came off it, so it does not offer a website as though they had none. It
 * offers to build or take over the one they have, which is what a site put up
 * in the first weeks of a business usually needs.
 *
 * It is rendered by the same plain renderers outreach's introduction goes out
 * in, so it reads as a few typed paragraphs with the same signature and the
 * same footer, and it carries its own unsubscribe link.
 */

import { BIO_NAME, BIO_PHONE } from '../mail/bio.js'
import { firstNameOf } from '../outreach/first-names.js'
import { OUTREACH_ORIGIN, homeUrl, renderPlainHtml, renderPlainText } from '../outreach/message.js'
import { displayName } from './filings.js'

/** The subject, which is who is writing, the way outreach's introduction puts it. */
export const SUBJECT = `${BIO_NAME}, TaylorURL`

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * When the company was registered, said the way a person would: "this month",
 * "last month", or the month by name.
 */
export function whenFormed(formedOn, at = new Date()) {
  if (!formedOn) return 'recently'
  const formed = new Date(`${formedOn}T12:00:00Z`)
  const months =
    (at.getUTCFullYear() - formed.getUTCFullYear()) * 12 + at.getUTCMonth() - formed.getUTCMonth()
  if (months <= 0) return 'this month'
  if (months === 1) return 'last month'
  return `in ${MONTHS[formed.getUTCMonth()]}`
}

/** A site's address the way it is said aloud: the host, without the www. */
export function siteShown(website) {
  try {
    return new URL(website).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** The paragraphs under the greeting. */
export function paragraphsFor(lead, at = new Date()) {
  const name = displayName(lead.name) || lead.name
  const site = siteShown(lead.website)
  return [
    `I saw that ${name} was registered in Texas ${whenFormed(lead.formed_on, at)}. We are TaylorURL, a small team that builds and looks after websites.`,
    `If ${site ?? 'your site'} isn't finished yet, or you'd rather someone else handled it, we can build it and look after it for you.`,
    `If that would help, reply here, or call or text me at ${BIO_PHONE}.`,
  ]
}

/** The link that takes a reader off the list, on this pipeline's own endpoint. */
export function unsubscribeUrlFor(token) {
  return `${OUTREACH_ORIGIN}/api/new-business/unsubscribe?token=${encodeURIComponent(token)}`
}

/**
 * The whole message for a lead.
 *
 * @returns {{ to_address: string, subject: string, body_text: string, body_html: string, unsubscribe: string }}
 */
export function composeFor(lead, at = new Date()) {
  const unsubscribe = unsubscribeUrlFor(lead.unsub_token)
  const content = {
    subject: SUBJECT,
    greeting: firstNameOf(lead.email),
    at,
    paragraphs: paragraphsFor(lead, at),
    track: null,
    contact: { unsubscribe, site: homeUrl(null) },
    styled: false,
  }
  return {
    to_address: String(lead.email).toLowerCase(),
    subject: SUBJECT,
    body_text: renderPlainText(content),
    body_html: renderPlainHtml(content),
    unsubscribe,
  }
}
