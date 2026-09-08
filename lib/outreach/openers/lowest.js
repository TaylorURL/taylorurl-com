/**
 * The lowest mark: the first follow-up to a measured site.
 *
 * A few days after the reading, one thing off it: the category the report
 * marked lowest, which is where the work would start. The reader has the
 * whole report already, so this quotes one figure rather than four, and it
 * threads under the first letter rather than opening a second subject.
 */

import { CATEGORIES, GOOD_FLOOR, bandOf, verify } from '../audit/bands.js'
import { CLOSE, OFFER } from './shared.js'

/** The category a reading marks lowest, or null where nothing was scored. */
export function lowestMark(prospect) {
  const scored = CATEGORIES.filter(entry => typeof prospect[entry.column] === 'number')
  if (!scored.length) return null
  return scored.reduce((low, entry) =>
    prospect[entry.column] < prospect[low.column] ? entry : low
  )
}

/** The follow-up that names the one mark to start with. */
export function lowestOpener(prospect, where, shot, context = {}) {
  const mark = lowestMark(prospect)
  const value = mark ? prospect[mark.column] : null
  const short = value !== null && value < GOOD_FLOOR

  return {
    subject: context.prior?.subject ? `Re: ${context.prior.subject}` : 'the one mark to start with',
    marker: '// Second Look',
    lines: [
      `One thing off the report we sent you a few days ago, in case the whole thing was more than you wanted to read.`,
    ],
    figure: mark
      ? {
          label: 'Lowest Mark',
          meta: mark.label,
          value: String(value),
          unit: 'out of 100',
          band: bandOf(value),
          meaning: short
            ? `${mark.label} is the lowest of the four marks and usually the quickest to bring up, so it's where we’d start.`
            : `${mark.label} is the lowest of the four marks, and it still sits in the band Google calls good. There's nothing on that report we’d open with.`,
          site: prospect.website ? { url: prospect.website, name: prospect.name, shot } : null,
          // The same report the first letter linked, and the same way to check it.
          note: prospect.website ? verify(prospect.website) : null,
        }
      : null,
    after: short
      ? [
          `That's usually a short job rather than a rebuild, and it's the kind of work we do for small businesses ${where}.`,
          OFFER('the list of what we would change, in order'),
        ]
      : [
          `So the offer stands the other way round: if there's something the site isn't doing for the business yet, that's the conversation worth having.`,
          OFFER('a hand with that'),
        ],
    close: CLOSE,
  }
}
