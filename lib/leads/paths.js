/**
 * The page a lead was recorded at, named once.
 *
 * A lead's row carries the path it was recorded at, and the console's Leads
 * section reads that answer back to say which door somebody came through. It
 * cannot work the answer out from anything else, so a string typed in two
 * places is a string that goes wrong in one of them, and the failure is silent:
 * a path that matches nothing simply reads as another door.
 *
 * Deliberately free of imports. The server files here reach for it beside a
 * database client and the console reaches for it in a browser bundle, and a
 * constant that drags a driver into either is a constant nobody can use in both.
 */

/** The short checkout rows were recorded at, which the console still lists. */
export const PAYMENT_PATH = '/payment'

/**
 * Whether a recorded path is the short checkout.
 *
 * Asked as a function rather than compared inline because a path was written by
 * a browser and can carry a trailing slash or a query, and a comparison that
 * misses those reads a payment-page lead as something else.
 *
 * @param {unknown} path
 * @returns {boolean}
 */
export function fromPaymentPage(path) {
  if (typeof path !== 'string') return false
  const trimmed = path.trim().split('?')[0].replace(/\/+$/, '').toLowerCase()
  return trimmed === PAYMENT_PATH
}
