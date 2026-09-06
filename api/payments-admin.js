/**
 * What every client pays, and everything they have paid.
 *
 * The console could say what a build was waiting on and what a site's traffic
 * came to, and nowhere could it say who pays for any of it. That reading lived
 * in the Stripe dashboard, which holds the money for more than one trade and
 * sorts none of it, so the question "who owes me something" was answered by
 * scrolling.
 *
 * Stripe is read live on every request rather than mirrored into a table. The
 * money is Stripe's to know: a card that failed an hour ago, a subscription
 * cancelled from the dashboard, an invoice paid this morning. A copy of that in
 * our own database would be a second answer to a question that already has one,
 * and the first hour it disagreed nobody would know which half was wrong. The
 * account holds a few dozen customers and a few hundred rows, so the whole of it
 * is read in one pass and there is nothing to page through.
 *
 * The record is built from invoices rather than from charges. An invoice says
 * what was billed and what each line of it was for; a charge says only that
 * money moved, and in this account's API version it no longer names the invoice
 * it settled. So invoices carry the record and charges are read for the one
 * thing they alone know, which is that a card was refused.
 *
 * Nothing here writes. The endpoint holds no verb that could void, refund,
 * cancel or charge anything, which is what makes it safe to put behind a
 * console section rather than behind a confirmation.
 *
 * GET answers the whole record:
 *
 *   { clients, payments, totals, complete }
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { stripeList } from '../lib/stripe/read.js'
import { clientKey, isClient, loadRoster, recurringLine, setupCents } from '../lib/stripe/roster.js'

/**
 * The key this reads Stripe with.
 *
 * The read-only one where the deployment carries it, and the checkout's key
 * where it does not. Both can read all four collections, so the preference buys
 * nothing at the API and everything at the blast radius: the checkout's key can
 * create a session that charges a card, and a reporting endpoint that never
 * needs to should not be holding one that can. Naming its own variable is also
 * what lets the key be rotated or narrowed without touching the door money
 * actually comes through.
 */
const SECRET_KEY = process.env.STRIPE_READONLY_KEY || process.env.STRIPE_SECRET_KEY || ''

/** A year, for working out when a hand-billed annual fee comes round again. */
const YEAR_SECONDS = 365 * 24 * 60 * 60

/** Cents as the dollars a sentence says them in. */
function money(cents) {
  if (!Number.isInteger(cents)) return 'an unknown amount'
  const dollars = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `$${dollars}`
}

/**
 * What a subscription costs and how often, read off the item rather than the
 * subscription.
 *
 * Stripe moved the price and the period onto the item some versions back, and
 * the copy still sitting on the subscription is the deprecated `plan`. Reading
 * the item is what keeps this right on the account as it stands now.
 */
function recurringFrom(subscription) {
  const item = subscription?.items?.data?.[0]
  const price = item?.price
  if (!price) return null
  return {
    cents: Number.isInteger(price.unit_amount) ? price.unit_amount : null,
    interval: price.recurring?.interval || 'month',
    every: price.recurring?.interval_count || 1,
    nextAt: item.current_period_end || null,
  }
}

/**
 * Everything a client's row says about what they pay.
 *
 * A subscription is preferred over a hand-billed arrangement wherever one
 * exists, and an active subscription over a cancelled one, because a client who
 * cancelled last year and started again last week is one client on the terms
 * they are on now.
 *
 * Where no subscription exists, the last invoice they were sent is what says
 * what they pay. That is the same place the figure would have come from anyway,
 * and it means a hand-billed client whose fee changes needs nothing altered
 * here for the row to follow it.
 */
