/**
 * Which of the auth screens is on show, one step at a time.
 *
 * The choice is frozen the moment the sign-in is over. What is left then is a
 * page being left, and the page transition fades away whatever the outgoing
 * route last drew - so a screen chosen again on the way out is the screen that
 * gets faded, and the sign-in form comes back for a fifth of a second on the
 * way to the console. Rendering nothing instead fades an empty frame, which is
 * the same fault with nothing in it.
 *
 * So leaving changes what happens next and never what is on screen.
 */

/**
 * @param {string} current - What is on screen now.
 * @param {{leaving: boolean, waiting: boolean, pending: boolean}} state -
 *   `leaving` is a finished sign-in, `waiting` an account not yet read back,
 *   `pending` an account owing a code.
 * @returns {string} What to draw.
 */
export function nextScreen(current, { leaving, waiting, pending }) {
  if (leaving) return current
  if (waiting) return 'wait'
  return pending ? 'code' : 'password'
}

/**
 * What the screen after a payment draws.
 *
 * It has one thing to do and two ways it can end, and the whole difficulty is
 * the moment between them. Redeeming the key hands the page an account the
 * instant it succeeds, and the page then waits on that session being read back
 * and on whether it owes a second factor - a frame or two in which the claim is
 * over and nothing has arrived. Read as an ending, that gap draws the screen
 * offering a password, to somebody who has just been signed in and is about to
 * be moved to their console.
 *
 * So a sign-in in hand keeps waiting rather than settling, and only a claim
 * that ended with no session at all reaches the second screen.
 *
 * @param {{settled: boolean, signedIn: boolean, leaving: boolean}} state -
 *   `settled` is the key spent, whichever way it went; `signedIn` is a session
 *   that came out of it or was already there under the address that paid;
 *   `leaving` is that session fully read back.
 * @returns {'wait'|'password'} What to draw.
 */
export function welcomeScreen({ settled, signedIn, leaving }) {
  if (leaving) return 'wait'
  return !settled || signedIn ? 'wait' : 'password'
}
