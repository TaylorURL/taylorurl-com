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

import { BIO_PHONE } from '../../../mail/bio.js'
import { courtPhrase } from '../../prospects/lawsuits.js'
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

export function lawsuitSubject(prospect) {
  return `the lawsuit over ${siteName(prospect)}`
}

export function lawsuitOpener(prospect) {
  const site = siteName(prospect)
  const day = filedOn(prospect.case_filed_on)
  const when = day ? ` on ${day}` : ''
  const number = prospect.case_number ? ` (case ${prospect.case_number})` : ''
  return plainLetter(lawsuitSubject(prospect), [
    `I saw that a lawsuit was filed against ${prospect.name} in ${courtPhrase(prospect.case_court)}${when}${number}, saying ${site} doesn't work with a screen reader.`,
    `Suits like this usually settle with the business agreeing to bring its site up to WCAG 2.1 AA, the accessibility standard these settlements use, by a set date. I build websites, and I can rebuild ${site} to that standard and give you a written audit of the site before and after to hand to your lawyer.`,
    `If that would help, reply and I'll send you a list of what fails on the site today.`,
    `I'm not a lawyer, and none of this is legal advice.`,
  ])
}

export function lawsuitFollowUpOpener(prospect, where, shot, context = {}) {
  const site = siteName(prospect)
  return plainLetter(threaded(context, lawsuitSubject(prospect)), [
    `I wrote a couple of weeks ago about the accessibility suit over ${site}.`,
    `If the site still has to be brought up to WCAG 2.1 AA, I can look at it this week and tell you what the rebuild would cost. Reply here, or call or text me at ${context.phone ?? BIO_PHONE}.`,
  ])
}
