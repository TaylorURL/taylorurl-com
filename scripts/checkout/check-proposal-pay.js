/**
 * Proves that a proposal's pay page charges the sheet and nothing else.
 *
 * The page is public and takes no sign-in, so the endpoint behind it is a door
 * anybody can push on. What it must hold is narrow: every price comes off the
 * saved profile, the only choice a request makes is which of the profile's own
 * add-ons to take, and a profile that is paid or past its date opens nothing.
 * The cases below push on each of those with Stripe and the database answered
 * here, and fail if Stripe is reached when it should not have been.
 *
 * The figures are held to the sheet the `/proposal` skill printed for
 * Southbelt: $2,500 for the site, $0 for the inventory system, the $250 Monthly
 * Fee, a first year of $5,500 and $3,000 each year after. The page has to say
 * what the paper in their hand says.
 *
 * The other half is what Stripe's checkout cannot do: one subscription at two
 * intervals. A quarterly add-on beside the monthly fee is charged its first
 * quarter at the checkout and opened as its own subscription by the webhook,
 * and the cases follow it through to the subscription that is opened, once.
 *
 *   npm run check:proposal-pay
 */

import { cases, check, finish, ok, same } from '../harness/checks.js'

process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key'
process.env.SITE_URL = 'https://www.taylorurl.com'
process.env.SUPABASE_URL = 'https://project.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_not_a_real_key'
process.env.SUPABASE_ANON_KEY = 'anon_not_a_real_key'

const { centsOf, checkoutPlan, linesOf, picked, totals } =
  await import('../../src/app/data/checkout/proposal.js')
const { default: payHandler, proposalFields, stateOf } = await import('../../api/proposal.js')
const { anchorAfter, laterLines, settleProposal } = await import('../../lib/stripe/proposal.js')
const { productId } = await import('../../lib/stripe/catalogue.js')
const { purchaseNotice, purchaseOf, openArgs } = await import('../../api/stripe-webhook.js')
const { claimHolds, mintClaim } = await import('../../lib/stripe/claim.js')

const KEY = 'AbCdEfGhIjKlMnOpQrStUvWx'
const PROFILE_ID = '00000000-0000-4000-8000-0000000000aa'

/** The Southbelt sheet, as the skill saves it. */
const ITEMS = [
  { name: 'Website Design', price: 2500, per: 'once' },
  { name: 'Inventory SaaS', price: 0 },
  { name: 'Monthly Fee', price: 250, per: 'month', extra: 'Hosting, domain and maintenance' },
]
const ADDONS = [
  {
    name: 'Google / Facebook Ads Setup & Management',
    price: 1000,
    per: 'quarter',
    extra: 'Not counting ad spend',
  },
  { name: 'Company Email Management & Spam Filtering', price: 25, per: 'month' },
  { name: 'Cold Outreach', price: 25, per: 'month' },
  { name: 'Email Marketing', price: 25, per: 'month' },
  { name: 'Lead Generation', price: 25, per: 'month' },
  { name: 'AI Integration', price: 25, per: 'month', extra: 'Not counting AI usage' },
]
const ADS = ADDONS[0].name

function profile(overrides = {}) {
  return {
    id: PROFILE_ID,
    client: 'Southbelt Repair and Supply Inc.',
    items: ITEMS,
    addons: ADDONS,
    good_until: '2099-12-02',
    status: 'open',
    ...overrides,
  }
}

const items = linesOf(ITEMS)
const addons = linesOf(ADDONS)

check('a price is whole cents or it is refused', () => {
  same(centsOf(2500), 250000, 'the site')
  same(centsOf(12.5), 1250, 'a price with cents')
  same(centsOf(0), 0, 'no charge')
  for (const bad of [-1, 0.001, '25', Number.NaN, Infinity, 50000.01, null, undefined]) {
    same(centsOf(bad), null, `a price of ${String(bad)}`)
  }
})

check('one line that will not read refuses the whole list', () => {
  same(linesOf([...ITEMS, { name: 'Logo', price: '500' }]), null, 'a price as a string')
  same(linesOf([...ITEMS, { name: 'Logo', price: 500, per: 'weekly' }]), null, 'an unknown per')
  same(linesOf('not a list'), null, 'not a list')
})

