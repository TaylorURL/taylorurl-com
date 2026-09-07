/**
 * Proves that a payment becomes a project only when Stripe is the one saying
 * so, and that the figure charged is the figure the site advertises.
 *
 * Both halves fail silently if they are wrong, and both fail expensively. The
 * signature is the entire security of an endpoint that opens paid work on a
 * stranger's say-so: a check that accepts anything lets anybody open projects
 * that were never bought, and one that accepts nothing loses a real customer's
 * build between their card being charged and anybody knowing about it.
 *
 * The price is the other one. It is written twice - once as the words on the
 * page, once as the number the card reader takes - and nothing but this holds
 * them together. A page saying one figure while the charge is another is not a
 * bug anybody notices before it has happened to somebody.
 *
 *   npm run check:checkout
 */
import { createHmac } from 'node:crypto'
import { openArgs, signed } from '../../api/stripe-webhook.js'
import {
  BUILD_PRICE,
  BUILD_PRICE_CENTS,
  MONTHLY_PRICE,
  MONTHLY_PRICE_CENTS,
} from '../../src/app/data/checkout/pricing.js'

const SECRET = 'whsec_this_is_not_a_real_secret_it_is_a_test'

/** A Stripe signature header over exactly these bytes, as Stripe sends one. */
function sign(body, { stamp = Math.floor(Date.now() / 1000), secret = SECRET, extra = [] } = {}) {
  const mac = createHmac('sha256', secret).update(`${stamp}.${body}`).digest('hex')
  return [`t=${stamp}`, ...extra.map(one => `v1=${one}`), `v1=${mac}`].join(',')
}

/** The figure a page prints, read back as cents. */
function centsOf(printed) {
  return Math.round(Number(printed.replace(/[^0-9.]/g, '')) * 100)
}

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`)
}

const BODY = JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } })

check('a body Stripe signed is admitted', () => {
  same(signed(sign(BODY), BODY, SECRET), true, 'a good signature')
})

check('a body changed after signing is refused', () => {
  const header = sign(BODY)
  same(signed(header, `${BODY} `, SECRET), false, 'a tampered body')
})

check('a signature made with another secret is refused', () => {
  same(signed(sign(BODY, { secret: 'whsec_someone_elses' }), BODY, SECRET), false, 'a wrong key')
})

check('an old signature is refused however well it is made', () => {
  const stale = Math.floor(Date.now() / 1000) - 3600
  same(signed(sign(BODY, { stamp: stale }), BODY, SECRET), false, 'an hour-old request')
})

check('a request carrying no signature at all is refused', () => {
  same(signed(undefined, BODY, SECRET), false, 'no header')
  same(signed('', BODY, SECRET), false, 'an empty header')
  same(signed('t=123', BODY, SECRET), false, 'a header with no signature in it')
})

check('an endpoint with no secret configured admits nothing', () => {
  same(signed(sign(BODY), BODY, ''), false, 'no secret')
})

check('a secret mid-rotation is admitted on either key', () => {
  // Stripe sends every live signature during a rotation, so the one this
  // endpoint holds arrives beside one it has never seen.
  const header = sign(BODY, { extra: ['0'.repeat(64)] })
  same(signed(header, BODY, SECRET), true, 'the key we hold, beside one we do not')
})

check('a subscription session records the build, not the total it charged', () => {
  const session = {
    id: 'cs_test_1',
    mode: 'subscription',
    amount_total: BUILD_PRICE_CENTS + MONTHLY_PRICE_CENTS,
    subscription: 'sub_1',
    customer: 'cus_1',
  }
  const args = openArgs(session, 'buyer@example.com')
  same(args.p_deposit_cents, BUILD_PRICE_CENTS, 'the deposit is the build alone')
  same(args.p_session, 'cs_test_1', 'the session is what a repeat delivery is refused on')
  same(args.p_subscription, 'sub_1', 'the subscription is recorded as the project opens')
  same(args.p_payment_intent, null, 'a subscription session carries no payment intent')
})

check('a payment session passes its total only when Stripe named one', () => {
  const withTotal = openArgs({ amount_total: 100000 }, 'buyer@example.com')
  same(withTotal.p_deposit_cents, 100000, 'a session carrying a total')

  const without = openArgs({}, 'buyer@example.com')
  same('p_deposit_cents' in without, false, 'a session carrying no total')
})

check('the payment and customer are read whether expanded or not', () => {
  const asIds = openArgs(
    { payment_intent: 'pi_1', customer: 'cus_1', subscription: 'sub_1' },
    'buyer@example.com'
  )
  same(asIds.p_payment_intent, 'pi_1', 'a payment sent as an id')
  same(asIds.p_customer, 'cus_1', 'a customer sent as an id')
  same(asIds.p_subscription, 'sub_1', 'a subscription sent as an id')

  const asObjects = openArgs(
    { payment_intent: { id: 'pi_2' }, customer: { id: 'cus_2' }, subscription: { id: 'sub_2' } },
    'buyer@example.com'
  )
  same(asObjects.p_payment_intent, 'pi_2', 'a payment sent expanded')
  same(asObjects.p_customer, 'cus_2', 'a customer sent expanded')
  same(asObjects.p_subscription, 'sub_2', 'a subscription sent expanded')
})

check('the charge is the figure the site prints', () => {
  same(BUILD_PRICE_CENTS, centsOf(BUILD_PRICE), `${BUILD_PRICE} up front`)
  same(MONTHLY_PRICE_CENTS, centsOf(MONTHLY_PRICE), `${MONTHLY_PRICE} a month`)
})

const failures = []
for (const [name, run] of cases) {
  try {
    run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const line of failures) console.error(line)
  console.error(`checkout: ${failures.length} of ${cases.length} cases failed`)
  process.exit(1)
}

console.log(
  `checkout: all ${cases.length} cases pass; ${BUILD_PRICE} charged as ${BUILD_PRICE_CENTS} cents`
)
