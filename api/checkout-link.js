/**
 * A checkout opened by hand, for a job that was quoted before it was sold.
 *
 * `/start` is where somebody who found the site buys the standard build at the
 * standard figure. This is the other half of the same sale: a prospect in a
 * reply, a number agreed in an email, and a link that has to charge that number
 * without either of us going near the Stripe dashboard. What comes back is a
 * URL to paste into the reply.
 *
 * What it opens is the same object `api/checkout.js` opens, built the same way
 * and pointed at the same two places, because a build bought through a link in
 * an email has to become a project by exactly the route a build bought off the
 * pricing page does. The webhook is the only door a project comes through, the
 * screen after a payment reads the session back to name the address that paid
 * and spends the key that signs the buyer in, and neither of them is told which
 * of the two endpoints made the session. The only difference either can see is
 * metadata nothing branches on.
 *
 * The prices come from `pricing.js` for the same reason they do there, and
 * with an extra edge: this endpoint can be told a different figure, so the
 * default it falls back to has to be the one figure the pages print, read from
 * the same module they read. A link opened with no override charges what
 * `/start` charges, and `scripts/checkout/check-payment-link.js` fails the suite if the
 * two ever send different bodies.
 *
 * An override may only go up. `pricing.js` calls both figures a floor, and a
 * bigger build costs more than one; nothing about a quote is ever a reason to
 * charge less than the site publicly advertises. Refusing below the floor here
 * means the worst an override can do, if this endpoint were ever reached by
 * somebody who should not have reached it, is overpay.
 *
 * Which is the other thing this file is: the only endpoint on the site that
 * takes a price from its caller. `authorizeAdmin` is what stands in front of
 * it, the same check the console's own endpoints use, and it is not optional
 * or bypassable by a shared secret. A public endpoint that accepts an amount
 * is a way to buy a thousand dollar site for a dollar.
 *
 * A request carrying `preview` is answered with the two figures and nothing
 * else. It exists because the figures a person reads before agreeing to a
 * charge have to be the ones this endpoint would charge, rather than a second
 * calculation of them made by whatever asked. Reading is not creating, and
 * that path returns before Stripe is reached at all.
 *
 * The session expires inside a day, because Stripe will not open one that
 * lives longer: `expires_at` may be anywhere from thirty minutes to twenty
 * four hours after creation and no further. A link is therefore something you
 * send and they act on, not something that sits in an inbox for a week. When
 * one lapses, open another; nothing is consumed by a session that expired.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { BUILD_PRICE_CENTS, MONTHLY_PRICE_CENTS } from '../src/app/data/checkout/pricing.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { claimReturnUrl, mintClaim } from '../lib/stripe/claim.js'

const STRIPE_ENDPOINT = 'https://api.stripe.com/v1/checkout/sessions'
const SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'

// The same two products the pricing page's checkout hangs its lines on. Named
// from the environment for the same reason: a product id belongs to one mode
// of the account, and the sandbox keeps its own pair.
const BUILD_PRODUCT = process.env.STRIPE_PRODUCT_BUILD || ''
const CARE_PRODUCT = process.env.STRIPE_PRODUCT_CARE || ''

const TIMEOUT_MS = 10000

/**
 * How long a link lives, in seconds.
 *
 * Stripe's ceiling is twenty four hours after it creates the session, and the
 * clock that measures it is Stripe's rather than this one's. Asking for the
 * whole day from a machine running a few minutes fast is a request Stripe
 * refuses outright, so a few minutes are given back. The difference is
 * invisible to somebody being told the link is good until tomorrow, and it is
 * the difference between a link and an error.
 */
const LINK_SECONDS = 24 * 60 * 60 - 300

/**
 * The most either figure may be set to.
 *
 * Not a policy about what a build can cost. It is the guard against a zero
 * typed twice, which is the only way this endpoint can charge somebody an
 * amount nobody meant. The tool that calls it prints dollars back and waits to
 * be told to go ahead, and this is what stands behind that when the answer is
 * given too quickly.
 */
