/**
 * Proves the checkout is reachable and that no page still promises the
 * opposite of it.
 *
 * Two faults, and the site can hold both at once without either showing. The
 * first is an endpoint nothing calls: `api/checkout.js` can take a payment
 * perfectly and be reachable from no button on any page, in which case the
 * funnel ends at a form and the money is never asked for. The second is worse
 * and quieter, because it is a page that reads correctly and is untrue - a
 * pricing page saying nothing here takes payment, standing in front of a
 * checkout that does. That one is published as FAQ markup too, so a search
 * result can carry the wrong promise long after the page stops making it.
 *
 * So: the endpoint is checked for a caller, and every user-facing file is read
 * for the sentences that said payment came later.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cases, check, finish, report, same } from '../harness/checks.js'
import { filesUnder } from '../harness/files.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const read = path => readFileSync(join(ROOT, path), 'utf8')

/** Every file under `src`, which is everything a visitor can end up reading. */
function everySource() {
  return filesUnder(join(ROOT, 'src'), /\.(jsx?|tsx?)$/).map(path => relative(ROOT, path))
}

/**
 * The sentences that were true while nothing on the site took a payment.
 *
 * Each is quoted rather than matched loosely, because the words next to them
 * are still true and still wanted: asking a question costs nothing, and the
 * plan and the price still come before any work starts. It is only the claim
 * about when money changes hands that the checkout contradicts.
 */
const NO_LONGER_TRUE = [
  'Nothing on this site takes payment',
  'No Checkout Here',
  'Payment happens after a conversation',
  'invoiced once, on the day the site goes live',
  'is invoiced once the work is agreed',
  'paid once when the site goes live',
  'paid once, when the site goes live',
  'paid once when the new site goes live',
  'You pay nothing until',
  // The monthly started on launch day while the checkout took the build alone.
  // It starts on the checkout now, on the same session.
  'monthly starts the day the site goes live',
  'starts the day the site goes live and is billed',
  'Starts the day the site goes live and runs',
]

check('the checkout endpoint has a caller', () => {
  const callers = everySource().filter(path => read(path).includes('/api/checkout'))
  same(callers.length > 0, true, 'something in src posts to /api/checkout')
})

check('the funnel every buy button leads to carries the payment step', () => {
  const start = read('src/app/views/start/Start.jsx')
  same(start.includes("id: 'pay'"), true, 'the start flow holds a pay step')
  same(start.includes('PaySection'), true, 'the pay step draws the payment section')
  same(
    read('src/app/views/start/steps/PaySection.jsx').includes('onSubmit'),
    true,
    'the payment section submits'
  )

  // Every primary CTA lands on /start, which is what makes one step reach all
  // of them. A button pointed anywhere else would need its own.
  const banner = read('src/app/components/conversion/CtaBanner.jsx')
  same(banner.includes("primaryTo = '/start'"), true, 'the shared banner still leads to /start')
})

check('no page still promises that payment comes later', () => {
  const faults = []
  for (const path of everySource()) {
    const body = read(path)
    for (const phrase of NO_LONGER_TRUE) {
      if (body.includes(phrase)) faults.push(`${path} still says "${phrase}"`)
    }
  }
  report(faults)
})

check('the card is never offered to this site', () => {
  const faults = []
  // Named field by field rather than by a word like "expiry", which is
  // ordinary English about a session token and would fail this on a comment.
  const cardish = /\b(card_number|cardNumber|cardCvc|cvc|cvv|exp_month|exp_year|expiryDate)\b/
  for (const path of everySource()) {
    if (cardish.test(read(path))) faults.push(`${path} names a card field`)
  }
  if (cardish.test(read('api/checkout.js'))) faults.push('api/checkout.js names a card field')
  report(faults)
})

check('the price the checkout charges is the price the pages print', () => {
  const pricing = read('src/app/data/checkout/pricing.js')
  const cents = Number(pricing.match(/BUILD_PRICE_CENTS = (\d+)/)?.[1])
  const printed = Number(pricing.match(/BUILD_PRICE = '\$([\d,]+)'/)?.[1].replace(/,/g, ''))
  same(cents, printed * 100, 'the charged figure is the printed one')
  const monthlyCents = Number(pricing.match(/MONTHLY_PRICE_CENTS = (\d+)/)?.[1])
  const monthlyPrinted = Number(
    pricing.match(/MONTHLY_PRICE = '\$([\d,]+)'/)?.[1].replace(/,/g, '')
  )
  same(monthlyCents, monthlyPrinted * 100, 'the monthly figure is the printed one')
  const checkout = read('api/checkout.js')
  same(
    checkout.includes('BUILD_PRICE_CENTS') && checkout.includes('MONTHLY_PRICE_CENTS'),
    true,
    'the endpoint charges the shared figures rather than ones of its own'
  )
})

check('the checkout opens the subscription with the build on its first invoice', () => {
  const checkout = read('api/checkout.js')
  same(checkout.includes("mode: 'subscription'"), true, 'the session is a subscription')
  same(
    checkout.includes("'line_items[1][price_data][recurring][interval]': 'month'"),
    true,
    'the care recurs monthly'
  )
  same(
    checkout.includes('STRIPE_PRODUCT_BUILD') && checkout.includes('STRIPE_PRODUCT_CARE'),
    true,
    'each line names its product from the environment'
  )
  // Both belong to payment mode, and Stripe refuses a subscription session
  // that carries either. A product named inline would be minted per checkout.
  const faults = []
  for (const stray of ['customer_creation', 'payment_intent_data', 'product_data']) {
    if (checkout.includes(stray)) faults.push(`api/checkout.js still carries ${stray}`)
  }
  report(faults)
})

const passed = await finish({ listed: true })
console.log(`\n${passed}/${cases.length} passed`)
