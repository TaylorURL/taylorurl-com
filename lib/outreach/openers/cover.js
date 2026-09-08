/**
 * What it covers: the first follow-up to a business with no site of its own.
 *
 * The first letter said the listing points at a page on a platform. This one
 * says what a site of their own would hold, in one paragraph, since nobody
 * asked and the answer is short. It threads under the first letter.
 */

import { CLOSE, OFFER } from './shared.js'

/** The follow-up that says what a site of their own would cover. */
export function coverOpener(prospect, where, shot, context = {}) {
  const name = prospect.name.slice(0, 60)

  return {
    subject: context.prior?.subject ? `Re: ${context.prior.subject}` : 'what a site would cover',
    marker: '// What It Covers',
    lines: [
      `We wrote a few days ago about your listing pointing at a page on somebody else's platform. Here's the short version of what a site of your own would cover.`,
    ],
    figure: null,
    after: [
      `Your hours and your number where a search puts them. A page for each thing you do. A way to ask for a quote. Your reviews. And an address that stays yours whatever the platform does next.`,
      `Built to be found by somebody searching for what you do, not just for your name. That's most of what we build for small businesses ${where}.`,
      OFFER(`what one would cover for ${name} in particular`),
    ],
    close: CLOSE,
  }
}
