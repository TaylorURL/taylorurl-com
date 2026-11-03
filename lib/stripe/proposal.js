/**
 * Finishing a proposal once its checkout has been paid.
 *
 * A proposal always sells a subscription - the Monthly Fee is on every sheet -
 * and sometimes more than one: an add-on billed every quarter beside a fee
 * billed every month. Stripe's checkout opens one subscription and refuses a
 * second interval on it, so `checkoutPlan` charges the longer-interval lines
 * their first period at the checkout and writes them onto the session, and
 * this opens them as their own subscription once the money has cleared. Each
 * starts one period on, so nothing is charged twice and nothing is left
 * unbilled, and each bills the card the buyer just used.
 *
 * It runs from the webhook, which Stripe retries until it is answered, so every
 * step can be run twice: Stripe is asked to open each subscription under a key
 * named after the checkout, which hands back the first answer for a day, and
 * the profile records what was opened so a later delivery finds it done.
 */

import { timedFetch } from '../http/timed.js'
import { UUID_PATTERN } from '../db/fields.js'
import { PERS } from '../../src/app/data/checkout/proposal.js'
import { ensureProduct } from './catalogue.js'

const STRIPE_API = 'https://api.stripe.com/v1'

const TIMEOUT_MS = 10000

/**
 * How far before a full period the new subscription's first bill is set.
 *
 * Stripe takes an anchor only inside the first period and measures that on its
 * own clock, so a few minutes are given back for a machine running fast. The
 * bill still lands on the same day.
 */
const ANCHOR_MARGIN_SECONDS = 600

/** The id of an object a session points at, expanded or not. */
function idOf(object) {
  return typeof object === 'string' ? object : object?.id || null
}

/** The profile a session was opened for, where it was opened for one. */
export function proposalOf(session) {
  const held = session?.metadata?.proposal
  return typeof held === 'string' && UUID_PATTERN.test(held.trim()) ? held.trim() : null
}

/**
 * The lines the checkout charged once and left to be subscribed to, or null
 * where the field is there and will not read.
 *
 * @returns {Array<{name: string, cents: number, per: string}>|null}
 */
export function laterLines(session) {
  const held = session?.metadata?.later
  if (!held) return []
  let lines
  try {
    lines = JSON.parse(held)
  } catch {
    return null
  }
  if (!Array.isArray(lines)) return null
  const fit = lines.every(
    line =>
      typeof line?.name === 'string' &&
      line.name.trim() &&
      Number.isInteger(line.cents) &&
      line.cents > 0 &&
      PERS[line.per]?.interval
  )
  return fit ? lines : null
}

/**
 * When a subscription opened now first bills, one period on.
 *
 * The same day of the month, or the month's last day where it is shorter, so a
 * quarter bought on November 30 first bills on February 28 rather than on
 * March 2.
 *
 * @param {string} per `quarter`, `year` or `month`.
 * @param {Date} [now]
 * @returns {number} Unix seconds.
 */
export function anchorAfter(per, now = new Date()) {
  const months = PERS[per].months
  const target = new Date(now.getTime())
  const day = target.getUTCDate()
  target.setUTCDate(1)
  target.setUTCMonth(target.getUTCMonth() + months)
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, last))
  return Math.floor(target.getTime() / 1000) - ANCHOR_MARGIN_SECONDS
}

/**
 * The body that opens one later subscription.
 *
 * No proration, so nothing is billed until the anchor: the first period was
 * on the checkout. Tax is worked out the way the checkout worked it out.
 */
