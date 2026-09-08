/**
 * The plain first letter to a business whose listing points at a platform.
 *
 * What the listing does to a searcher, what a page of their own would do
 * instead, one to look at, and one question.
 */

import { hostOf, platformName } from '../../prospects/platforms.js'
import { YES, plainLetter, workLine } from './shared.js'

export function plainListingOpener(prospect, where, shot, context = {}) {
  const platform = platformName(hostOf(prospect.website)) || "somebody else's page"
  const name = prospect.name.slice(0, 60)
  const search = [prospect.trade, prospect.town].filter(Boolean).join(' ')

  return plainLetter('your google listing', [
    `We looked for ${name}'s website this week. Your Google listing points at ${platform} and nowhere else.`,
    search
      ? `Someone who searches "${search}" and taps through lands on ${platform}'s page, in ${platform}'s layout with ${platform}'s name at the top, and has to hunt for your number and your hours.`
      : `Someone who taps through lands on ${platform}'s page, in ${platform}'s layout with ${platform}'s name at the top, and has to hunt for your number and your hours.`,
    [
      `A site of your own is one page with your number at the top, your hours, your work and a way to ask for a quote, at an address that stays yours. We build them for small businesses ${where}.`,
      workLine(context),
    ]
      .filter(Boolean)
      .join(' '),
    `Want to see what one would look like for ${name}? ${YES}`,
  ])
}