const BUILD_CEILING_CENTS = 5000000
const MONTHLY_CEILING_CENTS = 500000

/** Stripe takes form encoding with square brackets for nesting, not JSON. */
function form(entries) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === '') continue
    body.append(key, String(value))
  }
  return body
}

/** An address that could plausibly receive the receipt. */
function usableEmail(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length < 5 || trimmed.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null
  return trimmed
}

/** Trimmed and capped, empty rather than absent when it holds nothing. */
function short(value, limit) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, limit)
}

/**
 * One quoted figure, or the reason it cannot stand.
 *
 * Absent is the ordinary case and answers with the floor, which is what makes
 * a link with no override charge what the pricing page charges. Present has to
 * be a whole number of cents at or above that floor and under the ceiling; a
 * decimal, a string of dollars, or anything below what the site advertises is
 * refused by name rather than rounded into something plausible.
 *
 * @param {unknown} value
 * @param {{floor: number, ceiling: number, what: string}} bounds
 * @returns {{cents: number, quoted: boolean}|{error: string}}
 */
export function quotedCents(value, { floor, ceiling, what }) {
  if (value === undefined || value === null || value === '') return { cents: floor, quoted: false }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { error: `The ${what} has to be a whole number of cents.` }
  }
  if (value < floor) {
    return { error: `The ${what} cannot go below the ${floor / 100} dollars the site publishes.` }
  }
  if (value > ceiling) {
    return { error: `The ${what} is past the ${ceiling / 100} dollar ceiling. Check the zeros.` }
  }
  return { cents: value, quoted: true }
}

/**
 * The body sent to Stripe, which is the whole of what this endpoint decides.
 *
 * Split out from the handler so the suite can hold it beside the body
 * `api/checkout.js` sends and fail on any difference. Everything a buyer meets
 * is in here: what they are charged, where they land afterwards, what the
 * subscription is called in a year, and which address the receipt goes to.
 *
 * The figures are written into metadata as well as into the line items. Stripe
 * puts the build and the first month into one total on a subscription session,
 * so the total the webhook is handed cannot be taken apart afterwards, and
 * without this the deposit recorded against the project would be whatever the
 * code guessed rather than what the card was charged.
 *
 * The key that signs the buyer in is minted here rather than passed in, so a
 * caller cannot open a checkout that a buyer comes back from with no way into
 * the account it made. Each call mints its own, which is why the suite compares
 * the two bodies with it normalised out rather than expecting one string.
 *
 * @param {object} quote
 * @returns {URLSearchParams}
 */
