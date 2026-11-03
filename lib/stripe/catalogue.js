/**
 * The Stripe products a proposal's lines are sold as.
 *
 * A checkout line has to hang on a product, and the product's name is what the
 * receipt, the invoice and the dashboard print. The hand-opened payment link
 * sells two things and keeps two products for them; a proposal sells whatever
 * its sheet lists, so the products are found by name instead of held by id.
 *
 * Each one is created on first use under an id made from its name, which is
 * what keeps the catalogue to one product per service. Asking Stripe to make a
 * product inline on every checkout would leave a new one behind each time, and
 * the dashboard would fill with a dozen identical "Monthly Fee" rows inside a
 * month. An id Stripe can be asked for directly also needs no search, which is
 * the one read on a product that is not immediately consistent.
 */

import { timedFetch } from '../http/timed.js'

const PRODUCTS = 'https://api.stripe.com/v1/products'

const TIMEOUT_MS = 10000

/**
 * The product id a line's name is sold under.
 *
 * Lower case, words joined by underscores, and prefixed so a glance at the id
 * says where it came from. "Google / Facebook Ads Setup & Management" is
 * `proposal_google_facebook_ads_setup_and_management`.
 *
 * @param {string} name
 * @returns {string}
 */
export function productId(name) {
  const slug = String(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return `proposal_${slug || 'line'}`
}

/** One request to Stripe's products, and the body it came back with. */
async function ask(url, secret, body) {
  const answer = await timedFetch(
    url,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(body ? { body } : {}),
    },
    TIMEOUT_MS
  )
  return { answer, payload: await answer.json().catch(() => ({})) }
}

/**
 * The id of the product a line is sold as, made if it is not there yet.
 *
 * Read first, because nearly every call finds it. A product that was archived
 * by hand in the dashboard is brought back rather than refused, since the
 * line it sells is still on somebody's sheet. Two checkouts racing to make the
 * same new product is the one case where the create can fail and nothing is
 * wrong, so an id that already exists is an answer rather than an error.
 *
 * @param {string} name The line's name, as the sheet prints it.
 * @param {string} secret The account's secret key.
 * @returns {Promise<string>} Rejects with Stripe's own message.
 */
export async function ensureProduct(name, secret) {
  const id = productId(name)
  const found = await ask(`${PRODUCTS}/${id}`, secret)
  if (found.answer.ok) {
    if (found.payload.active === false || found.payload.name !== name) {
      const revived = await ask(
        `${PRODUCTS}/${id}`,
        secret,
        new URLSearchParams({ active: 'true', name })
      )
      if (!revived.answer.ok) {
        throw new Error(
          revived.payload?.error?.message || `Stripe answered ${revived.answer.status}.`
        )
      }
    }
    return id
  }
  if (found.answer.status !== 404) {
    throw new Error(found.payload?.error?.message || `Stripe answered ${found.answer.status}.`)
  }

  const made = await ask(PRODUCTS, secret, new URLSearchParams({ id, name }))
  if (made.answer.ok || made.payload?.error?.code === 'resource_already_exists') return id
  throw new Error(made.payload?.error?.message || `Stripe answered ${made.answer.status}.`)
}

/**
 * Every line's product, keyed by the line's name.
 *
 * @param {string[]} names
 * @param {string} secret
 * @returns {Promise<Map<string, string>>}
 */
export async function ensureProducts(names, secret) {
  const unique = [...new Set(names)]
  const ids = await Promise.all(unique.map(name => ensureProduct(name, secret)))
  return new Map(unique.map((name, at) => [name, ids[at]]))
}
