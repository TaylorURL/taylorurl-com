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
import { spokenName } from '../../previews.js'
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
  return spokenName(name) || 'your business'
}

export function lawsuitOpener(prospect, where, shot, context = {}) {
  const site = siteName(prospect)
  const name = businessName(prospect.name)
  const day = filedOn(prospect.case_filed_on)
  const court = prospect.case_court ? courtPhrase(prospect.case_court) : null
  const filed = [
    `I saw the accessibility suit filed against ${name}`,
    court && court !== 'federal court' ? ` in ${court}` : '',
    day ? ` on ${day}` : '',
    '.',
  ].join('')
  return plainLetter(LAWSUIT_SUBJECT, [
    `${filed} Sorry you're dealing with that. A lot of small businesses are getting hit with these lately, and most had no idea their site was an issue.`,
    `Fixing the website side is what I do. I can get ${site} working with screen readers to the standard these cases ask for (WCAG 2.1 AA) and give you a written report your lawyer can hand over.`,
    `Want me to take a look at it? Just reply here, or call me at ${context.phone ?? BIO_PHONE}. (I'm not a lawyer, so this isn't legal advice, just the website part.)`,
  ])
}

export function lawsuitFollowUpOpener(prospect, where, shot, context = {}) {
  const site = siteName(prospect)
  return plainLetter(threaded(context, LAWSUIT_SUBJECT), [
    `Checking back on the website suit. If you haven't got someone fixing ${site} yet, I can look at it this week and tell you exactly what it'd take and what it'd cost.`,
    `Just reply here or call me at ${context.phone ?? BIO_PHONE}.`,
  ])
}
