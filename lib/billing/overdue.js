/**
 * When an unpaid invoice takes a client's site offline, and when it counts as
 * late enough to chase.
 *
 * One rule answers both questions, so the site that goes dark and the Monday
 * letter that says why can never disagree about which invoice did it. An
 * invoice holds a site once it has sat unpaid for a week past the day it was
 * owed. The status endpoint every client site asks reads it, and so does the
 * reminder run, and neither restates the week.
 *
 * The day an invoice was owed is its due date where it has one. An emailed
 * invoice always does. One charged to a card on file has none, because Stripe
 * meant to take the money the moment it was finalised, so that moment is the
 * day it was owed and every failed retry since is the card saying no.
 *
 * Pure throughout: nothing here reads the clock, the network or the database.
 * The caller hands in the moment it is asking about, which is what lets the
 * check hold the rule to exact days on either side of the line.
 */

/** Days an invoice may sit unpaid past the day it was owed before its site goes offline. */
export const PAUSE_AFTER_DAYS = 7

const DAY_SECONDS = 24 * 60 * 60

/**
 * The moment an invoice was owed, in Stripe's seconds.
 *
 * @param {object} invoice A Stripe invoice.
 * @returns {number|null}
 */
export function owedSince(invoice) {
  if (!invoice) return null
  const owed =
    invoice.due_date || invoice.status_transitions?.finalized_at || invoice.created || null
  return Number.isFinite(owed) ? owed : null
}

/**
 * Whole days an invoice has been unpaid past the day it was owed.
 *
 * Zero on the day it was owed and on any day before it, so an invoice that is
 * not yet due is never read as late.
 *
 * @param {object} invoice A Stripe invoice.
 * @param {Date} now The moment being asked about.
 * @returns {number}
 */
export function daysLate(invoice, now) {
  const owed = owedSince(invoice)
  if (owed === null) return 0
  const seconds = Math.floor(now.getTime() / 1000) - owed
  return seconds > 0 ? Math.floor(seconds / DAY_SECONDS) : 0
}

/**
 * Whether an invoice is still owed at all.
 *
 * Only an open invoice with money left on it. A draft has not been sent, a
 * paid one is settled, and a void or uncollectible one is an invoice somebody
 * decided nobody will collect, which is not a debt a site should go dark over.
 *
 * @param {object} invoice A Stripe invoice.
 * @returns {boolean}
 */
export function isOwed(invoice) {
  return invoice?.status === 'open' && (invoice.amount_remaining ?? invoice.amount_due ?? 0) > 0
}

/**
 * Whether this invoice takes its client's site offline.
 *
 * @param {object} invoice A Stripe invoice.
 * @param {Date} now The moment being asked about.
 * @returns {boolean}
 */
export function holdsSite(invoice, now) {
  return isOwed(invoice) && daysLate(invoice, now) >= PAUSE_AFTER_DAYS
}

/**
 * A site's address as the client-site table keys it.
 *
 * A site asks about itself by name, and a name arrives in more shapes than
 * one: with the scheme a browser shows, with the `www.` some of the sites
 * serve from, in capitals. All of them are the same site, so all of them are
 * read as the bare lowercase host.
 *
 * @param {unknown} value
 * @returns {string|null} The host, or null where there is no host to read.
 */
export function siteName(value) {
  if (typeof value !== 'string') return null
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#:].*$/, '')
    .replace(/^www\./, '')
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
}
