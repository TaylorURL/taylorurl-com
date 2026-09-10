/**
 * The letter cold outreach sends. There is one, and this is it.
 *
 * It says nothing about the reader's business. No score, no listing, no
 * shortcoming, nothing that could read as a stranger grading work the owner or
 * somebody they know put together. It carries no offer, no price and no
 * button. What it has is who is writing, what they do, where they do it, and a
 * plain statement that nothing is being asked for.
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
 * put. The signature under the letter is the only way back, and a reader who
 * wants it will find the address and the number there, which is where a person
 * looks for them.
 *
 * The last line is the one place the studio's trade is named as something the
 * reader might want, and it asks for nothing: being remembered is not an
 * action anybody has to take today. The promise in front of it is about what
 * is not coming, and it is in the body rather than the footer because it is a
 * promise about what happens next and not a legal notice. The way off the list
 * is under it either way.
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
    `We won't spam you. We just wanted to be top of mind if you ever need help getting a site put up and found on Google.`,
  ])
}
