/**
 * Where a completed payment becomes a project.
 *
 * This is the only door a project comes through. A buyer pays before they hold
 * an account, so nothing about the purchase can be recorded by the browser
 * that made it - the browser is gone by the time the money settles, and a
 * confirmation page that writes the row is a confirmation page that loses the
 * row whenever somebody closes the tab. Stripe tells this endpoint instead,
 * and keeps telling it until it answers.
 *
 * Which means the signature is the whole of the security here. Anyone can post
 * to this address; only Stripe can post to it with a body that matches the
 * signing secret, so an unsigned or stale request is refused before it is
 * read as anything.
 *
 * Answering twice for one payment is normal rather than exceptional - Stripe
 * retries until it gets a 2xx, and a retry after a slow write arrives while
 * the first is still running. The refusal to double up lives in the database,
 * keyed on the session, so two deliveries of one event produce one project.
 *
 * A session opens a subscription as well as taking the build, and the
 * subscription id is written on the project as it opens. It is the one thing
 * about the purchase still there in a year, and it is what a cancellation or
 * a failed monthly will name.
 *
 * Opening the project is also the moment a person has to hear about it. Stripe
 * says a card cleared; it does not say a business now has a build waiting and a
 * brief to read, and a purchase nobody is told about is a purchase that waits
 * on somebody happening to open the console. So the row is written first and
 * the studio is told second, on the first delivery only.
 *
 * The two ad accounts have to hear about it on the same delivery and for the
 * same reason. Everything a browser can report about a build stops at the
 * checkout being opened, because the browser is gone before the money settles,
 * so bidding taught only by the tags learns which ads produce somebody who
 * reaches Stripe rather than which ads produce a sale - and those are different
 * ads. This is the only place the sale is visible, and the click identifier the
 * checkout wrote onto the session is what lets each account credit it back to
 * the ad that earned it.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { UUID_PATTERN } from '../lib/db/fields.js'
import { notice, sendNotice } from '../lib/mail/notice.js'
import { markLead } from '../lib/leads/record.js'
import { BUILD_PRICE_CENTS, MONTHLY_PRICE_CENTS } from '../src/app/data/checkout/pricing.js'
import { SITE } from '../lib/site/current.js'
import { timedFetch } from '../lib/http/timed.js'

// The body is read as bytes rather than as an object, because a signature is
// over what was sent and not over what a parser made of it.
export const config = { api: { bodyParser: false } }

const SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gujgtjqqurildqurpffh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'

// What opens each ad account's door. Meta takes one long-lived token against
// the pixel; Google mints a short one per call from a refresh token, and wants
// the account, the action inside it and its own developer token besides. With
// either set incomplete that platform is told nothing, which leaves the browser
// events standing alone - what every deployment did before this.
//
// The account numbers arrive as people copy them, which is with dashes in.
// Google takes them without: the customer id is a path segment and the manager
// is a header value, and a dash in either is a request to an account that does
// not exist.
const META_CAPI_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || ''
const ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || ''
const ADS_CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '')
const ADS_LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '')
const ADS_PURCHASE_ACTION = process.env.GOOGLE_ADS_PURCHASE_ACTION_ID || ''
const ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || ''
const ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || ''
const ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN || ''

// Which Ads API this is written against. The version is a path segment rather
// than something negotiated, so it is pinned here and moved deliberately:
// Google retires a version about a year after it ships, and a call to a retired
// one is refused rather than served by its successor.
//
// The upload is a custom method, which is why the verb hangs off the customer
// on a colon instead of sitting under a collection of its own. The service
// definition binds it to `/{version}/customers/{customer_id}:uploadClickConversions`
// and the front end routes nothing else - a near miss is a 404, which arrives
// looking exactly like an account that refused the sale.
const ADS_API_VERSION = 'v25'

const META_EVENTS = `https://graph.facebook.com/v21.0/${SITE.metaPixelId}/events`
const ADS_UPLOAD = `https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${ADS_CUSTOMER_ID}:uploadClickConversions`
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'

// The three spellings a Google click identifier comes in, in the order they are
// looked for. Which one a click carries is Google's choice and not the
// advertiser's, and a conversion may name exactly one of them.
const GOOGLE_CLICK_FIELDS = ['gclid', 'gbraid', 'wbraid']

// How long either account is given. The money is taken and the project is open
// by the time these run, so a platform that has gone slow costs a figure in a
// dashboard, and it must not also cost the answer Stripe is waiting on.
const REPORT_TIMEOUT_MS = 8000

// How old a signed request may be. Stripe signs the moment it sends, so a
// wider window is a wider replay window and nothing else.
const TOLERANCE_SECONDS = 300

/** The raw bytes of the request, read straight off the stream. */
async function rawBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Whether the signature Stripe sent matches the body that arrived.
 *
 * The header carries a timestamp and one or more signatures, because a secret
 * being rotated means both the old and the new one are live for a window and
 * either is a legitimate answer. Any one matching is a match.
 */
