/**
 * The plain second letter to a business with no site of its own: three things
 * a page of their own does that the platform's page cannot, and the same
 * question as the first letter, asked the other way round.
 */

import { hostOf, platformName } from '../../platforms.js'
import { YES, plainLetter, threaded, workLine } from './shared.js'

export function plainCoverOpener(prospect, where, shot, context = {}) {
  const platform = platformName(hostOf(prospect.website)) || 'the platform'

  return plainLetter(threaded(context, 'what a site would cover'), [
    `Short one, following my note about your listing.`,
    `Three things a site of your own does that the ${platform} page can't. It turns up when someone searches for what you do, not only for your name. It puts your number and your hours where a phone shows them first. And it stays yours whatever ${platform} changes next.`,
    `You'd see it as it took shape rather than at the end. Worth a look? ${YES}`,
    workLine({ site: context.site }),
  ])
}
