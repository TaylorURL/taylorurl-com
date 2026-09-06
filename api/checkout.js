/**
 * Opens a Stripe checkout for a website build and the care that runs it.
 *
 * Payment comes before the work and before the account. A buyer arrives here
 * with an address and nothing else, is sent to Stripe's own page to pay, and
 * picks a password afterwards; the project they paid for is waiting under that
 * address when they do. Nothing on this site ever holds a card number.
 *
 * One session carries both figures the pages print. The build is a one-time
 * line, which Stripe puts on the first invoice and on no other; the care is a
 * monthly line, so the same session that takes the build opens the
 * subscription, and Stripe charges the card it saved on the same day each
 * month until the subscription is cancelled. Nothing has to remember to start
 * the monthly later, which is how every site launched before this ran
 * unbilled.
 *
 * Stripe is reached over plain HTTPS rather than through its library, the way
 * the one other signed webhook in this directory reaches Resend. The two calls
 * this needs are a form post and an HMAC, both of which the runtime already
 * has, and a dependency carried into every install to save writing thirty
 * lines is a dependency that has to be kept current forever.
 *
 * The amounts are sent inline rather than named. A price object living in the
 * Stripe account is a second place the figure is written down, and the first
 * time the page says one number while the account says another, the account
 * wins and nobody finds out until a customer is charged. `pricing.js` holds
 * the only two figures, and they travel with the request. What the account
 * does hold is a product for each line, named from the environment because a
 * product id belongs to one mode and the sandbox keeps its own pair. An inline
 * price with no product to hang on makes Stripe mint a product per checkout,
 * and a subscription a year old would sit under its own copy of the care.
 *
 * The terms are a condition of the sale rather than a decoration on the form.
 * A checkout that does not carry the buyer's agreement is refused here, because
 * a checkbox is a thing a browser can be talked out of and this is the only
 * place that cannot be. The time it was given is written onto the session and
 * onto the subscription, so what proves somebody agreed lives beside the
 * payment they agreed to rather than in a log that rolls over.
 *
 * The click identifier the buyer arrived on is written onto the session, along
 * with the two cookies Meta's pixel holds. None of it is read here. The sale is
 * reported to the ad accounts by the webhook, after the browser that made it is
 * gone, and an account credits a reported conversion through the identifier it
 * wrote on the click - so the session is where those values wait, because it is
 * the one object that exists on both sides of the payment.
 *
 * The brief the buyer just spent six screens answering is written down here and
 * named to Stripe by its id alone. Stripe caps a metadata value at 500
 * characters and would hold the answers in a payment processor besides, so what
 * travels through the session is a uuid and what holds the brief is our own
 * table. A brief that cannot be stored does not stop the checkout: the payment
 * is the part the buyer came for, and a build opened without its brief is a
 * conversation, while a card refused at the last step is a lost sale.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { BUILD_PRICE_CENTS, MONTHLY_PRICE_CENTS } from '../src/app/data/pricing.js'
import { callerWindow } from '../lib/http/rate.js'
import { connect } from '../lib/db/clients.js'
import { markLead } from '../lib/leads/record.js'

const STRIPE_ENDPOINT = 'https://api.stripe.com/v1/checkout/sessions'
const SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'

// The products the two lines belong to. Ids, from the environment, because a
// product lives in one mode of the account and the sandbox holds its own pair.
const BUILD_PRODUCT = process.env.STRIPE_PRODUCT_BUILD || ''
const CARE_PRODUCT = process.env.STRIPE_PRODUCT_CARE || ''

const TIMEOUT_MS = 10000

// What one email address may start inside one window. A checkout costs nothing
// to open and expires on its own, so this is aimed at a script in a loop rather
// than at somebody who changed their mind twice. The window counts the address
// the checkout is for rather than the connection it came over, since the same
// buyer retrying from a phone and a laptop is one buyer.
const startWindow = callerWindow({ limit: 6, windowMs: 10 * 60 * 1000 })

/**
 * Stripe takes form encoding with square brackets for nesting, not JSON.
 *
 * Written out rather than reached for from a library because the shape is
 * small and fixed, and because a helper that flattens anything would happily
 * flatten a field nobody meant to send.
 */
