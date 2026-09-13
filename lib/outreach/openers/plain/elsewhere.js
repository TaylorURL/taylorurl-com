/**
 * The second letter to a business whose listing points at a platform: where
 * that listing sends a searcher, said after a letter that made no claim about
 * it.
 *
 * The same position in the chain as the load time letter beside it, written
 * for the businesses there is nothing to measure. The introduction went first
 * and said who is writing; this is the finding, and the line that opens it is
 * the one that says why it waited.
 *
 * What is left out is the introduction. The cold version of this letter had to
 * carry it, since it was the first thing the reader ever saw from the studio.
 * Here it is three days old, and a second letter that introduces its writer
 * again is a second letter from somebody who does not remember sending the
 * first.
 */

import { HELD_BACK, YES, listingLines, plainLetter, threaded } from './shared.js'

export function elsewhereOpener(prospect, where, shot, context = {}) {
  const name = prospect.name.slice(0, 60)

  return plainLetter(threaded(context, 'your google listing'), [
    ...listingLines(prospect),
    `A site of your own is one page with your number at the top, your hours, your work and a way to ask for a quote, at an address that stays yours.`,
    `${HELD_BACK} Want to see what one would look like for ${name}? ${YES}`,
  ])
}
