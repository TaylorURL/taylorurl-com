/**
 * The plain third letter, to a measured site and to a business with none: a
 * site already live, and how theirs would be built. Nothing is quoted, since
 * a review is on the site's own page and the letter points there.
 */

import { sharesTrade } from '../../message.js'
import { IN_PERSON } from '../shared.js'
import { YES, plainLetter, threaded } from './shared.js'

export function plainNearbyOpener(prospect, where, shot, context = {}) {
  const project = context.work?.[0] ?? null
  const subject = threaded(context, `a site near ${prospect.town || 'you'}`)

  // The closest work is only called the closest work when it is in their own
  // trade. Where it is not, the letter says what it can say truthfully: it is
  // one of the sites the studio has live nearby. A reader who clicks through
  // to a go-kart track after being told it is their line of work has caught
  // the message overstating itself, and there is no recovering that.
  const opening = !project
    ? `One more from us, then we'll leave it with you. We have a few sites live for businesses ${where}, each on the business's own address.`
    : sharesTrade(project, prospect.trade)
      ? `One more from us, then we'll leave it with you. ${project.name} in ${project.town || project.place} is the closest thing to your line of work we have live.`
      : `One more from us, then we'll leave it with you. ${project.name} in ${project.town || project.place} is one of the sites we have live near you.`

  return plainLetter(subject, [
    opening,
    `Built to load on a phone the way Google's test wants, and to be found for what the business does rather than only its name. Yours would be built the same way, and you'd see it as it took shape rather than at the end.`,
    IN_PERSON,
    context.site ? `That one and the rest are here: ${context.site}` : null,
    `Worth a look? ${YES}`,
  ])
}
