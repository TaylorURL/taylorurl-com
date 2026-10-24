/**
 * What every plain letter shares: the reader's address as they would type it,
 * a subject threaded under the first letter, and the shape a letter answers
 * with.
 */

import { hostOf } from '../../prospects/platforms.js'

/** The address a reader would type, which is the host without its www. */
export function bareHost(website) {
  const host = hostOf(website)
  return host ? host.replace(/^www\./, '') : null
}

/** A subject threaded under the first letter, or the given one where there is no first. */
export const threaded = (context, subject) =>
  context?.prior?.subject ? `Re: ${context.prior.subject}` : subject

/** The shape every plain opener answers with. */
export function plainLetter(subject, paragraphs) {
  return { subject, paragraphs: paragraphs.filter(Boolean), plain: true }
}
