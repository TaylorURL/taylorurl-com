/**
 * The letter cold outreach sends. There is one, and this is it.
 *
 * It says nothing about the reader's business. No score, no listing, no
 * shortcoming, nothing that could read as a stranger grading work the owner or
 * somebody they know put together. It carries no offer, no price, no button
 * and no number to ring. What it has is who is writing, what he does, where he
 * does it, and a plain statement that this is the only mail he sends.
 *
 * That is the whole of it, and the restraint is the point. A business owner
 * gets a dozen messages a week from people who found their website and have
 * opinions about it. None of them is an introduction. This one is: a name, a
 * trade, and nothing asked for.
 *
 * The first line says what the letter is rather than who sent it. The reader's
 * first question about an unexpected email is what it wants from them, and
 * answering it in the opening sentence is what buys the next one. The name
 * follows immediately, because an introduction that never introduces anybody
 * is a riddle.
 *
 * Nothing here argues that the studio is good at anything, and nothing invites
 * a call. A claim about the writer's own work is a pitch however evenly it is
 * put, and a number under an invitation to use it is a call to action, which
 * is the thing this letter is defined by not being. The address in the
 * signature is the only way back, and a reader who wants it will find it
 * there.
 *
 * The monthly line is in the body rather than in the footer because it is a
 * promise about what happens next and not a legal notice. It says what is not
 * coming as well as what is: no newsletter, no offers, nothing but this. A
 * reader who knows exactly what they have signed up for has no reason to be
 * annoyed by the second one, and the reader who does not want it is told, in
 * the same breath, where the door is.
 *
 * The last line says why the letter was sent at all, and it is the one place
 * the studio's trade is named as something the reader might want. It comes
 * after the door rather than before it, so the reader who is leaving has
 * already been told how, and it asks for nothing: being remembered is not an
 * action anybody has to take today.
 */

import { BIO_NAME } from '../../../mail/bio.js'
import { plainLetter } from './shared.js'

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
  return plainLetter(SUBJECT, [
    `This is only an introduction. There's nothing to buy in it and nothing to sign up for. We are TaylorURL, a small team that builds and looks after websites for businesses ${where}.`,
    `One email a month is all we send you: no newsletters, no offers, nothing else. If you'd rather not have it, the link at the bottom takes this address off for good.`,
    `We just want to be top of mind if you ever need help getting more customers.`,
  ])
}
