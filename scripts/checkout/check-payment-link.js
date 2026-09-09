/**
 * Proves that a link opened by hand sells the same thing the pricing page
 * sells, and that a link opened against a quote records what it charged.
 *
 * Two endpoints now open a checkout, and they will drift. Somebody changes how
 * the pricing page's checkout collects an address, or which payment methods it
 * offers, or where it sends a buyer afterwards, and the other one keeps doing
 * what it did. The failure is invisible from either file: both work, both take
 * money, and the difference only shows up as one customer out of thirty
 * landing somewhere nobody meant them to.
 *
 * So this does not read the two files and compare them by eye. It runs the
 * pricing page's checkout against a stubbed Stripe, catches the exact body it
 * puts on the wire, and holds it beside the body the other endpoint builds for
 * the same buyer with nothing overridden. Every field has to match. The only
 * additions allowed are the ones this file names, and a new one appearing on
 * either side fails the suite until somebody says which it is.
 *
 * The brief is the one intended difference. A buyer off the pricing page has
 * answered six screens by the time they reach Stripe; a prospect handed a link
 * in an email has answered nothing, and a checkout without a brief is a case
 * the pricing page's own endpoint already handles. Both bodies here carry no
 * brief, which is what makes them comparable.
 *
 *   npm run check:payment-link
 */

// Read before either endpoint is imported: both fix these at module load, and
// a product id or a site URL differing between the two would show up as a
// difference in the bodies that has nothing to do with either file.
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

const { default: startCheckout } = await import('../../api/checkout.js')
const { default: linkHandler, linkFields, quotedCents } = await import('../../api/checkout-link.js')
const { openArgs } = await import('../../api/stripe-webhook.js')
const { BUILD_PRICE_CENTS, MONTHLY_PRICE_CENTS } =
  await import('../../src/app/data/checkout/pricing.js')