function form(fields) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
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

// What one brief may carry. The configurator asks eight questions and the caps
// are well clear of the longest answer any of them can produce, so these refuse
// a crafted payload rather than a talkative buyer.
const BRIEF_ROWS = 24
const BRIEF_LABEL = 80
const BRIEF_VALUE = 500

/**
 * The buyer's answers, in the label-and-value rows the studio reads them in.
 *
 * Anything that is not a pair of non-empty strings is dropped rather than
 * refused. The brief is a convenience for the person doing the build, and one
 * malformed row is not a reason to lose the other seven.
 *
 * @param {unknown} value
 * @returns {Array<{label: string, value: string}>}
 */
function briefRows(value) {
  if (!Array.isArray(value)) return []
  const rows = []
  for (const row of value.slice(0, BRIEF_ROWS)) {
    const label = short(row?.label, BRIEF_LABEL)
    const answer = short(row?.value, BRIEF_VALUE)
    if (label && answer) rows.push({ label, value: answer })
  }
  return rows
}

/**
 * Writes the brief down and hands back its id, or null when it could not be
 * stored.
 *
 * Every failure here is swallowed on purpose. This runs between a buyer
 * pressing pay and Stripe's page opening, and there is no fault in this
 * function worth turning into a checkout the buyer cannot complete.
 *
 * @param {Array<{label: string, value: string}>} rows
 * @param {string} email
 * @returns {Promise<string|null>}
 */