export function signed(header, body, secret) {
  if (!header || !secret) return false

  const parts = Object.create(null)
  for (const pair of String(header).split(',')) {
    const at = pair.indexOf('=')
    if (at < 1) continue
    const key = pair.slice(0, at).trim()
    const value = pair.slice(at + 1).trim()
    if (key === 'v1') (parts.v1 ||= []).push(value)
    else parts[key] = value
  }

  const stamp = Number(parts.t)
  if (!Number.isFinite(stamp)) return false
  if (Math.abs(Date.now() / 1000 - stamp) > TOLERANCE_SECONDS) return false
  if (!parts.v1?.length) return false

  const expected = createHmac('sha256', secret).update(`${stamp}.${body}`).digest('hex')
  const wanted = Buffer.from(expected, 'utf8')
  return parts.v1.some(offered => {
    const got = Buffer.from(offered, 'utf8')
    return got.length === wanted.length && timingSafeEqual(got, wanted)
  })
}

/** The address the receipt went to, whichever field Stripe filled in. */
function buyerEmail(session) {
  return session?.customer_details?.email || session?.customer_email || null
}

/** A payment intent id, whether Stripe expanded the object or sent the id. */
function paymentIntentId(session) {
  const intent = session?.payment_intent
  return typeof intent === 'string' ? intent : intent?.id || null
}

/** A customer id, on the same terms. */
function customerId(session) {
  const customer = session?.customer
  return typeof customer === 'string' ? customer : customer?.id || null
}

/** The subscription the session opened, on the same terms. */
function subscriptionId(session) {
  const subscription = session?.subscription
  return typeof subscription === 'string' ? subscription : subscription?.id || null
}

/**
 * The brief this session was opened with, where it carries one.
 *
 * Checked for shape rather than taken on trust. The value reaches us back from
 * Stripe, and the only thing worth passing to a database function is a string
 * that could be the id it claims to be.
 */
export function briefId(session) {
  const held = session?.metadata?.brief_id
  return typeof held === 'string' && UUID_PATTERN.test(held.trim()) ? held.trim() : null
}

/**
 * A figure a session was quoted at, when the session says so itself.
 *
 * A subscription session puts the build and the first month into one total, so
 * `amount_total` cannot be taken apart after the fact and the deposit is read
 * off the published figure instead. That is correct for every checkout the
 * pricing page opens, and wrong for every one quoted above it: the card is
 * charged what was agreed while the project records what the page advertises,
 * and the two disagree quietly for as long as the project exists.
 *
 * So a checkout opened against a quote writes both figures down as it opens,
 * and this reads one of them back. A session that carries no such key was
 * charged the floor, which is what every caller below falls back to; every
 * session opened before this existed is one of those, and none of them is
 * recorded any differently than it was.
 *
 * @param {object} session
 * @param {string} key Which metadata figure: the build, or the monthly.
 * @returns {number|null} The cents that was sold for, or null to fall back.
 */
function quoted(session, key) {
  const written = session?.metadata?.[key]
  if (written === undefined || written === null || written === '') return null
  const cents = Number(written)
  if (!Number.isInteger(cents) || cents < 0) return null
  return cents
}

/**
 * What opening the project is told about the payment.
 *
 * The deposit is the build and nothing else. A subscription session's total is
 * the build plus the first month plus whatever tax applied, so what is recorded
 * is the figure the session was opened with rather than the figure it charged:
 * the session's own note of it where there is one, and the published figure
 * where there is not. A payment session, which is what every project before the
 * subscription came through, carried the build alone, and its total is the
 * deposit when Stripe named one.
 *
 * The amount is passed only when it is known. The column behind it takes no
 * nulls, and a Postgres default applies to an argument that is absent rather
 * than to one that is present and empty, so a session without a total has to
 * leave the key off entirely rather than send nothing in it.
 */
