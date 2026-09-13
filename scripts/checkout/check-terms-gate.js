/**
 * Proves that nobody is charged without first agreeing to the terms, and that
 * reading them costs nobody the form they were filling in.
 *
 * The failure this is aimed at is a quiet one. A checkbox is the easiest thing
 * on a page to lose: a prop stops being passed, a validation branch is dropped
 * while somebody is rearranging the submit handler, and the form still works,
 * still opens Stripe, still takes the money. Nothing is red, and what is gone
 * is the only evidence that the buyer ever saw what they were signing. So the
 * gate is checked at both ends - the control that collects the agreement, and
 * the endpoint that refuses a checkout arriving without one - because either
 * alone is a gate somebody can walk around.
 *
 * The other half is smaller and just as easy to lose. A terms link that opens
 * in place walks a buyer off a form they have spent five screens filling in,
 * and what they come back to, if they come back, is an empty one. It opens in
 * a tab of its own, and this is what says so.
 *
 *   npm run check:terms-gate
 */

import { cases, check, finish, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

// Fixed before the endpoint is imported: it reads all of these at module load
// and answers 503 rather than opening anything without them.
process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key'
process.env.STRIPE_PRODUCT_BUILD = 'prod_build_test'
process.env.STRIPE_PRODUCT_CARE = 'prod_care_test'
process.env.SITE_URL = 'https://www.taylorurl.com'

const { default: checkout } = await import('../../api/checkout.js')

const PAY = 'src/app/views/start/steps/PaySection.jsx'
const START = 'src/app/views/start/Start.jsx'
const SENDER = 'src/app/data/checkout/startCheckout.js'

// The short checkout. It is a second form in front of the same endpoint, so
// every question this file asks of the configurator has to be asked of it too:
// a page that takes a card without collecting the agreement is exactly the hole
// the endpoint's refusal is there to close, and it would close it by failing a
// buyer at the last step rather than by never letting the page ship.
const DIRECT = 'src/app/views/start/Payment.jsx'

/**
 * One request through the real endpoint, with Stripe replaced.
 *
 * What comes back is what the buyer would have got and what Stripe would have
 * been sent, so a refusal can be told apart from a checkout that opened
 * quietly. Each case uses an address of its own: the endpoint counts attempts
 * per address, and a suite that shared one would start reading its own rate
 * limit as a refusal.
 */
async function opened(body) {
  const original = globalThis.fetch
  let sent = null
  globalThis.fetch = async (_url, options) => {
    sent = options.body
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'cs_test_terms', url: 'https://checkout.stripe.com/c/pay/cs_test' }),
    }
  }

  let status = 0
  let payload = null
  const response = {
    setHeader() {},
    status(code) {
      status = code
      return this
    },
    json(value) {
      payload = value
      return this
    },
  }

  try {
    await checkout({ method: 'POST', body }, response)
  } finally {
    globalThis.fetch = original
  }

  return { status, payload, sent }
}

check('a checkout that carries no agreement is refused before Stripe is reached', async () => {
  const run = await opened({ email: 'nobody@example.com', business_name: 'Lawton Park' })
  same(run.status, 400, 'the status a checkout with no agreement answers with')
  same(run.sent, null, 'what Stripe was sent')
  same(typeof run.payload?.error, 'string', 'the buyer is told why')
})

check('an agreement that is not one is refused too', async () => {
  const truthy = await opened({ email: 'truthy@example.com', terms_accepted: 'yes' })
  same(truthy.status, 400, 'the status a string of yes answers with')
  same(truthy.sent, null, 'what Stripe was sent for a string of yes')

  const refused = await opened({ email: 'refused@example.com', terms_accepted: false })
  same(refused.status, 400, 'the status an unticked box answers with')
  same(refused.sent, null, 'what Stripe was sent for an unticked box')
})

check('an agreed checkout opens and says when it was agreed', async () => {
  const run = await opened({
    email: 'buyer@example.com',
    business_name: 'Lawton Park',
    terms_accepted: true,
  })
  same(run.status, 200, 'the status an agreed checkout answers with')
  same(run.payload?.url, 'https://checkout.stripe.com/c/pay/cs_test', 'the page the buyer is sent')

  // On the session, which the webhook reads, and on the subscription, which is
  // the object still there in a year when somebody asks what was agreed to.
  const stamp = run.sent.get('metadata[terms_agreed_at]')
  same(
    Number.isFinite(Date.parse(stamp || '')),
    true,
    'the session carries a time the agreement was given'
  )
  same(
    run.sent.get('subscription_data[metadata][terms_agreed_at]'),
    stamp,
    'the subscription carries the same time'
  )
})

