/**
 * Proves that a link opened by hand charges the figure that was agreed, hands
 * the buyer back a way into the account it opens, and records what it charged.
 *
 * One endpoint opens a checkout and it is the only way a build is sold, so
 * every failure here is a failure nobody else catches. The body it puts on the
 * wire decides what a card is charged, where a buyer lands afterwards, what the
 * subscription is called in a year, and whether the project the webhook opens
 * records the figure or the floor.
 *
 * So the body is built and read field by field rather than trusted. The figures
 * are held to the floor module, the return address is held to the key it is
 * supposed to carry, and the quote is followed from the override through the
 * session metadata to the arguments the project is opened with.
 *
 * The endpoint is also the one place on the site that takes a price from its
 * caller, so the cases below run it as an admin and as a signed-in client, and
 * the client has to be refused before Stripe is reached at all.
 *
 *   npm run check:payment-link
 */

import { cases, check, finish, same } from '../harness/checks.js'

// Read before the endpoint is imported: it fixes these at module load, so a
// product id or a site URL named afterwards would not reach the body under
// test.
process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key'
process.env.STRIPE_PRODUCT_BUILD = 'prod_build_test'
process.env.STRIPE_PRODUCT_CARE = 'prod_care_test'
process.env.SITE_URL = 'https://www.taylorurl.com'

// The db client fixes these at module load and answers 503 without them, so an
// authorised path cannot be reached at all unless they name something first.
// Nothing here reaches a real project: every request the endpoint makes is
// answered by the stub below.
process.env.SUPABASE_URL = 'https://project.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_not_a_real_key'
process.env.SUPABASE_ANON_KEY = 'anon_not_a_real_key'

const { default: linkHandler, linkFields, quotedCents } = await import('../../api/checkout-link.js')
const { mintedHere, openArgs } = await import('../../api/stripe-webhook.js')
const { BUILD_PRICE_CENTS, MONTHLY_PRICE_CENTS } =
  await import('../../src/app/data/checkout/pricing.js')
const { claimHolds } = await import('../../lib/stripe/claim.js')

const BUYER = 'prospect@example.com'
const BUSINESS = 'Lawton Park'
const WEBSITE = 'https://lawtonpark.example'

/** The same buyer, through the endpoint a link is opened from, nothing quoted. */
function bodyFromLink(overrides = {}) {
  return linkFields({
    email: BUYER,
    business: BUSINESS,
    website: WEBSITE,
    buildCents: BUILD_PRICE_CENTS,
    monthlyCents: MONTHLY_PRICE_CENTS,
    quotedBy: 'trenton@taylorurl.com',
    quotedAt: '2026-09-04T00:00:00.000Z',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  })
}

/**
 * What a link must never claim.
 *
 * Nobody ticks anything on a link handed over in an email, so a session stamped
 * with an agreement would be recording one that was never given, which is worse
 * than recording none. A code field is the same shape of fault: a link already
 * carries a figure somebody quoted on purpose, and a code applied on top of it
 * is a discount nobody agreed to and a total that can land under the floor the
 * endpoint refuses to quote beneath.
 */
const NEVER_ON_A_LINK = [
  'metadata[terms_agreed_at]',
  'subscription_data[metadata][terms_agreed_at]',
  'allow_promotion_codes',
]

check('a link claims no agreement and opens no discount', () => {
  const link = bodyFromLink()
  for (const key of NEVER_ON_A_LINK) {
    same(link.get(key), null, `${key}, which a link cannot honestly claim`)
  }
})

check('a link with nothing quoted charges the two figures the floor holds', () => {
  const link = bodyFromLink()
  same(
    link.get('line_items[0][price_data][unit_amount]'),
    String(BUILD_PRICE_CENTS),
    'the build, in cents'
  )
  same(
    link.get('line_items[1][price_data][unit_amount]'),
    String(MONTHLY_PRICE_CENTS),
    'the monthly, in cents'
  )
})

