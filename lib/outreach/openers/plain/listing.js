/**
 * The plain first letter to a business whose listing points at a platform.
 *
 * What the listing does to a searcher, what a page of their own would do
 * instead, one to look at, and one question.
 */

import { YES, listingLines, plainLetter, workLine } from './shared.js'

export function plainListingOpener(prospect, where, shot, context = {}) {
  const name = prospect.name.slice(0, 60)

  return plainLetter('your google listing', [
    ...listingLines(prospect),
    [
      `A site of your own is one page with your number at the top, your hours, your work and a way to ask for a quote, at an address that stays yours. We build them for small businesses ${where}.`,
      workLine(context),
    ]
      .filter(Boolean)
      .join(' '),
    `Want to see what one would look like for ${name}? ${YES}`,
  ])
}