check('the page totals the sheet the way the paper does', () => {
  const sums = totals(items)
  same(sums.today, 275000, 'due today: the site and the first month')
  same(sums.rows[0][0], 'First year', 'the first total')
  same(sums.rows[0][1], 550000, 'first year, as printed: $5,500')
  same(sums.rows[1][1], 300000, 'each year after, as printed: $3,000')
})

check('a ticked add-on moves the totals by its own price', () => {
  const sums = totals([...items, addons[0], addons[2]])
  same(sums.today, 275000 + 100000 + 2500, 'the first quarter of ads and a month of outreach')
  same(sums.rows[0][1], 550000 + 400000 + 30000, 'four quarters and twelve months on the year')
})

check('only the add-ons the sheet offered can be chosen', () => {
  same(picked(addons, undefined).lines.length, 0, 'nothing ticked')
  same(picked(addons, ['Cold Outreach']).lines[0].cents, 2500, 'the price on the profile')
  ok(picked(addons, ['Free Website']).error, 'a name the sheet never offered')
  ok(picked(addons, ['Cold Outreach', 'Cold Outreach']).error, 'one add-on twice')
  ok(picked(addons, [{ name: 'Cold Outreach', price: 0 }]).error, 'an add-on with its own price')
  ok(picked(addons, 'Cold Outreach').error, 'a name that is not in a list')
})

check(
  'a monthly fee and a quarterly add-on are paid for together without a second interval',
  () => {
    const plan = checkoutPlan([...items, addons[0], addons[2]])
    same(plan.mode, 'subscription', 'the Monthly Fee is a subscription')
    same(plan.base, 'month', 'the checkout subscription is monthly')
    const names = plan.now.map(({ line }) => line.name)
    ok(!names.includes('Inventory SaaS'), 'a $0 line is left off the checkout')
    const ads = plan.now.find(({ line }) => line.name === ADS)
    same(ads.recurring, null, 'the first quarter of ads is charged once at the checkout')
    same(plan.later.length, 1, 'and the ads alone are left to subscribe to')
    same(plan.later[0].name, ADS, 'the line that comes back quarterly')
    const intervals = new Set(
      plan.now
        .filter(({ recurring }) => recurring)
        .map(({ recurring }) => `${recurring.interval}/${recurring.count}`)
    )
    same(
      [...intervals].join(),
      'month/1',
      'one interval on the checkout, which is all Stripe takes'
    )
  }
)

check('a sheet with nothing recurring is a plain payment', () => {
  const plan = checkoutPlan(linesOf([{ name: 'Logo Design', price: 500, per: 'once' }]))
  same(plan.mode, 'payment', 'nothing to subscribe to')
  same(plan.later.length, 0, 'nothing left for later')
})

check('a profile past its date, or paid, is not open', () => {
  same(stateOf(profile(), '2026-11-02'), 'open', 'inside the month')
  same(stateOf(profile({ good_until: '2026-12-02' }), '2026-12-02'), 'open', 'the last good day')
  same(stateOf(profile({ good_until: '2026-12-02' }), '2026-12-03'), 'expired', 'the day after')
  same(stateOf(profile({ status: 'paid' }), '2026-11-02'), 'paid', 'already paid')
})

