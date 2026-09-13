/**
 * Proves the buyer's answers survive the payment, and that a paid build can be
 * found again by whoever paid for it.
 *
 * Two silent losses, both at the same moment, both invisible from every screen.
 *
 * The first: the configurator asks six screens of questions and builds a
 * summary out of them. That summary was sent down the enquiry path and not down
 * the payment path, so the person who paid arrived at their build with an
 * address and a business name, and everything they had said about their trade,
 * their look and their tools was dropped on the way to Stripe. The path that
 * took no money carried strictly more than the path that did, and nothing
 * anywhere reported it, because dropping a field is not an error.
 *
 * The second: a build attaches to the account whose address matches the one
 * that paid, exactly. Nobody types that address any more - the account is
 * opened against it by the payment itself - but a build can still be pointed at
 * an address whose owner is looking somewhere else, so the screen after a
 * payment has to carry the session forward to name it, and the console has to
 * say something better than nothing when a console has no build in it.
 *
 * The brief is checked for its whole route rather than at one end: collected,
 * posted, stored, named to Stripe, read back and attached. Any link missing is
 * the same lost brief.
 *
 *   npm run check:project-brief
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cases, check, finish, report, same } from '../harness/checks.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = path => readFileSync(join(HERE, '../..', path), 'utf8')

const START = 'src/app/views/start/Start.jsx'
const SENDER = 'src/app/data/checkout/startCheckout.js'
const CHECKOUT = 'api/checkout.js'
const WEBHOOK = 'api/stripe-webhook.js'
const RETURN = 'lib/stripe/claim.js'
const WELCOME = 'src/app/views/auth/Welcome.jsx'
const LOOKUP = 'api/checkout-claim.js'
const READER = 'src/app/data/checkout/checkoutClaim.js'
const TRACKER = 'src/app/views/console/pages/health/ProjectPage.jsx'
const ADMIN = 'api/projects-admin.js'
const BUILDS = 'src/app/views/console/pages/studio/BuildsPage.jsx'

check('the paying path carries every answer the configurator collected', () => {
  const start = read(START)
  // The handler is read out of the file rather than trusted, so this compares
  // what it actually sends against the summary the steps built.
  const buy = start.slice(start.indexOf('const handleBuySubmit'), start.indexOf('const steps ='))
  same(buy.includes('brief: summary'), true, 'the buy path sends the summary it built')
  same(
    start.includes('const summary = ['),
    true,
    'the summary is still the one thing the payment quotes'
  )
})

check('the brief reaches the endpoint and is stored rather than sent to Stripe', () => {
  same(read(SENDER).includes('brief'), true, 'the sender posts the brief')
  const checkout = read(CHECKOUT)
  same(checkout.includes('project_brief_open'), true, 'the endpoint writes the brief down')
  same(
    checkout.includes("'metadata[brief_id]'"),
    true,
    'Stripe is told the id rather than the answers'
  )
  // Stripe caps a metadata value at 500 characters and is a payment processor
  // besides. The answers must not travel through it.
  same(
    checkout.includes("'metadata[brief]'"),
    false,
    'the answers themselves are not put in Stripe metadata'
  )
})

check('a stored brief is attached when the payment lands', () => {
  const webhook = read(WEBHOOK)
  same(webhook.includes('briefId'), true, 'the webhook reads the id back off the session')
  same(webhook.includes('project_brief_attach'), true, 'the webhook attaches it to the project')
  same(
    webhook.includes('UUID_PATTERN'),
    true,
    'a value coming back from Stripe is checked for shape before it is passed on'
  )
})

check('the studio can read the brief on the build', () => {
  same(read(ADMIN).includes('project_briefs'), true, 'the admin endpoint reads the brief')
  same(read(BUILDS).includes('brief'), true, 'the build detail draws it')
})

check('a buyer is carried back to the address they paid with', () => {
  same(
    read(CHECKOUT).includes('claimReturnUrl(SITE_URL'),
    true,
    'the checkout sets a return address'
  )
  same(
    read(RETURN).includes('session_id={CHECKOUT_SESSION_ID}'),
    true,
    'the return address carries the session'
  )
  same(
    read(WELCOME).includes('claimCheckout('),
    true,
    'the screen after a payment looks the buyer up'
  )
  same(read(READER).includes('/api/checkout-claim'), true, 'the reader asks the endpoint')
})

check('the lookup answers with what the screen names back and no figure at all', () => {
  const lookup = read(LOOKUP)
  // The session id rides back in the address bar, so it is not a secret and
  // this has to answer as though it were public.
  same(lookup.includes("payment_status !== 'paid'"), true, 'an unpaid session is not readable')

  // Three fields. The buyer's own name, address and business are theirs, are
  // what the screen says back to them, and say nothing about the purchase.
  const answered = lookup.slice(lookup.indexOf('const buyer = {'))
  for (const filled of ['email,', 'name:', 'business:']) {
    same(answered.includes(filled), true, `the lookup answers with ${filled.slice(0, -1)}`)
  }

  // What must never join them is any figure. A build sold above the published
  // floor is a number between us and that buyer, and one readable out of a URL
  // is one the next prospect can read. The customer and the payment intent are
  // out for the older reason: they are handles onto the money itself.
  const faults = []
  for (const leak of [
    'amount_total',
    'amount_subtotal',
    'payment_intent',
    'customer:',
    'build_cents',
    'monthly_cents',
  ]) {
    if (answered.includes(leak)) faults.push(`the lookup answers with ${leak}`)
  }
  report(faults)
})

check('a console with no build in it explains itself', () => {
  const tracker = read(TRACKER)
  // The old copy said the build did not exist, to the one reader most likely
  // to have paid for one.
  same(
    tracker.includes('console-nothing'),
    true,
    'the empty tracker has something to say rather than one centred line'
  )
  same(tracker.includes('the email address you paid with'), true, 'it names the likeliest cause')
  same(
    tracker.includes('<ContactLine phone={phone} />') &&
      read('src/app/views/console/ui.jsx').includes('mailto:${SUPPORT_EMAIL}'),
    true,
    'it gives them somebody to reach'
  )
})

check('a build pointed at the wrong address can be moved', () => {
  same(read(ADMIN).includes('admin_project_claim'), true, 'the endpoint can re-point a build')
  same(read(BUILDS).includes('ClaimControl'), true, 'the builds table offers it')
  // Offered only where it is the answer: moving a build already being read by
  // its owner would take it off them.
  same(
    read(BUILDS).includes('project.claimed ? null : ('),
    true,
    'it is offered only on an unclaimed build'
  )
})

const passed = await finish({ listed: true })
console.log(`\n${passed}/${cases.length} passed`)
