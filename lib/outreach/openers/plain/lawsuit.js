/**
 * The two letters a business sued over its website's accessibility is sent.
 *
 * The introduction the rest of the pipeline sends asks for nothing, because a
 * business found on a map has not said it needs anything. A business named in
 * a website accessibility suit has: the court filing says the site does not
 * work with a screen reader, and the way these cases end is the site being
 * brought up to WCAG 2.1 AA by a date. So this letter names the case, says
 * what it usually ends in, and offers the one thing a defendant is about to
 * go looking for.
 *
 * Every fact in it is read off the row the lawsuits job filed, and every one
 * is a public record the reader can check against the papers they were
 * served: the court, the day it was filed, the case number and the site. It
 * says what the studio does about it and nothing about the case beyond that,
 * and it says in its last line that it is not legal advice, because a
 * stranger writing about somebody's lawsuit should say plainly which side of
 * that line they are on.
 *
 * The second letter follows two weeks later under the first and asks once
 * more. There is no third: a business still being sued a month on has
 * chosen somebody or chosen not to, and a third letter about its lawsuit
 * would be pressing on a sore point for nothing.
 */

import { BIO_NAME, BIO_PHONE } from '../../../mail/bio.js'
import { bareHost, plainLetter, threaded } from './shared.js'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * The day a case was filed, as "September 29". The column is a calendar date,
 * so it is read as its parts rather than through a Date, which would move it
 * a day in any zone west of UTC.
 */
export function filedOn(day) {
  const match = String(day ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}`
}

/** The site as the letter names it, or "your website" where the row holds none. */
function siteName(prospect) {
  return bareHost(prospect.website) ?? 'your website'
}

/**
 * The subject, which is who the letter is from and nothing else: the same
 * words the introduction and the meeting letter carry, so a business written
 * to under this letter sees the same sender every other business does.
 */
export const LAWSUIT_SUBJECT = `${BIO_NAME}, TaylorURL`

/**
 * The business as a person says it: the name the caption gives it, without the
 * company form on the end. "Cardhaus Games, LLC" is how a court files it and
 * "Cardhaus Games" is how anybody would write to it.
 */
export function businessName(name) {
  return (
    String(name ?? '')
      .replace(
        /,?\s+(?:LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Ltd\.?|LP|L\.P\.|PLLC)\.?$/i,
        ''
      )
      .trim() || 'your business'
  )
}

export function lawsuitOpener(prospect, where, shot, context = {}) {
  const site = siteName(prospect)
  const name = businessName(prospect.name)
  const day = filedOn(prospect.case_filed_on)
  const when = day ? ` on ${day}` : ''
  const record = [prospect.case_court, prospect.case_number].filter(Boolean).join(', case ')
  const score =
    typeof prospect.accessibility_score === 'number'
      ? ` When I ran ${site} through Google's accessibility check, it scored ${prospect.accessibility_score} out of 100, so there's real work to do, but it's work with a clear finish line.`
      : ''
  return plainLetter(LAWSUIT_SUBJECT, [
    `I came across the accessibility suit filed against ${name}${when}${record ? ` (${record})` : ''}. I'm sorry you're dealing with it. These suits go after small businesses far more often than people realize, and most owners had no idea their site was a problem until the papers arrived.`,
    `The complaint says ${site} doesn't work with a screen reader.${score} These cases usually end with the site having to meet WCAG 2.1 AA by a set date.`,
    `That's exactly what we do at TaylorURL. We'd bring ${site} up to WCAG 2.1 AA and hand you a written audit your lawyer can put in front of the other side, so you can show the problem is fixed rather than promise it will be.`,
    `If that would help, reply here, or call or text me at ${context.phone ?? BIO_PHONE}. I'm not a lawyer, so none of this is legal advice.`,
  ])
}

export function lawsuitFollowUpOpener(prospect, where, shot, context = {}) {
  const site = siteName(prospect)
  const name = businessName(prospect.name)
  return plainLetter(threaded(context, LAWSUIT_SUBJECT), [
    `Following up on the suit over ${site}. If ${name} hasn't settled on who's fixing the site yet, the deadline in these cases tends to arrive faster than expected.`,
    `I can go through ${site} this week and tell you exactly what has to change to meet WCAG 2.1 AA, how long it takes and what it costs, so you and your lawyer have a plan in hand.`,
    `Reply here, or call or text me at ${context.phone ?? BIO_PHONE}.`,
  ])
}
