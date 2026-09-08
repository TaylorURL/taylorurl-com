/**
 * Holding up: the letter that asks whether the site is still doing its job.
 *
 * It quotes the same performance figure the speed reading does, and it is a
 * different letter around it: the subject is a question rather than a score,
 * the lines say why a site that was fine when it went up may not be now, and
 * the number arrives as the answer to that rather than as the reason for
 * writing. Whether a reader opens for a question or for a figure is the thing
 * this is registered to find out.
 */

import { CHECK_LINE, CLOSE, OFFER } from './shared.js'
import { isClean, scoreOf, speedFigure } from './speed.js'

// What follows a reading with something short in it.
const BEHIND = where => [
  `It has slipped. That's fixable, and it's most of what we do for small businesses ${where}: sites that were fine when they went up and haven't kept pace with the business behind them.`,
  OFFER('the list of what is slowing yours down, in order'),
]

// What follows a reading with nothing short in it.
const HOLDING = where => [
  `It's holding up. Nothing in that reading falls short, so there's nothing here for us to sell you. If there's something the site isn't doing for the business yet, that's the conversation worth having, and it's most of what we do for small businesses ${where}.`,
  OFFER('the full report, or a hand with that'),
]

/** The opener for a measured site, put as a question about the site's age. */
export function holdingOpener(prospect, where, shot) {
  const name = prospect.name.slice(0, 60)

  return {
    subject: 'how your site is holding up',
    marker: '// Holding Up',
    lines: [
      `Most websites get built for the business it was at the time and never looked at again.`,
      `We ran ${name}'s site through Google's PageSpeed test this week to see how it's holding up, the way most of your customers arrive: on a phone, on a phone connection.${scoreOf(prospect) === null ? '' : ` ${CHECK_LINE}`}`,
    ],
    figure: speedFigure(prospect, shot),
    after: isClean(prospect) ? HOLDING(where) : BEHIND(where),
    close: CLOSE,
  }
}
