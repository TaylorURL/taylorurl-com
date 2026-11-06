/**
 * A proposal's pay page, read and paid.
 *
 * The `/proposal` skill prints a sheet for a meeting and saves what it printed
 * as a profile, and the QR code on the sheet opens `/pay` with the profile's
 * private key. This is what that page talks to: a GET answers with the sheet as
 * it stands now, and a POST turns the add-ons ticked on the page into a Stripe
 * checkout and answers with where to send the browser.
 *
 * It is public and takes no sign-in, so the one thing it must never take is a
 * price. The page sends the key and the names of the add-ons it ticked and
 * nothing else; every figure is read off the profile here, the names are
 * matched against the add-ons that profile offers, and anything that does not
 * match is refused rather than ignored. The worst a forged request can do is
 * open a checkout for exactly what the sheet already offered at exactly the
 * sheet's prices.
 *
 * The key is the whole of the access, the way an unsubscribe token is: 18
 * random bytes, printed on a sheet handed across a table. It is checked for
 * shape before it reaches the database and answered no-store, so an edit made
 * in a chat is what the next scan of the code shows.
 *
 * A profile that has been paid, or whose prices have run out, still reads -
 * the page says which - but will not open a checkout.
 *
 * The checkout carries the same one-use key every build checkout carries, so
 * `api/stripe-webhook.js` opens the buyer's account and project off it exactly
 * as it does for a hand-opened link, and the buyer lands on the same welcome
 * screen. The webhook is also what finishes a proposal, because Stripe's
 * checkout opens one subscription at one interval: see `checkoutPlan` for how
 * a monthly fee and a quarterly add-on are paid for together.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { connect } from '../lib/db/clients.js'
import { dayIn } from '../lib/time/zone.js'
import { ensureProducts } from '../lib/stripe/catalogue.js'
import { claimReturnUrl, mintClaim } from '../lib/stripe/claim.js'
import { form, openSession } from '../lib/stripe/session.js'
import {
  PROPOSAL_KEY,
  checkoutPlan,
  linesOf,
  picked,
  totals,
} from '../src/app/data/checkout/proposal.js'

const SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'

// A visitor reads the page once and presses pay once or twice; a back button
// from Stripe and a second try is a handful more. Past this is somebody
// working through keys.
const readWindow = callerWindow({ limit: 60, windowMs: 10 * 60 * 1000 })
const payWindow = callerWindow({ limit: 12, windowMs: 10 * 60 * 1000 })

// Stripe keeps a metadata value to 500 characters. Both lists written there
// are a handful of short names, and one that has outgrown the field is refused
// before Stripe refuses it with a message the visitor cannot use.
const METADATA_LIMIT = 500

// Written without the brackets the number usually wears, because the page reads
// every refusal through `faultMessage`, and a three-digit number in brackets
// is the mark it uses to spot a status code dressed as a sentence.
const CALL = 'Call 936-391-1956.'

/** The profile behind a key, or null where there is none. */
async function profileFor(db, key) {
  const { data, error } = await db
    .from('proposals')
    .select('id, client, items, addons, good_until, status')
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/**
 * The recurring lines the checkout cannot carry, as the webhook reads them back.
 *
 * Names, cents and how often - the three things a subscription is opened
 * from - and nothing else, since the field holds 500 characters.
 */
export function laterOf(plan) {
  return plan.later.length
    ? JSON.stringify(
        plan.later.map(line => ({ name: line.name, cents: line.cents, per: line.per }))
      )
    : ''
}

/** Whether the profile can be paid today, and if not, why. */
export function stateOf(profile, today = dayIn()) {
  if (profile.status === 'paid') return 'paid'
  if (profile.good_until < today) return 'expired'
  return 'open'
}

/**
 * The body sent to Stripe for one choice.
 *
 * Split out from the handler so the suite can read it without opening a
 * session. Each line hangs on the product named after it, so the receipt reads
 * as the sheet does. What the checkout cannot carry - the recurring lines on a
 * longer interval than the subscription it opens - is written onto the session
 * for the webhook to open once the money has cleared, with the first period
 * already charged here as a one-time line.
 *
 * @param {object} order
 * @returns {URLSearchParams}
 */
export function proposalFields({ profile, key, plan, products, chosen, claim }) {
  const fields = {
    mode: plan.mode,
    billing_address_collection: 'required',
    'automatic_tax[enabled]': 'true',
    'payment_method_types[0]': 'card',
    'payment_method_types[1]': 'link',
    'metadata[business_name]': profile.client,
    'metadata[proposal]': profile.id,
    'metadata[claim]': claim.hash,
    // What the project is opened with: the one-time lines are the build, and
    // the monthly lines are what the subscription renews at.
    'metadata[build_cents]': plan.now
      .filter(({ line }) => line.per === 'once')
      .reduce((sum, { line }) => sum + line.cents, 0),
    'metadata[monthly_cents]': plan.now
      .filter(({ line }) => line.per === 'month')
      .reduce((sum, { line }) => sum + line.cents, 0),
    'metadata[addons]': chosen.map(line => line.name).join(' | '),
    'metadata[later]': laterOf(plan),
    success_url: claimReturnUrl(SITE_URL, claim.token),
    cancel_url: `${SITE_URL}/pay?p=${key}`,
  }

  plan.now.forEach(({ line, recurring }, at) => {
    const prefix = `line_items[${at}]`
    fields[`${prefix}[quantity]`] = 1
    fields[`${prefix}[price_data][currency]`] = 'usd'
    fields[`${prefix}[price_data][unit_amount]`] = line.cents
    fields[`${prefix}[price_data][product]`] = products.get(line.name)
    if (recurring) {
      fields[`${prefix}[price_data][recurring][interval]`] = recurring.interval
      fields[`${prefix}[price_data][recurring][interval_count]`] = recurring.count
    }
  })

  if (plan.mode === 'subscription') {
    fields['subscription_data[description]'] = `TaylorURL services for ${profile.client}`
    fields['subscription_data[metadata][business_name]'] = profile.client
    fields['subscription_data[metadata][proposal]'] = profile.id
  } else {
    // A payment checkout makes no customer unless asked, and the project and
    // the account the webhook opens both hang on one.
    fields.customer_creation = 'always'
    fields['payment_intent_data[description]'] = `TaylorURL services for ${profile.client}`
  }

  return form(fields)
}

/** The sheet as the page draws it: every figure, nothing about the profile's insides. */
function sheetOf(profile, items, addons) {
  return {
    client: profile.client,
    items,
    addons,
    goodUntil: profile.good_until,
    state: stateOf(profile),
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Robots-Tag', 'noindex')

  const reading = request.method === 'GET'
  const limiter = reading ? readWindow : payWindow
  if (!limiter.allows(callerAddress(request))) {
    return response
      .status(429)
      .json({ error: `Too many tries just now. Wait a few minutes, or ${CALL.toLowerCase()}` })
  }

  const payload = reading ? request.query || {} : request.body || {}
  const key = typeof payload.p === 'string' ? payload.p.trim() : ''
  if (!PROPOSAL_KEY.test(key)) {
    return response.status(404).json({ error: `This link doesn’t match a proposal. ${CALL}` })
  }

  const connected = connect()
  if (!connected)
    return response.status(503).json({ error: `This page isn’t available right now. ${CALL}` })

  let profile
  try {
    profile = await profileFor(connected.db, key)
  } catch (cause) {
    console.error('proposal: the profile could not be read: %s', cause.message)
    return response.status(503).json({ error: `This page isn’t available right now. ${CALL}` })
  }
  if (!profile) {
    return response.status(404).json({ error: `This link doesn’t match a proposal. ${CALL}` })
  }

  const items = linesOf(profile.items)
  const addons = linesOf(profile.addons)
  if (!items || !addons) {
    console.error('proposal: profile %s holds a line that will not read', profile.id)
    return response.status(500).json({ error: `This proposal can’t be shown right now. ${CALL}` })
  }

  if (reading) return response.status(200).json(sheetOf(profile, items, addons))

  const state = stateOf(profile)
  if (state === 'paid') {
    return response.status(409).json({ error: `This proposal has already been paid. ${CALL}` })
  }
  if (state === 'expired') {
    return response.status(409).json({ error: `These prices have run out. ${CALL}` })
  }

  const chosen = picked(addons, payload.addons)
  if (chosen.error) return response.status(400).json({ error: chosen.error })

  const plan = checkoutPlan([...items, ...chosen.lines])
  if (!plan.now.length) {
    return response
      .status(400)
      .json({ error: `Nothing on this proposal is charged up front. ${CALL}` })
  }
  const names = chosen.lines.map(line => line.name).join(' | ')
  if (names.length > METADATA_LIMIT || laterOf(plan).length > METADATA_LIMIT) {
    return response
      .status(400)
      .json({ error: `That is too many add-ons for one checkout. ${CALL}` })
  }

  if (!SECRET_KEY) {
    console.error('proposal: STRIPE_SECRET_KEY unset')
    return response.status(503).json({ error: `Checkout isn’t available right now. ${CALL}` })
  }

  try {
    const products = await ensureProducts(
      plan.now.map(({ line }) => line.name),
      SECRET_KEY
    )
    const fields = proposalFields({
      profile,
      key,
      plan,
      products,
      chosen: chosen.lines,
      claim: mintClaim(),
    })
    const { answer: created, session } = await openSession(fields, SECRET_KEY)
    if (!created.ok || !session?.url) {
      console.error(
        'proposal: Stripe refused the checkout: %s',
        session?.error?.message || created.status
      )
      return response.status(502).json({ error: `Checkout couldn’t be opened. ${CALL}` })
    }
    return response
      .status(200)
      .json({ url: session.url, today: totals(plan.now.map(({ line }) => line)).today })
  } catch (cause) {
    console.error('proposal: Stripe could not be reached: %s', cause?.message)
    return response.status(502).json({ error: `Checkout couldn’t be opened. ${CALL}` })
  }
}
