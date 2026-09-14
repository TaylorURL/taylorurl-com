/**
 * The floor a payment link cannot be written under.
 *
 * A build is quoted per project, in a conversation, and the number agreed there
 * is the number the link charges. `api/checkout-link.js` takes that figure from
 * its caller, which makes it the one endpoint on the site that is handed an
 * amount, and these two constants are what it refuses to go below. A link
 * opened with no figure at all charges them.
 *
 * `api/stripe-webhook.js` reads the same pair, so a session that carries no
 * quoted amount opens a project at the same numbers the link would have
 * charged, and the project's deposit and monthly are never blank.
 *
 * Cents, because that is the only unit a card reader accepts, and held here
 * rather than parsed out of any display text: a figure read back out of the
 * words around it inherits every comma, currency sign and space that text ever
 * grows, and the failure is a charge for the wrong amount.
 */
export const BUILD_PRICE_CENTS = 100000
export const MONTHLY_PRICE_CENTS = 25000
