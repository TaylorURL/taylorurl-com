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

import { hostOf, platformName } from '../../platforms.js'
import { HELD_BACK, YES, plainLetter, threaded } from './shared.js'

export function elsewhereOpener(prospect, where, shot, context = {}) {
  const platform = platformName(hostOf(prospect.website)) || "somebody else's page"
  const name = prospect.name.slice(0, 60)
  const search = [prospect.trade, prospect.town].filter(Boolean).join(' ')

  return plainLetter(threaded(context, 'your google listing'), [
    `I looked for ${name}'s website this week. Your Google listing points at ${platform} and nowhere else.`,
    search
      ? `Someone who searches "${search}" and taps through lands on ${platform}'s page, in ${platform}'s layout with ${platform}'s name at the top, and has to hunt for your number and your hours.`
      : `Someone who taps through lands on ${platform}'s page, in ${platform}'s layout with ${platform}'s name at the top, and has to hunt for your number and your hours.`,
    `A site of your own is one page with your number at the top, your hours, your work and a way to ask for a quote, at an address that stays yours.`,
    `${HELD_BACK} Want to see what one would look like for ${name}? ${YES}`,
  ])
}