export function linkFields({
  email,
  business,
  website,
  buildCents,
  monthlyCents,
  quotedBy,
  quotedAt,
  expiresAt,
}) {
  const quoted = buildCents !== BUILD_PRICE_CENTS || monthlyCents !== MONTHLY_PRICE_CENTS
  const claim = mintClaim()
  return form({
    mode: 'subscription',
    customer_email: email,
    billing_address_collection: 'required',
    'automatic_tax[enabled]': 'true',
    'payment_method_types[0]': 'card',
    'payment_method_types[1]': 'link',
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': buildCents,
    'line_items[0][price_data][product]': BUILD_PRODUCT,
    'line_items[1][quantity]': 1,
    'line_items[1][price_data][currency]': 'usd',
    'line_items[1][price_data][unit_amount]': monthlyCents,
    'line_items[1][price_data][recurring][interval]': 'month',
    'line_items[1][price_data][product]': CARE_PRODUCT,
    'subscription_data[description]': business ? `Website care for ${business}` : 'Website care',
    'subscription_data[metadata][business_name]': business,
    'subscription_data[metadata][website]': website,
    'subscription_data[metadata][build_cents]': buildCents,
    'subscription_data[metadata][monthly_cents]': monthlyCents,
    // Who agreed to what, on the object that is still there when nobody
    // remembers the email. Written only for a quote, so an ordinary sale
    // carries no note claiming somebody negotiated it.
    'subscription_data[metadata][quoted_by]': quoted ? quotedBy : '',
    'subscription_data[metadata][quoted_at]': quoted ? quotedAt : '',
    'metadata[business_name]': business,
    'metadata[website]': website,
    'metadata[build_cents]': buildCents,
    'metadata[monthly_cents]': monthlyCents,
    'metadata[quoted_by]': quoted ? quotedBy : '',
    'metadata[quoted_at]': quoted ? quotedAt : '',
    'metadata[claim]': claim.hash,
    expires_at: expiresAt,
    success_url: claimReturnUrl(SITE_URL, claim.token),
    cancel_url: `${SITE_URL}/pricing`,
  })
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const missing = [
    !SECRET_KEY && 'STRIPE_SECRET_KEY',
    !BUILD_PRODUCT && 'STRIPE_PRODUCT_BUILD',
    !CARE_PRODUCT && 'STRIPE_PRODUCT_CARE',
  ].filter(Boolean)
  if (missing.length) {
    console.error(`checkout-link: not configured, ${missing.join(', ')} unset`)
    return response.status(503).json({ error: 'Checkout is not available right now.' })
  }

  const connected = connect()
  if (!connected) return response.status(503).json({ error: 'Not available right now.' })

  const caller = await authorizeAdmin(connected, request.headers?.authorization)
  if (caller.error) return response.status(caller.status).json({ error: caller.error })

  const payload = request.body || {}
  const email = usableEmail(payload.email)
  if (!email) return response.status(400).json({ error: 'A working email address is needed.' })

  const build = quotedCents(payload.build_cents, {
    floor: BUILD_PRICE_CENTS,
    ceiling: BUILD_CEILING_CENTS,
    what: 'build',
  })
  if (build.error) return response.status(400).json({ error: build.error })

  const monthly = quotedCents(payload.monthly_cents, {
    floor: MONTHLY_PRICE_CENTS,
    ceiling: MONTHLY_CEILING_CENTS,
    what: 'monthly',
  })
  if (monthly.error) return response.status(400).json({ error: monthly.error })

  // A run that has not been confirmed asks what this would charge and stops.
  // The figures have to be answered from here rather than worked out by
  // whatever is calling, or the dollars somebody reads before saying go ahead
  // are that caller's guess at the price and not the one the card would meet.
  // Nothing is created, and nothing at Stripe is touched.
  if (payload.preview === true) {
    return response.status(200).json({
      preview: true,
      build_cents: build.cents,
      monthly_cents: monthly.cents,
      build_quoted: build.quoted,
      monthly_quoted: monthly.quoted,
      expires_in_seconds: LINK_SECONDS,
    })
  }

  const expiresAt = Math.floor(Date.now() / 1000) + LINK_SECONDS
  const fields = linkFields({
    email,
    business: short(payload.business_name, 120),
    website: short(payload.website, 200),
    buildCents: build.cents,
    monthlyCents: monthly.cents,
    quotedBy: caller.email || '',
    quotedAt: new Date().toISOString(),
    expiresAt,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const created = await fetch(STRIPE_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: fields,
    })

    const session = await created.json()
    if (!created.ok || !session.url) {
      // Stripe's own message names the field it refused. This answers an admin
      // rather than a buyer, and an admin can act on it, so it comes back
      // rather than staying in the log alone.
      const said = session?.error?.message || `Stripe answered ${created.status}.`
      console.error('checkout-link: Stripe refused the request', said)
      return response.status(502).json({ error: said })
    }

    return response.status(200).json({
      url: session.url,
      session_id: session.id,
      expires_at: session.expires_at ?? expiresAt,
      build_cents: build.cents,
      monthly_cents: monthly.cents,
      build_quoted: build.quoted,
      monthly_quoted: monthly.quoted,
      quoted: build.quoted || monthly.quoted,
    })
  } catch (error) {
    console.error(
      `checkout-link: ${error?.name === 'AbortError' ? 'Stripe timed out' : 'Stripe unreachable'}`
    )
    return response.status(502).json({ error: 'Stripe could not be reached.' })
  } finally {
    clearTimeout(timer)
  }
}
