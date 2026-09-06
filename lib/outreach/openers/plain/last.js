/**
 * The plain last letter: the silence is taken as an answer, and the reader is
 * handed three numbers so that saying which one costs a keystroke.
 *
 * It does not say "I haven't heard back" or anything near it. Naming the
 * reader's silence puts the failure to answer on them, and every measurement
 * of that phrasing says it costs replies rather than earning them. The letter
 * takes the silence as the answer instead and says so without complaint.
 *
 * The three numbers exist because the useful answer here is often "not now",
 * and a reader who owes a sentence to say that will say nothing at all.
 *
 * Whichever chain it closes, it closes it. A letter that promises to be the
 * last and is followed by another is the one thing here that costs more than
 * a lost sale.
 */

import { plainLetter, threaded } from './shared.js'

export function plainLastOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, 'last note from me'), [
    `I'll take the quiet as an answer, so this is the last one from me.`,
    `If it's any use, reply with a number:\n1. Yes, tell me more.\n2. Not now, check back in a few months.\n3. No, and take me off.`,
    `Nothing back is an answer too, and I'll leave it there.`,
    context.site ? `The work, if you ever want a look: ${context.site}` : null,
  ])
}
