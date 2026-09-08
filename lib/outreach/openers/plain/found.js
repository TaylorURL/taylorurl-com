/**
 * The second letter to a measured site: the load time, said after a letter
 * that made no claim about it.
 *
 * The introduction opens the chain on who is writing and nothing else, so
 * this is where the studio first says something about the reader's own
 * business. That order is the point. A finding lands differently from
 * somebody the reader has already heard from once, and the letter says why it
 * was held back rather than pretending the first one never went.
 *
 * The words about the site are the ones every plain letter uses, taken off
 * the same stored report, so a business hears the same reading whichever
 * letter carries it. What is not here is the introduction: who is writing,
 * where they work and what they have built were all said three days ago, and
 * saying them again is how a chain starts reading as a sequence rather than a
 * person.
 *
 * A site that came up fast is told so and asked the other question, since a
 * letter that manufactures a problem to have something to sell against is the
 * one thing the introduction was written to avoid.
 */

import { isClean } from '../speed.js'
import {
  HELD_BACK,
  YES,
  bareHost,
  fixesOf,
  listed,
  loadLine,
  plainLetter,
  threaded,
} from './shared.js'

export function foundOpener(prospect, where, shot, context = {}) {
  const host = bareHost(prospect.website) ?? 'your site'
  const subject = threaded(context, `${host} load time`)

  if (isClean(prospect)) {
    return plainLetter(subject, [
      `We loaded ${host} on a phone connection this week and it came up fast. That's rarer than it sounds, so there's nothing for us to fix there.`,
      `If there's something the site isn't doing for the business yet, a page it needs or a form nobody fills in, that's the thing we’d be worth a note on.`,
      `Anything like that? A one-line reply is plenty.`,
    ])
  }

  const fixes = fixesOf(prospect)
  const causes = fixes.length
    ? `Most of it is ${listed(fixes)}. None of that needs a redesign.`
    : `Most of what causes a wait like that is a short job rather than a rebuild.`

  return plainLetter(subject, [
    loadLine(prospect),
    causes,
    `${HELD_BACK} Want the list of what we’d change, in order, with what each takes? ${YES}`,
  ])
}