export function openArgs(session, email) {
  const args = {
    p_email: email,
    p_business_name: session?.metadata?.business_name || null,
    p_customer: customerId(session),
    p_payment_intent: paymentIntentId(session),
    p_session: typeof session?.id === 'string' ? session.id : null,
    p_subscription: subscriptionId(session),
  }
  const build = quoted(session, 'build_cents')
  if (build !== null) args.p_deposit_cents = build
  else if (session?.mode === 'subscription') args.p_deposit_cents = BUILD_PRICE_CENTS
  else if (Number.isInteger(session?.amount_total)) args.p_deposit_cents = session.amount_total
  return args
}

/** A figure in cents, as the dollars a person reads. */
function dollars(cents) {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * The purchase, as the notice has to read it.
 *
 * Built from the arguments the project was opened with rather than from the
 * session a second time. The two derivations would agree on the day they were
 * written and drift the first time either figure moves, and the failure is a
 * message stating a price the record does not hold - which is the one thing a
 * notice about money must never do. So there is one reading of what was sold,
 * the row is written from it, and the mail quotes it.
 *
 * The monthly is the exception, because nothing about it is recorded on the
 * project: the subscription is Stripe's and the amount lives there. It is read
 * off the session on the same terms the build is - the figure the checkout was
 * opened with, or the published one where it was opened at the floor.
 *
 * @param {object} session The session Stripe sent.
 * @param {object} args What opening the project was told.
 * @param {{project: string|null, brief: string|null}} opened
 * @returns {object} The purchase.
 */
export function purchaseOf(session, args, { project = null, brief = null } = {}) {
  return {
    business: args.p_business_name || null,
    email: args.p_email,
    website: session?.metadata?.website || null,
    buildCents: Number.isInteger(args.p_deposit_cents) ? args.p_deposit_cents : null,
    // A payment session bought a build alone, which is how every project before
    // the subscription came through. Naming a monthly on one would invent a
    // charge nobody agreed to.
    monthlyCents:
      session?.mode === 'subscription'
        ? (quoted(session, 'monthly_cents') ?? MONTHLY_PRICE_CENTS)
        : null,
    brief,
    project,
  }
}

/**
 * The notice a purchase is worth.
 *
 * What a person needs at a glance is who bought, what they were charged, and
 * whether there are answers waiting to be read - a build opened against a
 * brief is work that can start, and one opened without is a conversation that
 * has to happen first. The brief line says which, and says so even when the
 * attach failed, because a brief that was paid for and did not land is the one
 * state where the console will show nothing and the answers still exist.
 *
 * The buyer rides on Reply-To, so answering the notice answers them. It is the
 * whole of the follow-up: somebody has just paid a four-figure sum to a company
 * they have never spoken to, and the first message back should not wait on
 * anybody finding their address.
 *
 * Exported because the mail console draws every family from the code that sends
 * it, and a sample retyped somewhere else stops being the message the moment
 * either copy moves.
 *
 * @param {object} purchase The purchase, as `purchaseOf` reads one.
 * @returns {{subject: string, text: string, html: string, replyTo: string}}
 */
export function purchaseNotice(purchase) {
  const rows = [
    ['Business', purchase.business || 'Not given'],
    ['Email', purchase.email],
  ]
  if (purchase.website) rows.push(['Their site', purchase.website])
  rows.push(['Build', purchase.buildCents === null ? 'Not recorded' : dollars(purchase.buildCents)])
  rows.push([
    'Monthly',
    purchase.monthlyCents === null
      ? 'Not on the monthly'
      : `${dollars(purchase.monthlyCents)} a month`,
  ])
  rows.push([
    'Brief',
    purchase.brief === 'attached'
      ? 'Answered, and on the build'
      : purchase.brief === 'stuck'
        ? 'Answered, and did not attach'
        : 'None with this purchase',
  ])
  if (purchase.project) rows.push(['Project', purchase.project])

  return notice({
    label: 'Purchase',
    subject: `Website bought by ${purchase.business || purchase.email}`,
    rows,
    link: { label: 'Open Builds', url: `${SITE_URL}/console/builds` },
    replyTo: purchase.email,
  })
}

/**
 * Puts a purchase in front of a person.
 *
 * The project is written and the money is taken by the time this runs, so a
 * refusal here costs the notice and never the record. It is logged rather than
 * raised for a reason worth stating: raising would return a 500, Stripe would
 * redeliver, and the redelivery would find the project already open and take
 * the repeat path - which sends nothing. A failed notice retried that way is
 * therefore not a notice sent twice, it is a notice never sent at all, and the
 * log is the only place it can be found.
 *
 * A deployment with no mail key sends nothing, which is the state a preview
 * build runs in.
 *
 * @param {object} purchase The purchase, as `purchaseOf` reads one.
 */
async function announce(purchase) {
  if (!RESEND_API_KEY) return

  try {
    await sendNotice(purchaseNotice(purchase), RESEND_API_KEY)
  } catch (cause) {
    console.error('stripe-webhook: the purchase notice did not send: %s', cause.message)
  }
}

/** A value the checkout wrote onto the session, trimmed, or an empty string. */
function stamped(session, key) {
  const value = session?.metadata?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The buyer's address in the only shape it may leave this codebase in.
 *
 * Meta matches a sale against its own users by comparing digests, so it is
 * given one and never the address itself. Lowercased and trimmed first,
 * because the digest of an address written two ways is two digests and matches
 * nobody.
 */
function hashedEmail(email) {
  return createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex')
}

/**
 * A moment in the one format the Ads API takes.
 *
 * `yyyy-mm-dd hh:mm:ss+hh:mm`, written in UTC with the offset stated. The
 * account has a timezone of its own and a datetime that omits the offset is
 * read in it, so stating it is what keeps a sale from being filed hours from
 * when it happened.
 */
function adsDateTime(at) {
  return `${new Date(at * 1000).toISOString().slice(0, 19).replace('T', ' ')}+00:00`
}

/** The currency the session charged in, as either platform spells one. */
function currencyOf(session) {
  return String(session?.currency || 'usd').toUpperCase()
}

/**
 * The identifier a Google click carried, and the field it belongs in.
 *
 * Null where the session carries none, which is every sale that did not come
 * from a Google ad and every sale made before the checkout began writing them
 * down. Google counts nothing for a conversion that names no click, so a report
 * without one is not sent rather than sent and refused.
 *
 * @param {object} session
 * @returns {{field: string, value: string}|null}
 */
export function googleClick(session) {
  for (const field of GOOGLE_CLICK_FIELDS) {
    const value = stamped(session, field)
    if (value) return { field, value }
  }
  return null
}

/**
 * The sale, in the shape Meta's Conversions API reads one.
 *
 * `event_id` is the Stripe session, because the duplicate this has to survive
 * is Stripe's own: an event is redelivered until it is answered, and a sale
 * reported twice is a sale the bidding believes happened twice. Meta drops the
 * second of two events sharing a name and an id, and the session is the one
 * string that is identical on every delivery of one payment.
 *
 * The cookies ride unhashed and the address does not, which is Meta's rule
 * rather than a choice: `_fbp` and `_fbc` are Meta's own identifiers and a
 * digest of one matches nothing.
 *
 * @param {object} session
 * @param {string} email
 * @param {number} cents What the card was charged.
 * @param {number} at Unix seconds the payment landed.
 */
export function metaPurchase(session, email, cents, at) {
  const person = { em: [hashedEmail(email)] }
  const browser = stamped(session, 'fbp')
  const click = stamped(session, 'fbc')
  if (browser) person.fbp = browser
  if (click) person.fbc = click

  return {
    data: [
      {
        event_name: 'Purchase',
        event_time: at,
        event_id: typeof session?.id === 'string' ? session.id : '',
        action_source: 'website',
        user_data: person,
        custom_data: { currency: currencyOf(session), value: cents / 100 },
      },
    ],
  }
}

/**
 * The sale, in the shape Google's click conversion upload reads one.
 *
 * The identifier goes in its own field, because the three are alternatives and
 * a conversion naming more than one is refused. `orderId` is the session, so a
 * redelivery lands on the conversion already uploaded rather than beside it.
 *
 * @param {object} session
 * @param {{field: string, value: string}} click
 * @param {number} cents What the card was charged.
 * @param {number} at Unix seconds the payment landed.
 */
export function adsPurchase(session, click, cents, at) {
  const conversion = {
    conversionAction: `customers/${ADS_CUSTOMER_ID}/conversionActions/${ADS_PURCHASE_ACTION}`,
    conversionDateTime: adsDateTime(at),
    conversionValue: cents / 100,
    currencyCode: currencyOf(session),
    [click.field]: click.value,
  }
  if (typeof session?.id === 'string') conversion.orderId = session.id
  return { conversions: [conversion], partialFailure: true }
}

/**
 * Tells the pixel's account about a sale it has no other way of seeing.
 *
 * A deployment with no token, and the site with no pixel of its own, tell
 * nothing. Sharing one pixel between two sites is one optimisation signal
 * learning from two different offers, and a sale reported to the wrong one
 * teaches an account to go and find the wrong buyer.
 */
async function tellMeta(session, email, cents, at) {
  if (!META_CAPI_TOKEN || !SITE.metaPixelId) return

  const answered = await timedFetch(
    META_EVENTS,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...metaPurchase(session, email, cents, at),
        access_token: META_CAPI_TOKEN,
      }),
    },
    REPORT_TIMEOUT_MS
  )
  if (!answered.ok) {
    // Meta quotes the request back in a refusal, and the token is in the
    // request, so what reaches the log is the reason and not the credential.
    const said = await answered.text().catch(() => '')
    const detail = said.replaceAll(META_CAPI_TOKEN, '[redacted]').slice(0, 300)
    throw new Error(`meta returned ${answered.status} ${detail}`.trim())
  }
}