check('the time written down is the server clock, not one the buyer sent', async () => {
  const run = await opened({
    email: 'clock@example.com',
    terms_accepted: true,
    terms_agreed_at: '1999-01-01T00:00:00.000Z',
  })
  same(run.status, 200, 'the status a checkout with a supplied time answers with')
  same(
    run.sent.get('metadata[terms_agreed_at]').startsWith('1999'),
    false,
    'a time sent by the buyer is not the time written down'
  )
})

check('the payment form asks for the agreement', () => {
  const pay = read(PAY)
  same(pay.includes('id="start-terms"'), true, 'the form holds the agreement control')
  same(pay.includes('type="checkbox"'), true, 'the agreement is ticked rather than assumed')
  same(pay.includes('checked={agreed}'), true, 'the control shows what has been agreed')
  same(pay.includes('onChange={onAgree}'), true, 'ticking it reaches the flow')

  const start = read(START)
  same(start.includes('agreed={agreed}'), true, 'the flow hands the form what has been agreed')
  same(start.includes('onAgree={handleAgree}'), true, 'and takes the tick back')
})

check('the terms open in a tab of their own', () => {
  const pay = read(PAY)
  const link = pay.slice(pay.indexOf('to="/terms"'), pay.indexOf('Terms of Service'))
  same(link.length > 0, true, 'the agreement links to the terms')
  same(link.includes('target="_blank"'), true, 'the terms open in a new tab')
  same(link.includes('noopener'), true, 'the new tab cannot reach back at the page that opened it')
})

check('the flow refuses to pay without it', () => {
  const start = read(START)
  const buy = start.slice(start.indexOf('const handleBuySubmit'), start.indexOf('const steps ='))
  same(buy.includes('if (!agreed)'), true, 'the submit refuses an unagreed checkout')
  same(buy.includes('return'), true, 'the refusal stops rather than warns')
  same(buy.includes('termsAccepted: agreed'), true, 'the agreement travels with the payment')
  same(read(SENDER).includes('terms_accepted'), true, 'the sender posts it')
})

check('nothing ticks the box on the buyer behalf', () => {
  const start = read(START)
  same(
    start.includes('const [agreed, setAgreed] = useState(false)'),
    true,
    'the agreement starts unticked'
  )
  // The configurator writes its answers to session storage and reads them back
  // on the next visit. An agreement recalled that way is a box the site ticked
  // for somebody, which is not agreement.
  const written = start.indexOf('rememberStart({')
  const remembered = start.slice(written, start.indexOf('})', written))
  same(remembered.includes('agreed'), false, 'the agreement is not written to the store')
  same(read('src/app/views/start/lib/memory.js').includes('agreed'), false, 'nor read back from it')
})

check('the short checkout asks for the agreement too', () => {
  const direct = read(DIRECT)
  same(direct.includes('type="checkbox"'), true, 'the form holds an agreement control')
  same(direct.includes('checked={agreed}'), true, 'the control shows what has been agreed')
  same(
    direct.includes('const [agreed, setAgreed] = useState(false)'),
    true,
    'the agreement starts unticked'
  )
  same(direct.includes('termsAccepted: agreed'), true, 'the agreement travels with the payment')
  same(direct.includes('if (!agreed)'), true, 'the submit refuses an unagreed checkout')
})

check('the short checkout opens the terms in a tab of their own', () => {
  const direct = read(DIRECT)
  const link = direct.slice(direct.indexOf('to="/terms"'), direct.indexOf('Terms of Service'))
  same(link.length > 0, true, 'the agreement links to the terms')
  same(link.includes('target="_blank"'), true, 'the terms open in a new tab')
  same(link.includes('noopener'), true, 'the new tab cannot reach back at the page that opened it')
})

await finish()

console.log(`terms gate: all ${cases.length} cases pass; nothing is charged without an agreement`)
