/**
 * The third letter of the introduction chain: assume theirs is fine and ask
 * to be pointed somewhere else.
 *
 * The letter takes the reader off the hook in its first line, which is the
 * one move in cold mail that costs the sender the sale and is therefore
 * believed. It also asks for something a person can give without buying
 * anything, and in trades that run on word of mouth a name is worth more than
 * a reply.
 *
 * It takes no position on their site either way. The letter before it named
 * what was wrong with theirs, so "if yours is sorted" would be the chain
 * contradicting itself three days later, and a reader who spots that stops
 * believing the rest. What is offered instead is the other exit: this may not
 * be your job, and it may not be your year, and either way a name would do.
 */

import { plainLetter, threaded } from './shared.js'

export function pointerOpener(prospect, where, shot, context = {}) {
  // The service area reads as a clause of its own, which is right after "small
  // businesses" and wrong in the middle of a question about one person. The
  // town alone is what fits here, and where the row has none, nothing does.
  const near = prospect.town ? `in ${prospect.town}` : 'around here'

  return plainLetter(threaded(context, 'wrong person?'), [
    `You may well be the wrong person for this, or it may just not be the year for it. Both are fine answers.`,
    `Either way, is there somebody ${near} who's been meaning to do something about their website? We'd rather be pointed at one person who needs it than write to fifty who don't.`,
    context.site
      ? `And if it turns out to be you after all, the work's here: ${context.site}`
      : `And if it turns out to be you after all, just say so.`,
  ])
}
