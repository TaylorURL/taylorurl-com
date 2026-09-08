/**
 * Own ground: the letter for a business whose only page online belongs to a
 * platform, put as a question of who owns the page.
 *
 * The web presence letter says the business has no site. This one names the
 * platform the listing points at and says what a page on it is: something the
 * platform shows on its own terms and can change. Whether a reader moves for
 * the missing site or for the rented one is what this is registered to find
 * out.
 */

import { hostOf, platformName } from '../prospects/platforms.js'
import { CLOSE, OFFER } from './shared.js'

/** The opener for a business whose listing points at a platform it does not own. */
export function groundOpener(prospect, where) {
  const platform = platformName(hostOf(prospect.website))
  const name = prospect.name.slice(0, 60)

  return {
    subject: "a site that's yours",
    marker: '// Own Ground',
    lines: [
      `Your listing points at your page on ${platform} and nowhere else. That page is theirs: what it shows and who sees it are ${platform}'s to change, and they change them.`,
    ],
    figure: {
      label: 'Your Listing',
      meta: platform,
      value: 'Theirs',
      unit: 'not yours',
      band: 'plain',
      meaning: `A platform page shows what the platform decides to show, in the platform's own layout, with the platform's name at the top. A site of your own shows what you decide, at an address that stays yours.`,
    },
    after: [
      `A site of your own is an address you keep whatever the platform does next, with your hours, your number and your work laid out the way you want them. It's most of what we build for small businesses ${where}.`,
      OFFER(`to see what one would cover for ${name}`),
    ],
    close: CLOSE,
  }
}
