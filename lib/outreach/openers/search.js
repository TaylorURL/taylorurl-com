/**
 * The search reading: the letter that opens on the business's SEO score.
 *
 * The same report the speed reading quotes grades four things, and the one
 * it files under SEO is whether a page tells Google plainly what it is. A
 * business whose site is short there has a different fault from a slow one,
 * and a letter that names it is a different letter, so this is registered
 * beside the speed reading rather than folded into it.
 *
 * It is only ever sent where the SEO score is under the good band. A letter
 * quoting a score of 100 as the reason for writing is quoting a fault that is
 * not there, and the registry's condition keeps it off those rows.
 */

import { GOOD_FLOOR, supporting } from '../audit/bands.js'
import { CHECK_LINE, CLOSE, OFFER } from './shared.js'
import { scoreFigure } from './speed.js'

/** The SEO score a row carries, or null where the audit put no number on it. */
export const searchScoreOf = prospect =>
  typeof prospect.seo_score === 'number' ? prospect.seo_score : null

/** Whether the search reading has a fault to name, which is the only time it is sent. */
export const searchShort = prospect => {
  const score = searchScoreOf(prospect)
  return score !== null && score < GOOD_FLOOR
}

// What the report's SEO checks are, said once so every band says the same.
// Each item is one Google publishes as something it reads before it can show a
// page for a search, and nothing beyond that is claimed for them.
const CHECKS =
  'What it checks for is the basics a page needs before a search can find it: a title, a description, links it can follow and text a phone can read.'

/** What one SEO score means, in a sentence the reader can check. */
function searchVerdict(score) {
  if (typeof score !== 'number') {
    return 'Google has not managed to put a number on it yet, which is usually a sign of its own.'
  }
  if (score < 50) return `Anything under 50 is what Google files as poor. ${CHECKS}`
  if (score < GOOD_FLOOR) {
    return `Google files that as needs improvement, short of the good band that starts at 90. ${CHECKS}`
  }
  return 'That already sits in the band Google calls good.'
}

/** The opener for a measured site whose SEO score falls short. */
export function searchOpener(prospect, where, shot) {
  const score = searchScoreOf(prospect)
  const name = prospect.name.slice(0, 60)

  return {
    subject: 'your site in google search',
    marker: '// Search Reading',
    lines: [
      score === null
        ? `We ran ${name}'s website through Google's report this week. Speed is the figure most people quote from it, but it also grades whether a page tells Google plainly what you do and where you are, and it couldn't put a number on yours.`
        : `Google's PageSpeed report gives ${name}'s website ${score} out of 100 for search. That's its grade for whether a page tells Google plainly what you do and where you are, which decides who finds you. ${CHECK_LINE}`,
    ],
    figure: scoreFigure(prospect, shot, {
      label: 'SEO',
      score,
      meaning: searchVerdict(score),
      // The other three categories, where they fall short, performance among
      // them: a slow page beside a poor SEO reading is corroboration that the
      // site was examined rather than a second complaint.
      also: supporting(prospect, 'seo_score'),
    }),
    after: [
      `Most of what it marks is a short job: a title, a description, links it can follow. Fixed, the people searching for what you do find you instead of the next name down. It's most of what we do for small businesses ${where}.`,
      OFFER('the list of what it marked on yours'),
    ],
    close: CLOSE,
  }
}