/**
 * A short-lived access token for the ad account, minted from the refresh one.
 *
 * Minted per report rather than held, because a function instance lives for one
 * request and a token cached in one is a token no other instance can read.
 */
async function adsAccessToken() {
  const answered = await timedFetch(
    GOOGLE_TOKEN,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ADS_CLIENT_ID,
        client_secret: ADS_CLIENT_SECRET,
        refresh_token: ADS_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    },
    REPORT_TIMEOUT_MS
  )
  const minted = await answered.json().catch(() => null)
  if (!answered.ok || !minted?.access_token) {
    // The reason is named and nothing of the exchange is quoted: a refusal here
    // carries the client secret and the refresh token in the request it is
    // refusing.
    throw new Error(`google refused the refresh token (${answered.status})`)
  }
  return minted.access_token
}

/**
 * Tells the ad account about a sale it has no other way of seeing.
 *
 * Six values open this door and a deployment holding five of them opens
 * nothing, so the whole set is checked before a token is minted rather than
 * discovering it in a refusal.
 */
async function tellGoogle(session, cents, at) {
  const wired =
    ADS_DEVELOPER_TOKEN &&
    ADS_CUSTOMER_ID &&
    ADS_PURCHASE_ACTION &&
    ADS_CLIENT_ID &&
    ADS_CLIENT_SECRET &&
    ADS_REFRESH_TOKEN
  if (!wired || !SITE.adsId) return

  const click = googleClick(session)
  if (!click) return

  const headers = {
    Authorization: `Bearer ${await adsAccessToken()}`,
    'developer-token': ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  }
  // Which account the caller is acting as, named only where the ad account is
  // reached through a manager rather than held outright by the user the refresh
  // token was minted for. Google reads the absence as a claim of direct access,
  // and answers a request that makes that claim untruthfully as an account that
  // is not there - which reads exactly like a sale the account declined.
  if (ADS_LOGIN_CUSTOMER_ID) headers['login-customer-id'] = ADS_LOGIN_CUSTOMER_ID

  const answered = await timedFetch(
    ADS_UPLOAD,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(adsPurchase(session, click, cents, at)),
    },
    REPORT_TIMEOUT_MS
  )
  const said = await answered.json().catch(() => null)
  if (!answered.ok) {
    throw new Error(`google ads returned ${answered.status} ${said?.error?.message || ''}`.trim())
  }
  // A refused conversion comes back inside a 200. An expired identifier, a
  // conversion action from another account and a datetime outside the click's
  // window all arrive this way, and read as success to anything that only
  // checks the status.
  if (said?.partialFailureError?.message) {
    throw new Error(`google ads refused it: ${said.partialFailureError.message}`)
  }
}

