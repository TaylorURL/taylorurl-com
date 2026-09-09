/**
 * Nearby work: the second follow-up, for any kind of business.
 *
 * A site built for a business like theirs, near them, which the message
 * already shows below the letter. The words point at the first one and say
 * what it has in common with the site they would get. The composer hands the
 * work in, so the letter says the same thing the pictures under it show.
 */

import { CLOSE, IN_PERSON, OFFER } from './shared.js'

/** The follow-up that points at a site built for a business like theirs. */
export function nearbyOpener(prospect, where, shot, context = {}) {
  const project = context.work?.[0] ?? null
  const name = prospect.name.slice(0, 60)

  return {
    subject: context.prior?.subject
      ? `Re: ${context.prior.subject}`
      : `A site we built near ${prospect.town || 'you'}`,
    marker: '// Nearby Work',
    lines: [
      project
        ? `One more from us, then we'll leave it with you. The first site below is one we built for ${project.name} in ${project.place}, the closest thing to your line of work we have live.`
        : `One more from us, then we'll leave it with you. Below are a few of the sites we have live for businesses ${where}.`,
    ],
    figure: null,
    after: [
      project?.review
        ? `${project.review.name} wrote of it: "${project.review.quote}"`
        : `Each one sits on the business's own address, loads on a phone the way Google's test wants, and carries the hours, the number and the work.`,
      `Yours would be built the same way, and you'd see it as it took shape rather than at the end. ${IN_PERSON}`,
      OFFER(`to see what one would cover for ${name}`),
    ],
    close: CLOSE,
  }
}
