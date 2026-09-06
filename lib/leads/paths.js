/**
 * The two pages that record a lead, named once.
 *
 * A lead's row carries the path it was recorded at, and four things read that
 * answer back: the notice that puts a new lead in front of a person, the
 * console section that lists them, the follow-up that decides where to send
 * somebody who did not finish, and the pages themselves. None of them can work
 * it out from anything else, so a string typed four times is a string that goes
 * wrong in one of them - and the failure is silent, because a path that matches
 * nothing simply reads as the other page.
 *
 * Deliberately free of imports. The server files here reach for it beside a
 * database client and the console reaches for it in a browser bundle, and a
 * constant that drags a driver into either is a constant nobody can use in both.
 */

/** The configurator, which asks five screens of questions before the card. */
export const START_PATH = '/start'

/** The short checkout, for a build somebody has already agreed to in person. */
export const PAYMENT_PATH = '/payment'

/**
 * How many screens the configurator runs, and which one the payment sits on.
 *
 * The payment page has no steps of its own and every reader of a lead wants to
 * know how far somebody got, so a lead recorded there is recorded at the screen
 * it stands in for: somebody on it is at the payment, whichever route brought
 * them. What tells the two apart is the path, not the number.
 */
export const STEP_COUNT = 5
export const PAY_STEP = STEP_COUNT - 1

/**
 * Whether a recorded path is the short checkout.
 *
 * Asked as a function rather than compared inline because a path arrives from
 * a browser and can carry a trailing slash or a query, and a comparison that
 * misses those reads a payment-page lead as a configurator one.
 *
 * @param {unknown} path
 * @returns {boolean}
 */
export function fromPaymentPage(path) {
  if (typeof path !== 'string') return false
  const trimmed = path.trim().split('?')[0].replace(/\/+$/, '').toLowerCase()
  return trimmed === PAYMENT_PATH
}