/**
 * When the payment landed, as both accounts count seconds.
 *
 * Stripe's own stamp on the event rather than the clock here. A bank debit
 * settles for hours and a redelivery arrives later still, and an account told
 * a sale happened at the moment it was reported files it against the wrong day
 * - or outside the window a click is creditable in, which loses it entirely.
 */
function paidAt(event) {
  return Number.isInteger(event?.created) ? event.created : Math.floor(Date.now() / 1000)
}

/**
 * Reports the sale to the accounts that sold it.
 *
 * Both are told at once and neither can fail the delivery. Raising here would
 * return a 500, Stripe would redeliver, and the redelivery would find the
 * project already open and take the repeat path - so a conversion retried that
 * way is not a conversion uploaded twice, it is a project opened again for
 * nothing while the report stays lost. The log is where a failure is found.
 *
 * A session Stripe named no total on is not reported at all. The whole point of
 * the report is the money on it, and an account told a sale happened for
 * nothing learns to go and find more of them.
 *
 * @param {object} session The session Stripe sent.
 * @param {string} email The address the receipt went to.
 * @param {number} at Unix seconds the payment landed.
 */
async function report(session, email, at) {
  if (!Number.isInteger(session?.amount_total)) {
    console.error('stripe-webhook: a paid session carried no total, so the sale was not reported')
    return
  }

  const [meta, google] = await Promise.allSettled([
    tellMeta(session, email, session.amount_total, at),
    tellGoogle(session, session.amount_total, at),
  ])
  if (meta.status === 'rejected') {
    console.error('stripe-webhook: the pixel was not told about the sale: %s', meta.reason?.message)
  }
  if (google.status === 'rejected') {
    console.error(
      'stripe-webhook: the ad account was not told about the sale: %s',
      google.reason?.message
    )
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const body = await rawBody(request)
  if (!signed(request.headers['stripe-signature'], body, SIGNING_SECRET)) {
    return response.status(400).json({ error: 'Bad signature.' })
  }

  let event
  try {
    event = JSON.parse(body)
  } catch {
    return response.status(400).json({ error: 'Malformed body.' })
  }

  // Everything else Stripe is configured to send is acknowledged and dropped.
  // A 2xx is what stops it retrying, and an event this endpoint has no opinion
  // about is not a failure.
  const opens = ['checkout.session.completed', 'checkout.session.async_payment_succeeded']
  if (!opens.includes(event?.type)) {
    return response.status(200).json({ ok: true, ignored: event?.type || 'unknown' })
  }

  const session = event?.data?.object || {}

  // A session can complete before the money has. Bank debits settle for hours,
  // and opening a project against one that later fails would put an unpaid
  // build in front of somebody.
  if (session.payment_status && session.payment_status !== 'paid') {
    return response.status(200).json({ ok: true, waiting: session.payment_status })
  }

  const email = buyerEmail(session)
  if (!email) {
    console.error('stripe-webhook: a paid session carried no address')
    return response.status(200).json({ ok: true, ignored: 'no address' })
  }

  if (!SERVICE_KEY) {
    console.error('stripe-webhook: no service key, the project was not opened')
    return response.status(500).json({ error: 'Not configured.' })
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const args = openArgs(session, email)
  const { data, error } = await db.rpc('project_open', args)

  if (error || data?.error) {
    // A 500 is what makes Stripe try again, which is the right answer to a
    // database that was briefly unreachable and the only answer that does not
    // silently lose a paid project.
    console.error('stripe-webhook: the project was not opened', error?.message || data?.error)
    return response.status(500).json({ error: 'The project was not opened.' })
  }

  // The brief is attached after the project exists rather than as an argument
  // to opening it, so the function that takes the money keeps the signature it
  // has. Attaching is its own idempotent write and a repeat delivery lands on
  // the same pair, so this runs on a retry as willingly as on the first call.
  //
  // A brief that fails to attach is not worth a 500. That would make Stripe
  // redeliver an event whose only remaining work is decoration, and every
  // redelivery re-runs the part that already succeeded.
  // The buyer started as a lead, and the row that says so is what keeps the
  // follow-up from chasing somebody who has already paid. Stamped here rather
  // than at the checkout because this is the delivery that means money moved,
  // and it is the one fact on the row worth being certain about.
  await markLead('bought', email, db)

  const brief = briefId(session)
  let carried = brief ? 'stuck' : null
  if (brief && data?.project_id) {
    const attached = await db.rpc('project_brief_attach', {
      p_project: data.project_id,
      p_brief: brief,
    })
    if (attached.error || attached.data?.error) {
      console.error(
        'stripe-webhook: the brief was not attached',
        attached.error?.message || attached.data?.error
      )
    } else {
      carried = 'attached'
    }
  }

  // Only on the delivery that opened the project. Stripe retries until it is
  // answered and a slow write is answered twice, so a notice sent on every
  // delivery is one purchase arriving in the inbox as several - and an inbox
  // that repeats itself is one a person stops reading closely. The ad accounts
  // are on the same guard for the harder version of the same reason: a sale
  // uploaded once per delivery is a sale the bidding believes happened three
  // times. The database already refuses to open the project twice, and this
  // reads its answer.
  //
  // Awaited rather than left running, because a serverless function that has
  // returned is a function that may be frozen mid-fetch.
  if (!data?.repeat) {
    await announce(purchaseOf(session, args, { project: data?.project_id || null, brief: carried }))
    await report(session, email, paidAt(event))
  }

  return response.status(200).json({ ok: true, repeat: Boolean(data?.repeat) })
}
