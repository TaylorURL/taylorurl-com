/**
 * The sentences every letter shares, written once.
 *
 * A letter is one opener: its subject, its marker, the lines under the
 * greeting, the figure, the paragraphs after it and the closing line. Most of
 * what one letter says that another does not is in the first half of that.
 * The offer, the visit and the close say the same thing whichever letter
 * carries them, so they live here and a new letter takes them rather than
 * writing its own, which is what keeps twelve letters from making twelve
 * different promises.
 *
 * Strings and pure functions only. The console bundles the registry that
 * imports these, and a server dependency here would break that bundle.
 */

/**
 * How a build runs once one is underway. It sits in the closing paragraphs
 * rather than beside the action, because it states what the work is and asks
 * for nothing.
 *
 * The visit is offered rather than promised. Most builds never need one, and a
 * message that says every customer gets a house call is making a claim it would
 * rather not keep. The second sentence is the part that holds either way, and
 * it names what does not happen, which is harder to claim falsely than a
 * promise is.
 */
export const IN_PERSON =
  "If you'd rather go through it in person once a build is underway, I'll come to you. Nobody hands you a login and leaves you to it."

/**
 * The offer, which is the one thing the message asks the reader to do.
 *
 * It names what a reply brings back and says twice that it costs nothing,
 * because a stranger offering something free is assumed to be selling the
 * next thing, and the sentence has to close that door itself.
 *
 * @param {string} what What the reply brings back, as the object of "want".
 */
export const OFFER = what =>
  `Want ${what}? Reply and I'll send it over. No charge, and no sales call attached.`

/**
 * Where the reader is told, in the opening lines, that the figure can be
 * checked. The reading block carries the link itself; this sentence sits above
 * it so a reader who stops at the first paragraph still knows the test is
 * Google's and theirs to run. It is said the same way in every letter that
 * quotes a score, since the letters share the block it points at.
 */
export const CHECK_LINE = 'The link under the score runs the same test for you.'

/** The closing line, which the action under it answers. */
export const CLOSE = 'Or, if you already know what the site has to do, start here.'