check('a paid buyer lands on the screen that signs them in, and a lapsed one can write in', () => {
  const link = bodyFromLink()
  same(new URL(link.get('success_url')).pathname, '/welcome', 'where a paid checkout returns to')
  same(new URL(link.get('cancel_url')).pathname, '/contact', 'where an abandoned one returns to')
  same(link.get('mode'), 'subscription', 'the mode that opens the monthly with the build')
})

/**
 * The key is a fresh secret on every checkout.
 *
 * The token goes out in the return address and only its hash is left on the
 * session, which is what stops the session id - a string that rides back in the
 * address bar and gets pasted into support threads - from being enough to sign
 * anybody in. So the pair is checked for the property that matters rather than
 * against a fixed string.
 */
check('a checkout hands the buyer a key the session alone cannot forge', () => {
  const faults = []
  const body = bodyFromLink()
  const carried = new URL(body.get('success_url')).searchParams.get('claim')
  if (!carried) faults.push('a link sends a buyer back with no key')
  else if (!claimHolds(body.get('metadata[claim]'), carried)) {
    faults.push('a link leaves a hash on the session that does not know its own key')
  }
  // The session must carry the hash and never the token, or anything that can
  // read the session can mint a sign-in from it.
  if (body.get('metadata[claim]') === carried) faults.push('a link put the key on the session')
  if (faults.length) throw new Error(faults.join('; '))
})

check('the buyer address is prefilled, so the receipt and the build agree', () => {
  same(bodyFromLink().get('customer_email'), BUYER, 'the address the link was opened for')
})

check('a quote rides on the subscription, not just the session', () => {
  const link = bodyFromLink({ buildCents: 180000 })
  same(
    link.get('subscription_data[metadata][build_cents]'),
    '180000',
    'the build, on the year-old object'
  )
  same(
    link.get('subscription_data[metadata][quoted_by]'),
    'trenton@taylorurl.com',
    'who agreed to it'
  )
  same(link.get('subscription_data[metadata][quoted_at]'), '2026-09-04T00:00:00.000Z', 'when')
  same(link.get('line_items[0][price_data][unit_amount]'), '180000', 'the figure actually charged')
})

check('an ordinary sale claims nobody negotiated it', () => {
  const link = bodyFromLink()
  same(link.get('metadata[quoted_by]'), null, 'no quoter on a checkout written at the floor')
  same(link.get('metadata[quoted_at]'), null, 'no quote date either')
})

check('an absent override is the floor', () => {
  same(quotedCents(undefined, floor(BUILD_PRICE_CENTS)).cents, BUILD_PRICE_CENTS, 'the build floor')
  same(quotedCents(undefined, floor(BUILD_PRICE_CENTS)).quoted, false, 'not a quote')
  same(
    quotedCents(null, floor(MONTHLY_PRICE_CENTS)).cents,
    MONTHLY_PRICE_CENTS,
    'the monthly floor'
  )
})

check('an override below the floor is refused', () => {
  const under = quotedCents(100, floor(BUILD_PRICE_CENTS))
  same(Boolean(under.error), true, 'a dollar for a thousand dollar build')
  same(
    quotedCents(BUILD_PRICE_CENTS - 1, floor(BUILD_PRICE_CENTS)).cents,
    undefined,
    'a cent under'
  )
})

check('the floor itself is accepted and is stated rather than defaulted', () => {
  const exact = quotedCents(BUILD_PRICE_CENTS, floor(BUILD_PRICE_CENTS))
  same(exact.cents, BUILD_PRICE_CENTS, 'the floor, stated outright')
  same(exact.quoted, true, 'stated rather than defaulted')
})

check('an override that is not whole cents is refused', () => {
  same(Boolean(quotedCents(180000.5, floor(BUILD_PRICE_CENTS)).error), true, 'part of a cent')
  same(Boolean(quotedCents('180000', floor(BUILD_PRICE_CENTS)).error), true, 'cents as a string')
  same(Boolean(quotedCents(Number.NaN, floor(BUILD_PRICE_CENTS)).error), true, 'not a number')
})

