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