function arrangementFor({ subscriptions, invoices, key, cardOnFile, roster }) {
  const live = subscriptions.find(one => one.status === 'active' || one.status === 'trialing')
  const chosen = live || subscriptions[0]

  if (chosen) {
    const recurring = recurringFrom(chosen)
    const over = chosen.status === 'canceled'
    return {
      ...recurring,
      // A cancelled subscription keeps the period it was cancelled inside, and
      // reading that back as the next charge would put a date in the column
      // for a client nothing is going to bill.
      nextAt: over ? null : recurring?.nextAt || null,
      source: 'stripe',
      status: chosen.status,
      collection: chosen.collection_method || null,
      endsAtPeriod: Boolean(chosen.cancel_at_period_end),
      startedAt: chosen.start_date || chosen.created || null,
      endedAt: chosen.ended_at || null,
      // Stripe charges the subscription's own method where it has one and the
      // customer's default where it does not, so a subscription with nothing
      // set against it is still paying by card. Reading only the subscription
      // reported half the clients as having no way to pay.
      hasCard: Boolean(chosen.default_payment_method || cardOnFile),
      subscriptionId: chosen.id,
    }
  }

  // No subscription, but the studio still bills them. What they owe is real and
  // nothing in Stripe renews it, which is the whole of why the row is flagged.
  if (!roster.offStripe.has(key)) return null

  const last = invoices.find(one => one.status === 'paid' && recurringLine(one, roster))
  const fee = last ? recurringLine(last, roster) : null
  if (!fee) return null

  return {
    cents: fee.cents,
    interval: fee.interval,
    every: 1,
    // A yearly fee paid on an invoice comes round a year after that invoice.
    // A monthly one billed by hand comes round whenever somebody sends the
    // next one, which is not a date anything can state.
    nextAt: fee.interval === 'year' ? last.created + YEAR_SECONDS : null,
    source: 'hand',
    status: 'hand',
    collection: 'send_invoice',
    endsAtPeriod: false,
    startedAt: last.created,
    endedAt: null,
    hasCard: false,
    subscriptionId: null,
  }
}

/** What a client's recurring fee comes to in a month, for one running total. */
function monthlyCents(arrangement) {
  if (!arrangement?.cents) return 0
  if (arrangement.status !== 'active' && arrangement.status !== 'hand') return 0
  const every = arrangement.every || 1
  if (arrangement.interval === 'year') return Math.round(arrangement.cents / (12 * every))
  if (arrangement.interval === 'week') return Math.round((arrangement.cents * 52) / (12 * every))
  if (arrangement.interval === 'day') return Math.round((arrangement.cents * 365) / (12 * every))
  return Math.round(arrangement.cents / every)
}

/**
 * What is wrong with a client's billing, in the words the row shows.
 *
 * A trouble is something a person has to do something about, which is why an
 * ordinary cancelled subscription on a client who left is not one and a
 * cancelled subscription on a client whose site is still running is. This
 * cannot tell those apart, so it reports the cancellation and lets the reader
 * decide, which is the honest version of a flag nobody can compute.
 */
function troublesFor({ arrangement, invoices, charges, key, now, roster }) {
  const troubles = []

  const byHand = roster.offStripe.get(key)
  if (byHand) troubles.push({ code: 'no-subscription', note: byHand })

  if (arrangement?.status === 'canceled') {
    troubles.push({
      code: 'canceled',
      note: 'The subscription is cancelled. Nothing bills this client again.',
    })
  }

  if (arrangement?.endsAtPeriod) {
    troubles.push({
      code: 'ending',
      note: 'The subscription is set to stop at the end of the paid period.',
    })
  }

  if (
    arrangement?.status === 'active' &&
    arrangement.collection === 'charge_automatically' &&
    !arrangement.hasCard
  ) {
    troubles.push({
      code: 'no-card',
      note: 'The subscription charges a card automatically and no card is saved against it.',
    })
  }

  for (const invoice of invoices) {
    if (invoice.status !== 'open') continue
    const overdue = invoice.due_date && invoice.due_date < now
    troubles.push({
      code: overdue ? 'overdue' : 'open',
      note: overdue
        ? `An invoice for ${money(invoice.total)} was due and has not been paid.`
        : `An invoice for ${money(invoice.total)} is out and not yet paid.`,
    })
  }

  // Only the most recent attempt matters. A card refused in March on a client
  // who has paid every month since is not a thing anybody needs to be told.
  const latest = charges[0]
  if (latest?.status === 'failed') {
    troubles.push({
      code: 'failed',
      note: `The last payment of ${money(latest.amount)} was refused${
        latest.failure_message ? `: ${latest.failure_message}` : '.'
      }`,
    })
  }

  return troubles
}

