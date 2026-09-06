/**
 * Who the studio is, on the slab every message opens with.
 *
 * The mark and the three lines beside it are the same in a cold message and in
 * an issue of the newsletter, because they are the same studio writing. Held
 * once so the two cannot drift into two identities, the way the bio beside
 * this file is held once for the same reason.
 *
 * The phone comes from the bio rather than being written again here: a reader
 * who finds two numbers in one message has to decide which one is real.
 */

import { BIO_PHONE } from './bio.js'

const SITE = 'https://www.taylorurl.com'

/**
 * The wordmark, in its light-on-dark cut.
 *
 * A mail client that blocks images draws the alt text instead, so the slab
 * carries the studio's name in the lines beside the mark as well as in the
 * mark itself.
 */
export const WORDMARK = {
  src: `${SITE}/images/email/wordmark-on-dark.png`,
  width: 120,
  height: 36,
}

/** The registered name, where it trades, and how to reach it. */
export const ANNOTATION = ['TaylorURL LLC', 'Baytown, TX', BIO_PHONE]

/**
 * The registered name and the town it trades from, as one line.
 *
 * A letter written plain has no slab to set the three lines on, and it still
 * has to say which studio is writing and where it trades. So the same two
 * lines are given as a sentence for a footer to carry, and the number is left
 * out of it because the sign-off above already gives it.
 */
export const TRADING_LINE = `${ANNOTATION[0]}, ${ANNOTATION[1]}`