check('the checkout charges the profile’s figures and names each line as the sheet does', () => {
  const chosen = [addons[0], addons[2]]
  const plan = checkoutPlan([...items, ...chosen])
  const claim = mintClaim()
  const products = new Map(plan.now.map(({ line }) => [line.name, productId(line.name)]))
  const body = proposalFields({ profile: profile(), key: KEY, plan, products, chosen, claim })
  const lines = []
  for (let at = 0; body.has(`line_items[${at}][quantity]`); at += 1) {
    lines.push({
      product: body.get(`line_items[${at}][price_data][product]`),
      cents: body.get(`line_items[${at}][price_data][unit_amount]`),
      every: body.get(`line_items[${at}][price_data][recurring][interval]`),
    })
  }
  same(lines.length, 4, 'site, Monthly Fee, first quarter of ads, outreach')
  same(lines[0].product, 'proposal_website_design', 'the site, by name')
  same(lines[0].cents, '250000', 'at $2,500')
  same(lines[0].every, null, 'once')
  same(lines[1].product, 'proposal_monthly_fee', 'the fee, by name')
  same(lines[1].every, 'month', 'monthly')
  same(lines[2].product, 'proposal_google_facebook_ads_setup_and_management', 'the ads, by name')
  same(lines[2].every, null, 'their first quarter, once')
  same(body.get('metadata[build_cents]'), '250000', 'the build the project opens with')
  same(body.get('metadata[monthly_cents]'), '27500', 'the fee and the outreach, monthly')
  same(body.get('metadata[addons]'), `${ADS} | Cold Outreach`, 'what was ticked')
  same(
    JSON.parse(body.get('metadata[later]'))[0].cents,
    100000,
    'the ads, left for the webhook at $1,000 a quarter'
  )
  same(new URL(body.get('success_url')).pathname, '/welcome', 'a paid buyer is signed in')
  same(
    body.get('cancel_url'),
    `https://www.taylorurl.com/pay?p=${KEY}`,
    'a back button returns to the sheet'
  )
  ok(
    claimHolds(
      body.get('metadata[claim]'),
      new URL(body.get('success_url')).searchParams.get('claim')
    ),
    'the session holds the hash of the key the buyer carries back'
  )
})

/** A successful answer carrying `payload`. */
const answer = (payload, status = 200) => ({
  ok: status < 400,
  status,
  headers: new Headers({ 'content-type': 'application/json' }),
  text: async () => JSON.stringify(payload),
  json: async () => payload,
})

/** A response for the endpoint to answer into. */
function recorder() {
  const sent = { status: null, body: null }
  return {
    sent,
    response: {
      setHeader() {},
      status(code) {
        sent.status = code
        return this
      },
      json(payload) {
        sent.body = payload
        return this
      },
    },
  }
}

/**
 * The endpoint run with the database and Stripe answered here.
 *
 * Every request is recorded, with its body, so a case can say what reached
 * Stripe and what never did.
 */
async function run(request, { row = profile() } = {}) {
  const original = globalThis.fetch
  const asked = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    asked.push({ url, method: init.method || 'GET', body: init.body ? String(init.body) : '' })
    if (url.includes('/rest/v1/proposals')) return answer(row ? [row] : [])
    if (url.includes('api.stripe.com/v1/products/'))
      return answer({ error: { message: 'No such product' } }, 404)
    if (url.endsWith('api.stripe.com/v1/products')) return answer({ id: 'made' })
    if (url.includes('api.stripe.com/v1/checkout/sessions')) {
      return answer({ id: 'cs_test_pay', url: 'https://checkout.stripe.com/c/pay/cs_test_pay' })
    }
    throw new Error(`the endpoint reached somewhere unexpected: ${url}`)
  }
  const { sent, response } = recorder()
  try {
    await payHandler(
      {
        url: '/api/proposal',
        headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
        ...request,
      },
      response
    )
  } finally {
    globalThis.fetch = original
  }
  return { sent, asked, stripe: asked.filter(call => call.url.includes('api.stripe.com')) }
}

check('a key that is not the shape of one is refused before the database is asked', async () => {
  const { sent, asked } = await run({ method: 'GET', query: { p: 'short' } })
  same(sent.status, 404, 'a malformed key')
  same(asked.length, 0, 'nothing reached')
})

check(
  'a key reads the sheet as it stands, figures in cents and nothing inside the profile',
  async () => {
    const { sent } = await run({ method: 'GET', query: { p: KEY } })
    same(sent.status, 200, 'the sheet')
    same(sent.body.client, 'Southbelt Repair and Supply Inc.', 'who it is for')
    same(sent.body.items[0].cents, 250000, 'the site')
    same(sent.body.state, 'open', 'payable')
    same(sent.body.id, undefined, 'the profile id stays inside')
  }
)

check('a key nobody saved reads as no proposal', async () => {
  const { sent } = await run({ method: 'GET', query: { p: KEY } }, { row: null })
  same(sent.status, 404, 'no profile')
})