async function storeBrief(rows, email) {
  if (!rows.length) return null
  const wired = connect()
  if (!wired) return null
  try {
    const { data, error } = await wired.db.rpc('project_brief_open', {
      p_email: email,
      p_answers: rows,
    })
    if (error || !data?.brief_id) {
      console.error('checkout: the brief was not stored', error?.message || data?.error)
      return null
    }
    return data.brief_id
  } catch (error) {
    console.error('checkout: the brief was not stored', error?.message)
    return null
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  // A deployment without the key cannot take money, and one without the
  // products cannot say what it is selling. Saying so plainly beats a Stripe
  // error the buyer cannot act on, and the log names which one is missing.
  const missing = [
    !SECRET_KEY && 'STRIPE_SECRET_KEY',
    !BUILD_PRODUCT && 'STRIPE_PRODUCT_BUILD',
    !CARE_PRODUCT && 'STRIPE_PRODUCT_CARE',
  ].filter(Boolean)
  if (missing.length) {
    console.error(`checkout: not configured, ${missing.join(', ')} unset`)
    return response.status(503).json({ error: 'Checkout is not available right now.' })
  }

  const payload = request.body || {}
  const email = usableEmail(payload.email)
  if (!email) return response.status(400).json({ error: 'A working email address is needed.' })

  if (!startWindow.allows(email)) {
    return response.status(429).json({ error: 'Too many attempts. Try again shortly.' })
  }

  // Refused before the brief is stored, because a request that is not going to
  // open a checkout has no business leaving a row behind. The time is taken
  // here rather than read off the request: a clock a buyer controls is not a
  // record of anything.
  if (payload.terms_accepted !== true) {
    return response.status(400).json({ error: 'The terms have to be agreed to before you pay.' })
  }
  const agreedAt = new Date().toISOString()

  const business = short(payload.business_name, 120)
  const website = short(payload.website, 200)
  const brief = await storeBrief(briefRows(payload.brief), email)
  const campaign = payload.campaign && typeof payload.campaign === 'object' ? payload.campaign : {}

  // The address answered on the configurator's first step is the address the
  // card is used with, so this is where a lead stops being one. Stamped before
  // Stripe is reached rather than after, because a buyer who opens the page and
  // closes it has still reached the checkout, and that is the reading the
  // console is drawing.
  await markLead('checkout', email)

  const fields = form({
    mode: 'subscription',
    customer_email: email,
    // Asked for because the monthly is taxed, and tax is worked out from where
    // the customer is. A customer record with no address is one Stripe cannot
    // calculate for, and the failure would land on the first monthly rather
    // than here, where somebody is filling a form in anyway.
    billing_address_collection: 'required',
    'automatic_tax[enabled]': 'true',
    // Cards, and Link for a card already saved with Stripe. A bank debit can
    // carry a subscription, but the build by ACH settles over days and nothing
    // opens until the money lands, which reads as a week of silence after
    // somebody paid.
    'payment_method_types[0]': 'card',
    'payment_method_types[1]': 'link',
    // A field for a code on Stripe's own page. The follow-up sent to somebody
    // who started a build and left carries a single-use one that halves the
    // build line, and a code with nowhere to be typed is not an offer.
    allow_promotion_codes: 'true',
    // The build, once. A one-time line in a subscription session lands on the
    // first invoice and on no other.
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': BUILD_PRICE_CENTS,
    'line_items[0][price_data][product]': BUILD_PRODUCT,
    // The care, every month from today, on the card that paid for the build.
    'line_items[1][quantity]': 1,
    'line_items[1][price_data][currency]': 'usd',
    'line_items[1][price_data][unit_amount]': MONTHLY_PRICE_CENTS,
    'line_items[1][price_data][recurring][interval]': 'month',
    'line_items[1][price_data][product]': CARE_PRODUCT,
    // Written on the subscription as well as the session. The session is a
    // day's object; the subscription is the one still there in a year when
    // somebody in the Stripe dashboard asks whose it is.
    'subscription_data[description]': business ? `Website care for ${business}` : 'Website care',
    'subscription_data[metadata][business_name]': business,
    'subscription_data[metadata][website]': website,
    'subscription_data[metadata][brief_id]': brief || '',
    'subscription_data[metadata][terms_agreed_at]': agreedAt,
    'metadata[business_name]': business,
    'metadata[website]': website,
    'metadata[terms_agreed_at]': agreedAt,
    // What the ad accounts read the sale back against when the webhook reports
    // it. All three Google spellings, because which one a click carries is
    // Google's choice and not the advertiser's, and `form` drops the two that
    // are empty. The pixel's cookies go beside them: `_fbp` names the browser
    // and `_fbc` the Meta click, and neither is derivable from anything on this
    // side of the redirect.
    'metadata[gclid]': short(campaign.gclid, 200),
    'metadata[gbraid]': short(campaign.gbraid, 200),
    'metadata[wbraid]': short(campaign.wbraid, 200),
    'metadata[fbp]': short(payload.fbp, 200),
    'metadata[fbc]': short(payload.fbc, 400),
    // The brief itself stays here; this is the string that finds it again when
    // the payment lands. `form` drops an empty value, so a checkout opened
    // without a brief carries no key rather than an empty one.
    'metadata[brief_id]': brief || '',
    // Stripe fills the template in on the way back. The session is what lets
    // the signup screen name the address the payment was made with, which is
    // the address the build is waiting under.
    success_url: `${SITE_URL}/signup?bought=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/pricing`,
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
      // Stripe's own message names the field it refused, which is worth having
      // in the log and worth keeping out of the browser.
      console.error(
        'checkout: Stripe refused the request',
        session?.error?.message || created.status
      )
      return response.status(502).json({ error: 'Checkout could not be started.' })
    }

    return response.status(200).json({ url: session.url })
  } catch (error) {
    console.error(
      `checkout: ${error?.name === 'AbortError' ? 'Stripe timed out' : 'Stripe unreachable'}`
    )
    return response.status(502).json({ error: 'Checkout could not be started.' })
  } finally {
    clearTimeout(timer)
  }
}