const { claimHolds } = await import('../../lib/stripe/claim.js')

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`)
}

const BUYER = 'prospect@example.com'
const BUSINESS = 'Lawton Park'
const WEBSITE = 'https://lawtonpark.example'

/**
 * What the pricing page's checkout actually sends Stripe for this buyer.
 *
 * The endpoint is run rather than read. Stripe is replaced for the duration by
 * something that keeps the body and answers the way Stripe answers, so what
 * comes back is the bytes a real buyer's checkout would have been opened with.
 */
async function bodyFromStart() {
  const original = globalThis.fetch
  let sent = null
  // The endpoint reaches the database as well as Stripe - it stores the brief
  // and stamps the lead the address belongs to - so the stub answers both and
  // keeps the body of the one this is about. A stub that captured whatever went
  // out last would be testing whichever call happened to be written last.
  globalThis.fetch = async (url, options) => {
    const stripe = String(url).includes('api.stripe.com')
    if (stripe) sent = options.body
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '[]',
      json: async () =>
        stripe ? { id: 'cs_test_start', url: 'https://checkout.stripe.com/c/pay/cs_test' } : [],
    }
  }

  const response = {
    setHeader() {},
    status() {
      return this
    },
    json() {
      return this
    },
  }

  try {
    await startCheckout(
      {
        method: 'POST',
        body: {
          email: BUYER,
          business_name: BUSINESS,
          website: WEBSITE,
          // The endpoint refuses a checkout that carries no agreement, so a
          // body caught without this would be no body at all.
          terms_accepted: true,
        },
      },
      response
    )
  } finally {
    globalThis.fetch = original
  }

  if (!sent) throw new Error('the pricing page checkout sent nothing to Stripe')
  return sent
}

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
 * What a link may carry that the pricing page's checkout does not.
 *
 * The figures, because a subscription session's total cannot be taken apart
 * afterwards and the project has to record what the card was charged. The
 * expiry, because a link is handed to somebody rather than clicked on the spot.
 * Nothing else, and nothing here changes what is charged or where the buyer
 * ends up.
 */
const ALLOWED_EXTRA = new Set([
  'metadata[build_cents]',
  'metadata[monthly_cents]',
  'subscription_data[metadata][build_cents]',
  'subscription_data[metadata][monthly_cents]',
  'expires_at',
])

/**
 * What the pricing page's checkout carries that a link must not.
 *
 * A buyer off the pricing page ticked the terms on the page before anything
 * opened, and the moment they did is written onto the session. Nobody ticks
 * anything on a link handed over in an email, so a link stamped the same way
 * would be recording an agreement that was never given, which is worse than
 * recording none.
 *
 * The code field is the same shape of difference. The pricing page charges the
 * figures `pricing.js` holds and a code is the only way any of them moves; a
 * link already carries a figure somebody quoted on purpose, and a code applied
 * on top of a negotiated price is a discount nobody agreed to and a total that
 * can land under the floor the endpoint refuses to quote beneath.
 */
const ONLY_ON_START = new Set([
  'metadata[terms_agreed_at]',
  'subscription_data[metadata][terms_agreed_at]',
  'allow_promotion_codes',
])

/**
 * The two fields that are a fresh secret on every checkout.
 *
 * Each session is opened with its own one-use key: the token goes out in the
 * return address and only its hash is left on the session, which is what stops
 * the session id - a string that rides back in the address bar and gets pasted
 * into support threads - from being enough to sign anybody in. Two checkouts
 * therefore differ in these two fields by design, and comparing them as strings
 * would fail for the one reason that is not a drift.
 *
 * So they are held to each other with the key normalised out, and the key
 * itself is checked for the property that matters: that the token in the
 * address is the one the hash on the session recognises, on both endpoints.
 */
const MINTED_PER_CHECKOUT = new Set(['metadata[claim]', 'success_url'])

/** A return address with whichever key it happens to carry taken out. */
const lessKey = url => String(url).replace(/([?&]claim=)[^&]*/, '$1')

const started = await bodyFromStart()

check('a link with nothing quoted sends what the pricing page sends', () => {
  const link = bodyFromLink()
  for (const [key, value] of started.entries()) {
    if (ONLY_ON_START.has(key) || MINTED_PER_CHECKOUT.has(key)) continue
    same(link.get(key), value, `${key}, which the pricing page sends`)
  }
})

check('the agreement and the code field belong to the pricing page alone', () => {
  const link = bodyFromLink()
  for (const key of ONLY_ON_START) {
    same(Boolean(started.get(key)), true, `${key}, which the pricing page sends`)
    same(link.get(key), null, `${key}, which a link cannot honestly claim`)
  }
})

check('a link adds nothing to the checkout but the figures and the expiry', () => {
  const link = bodyFromLink()
  const extra = [...link.keys()].filter(key => !started.has(key) && !ALLOWED_EXTRA.has(key))
  same(extra.join(', ') || 'none', 'none', 'fields only the link sends')
})

check('a link with nothing quoted charges the two published figures', () => {
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

check('a buyer off a link lands where a buyer off the pricing page lands', () => {
  const link = bodyFromLink()
  same(
    lessKey(link.get('success_url')),
    lessKey(started.get('success_url')),
    'where a paid checkout returns to'
  )
  same(link.get('cancel_url'), started.get('cancel_url'), 'where an abandoned one returns to')
  same(link.get('mode'), 'subscription', 'the mode that opens the monthly with the build')
})

check('both checkouts hand the buyer a key the session alone cannot forge', () => {
  const faults = []
  for (const [what, body] of [
    ['the pricing page', started],
    ['a link', bodyFromLink()],
  ]) {
    const carried = new URL(body.get('success_url')).searchParams.get('claim')
    if (!carried) faults.push(`${what} sends a buyer back with no key`)
    else if (!claimHolds(body.get('metadata[claim]'), carried)) {
      faults.push(`${what} leaves a hash on the session that does not know its own key`)
    }
    // The session must carry the hash and never the token, or anything that can
    // read the session can mint a sign-in from it.
    if (body.get('metadata[claim]') === carried) faults.push(`${what} put the key on the session`)
  }
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
  same(link.get('metadata[quoted_by]'), null, 'no quoter on a checkout at the published price')
  same(link.get('metadata[quoted_at]'), null, 'no quote date either')
})

check('an absent override is the published figure', () => {
  same(quotedCents(undefined, floor(BUILD_PRICE_CENTS)).cents, BUILD_PRICE_CENTS, 'the build floor')
  same(quotedCents(undefined, floor(BUILD_PRICE_CENTS)).quoted, false, 'not a quote')
  same(
    quotedCents(null, floor(MONTHLY_PRICE_CENTS)).cents,
    MONTHLY_PRICE_CENTS,
    'the monthly floor'
  )
})

check('an override below the published figure is refused', () => {
  const under = quotedCents(100, floor(BUILD_PRICE_CENTS))
  same(Boolean(under.error), true, 'a dollar for a thousand dollar build')
  same(
    quotedCents(BUILD_PRICE_CENTS - 1, floor(BUILD_PRICE_CENTS)).cents,
    undefined,
    'a cent under'
  )
})

check('the published figure itself is accepted and is not a quote', () => {
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

check('a session that says nothing is the published figure, as it always was', () => {
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
    const answer = payload => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    })

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
  same(run.body.monthly_quoted, false, 'the monthly left at the published figure')
  same(run.body.url, undefined, 'a preview hands back no link')
})

check('a preview of an ordinary sale is the two published figures', async () => {
  const run = await runAsAdmin({ email: BUYER, business_name: BUSINESS, preview: true })
  same(run.body.build_cents, BUILD_PRICE_CENTS, 'the build the pricing page prints')
  same(run.body.monthly_cents, MONTHLY_PRICE_CENTS, 'the monthly the pricing page prints')
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
    const answer = payload => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    })
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

const failures = []
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const line of failures) console.error(line)
  console.error(`payment link: ${failures.length} of ${cases.length} cases failed`)
  process.exit(1)
}

console.log(
  `payment link: all ${cases.length} cases pass; a link with nothing quoted sends what /start sends`
)