/**
 * What an invoice was for, in one word the table can group on.
 *
 * An invoice carrying both fees is filed under the recurring one, because the
 * up-front fee is already reported on its own against the client and a payment
 * cannot sit in two places in a list of payments. What it says on the row is
 * the lines themselves, which name both.
 */
function kindOf(invoice, subscribed, roster) {
  const recurring = recurringLine(invoice, roster)
  if (recurring) return recurring.interval === 'year' ? 'yearly' : 'monthly'
  if (setupCents(invoice, roster) > 0) return 'setup'
  return subscribed ? 'monthly' : 'other'
}

/** The line descriptions an invoice carries, joined as the row prints them. */
function describe(invoice) {
  const lines = (invoice?.lines?.data || []).map(line => line?.description).filter(Boolean)
  return lines.length ? lines.join(' · ') : 'No description'
}

/**
 * The whole record, from the four collections Stripe was asked for.
 *
 * Separated from the request it answers so it can be run against a fixture. The
 * sorting rules here are the only thing standing between a client's row and a
 * go-kart hire appearing on it, and a rule that cannot be tested without a
 * live Stripe key is a rule nobody tests.
 *
 * @param {{customers: object[], subscriptions: object[], invoices: object[],
 *   charges: object[], roster: object, now?: number}} account
 * @returns {{clients: object[], payments: object[], totals: object}}
 */
