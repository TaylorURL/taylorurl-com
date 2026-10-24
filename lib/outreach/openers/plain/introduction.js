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
import { plainName, reviewsLine, siteFinding } from './research.js'

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
  const praise = reviewsLine(prospect)
  const finding = siteFinding(prospect)
  const why = praise
    ? `That's why I'm writing to you and not everyone on the list: the work is clearly good, and the website should be winning you as much business as your reputation does.`
    : `I don't send this to everyone. I picked ${name} because it's a gap I know how to close quickly.`
  return plainLetter(SUBJECT, [
    `I spent some time this week looking into ${name}.${praise ? ` ${praise}` : ''}`,
    finding,
    `I'm Trenton with TaylorURL. We're a small team that builds websites for local businesses ${where}, the kind that load fast on a phone and make it easy to call you. ${why}`,
    `Would a quick 15-minute call to walk you through what I'd change be worth it? Just reply to this email with a day that suits you and I'll make it work.`,
  ])
}