check('an override past the ceiling is refused, which is the zero typed twice', () => {
  same(Boolean(quotedCents(180000000, floor(BUILD_PRICE_CENTS)).error), true, 'eighteen million')
})

check('a session says what it charged and the project records that', () => {
  const quoted = openArgs(
    { id: 'cs_1', mode: 'subscription', metadata: { build_cents: '180000' } },
    BUYER
  )
  same(quoted.p_deposit_cents, 180000, 'the build that was actually agreed')
})

check('a session that says nothing is the floor, as it always was', () => {
  const plain = openArgs({ id: 'cs_2', mode: 'subscription' }, BUYER)
  same(plain.p_deposit_cents, BUILD_PRICE_CENTS, 'every checkout opened before any of this')
})

check('a session saying something unusable falls back rather than guessing', () => {
  for (const written of ['', 'lots', '12.5', '-100', null]) {
    const args = openArgs(
      { id: 'cs_3', mode: 'subscription', metadata: { build_cents: written } },
      BUYER
    )
    same(args.p_deposit_cents, BUILD_PRICE_CENTS, `a build_cents of ${JSON.stringify(written)}`)
  }
})

/**
 * A session as Stripe delivers one, with whatever a case cares about set on it.
 *
 * The defaults are a client site's own checkout, because that is the shape the
 * webhook has to refuse and the shape nothing else in this suite produces.
 */
function delivered(overrides = {}) {
  return {
    id: 'cs_live_someone_elses',
    mode: 'payment',
    amount_total: 17016,
    payment_status: 'paid',
    customer_details: { email: 'ticket-buyer@example.com' },
    metadata: { total_quantity: '1' },
    on_behalf_of: 'acct_a_client_of_ours',
    transfer_data: { destination: 'acct_a_client_of_ours' },
    ...overrides,
  }
}

check('a checkout this site opened is recognised as one', () => {
  const link = bodyFromLink()
  same(
    mintedHere({ id: 'cs_ours', metadata: { claim: link.get('metadata[claim]') } }),
    true,
    'our own session'
  )
})

check('a client site selling its own goods through the account is not a build', () => {
  same(mintedHere(delivered()), false, 'go-kart tickets, paid, on this account')
})

check('a sale that pays out to another account is refused even carrying a key', () => {
  const link = bodyFromLink()
  const routed = delivered({ metadata: { claim: link.get('metadata[claim]') } })
  same(mintedHere(routed), false, 'a key on a session that pays somebody else')
})

check('a session with no key of ours is refused however ordinary it looks', () => {
  for (const claim of [undefined, '', null, 'not-a-hash', 'a'.repeat(63), 'A'.repeat(64)]) {
    const plain = delivered({ metadata: { claim }, on_behalf_of: null, transfer_data: null })
    same(mintedHere(plain), false, `a claim of ${JSON.stringify(claim)}`)
  }
})

/** A successful answer carrying `payload`, from any service the endpoint reaches. */
const answer = payload => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  text: async () => JSON.stringify(payload),
  json: async () => payload,
})

/** A response for the endpoint to answer into, and the status and body it sent. */
function recorder() {
  const sent = { status: null, body: null }
  const response = {
    setHeader() {},
    status(code) {
      sent.status = code
      return this
    },
    json(payload) {
      sent.body = payload
      return this
    },
  }
  return { sent, response }
}

/**
 * The endpoint run as an admin, with everything it talks to answered here.
 *
 * The session it would open, the account it checks, and the role behind that
 * account are all stubbed, so what is being tested is this endpoint's own
 * decisions and nothing else. Every request is recorded, which is what lets a
 * case assert that Stripe was never reached.
 */