export function buildRecord({
  customers,
  subscriptions,
  invoices,
  charges,
  roster,
  now = Math.floor(Date.now() / 1000),
}) {
  // Customer id to the address the client is known by. Money attached to no
  // customer belongs to one of the other trades and never reaches the record,
  // which is the single test that keeps go-kart hire and game-store sales out
  // of a table about websites.
  const keyOf = new Map()
  const held = new Map()
  const per = new Map()

  for (const customer of customers) {
    if (!isClient(customer, roster)) continue
    const key = clientKey(customer)
    if (!key) continue
    keyOf.set(customer.id, key)
    if (!per.has(key)) per.set(key, { subscriptions: [], invoices: [], charges: [] })

    const standing = held.get(key)
    // The most recently opened record carries the name, since a client
    // invoiced under their own name first and their business afterwards is
    // known by the business now.
    if (!standing || (customer.created || 0) > standing.created) {
      held.set(key, {
        key,
        email: customer.email,
        name: customer.individual_name || customer.name || null,
        business: customer.business_name || customer.name || null,
        created: customer.created || 0,
        cardOnFile: Boolean(customer.invoice_settings?.default_payment_method),
      })
    }
  }

  for (const subscription of subscriptions) {
    per.get(keyOf.get(subscription.customer))?.subscriptions.push(subscription)
  }
  for (const invoice of invoices) {
    per.get(keyOf.get(invoice.customer))?.invoices.push(invoice)
  }
  for (const charge of charges) {
    per.get(keyOf.get(charge.customer))?.charges.push(charge)
  }

  const newestFirst = (a, b) => (b.created || 0) - (a.created || 0)

  const rows = []
  const payments = []

  for (const [key, client] of held) {
    const mine = per.get(key)
    mine.subscriptions.sort(newestFirst)
    mine.invoices.sort(newestFirst)
    mine.charges.sort(newestFirst)

    const arrangement = arrangementFor({
      subscriptions: mine.subscriptions,
      invoices: mine.invoices,
      key,
      cardOnFile: client.cardOnFile,
      roster,
    })

    // A void or draft invoice was never money. It stays out of every total and
    // out of the payment record, because an invoice cancelled before it was
    // sent is not a thing that happened to the client.
    //
    // Nor is an invoice for nothing. Stripe writes a zero total when a
    // subscription is amended mid-period, and a row saying somebody paid $0.00
    // is a line in the record that reports no money changing hands.
    const real = mine.invoices.filter(
      one => (one.status === 'paid' || one.status === 'open') && (one.total || 0) > 0
    )

    let paidCents = 0
    let openCents = 0
    let setup = null

    for (const invoice of real) {
      if (invoice.status === 'paid') paidCents += invoice.total || 0
      else openCents += invoice.total || 0

      // The up-front fee is the line rather than the invoice, because the
      // client who paid a year in advance was charged the setup and the first
      // year on one invoice.
      const upFront = setupCents(invoice, roster)
      if (upFront > 0 && invoice.status === 'paid' && !setup) {
        setup = { cents: upFront, at: invoice.created, invoiceId: invoice.id }
      }

      payments.push({
        id: invoice.id,
        at: invoice.created,
        cents: invoice.total || 0,
        status: invoice.status,
        kind: kindOf(invoice, Boolean(mine.subscriptions.length), roster),
        key,
        name: client.name,
        business: client.business,
        description: describe(invoice),
        number: invoice.number || null,
        url: invoice.hosted_invoice_url || null,
      })
    }

    const dates = real.map(one => one.created).filter(Boolean)

    rows.push({
      key,
      email: client.email,
      name: client.name,
      business: client.business,
      arrangement,
      monthlyCents: monthlyCents(arrangement),
      setup,
      paidCents,
      openCents,
      payments: real.length,
      firstAt: dates.length ? Math.min(...dates) : null,
      lastAt: dates.length ? Math.max(...dates) : null,
      troubles: troublesFor({
        arrangement,
        invoices: mine.invoices,
        charges: mine.charges,
        key,
        now,
        roster,
      }),
    })
  }

  // A customer record with no money against it and nothing recurring is a
  // record somebody opened and never used. It is not a client, and leaving it
  // out is better than a row of dashes.
  const record = rows.filter(one => one.payments > 0 || one.arrangement)

  record.sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
  payments.sort((a, b) => (b.at || 0) - (a.at || 0))

  return {
    clients: record,
    payments,
    totals: {
      clients: record.length,
      paying: record.filter(one => one.monthlyCents > 0).length,
      monthlyCents: record.reduce((sum, one) => sum + one.monthlyCents, 0),
      collectedCents: record.reduce((sum, one) => sum + one.paidCents, 0),
      openCents: record.reduce((sum, one) => sum + one.openCents, 0),
      troubled: record.filter(one => one.troubles.length).length,
    },
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const clients = connect()
  if (!clients) return response.status(503).json({ error: 'The database is not configured.' })

  const account = await authorizeAdmin(clients, request.headers.authorization)
  if (account.status) return response.status(account.status).json({ error: account.error })

  if (!SECRET_KEY) {
    return response.status(503).json({ error: 'No Stripe key is set on this deployment.' })
  }

  // The roster is what sorts a client's money from the studio's own and reads
  // an up-front fee that predates the checkout. Without it every figure on the
  // page is still a number, and every one of them is wrong: the studio's own
  // card reads as a client and a build reads as a monthly. A money screen that
  // is wrong is worse than a money screen that is missing, so this refuses
  // rather than falls back to an empty one.
  const roster = await loadRoster(clients.db)
  if (!roster) return response.status(503).json({ error: 'The roster could not be read.' })

  let customers
  let subscriptions
  let invoices
  let charges
  try {
    ;[customers, subscriptions, invoices] = await Promise.all([
      stripeList('customers', SECRET_KEY),
      stripeList('subscriptions', SECRET_KEY, { status: 'all' }),
      stripeList('invoices', SECRET_KEY),
    ])
  } catch (fault) {
    console.error('payments-admin: Stripe would not answer', fault.message)
    return response.status(502).json({ error: 'Stripe could not be read.' })
  }

  // Charges are read on their own and forgiven if they fail. They carry one
  // thing the invoices do not, which is that a card was refused, and that is
  // worth a flag on a row rather than worth the whole page. A key narrowed to
  // the three collections above should still answer the question the section
  // exists for.
  try {
    charges = await stripeList('charges', SECRET_KEY)
  } catch (fault) {
    console.error('payments-admin: the charges were not read', fault.message)
    charges = { rows: [], complete: true }
  }

  const complete =
    customers.complete && subscriptions.complete && invoices.complete && charges.complete

  const record = buildRecord({
    customers: customers.rows,
    subscriptions: subscriptions.rows,
    invoices: invoices.rows,
    charges: charges.rows,
    roster,
  })

  // The record moves whenever a card is charged, so nothing caches it. A figure
  // about money that is five minutes stale is a figure somebody acts on.
  response.setHeader('Cache-Control', 'no-store')
  return response.status(200).json({ ...record, complete })
}