export function laterFields({ session, lines, per, products, paymentMethod, anchor }) {
  const body = new URLSearchParams()
  body.append('customer', idOf(session.customer))
  body.append('default_payment_method', paymentMethod)
  body.append('billing_cycle_anchor', String(anchor))
  body.append('proration_behavior', 'none')
  body.append('automatic_tax[enabled]', 'true')
  const business = session?.metadata?.business_name || ''
  body.append('description', business ? `TaylorURL services for ${business}` : 'TaylorURL services')
  body.append('metadata[proposal]', session.metadata.proposal)
  body.append('metadata[checkout]', session.id)
  if (business) body.append('metadata[business_name]', business)
  lines.forEach((line, at) => {
    body.append(`items[${at}][quantity]`, '1')
    body.append(`items[${at}][price_data][currency]`, 'usd')
    body.append(`items[${at}][price_data][unit_amount]`, String(line.cents))
    body.append(`items[${at}][price_data][product]`, products.get(line.name))
    body.append(`items[${at}][price_data][recurring][interval]`, PERS[per].interval)
    body.append(`items[${at}][price_data][recurring][interval_count]`, String(PERS[per].count))
  })
  return body
}

/** One request to Stripe, refused with Stripe's own words. */
async function stripe(path, secret, { body, idempotency } = {}) {
  const answer = await timedFetch(
    `${STRIPE_API}/${path}`,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotency ? { 'Idempotency-Key': idempotency } : {}),
      },
      ...(body ? { body } : {}),
    },
    TIMEOUT_MS
  )
  const payload = await answer.json().catch(() => ({}))
  if (!answer.ok) throw new Error(payload?.error?.message || `Stripe answered ${answer.status}.`)
  return payload
}

/**
 * Opens the later subscriptions for one paid checkout.
 *
 * @returns {Promise<string[]>} The subscriptions opened, one per interval.
 */
async function openLater(session, lines, secret) {
  const opened = idOf(session.subscription)
  if (!opened) throw new Error('the checkout opened no subscription to take the card from')
  const subscription = await stripe(`subscriptions/${opened}`, secret)
  const paymentMethod = idOf(subscription.default_payment_method)
  if (!paymentMethod) throw new Error('the checkout subscription holds no card')

  const products = new Map()
  for (const line of lines) {
    if (!products.has(line.name)) products.set(line.name, await ensureProduct(line.name, secret))
  }

  const ids = []
  for (const per of [...new Set(lines.map(line => line.per))]) {
    const made = await stripe('subscriptions', secret, {
      body: laterFields({
        session,
        lines: lines.filter(line => line.per === per),
        per,
        products,
        paymentMethod,
        anchor: anchorAfter(per),
      }),
      idempotency: `proposal-later-${session.id}-${per}`,
    })
    ids.push(made.id)
  }
  return ids
}

/**
 * Marks a proposal paid and opens what its checkout could not.
 *
 * A session opened for no proposal is left alone. A profile that has gone is
 * logged and let go, since retrying cannot bring it back and the payment has
 * already opened the project. A Stripe that refuses is an error, so the
 * webhook answers 500 and Stripe tries again.
 *
 * @param {object} db A service-role Supabase client.
 * @param {object} session The paid checkout session.
 * @param {string} secret The account's secret key.
 * @returns {Promise<{skipped?: boolean, repeat?: boolean, later?: string[], error?: string}>}
 */
export async function settleProposal(db, session, secret) {
  const id = proposalOf(session)
  if (!id) return { skipped: true }

  const { data: profile, error: readError } = await db
    .from('proposals')
    .select('id, paid_session, paid_later')
    .eq('id', id)
    .maybeSingle()
  if (readError) return { error: readError.message }
  if (!profile) {
    console.error('proposal: a paid checkout named a profile that is not there: %s', id)
    return { skipped: true }
  }
  if (profile.paid_session === session.id && Array.isArray(profile.paid_later)) {
    return { repeat: true, later: profile.paid_later }
  }

  const lines = laterLines(session)
  if (lines === null) return { error: 'the later lines on the session will not read' }

  let later = []
  if (lines.length) {
    if (!secret) return { error: 'no Stripe key to open the later subscriptions with' }
    try {
      later = await openLater(session, lines, secret)
    } catch (cause) {
      return { error: cause.message }
    }
  }

  const addons = String(session?.metadata?.addons || '')
    .split(' | ')
    .map(name => name.trim())
    .filter(Boolean)
  const { error: writeError } = await db
    .from('proposals')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_session: session.id,
      paid_addons: addons,
      paid_later: later,
    })
    .eq('id', id)
  if (writeError) return { error: writeError.message }
  return { later }
}
