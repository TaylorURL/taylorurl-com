/**
 * Who an issue is allowed to reach, and the single place that decides it.
 *
 * Four things put an address on the list, and an issue goes to all four:
 *
 *   `confirmed_at`       somebody followed the link in a confirmation email,
 *                        which is the only column the double opt-in path
 *                        writes and no other path can produce
 *   `source = client`    a paying client, put on the list from the Stripe
 *                        roster because there is a relationship behind them
 *   `source = console`   added by hand on the audience page, where the form
 *                        refuses to submit until the operator affirms consent
 *   `source = outreach`  a business the cold sender wrote to, enrolled as the
 *                        message left the transport
 *
 * The last one is a decision rather than an oversight. US commercial email is
 * opt-out, so a business that never signed up is a lawful recipient, and every
 * business the studio writes to is meant to hear from it again. The way off is
 * what carries the weight instead: one click, honoured immediately, and a
 * suppressed address that no path can put back.
 *
 * A row is still refused where it holds no standing at all. `status` and
 * `consent_at` both have to say the address is live, so an unsubscribe and a
 * hard bounce each take it out of every issue whatever brought it in.
 *
 * The same file also answers which of the two the address is, because a block
 * of an issue can be written for one side and not the other. That question and
 * the question of who may be reached come off the same column, so they are
 * settled together: a source added to one and not the other is a person who
 * receives an issue nobody decided what to say to.
 */

/** The standing an address holds while it is on the list. */
const SUBSCRIBED = 'subscribed'

/** Somebody with a site the studio runs. */
export const CLIENT = 'client'

/** Somebody the studio has written to, or who came to it, and owes it nothing. */
export const PROSPECT = 'prospect'

/**
 * The sources that carry a working relationship.
 *
 * `client` comes off the Stripe roster and `console` is added by hand on the
 * audience page, which is how somebody is put on the list who is owed the same
 * words as a client without Stripe knowing about them yet.
 */
const CLIENT_SOURCES = ['client', 'console']

/**
 * The sources that reach the list without a confirmation behind them.
 *
 * A client on the Stripe roster and a person added by hand on the audience
 * page are both somebody the studio already deals with, and each was put here
 * by a person who knows that. Everybody else confirms.
 *
 * `outreach` was on this list and is not. Being written to once is not asking
 * to be written to again, and a newsletter sent to the addresses a cold sender
 * found is a newsletter nobody on it agreed to. The sender no longer writes a
 * row here at all, and a row it wrote before now has to confirm like a
 * stranger, which is what it is.
 *
 * A bulk import is in the same position: nothing about a file of addresses
 * says where any of them came from.
 */
export const ASKED_SOURCES = [...CLIENT_SOURCES]

/**
 * The columns one delivery needs: the address, the way off the list, and the
 * column the two sides are told apart by.
 */
export const RECIPIENT_COLUMNS = 'id, email, name, unsub_token, source'

/**
 * The PostgREST filter for the human act, as one `or` group.
 *
 * It is built rather than written out so the source list has one definition:
 * a second copy here and in a migration is how a source gets added to one and
 * not the other.
 */
function askedFilter() {
  return `confirmed_at.not.is.null,source.in.(${ASKED_SOURCES.join(',')})`
}

/**
 * A read of `subscribers` narrowed to the people an issue may reach.
 *
 * Suppression is not applied here. It is a separate table and a separate
 * question - an address that must never be mailed again, whatever standing it
 * holds on the list - and the caller checks it against every recipient it
 * selects, including the ones it selected on an earlier run.
 *
 * @param {object} db A service-role Supabase client.
 * @param {string} [columns] Columns to read.
 * @returns {object} The query, unranged, for the caller to page.
 */
export function selectRecipients(db, columns = RECIPIENT_COLUMNS) {
  return db
    .from('subscribers')
    .select(columns)
    .eq('status', SUBSCRIBED)
    .not('consent_at', 'is', null)
    .or(askedFilter())
}

/**
 * Which side of the list one address is on.
 *
 * Only the two sources with a relationship behind them read as a client.
 * Everything else reads as a prospect, which covers the cold sender's rows and
 * covers somebody who found the site and confirmed a double opt-in.
 *
 * That second case is the one worth stating. A confirmation says the person
 * wants to hear from the studio; it does not say the studio runs anything of
 * theirs. Client copy is written to somebody whose site is already live and
 * offers to change it, so a self-subscriber on that side is handed a message
 * about a thing they do not have. The prospect side assumes only what the
 * confirmation proved.
 *
 * @param {{source?: string}} row A `subscribers` row, or anything carrying its source.
 * @returns {string} `CLIENT` or `PROSPECT`.
 */
export function audienceOf(row) {
  return CLIENT_SOURCES.includes(row?.source) ? CLIENT : PROSPECT
}
