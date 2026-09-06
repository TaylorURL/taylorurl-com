/**
 * The second letter of the introduction chain: what a build actually is,
 * week by week.
 *
 * The first letter claims the experience is different. This is the claim
 * cashed, because a promise about how something will feel is worth nothing
 * next to a plain account of what happens and when. It is also the letter
 * that answers the question stopping most of these people, which is not what
 * a site costs but how much of their week it will take.
 *
 * Still nothing about their business. The only thing it compares against is
 * the way the work is usually sold, which is a fact about the trade and not
 * about the reader.
 */

import { plainLetter, threaded } from './shared.js'

export function processOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, 'how a build goes'), [
    `Following my last note, here's how one actually runs, since it's the part nobody explains up front.`,
    `We talk once about what the site has to do. I build the first version and send you a link to it. You tell me what's wrong. We go round until it's right, it goes live, and then I look after it.`,
    `Your side of that is two conversations and a few links. Not a login you'll never open, and not a monthly bill for work nobody did.`,
    context.site ? `Worth a look? The work's here: ${context.site}` : `Worth a look?`,
  ])
}
