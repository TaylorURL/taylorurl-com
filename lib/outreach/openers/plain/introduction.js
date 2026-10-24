/**
 * The letter cold outreach opens with, for a business no draft will be built
 * for.
 *
 * It has to read as written to one business, because it was. So it opens on
 * what was found when that business was looked up - what its customers say,
 * how its own site behaves on a phone, or that there is no site at all - and
 * every one of those is read off the row by ./research.js and left out where
 * the row does not hold it. Then it says who is writing and why this business
 * in particular, and asks for one small thing: a short call, booked by
 * replying. It carries no number, because the first letter to a stranger
 * keeps its one way back to the reply button and the address under the name.
 *
 * Nothing in it is made up to sound urgent. A letter that invents a reason to
 * hurry is read as the spam it would be.
 */

import { BIO_NAME } from '../../../mail/bio.js'
import { plainLetter } from './shared.js'
import { pick, plainName, reviewsLine, siteFinding } from './research.js'

/**
 * The subject, which is who the letter is from and nothing else.
 *
 * It is the same words as the from name, so the row in the inbox says them
 * twice. That is deliberate rather than a slip. Every subject this pipeline
 * has tried that describes a topic - 'how i work', 'an introduction' - opened
 * under thirty per cent, and the ones that beat it named the reader's own
 * score, which this letter makes no claim about and is not going to start
 * making one. What is left is a subject that says who is writing, which is
 * also the whole of what the letter says.
 *
 * The name is the bio's rather than a second spelling of it, for the reason
 * the signature gives: a name written here as well as there is a name that can
 * come apart. The studio half has to match `from_name` in `outreach_settings`,
 * which is a row rather than code and cannot be read from here.
 */
const SUBJECT = `${BIO_NAME}, TaylorURL`

export function introductionOpener(prospect, where) {
  const name = plainName(prospect.name)
  const seed = prospect.name
  const praise = reviewsLine(prospect)
  const finding = siteFinding(prospect)
  const town = prospect.town
  const found = pick(seed, [
    town
      ? `I came across ${name} this week while looking at businesses around ${town}.`
      : `I came across ${name} this week.`,
    `I was looking at ${name} online the other day.`,
    town
      ? `Ran into ${name} while I was looking around ${town} online.`
      : `Ran into ${name} online this week.`,
  ])
  const who = pick(seed, [
    `I'm Trenton, I build websites for local businesses ${where}.`,
    `I'm Trenton. I do websites for small businesses ${where}.`,
  ])
  const ask = pick(seed, [
    `Would you be up for a quick call sometime this week? 15 minutes, tops.`,
    `Any interest in a quick 15-minute call to go over what I'd change?`,
    `Worth a quick call? Just reply with a day that works.`,
  ])
  return plainLetter(SUBJECT, [[found, praise].filter(Boolean).join(' '), finding, `${who} ${ask}`])
}
