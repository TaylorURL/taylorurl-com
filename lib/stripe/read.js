/**
 * Reading a list back out of Stripe.
 *
 * The three endpoints that open a checkout each write one object and read one
 * back, which is a single form post and needs nothing around it. Reading the
 * account is the other shape: four collections, each paged, each of which has
 * to be walked to the end before anything can be said about a client. So the
 * paging lives here once rather than four times in the endpoint that wants it.
 *
 * Stripe is reached over plain HTTPS rather than through its library, which is
 * the choice the checkout endpoints already made and the reason is the same: a
 * GET with a bearer token is a thing the runtime does, and a dependency carried
 * into every install to save writing it has to be kept current forever.
 *
 * Everything here reads. Nothing in this file can write to the account, and
 * that is deliberate rather than incidental - the console section behind it
 * shows money and changes none of it, so the code under it is given no verb
 * that could.
 */

import { timedFetch } from '../http/timed.js'

const STRIPE_API = 'https://api.stripe.com/v1'

/** How long one page of a list is given before the read is abandoned. */
const TIMEOUT_MS = 10_000

/** What Stripe will return in one page, and what we ask for every time. */
const PAGE_SIZE = 100

/**
 * How many pages one collection may take before the walk stops.
 *
 * A guard against a loop that never ends rather than a limit anybody should
 * meet: at a hundred rows a page this is ten thousand invoices, which is more
 * than this account will hold for years. Stopping short is reported rather
 * than hidden, because a total drawn from half the record is worse than no
 * total.
 */
const MAX_PAGES = 20

/**
 * One Stripe collection, walked to the end.
 *
 * @param {string} path The collection, as `customers` or `invoices`.
 * @param {string} secret The account's secret key.
 * @param {Record<string, string>} [query] Filters, less the paging.
 * @returns {Promise<{rows: object[], complete: boolean}>}
 *   Everything the collection holds, and whether the walk reached the end.
 */
export async function stripeList(path, secret, query = {}) {
  const rows = []
  let after = null

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const search = new URLSearchParams({ ...query, limit: String(PAGE_SIZE) })
    if (after) search.set('starting_after', after)

    const answer = await timedFetch(
      `${STRIPE_API}/${path}?${search}`,
      { headers: { Authorization: `Bearer ${secret}` } },
      TIMEOUT_MS
    )
    const payload = await answer.json().catch(() => ({}))

    if (!answer.ok) {
      // Stripe names the field it refused, which is worth having in the log
      // and worth keeping out of a browser.
      throw new Error(payload?.error?.message || `Stripe answered ${answer.status} for ${path}.`)
    }

    const batch = Array.isArray(payload.data) ? payload.data : []
    rows.push(...batch)
    if (!payload.has_more || !batch.length) return { rows, complete: true }
    after = batch[batch.length - 1].id
  }

  return { rows, complete: false }
}
