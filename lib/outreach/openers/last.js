/**
 * The last note: the final follow-up, for any kind of business.
 *
 * Short, and it says it is the last. It gives the reader a one-word way to
 * say later, so a business that is interested but busy is not lost, and it
 * says plainly that a no needs no reply.
 */

import { CLOSE } from './shared.js'

/** The follow-up that closes the chain. */
export function lastOpener(prospect, where, shot, context = {}) {
  return {
    subject: context.prior?.subject ? `Re: ${context.prior.subject}` : 'last note from me',
    marker: '// Last Note',
    lines: [`This is the last note from me on this, so it's a short one.`],
    figure: null,
    after: [
      `If the timing's wrong, reply with the one word "later" and I'll check back in a few months. If it's a no, no reply needed and I'll leave it here.`,
      `If it's a yes, or a maybe, reply with what the site has to do and I'll come back with what that would take. No charge for the asking, and no sales call attached.`,
    ],
    close: CLOSE,
  }
}
