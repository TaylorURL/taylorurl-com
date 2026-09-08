/**
 * The plain second letter to a measured site: a different angle from the
 * first. Where the report marks the site down for search, that is the angle.
 * Where it does not, the angle is what a phone visitor can do in the first
 * few seconds, and the ask is a question only the owner can answer.
 */

import { searchScoreOf, searchShort } from '../search.js'
import { YES, plainLetter, threaded, workLine } from './shared.js'

export function plainSearchOpener(prospect, where, shot, context = {}) {
  const subject = threaded(context, 'your site in search')
  const name = prospect.name.slice(0, 60)

  if (searchShort(prospect)) {
    return plainLetter(subject, [
      `One more thing off the same report, since it's the part that decides who finds you.`,
      `Google grades whether a page says plainly what you do and where you are. ${name} gets ${searchScoreOf(prospect)} out of 100 there. What it marks is usually a title, a description and a few links, which is an afternoon's work rather than a rebuild.`,
      `Want us to send what it marked on yours? ${YES}`,
      workLine({ site: context.site }),
    ])
  }

  return plainLetter(subject, [
    `One more from us on the site, then we’ll leave it with you.`,
    `The other thing we look at is what a phone visitor can do in the first five seconds: call you, see your hours, ask for a quote. Most sites make them hunt for all three.`,
    `If you tell us what people mostly want from you when they land there, we’ll tell you what we’d move. One line is plenty.`,
    workLine({ site: context.site }),
  ])
}
