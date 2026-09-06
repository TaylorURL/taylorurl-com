/**
 * The speed reading: the letter that opens on the business's own mobile
 * performance score.
 *
 * This is the opener the sender has always used for a measured site, kept
 * word for word. The figure it turns on is shared with any other letter that
 * quotes the same score, so two letters cannot describe one reading two ways.
 */

import { GOOD_FLOOR, bandOf, supporting, verdict, verify } from '../bands.js'
import { CHECK_LINE, CLOSE, OFFER } from './shared.js'

/** The score a row carries, or null where the audit put no number on it. */
export const scoreOf = prospect =>
  typeof prospect.audit_score === 'number' ? prospect.audit_score : null

/**
 * Whether a reading has nothing under the good band anywhere, performance
 * included. A letter opening on a clean reading has no fault to name, and
 * naming one that is not there is the fastest way to lose a reader who can
 * check in half a minute.
 */
export const isClean = prospect => {
  const score = scoreOf(prospect)
  return score !== null && score >= GOOD_FLOOR && !supporting(prospect).length
}

/**
 * The performance figure, as every letter that quotes it shows it: the score,
 * the band, what the band means, the page it was read on, whatever else the
 * same report marked short, and where to run it again.
 *
 * @param {object} prospect A candidate row.
 * @param {string|null} shot The stored capture of the page, or nothing.
 */
export function speedFigure(prospect, shot) {
  const score = scoreOf(prospect)
  return {
    label: 'PageSpeed',
    meta: 'Mobile',
    value: score === null ? 'No Score' : String(score),
    unit: score === null ? '' : 'out of 100',
    band: bandOf(score),
    meaning: verdict(score),
    // The page the reading was taken on, which the message shows rather than
    // describes. A row that reached here without one has nothing to show.
    site: prospect.website ? { url: prospect.website, name: prospect.name, shot } : null,
    also: supporting(prospect),
    // Nothing to check where nothing came back with a number on it, and no
    // address to run the check on where the row carries none.
    note: score === null || !prospect.website ? null : verify(prospect.website),
  }
}

// What follows a reading with something short in it.
//
// The ranking claim is the one Google publishes and nothing beyond it: page
// experience is a confirmed signal, Core Web Vitals is what it is measured on,
// and Google groups a site as good or not on real visits. It weighs most where
// competing pages are otherwise alike, which is where a local business stands
// against its neighbours. A score is not a placement and the message never
// offers one.
export const SHORTFALL = where => [
  `At that score, a person who finds you on a phone waits on a blank screen, and some of them leave before the page opens. Google ranks a slow page lower for the same reason. It's fixable, and it's most of what I do for small businesses ${where}.`,
  OFFER('the list of what is slowing yours down, in order'),
]

// What follows a reading with nothing short in it. The business is not a lead
// on this basis, so the message says what the reading found and what the studio
// does, and offers the report rather than a repair.
export const NOTHING_SHORT = where => [
  `Nothing in that reading falls short, so there's nothing here for me to sell you. I build and look after sites for small businesses ${where}, and most of what reaches me is a site that stopped keeping up with the business behind it.`,
  OFFER("the full report, or a hand with something the site isn't doing yet"),
]

/** The opener for a business whose own site was measured. */
export function speedOpener(prospect, where, shot) {
  const score = scoreOf(prospect)
  const name = prospect.name.slice(0, 60)

  return {
    subject: 'your site on a phone',
    marker: '// Speed Reading',
    lines: [
      score === null
        ? `I ran ${name}'s website through Google's PageSpeed test this week, the way most of your customers arrive: on a phone, on a phone connection.`
        : `${name}'s website scores ${score} out of 100 on Google's PageSpeed test, run the way most of your customers arrive: on a phone, on a phone connection. ${CHECK_LINE}`,
    ],
    figure: speedFigure(prospect, shot),
    after: isClean(prospect) ? NOTHING_SHORT(where) : SHORTFALL(where),
    close: CLOSE,
  }
}