check('an add-on the sheet never offered opens nothing at Stripe', async () => {
  const { sent, stripe } = await run({ method: 'POST', body: { p: KEY, addons: ['Free Website'] } })
  same(sent.status, 400, 'refused')
  same(stripe.length, 0, 'Stripe never asked')
})

check('a price sent with the request changes nothing about the charge', async () => {
  const { sent, stripe } = await run({
    method: 'POST',
    body: {
      p: KEY,
      addons: ['Cold Outreach'],
      items: [{ name: 'Website Design', price: 1, per: 'once' }],
      price: 1,
    },
  })
  same(sent.status, 200, 'a checkout')
  const session = new URLSearchParams(
    stripe.find(call => call.url.includes('checkout/sessions')).body
  )
  same(
    session.get('line_items[0][price_data][unit_amount]'),
    '250000',
    'the site at the profile’s price'
  )
  same(sent.body.today, 275000 + 2500, 'due today, as the page shows it')
})

check('a paid proposal and an expired one open no checkout', async () => {
  const paid = await run({ method: 'POST', body: { p: KEY } }, { row: profile({ status: 'paid' }) })
  same(paid.sent.status, 409, 'paid')
  same(paid.stripe.length, 0, 'Stripe never asked for a paid proposal')
  const old = await run(
    { method: 'POST', body: { p: KEY } },
    { row: profile({ good_until: '2020-01-01' }) }
  )
  same(old.sent.status, 409, 'expired')
  same(old.stripe.length, 0, 'Stripe never asked for an expired one')
})

check('each line gets its own product the first time it is sold', async () => {
  const { stripe } = await run({ method: 'POST', body: { p: KEY, addons: [ADS] } })
  const made = stripe
    .filter(call => call.url.endsWith('/v1/products') && call.method === 'POST')
    .map(call => new URLSearchParams(call.body).get('id'))
    .sort()
  same(
    made.join(),
    [
      'proposal_google_facebook_ads_setup_and_management',
      'proposal_monthly_fee',
      'proposal_website_design',
    ].join(),
    'one product per line, named for it'
  )
})

check('a later subscription first bills one period on, on the same day of the month', () => {
  const from = new Date(Date.UTC(2026, 10, 30, 15, 0, 0))
  const quarter = new Date((anchorAfter('quarter', from) + 600) * 1000)
  same(
    quarter.toISOString().slice(0, 10),
    '2027-02-28',
    'November 30 plus a quarter, in a short month'
  )
  const year = new Date((anchorAfter('year', new Date(Date.UTC(2028, 1, 29, 12))) + 600) * 1000)
  same(year.toISOString().slice(0, 10), '2029-02-28', 'a leap day plus a year')
  ok(anchorAfter('quarter', from) < from.getTime() / 1000 + 92 * 86400, 'inside the first period')
})

check('later lines on a session are read back or refused whole', () => {
  same(laterLines({ metadata: {} }).length, 0, 'none')
  same(
    laterLines({ metadata: { later: '[{"name":"Ads","cents":100000,"per":"quarter"}]' } }).length,
    1,
    'one'
  )
  same(
    laterLines({ metadata: { later: '[{"name":"Ads","cents":100000,"per":"once"}]' } }),
    null,
    'a one-time line cannot recur'
  )
  same(laterLines({ metadata: { later: 'not json' } }), null, 'unreadable')
})

/** A paid proposal checkout, as Stripe delivers one. */
function paidSession(overrides = {}) {
  return {
    id: 'cs_test_paid',
    mode: 'subscription',
    customer: 'cus_test_buyer',
    subscription: 'sub_test_monthly',
    payment_status: 'paid',
    metadata: {
      proposal: PROFILE_ID,
      business_name: 'Southbelt Repair and Supply Inc.',
      addons: `${ADS} | Cold Outreach`,
      later: JSON.stringify([{ name: ADS, cents: 100000, per: 'quarter' }]),
      build_cents: '250000',
      monthly_cents: '27500',
    },
    ...overrides,
  }
}