async function runAsAdmin(body) {
  const original = globalThis.fetch
  const asked = []

  globalThis.fetch = async input => {
    const url = String(input)
    asked.push(url)

    // Who is asking. The endpoint hands the bearer token straight to the auth
    // server, and this is the account it comes back as.
    if (url.includes('/auth/v1/user')) {
      return answer({
        id: '00000000-0000-4000-8000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'trenton@taylorurl.com',
      })
    }
    // The role that account holds, which is what admits it.
    if (url.includes('/rest/v1/profiles')) return answer({ role: 'admin' })
    if (url.includes('api.stripe.com')) {
      return answer({ id: 'cs_test_link', url: 'https://checkout.stripe.com/c/pay/cs_test_link' })
    }
    throw new Error(`the endpoint reached somewhere unexpected: ${url}`)
  }

  const { sent, response } = recorder()

  try {
    await linkHandler(
      { method: 'POST', headers: { authorization: 'Bearer a-session-token' }, body },
      response
    )
  } finally {
    globalThis.fetch = original
  }

  return { ...sent, asked, reachedStripe: asked.some(url => url.includes('api.stripe.com')) }
}

check('a preview says what it would charge and creates nothing', async () => {
  const run = await runAsAdmin({
    email: BUYER,
    business_name: BUSINESS,
    preview: true,
    build_cents: 180000,
  })
  same(run.status, 200, 'the status a preview answers with')
  same(run.reachedStripe, false, 'whether a preview reached Stripe')
  same(run.body.build_cents, 180000, 'the build it would charge')
  same(run.body.monthly_cents, MONTHLY_PRICE_CENTS, 'the monthly it would charge')
  same(run.body.build_quoted, true, 'the build as a quote')
  same(run.body.monthly_quoted, false, 'the monthly left at the floor')
  same(run.body.url, undefined, 'a preview hands back no link')
})

check('a preview of an ordinary sale is the two figures the floor holds', async () => {
  const run = await runAsAdmin({ email: BUYER, business_name: BUSINESS, preview: true })
  same(run.body.build_cents, BUILD_PRICE_CENTS, 'the build it would charge')
  same(run.body.monthly_cents, MONTHLY_PRICE_CENTS, 'the monthly it would charge')
  same(run.body.build_quoted, false, 'nothing quoted')
})

check('a confirmed run opens the session and hands back the link', async () => {
  const run = await runAsAdmin({ email: BUYER, business_name: BUSINESS, build_cents: 180000 })
  same(run.status, 200, 'the status a created link answers with')
  same(run.reachedStripe, true, 'whether Stripe was reached')
  same(run.body.url, 'https://checkout.stripe.com/c/pay/cs_test_link', 'the link handed back')
  same(run.body.build_cents, 180000, 'the build it charged')
})

check('a caller with no admin role is refused before anything is priced', async () => {
  const original = globalThis.fetch
  let reachedStripe = false
  globalThis.fetch = async input => {
    const url = String(input)
    if (url.includes('/auth/v1/user')) {
      return answer({
        id: '00000000-0000-4000-8000-000000000002',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'someone@example.com',
      })
    }
    if (url.includes('/rest/v1/profiles')) return answer({ role: 'client' })
    if (url.includes('api.stripe.com')) reachedStripe = true
    return answer({})
  }

  const { sent, response } = recorder()

  try {
    await linkHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer a-client-session' },
        body: { email: BUYER, build_cents: 100 },
      },
      response
    )
  } finally {
    globalThis.fetch = original
  }

  same(sent.status, 403, 'a signed-in client asking for a checkout at their own price')
  same(reachedStripe, false, 'whether a refused caller reached Stripe')
})

check('a link expires inside the day Stripe allows', () => {
  const now = Math.floor(Date.now() / 1000)
  const expires = Number(bodyFromLink({ expiresAt: now + 24 * 60 * 60 - 300 }).get('expires_at'))
  same(expires > now, true, 'an expiry in the future')
  same(expires - now <= 24 * 60 * 60, true, 'an expiry inside the twenty four hours Stripe permits')
})

/** The bounds one figure is read against. Named here so the cases stay short. */
function floor(cents) {
  return { floor: cents, ceiling: cents * 50, what: 'build' }
}

await finish()

console.log(
  `payment link: all ${cases.length} cases pass; a link with nothing quoted charges the floor`
)