/** The settling run with Stripe and a profile row answered here. */
async function settle(session, row) {
  const original = globalThis.fetch
  const asked = []
  const writes = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    asked.push({
      url,
      method: init.method || 'GET',
      body: init.body ? String(init.body) : '',
      headers: init.headers || {},
    })
    if (url.includes('/rest/v1/proposals')) {
      if ((init.method || 'GET') === 'PATCH') {
        writes.push(JSON.parse(String(init.body)))
        return answer(null, 204)
      }
      return answer(row ? [row] : [])
    }
    if (url.includes('/v1/subscriptions/sub_test_monthly')) {
      return answer({ id: 'sub_test_monthly', default_payment_method: 'pm_test_card' })
    }
    if (url.includes('/v1/products/')) return answer({ id: 'p', active: true, name: ADS })
    if (url.endsWith('/v1/subscriptions')) return answer({ id: 'sub_test_quarterly' })
    throw new Error(`settling reached somewhere unexpected: ${url}`)
  }
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  try {
    const result = await settleProposal(db, session, process.env.STRIPE_SECRET_KEY)
    return { result, asked, writes }
  } finally {
    globalThis.fetch = original
  }
}

check(
  'the quarterly ads become their own subscription on the same card, starting a quarter on',
  async () => {
    const { result, asked, writes } = await settle(paidSession(), {
      id: PROFILE_ID,
      paid_session: null,
      paid_later: null,
    })
    same(result.later?.join(), 'sub_test_quarterly', 'the subscription opened')
    const opened = asked.find(call => call.url.endsWith('/v1/subscriptions'))
    const body = new URLSearchParams(opened.body)
    same(body.get('customer'), 'cus_test_buyer', 'the buyer')
    same(body.get('default_payment_method'), 'pm_test_card', 'the card the checkout saved')
    same(
      body.get('proration_behavior'),
      'none',
      'nothing billed now: the first quarter was on the checkout'
    )
    same(body.get('items[0][price_data][unit_amount]'), '100000', '$1,000')
    same(body.get('items[0][price_data][recurring][interval]'), 'month', 'in months')
    same(body.get('items[0][price_data][recurring][interval_count]'), '3', 'three of them')
    ok(
      Number(body.get('billing_cycle_anchor')) > Date.now() / 1000 + 80 * 86400,
      'first billed about a quarter on'
    )
    same(
      opened.headers['Idempotency-Key'],
      'proposal-later-cs_test_paid-quarter',
      'a retry gets the same subscription'
    )
    same(writes[0].status, 'paid', 'the profile is marked paid')
    same(writes[0].paid_later.join(), 'sub_test_quarterly', 'with what was opened')
    same(writes[0].paid_addons.join(), `${ADS},Cold Outreach`, 'and what was ticked')
  }
)

check('a second delivery of the same payment opens nothing more', async () => {
  const { result, asked } = await settle(paidSession(), {
    id: PROFILE_ID,
    paid_session: 'cs_test_paid',
    paid_later: ['sub_test_quarterly'],
  })
  same(result.repeat, true, 'recognised as done')
  same(asked.filter(call => call.url.includes('api.stripe.com')).length, 0, 'Stripe never asked')
})

check('a checkout that came from no proposal is left alone', async () => {
  const { result, asked } = await settle({ id: 'cs_link', metadata: {} }, null)
  same(result.skipped, true, 'skipped')
  same(asked.length, 0, 'nothing reached')
})

check('the purchase notice says what was ticked and what bills quarterly', () => {
  const session = paidSession()
  const args = openArgs(session, 'owner@example.com')
  same(args.p_deposit_cents, 250000, 'the project opens with the build alone')
  const notice = purchaseNotice(purchaseOf(session, args))
  ok(notice.text.includes('Cold Outreach'), 'the add-on ticked')
  ok(notice.text.includes('$1,000.00 a quarter'), 'the ads, quarterly')
  ok(notice.text.includes('$275.00 a month'), 'the monthly: fee and outreach')
})

await finish({ hint: 'npm run check:proposal-pay' })

console.log(
  `proposal pay: all ${cases.length} cases pass; every figure charged is the one on the sheet`
)
