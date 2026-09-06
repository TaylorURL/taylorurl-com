/**
 * Proves the payments section is wired everywhere a section is wired, that the
 * money it shows cannot be written to, and that the rules sorting one trade's
 * income from another's still sort it.
 *
 * The first fault is the one the builds section already answers for: a console
 * section is registered in four files and three of them fail quietly. The menu
 * offers a row that routes nowhere, or the route answers and the menu never
 * shows it, or a direct load is a 404 because nothing prerendered the shell.
 *
 * The second is particular to this section. One Stripe account takes money for
 * more than one trade, and the test separating a website client from a go-kart
 * hire is a rule rather than a list of names. A rule that only runs against a
 * live secret key is a rule nobody runs, so the sorting is exercised here
 * against a fixture built to the shape Stripe actually returns - including the
 * two invoices whose own words are wrong about what they were for.
 *
 * The third is that this section reads money and must never move it. An
 * endpoint that grows a POST is an endpoint that can refund somebody by
 * accident, and the console section in front of it has no confirmation on
 * anything, because there is nothing to confirm.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRecord } from '../api/payments-admin.js'
import { recurringLine, setupCents } from '../lib/stripe/roster.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = path => readFileSync(join(HERE, '..', path), 'utf8')

const cases = []
function check(name, run) {
  cases.push([name, run])
}

function same(got, want, what) {
  if (got !== want)
    throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
}

function report(faults) {
  if (faults.length) throw new Error(faults.join('\n      '))
}

const ENDPOINT = 'api/payments-admin.js'
const PAGE = 'src/app/views/console/pages/PaymentsPage.jsx'
const HOOK = 'src/app/hooks/usePaymentsFeed.js'

/**
 * An account in the shape Stripe answers with, holding one of everything that
 * has ever confused this section.
 *
 * The amounts are the real ones because the awkward cases are real: a client
 * whose up-front fee is itemised as three monthly charges, a client whose one
 * invoice carries both the setup and a year of care, and two trades whose
 * takings share the account and belong to neither client.
 */
const line = (description, amount) => ({
  description,
  amount,
  pricing: { unit_amount_decimal: String(amount) },
})

const FIXTURE = {
  customers: [
    { id: 'cus_live', email: 'avery@example.com', name: 'Avery Lane', created: 100 },
    { id: 'cus_hand', email: 'hand@example.com', name: 'Morgan Reed', created: 100 },
    { id: 'cus_early', email: 'early@example.com', name: 'Jordan Ellis', created: 100 },
    {
      id: 'cus_early_2',
      email: 'early@example.com',
      business_name: 'Riverbend Karting',
      created: 200,
    },
    // Named in the roster as not a client, and holding money, so the exclusion
    // has something to actually exclude.
    {
      id: 'cus_not_client',
      email: 'notclient@example.com',
      name: 'Sam Avery',
      created: 50,
    },
  ],
  subscriptions: [
    {
      id: 'sub_live',
      customer: 'cus_live',
      status: 'active',
      collection_method: 'send_invoice',
      start_date: 1000,
      default_payment_method: 'pm_1',
      items: {
        data: [
          {
            current_period_end: 9999,
            price: { unit_amount: 9999, recurring: { interval: 'month', interval_count: 1 } },
          },
        ],
      },
    },
    {
      id: 'sub_early',
      customer: 'cus_early_2',
      status: 'active',
      collection_method: 'charge_automatically',
      start_date: 900,
      default_payment_method: 'pm_2',
      items: {
        data: [
          {
            current_period_end: 9998,
            price: { unit_amount: 2500, recurring: { interval: 'month', interval_count: 1 } },
          },
        ],
      },
    },
  ],
  invoices: [
    {
      id: 'in_setup',
      customer: 'cus_live',
      status: 'paid',
      total: 100000,
      created: 1000,
      lines: { data: [line('One Time Setup Fee', 100000)] },
    },
    {
      id: 'in_bundle',
      customer: 'cus_hand',
      status: 'paid',
      total: 55000,
      created: 2000,
      lines: {
        data: [line('Annual Recurring Discounted Fee', 30000), line('One Time Setup Fee', 25000)],
      },
    },
    // The invoice whose lines are wrong about it. Named in the roster as an
    // up-front fee in full, which is the only thing that gets this right.
    {
      id: 'in_early_setup',
      customer: 'cus_early',
      status: 'paid',
      total: 6495,
      created: 500,
      lines: {
        data: [
          line('Monthly Hosting Fee', 2000),
          line('Yearly Domain Costs', 1500),
          line('Monthly Development Fee', 2500),
        ],
      },
    },
    // Stripe writes a zero total when a subscription is amended mid-period.
    {
      id: 'in_zero',
      customer: 'cus_live',
      status: 'paid',
      total: 0,
      created: 3000,
      lines: { data: [] },
    },
    {
      id: 'in_void',
      customer: 'cus_live',
      status: 'void',
      total: 9999,
      created: 2500,
      lines: { data: [] },
    },
    {
      id: 'in_not_client',
      customer: 'cus_not_client',
      status: 'paid',
      total: 20568,
      created: 400,
      lines: { data: [line('Monthly Development Fee', 20568)] },
    },
  ],
  charges: [
    // Both of the other trades. Neither carries a customer, which is the whole
    // test.
    { id: 'ch_gokart', customer: null, amount: 15316, status: 'succeeded', created: 4000 },
    {
      id: 'ch_store',
      customer: null,
      amount: 600,
      status: 'succeeded',
      created: 4100,
      description: 'SwordFun store: Monthly Key x1',
    },
  ],
}

/**
 * The roster as the database holds one.
 *
 * The three facts that are about named people rather than about a shape in the
 * data, which is why they are rows in `stripe_roster` and not lines in the
 * source. The fixture states them itself, so this test proves the sorting
 * without knowing who any real customer is.
 */
const ROSTER = {
  notClients: new Map([
    ['cus_not_client', 'Paid one invoice years ago and never became a client.'],
  ]),
  setupInvoices: new Map([
    ['in_early_setup', 'An up-front fee itemised as hosting, a domain and development.'],
  ]),
  offStripe: new Map([['hand@example.com', 'Billed by hand, and nothing renews it.']]),
}

check('the payments section is registered everywhere a section is registered', () => {
  const faults = []
  const places = [
    ['src/app/views/console/lib/sections.js', "id: 'payments'"],
    ['src/app/constants/routes.js', "key: 'ConsolePayments', path: 'payments'"],
    ['src/app/views.js', 'ConsolePayments:'],
    ['vite/site-routes.js', "'/console/payments'"],
  ]
  for (const [path, needle] of places) {
    if (!read(path).includes(needle)) faults.push(`${path} does not carry the payments section`)
  }
  report(faults)
})

check('the section is admin-only and asks for no site in scope', () => {
  const sections = read('src/app/views/console/lib/sections.js')
  const entry = sections.slice(sections.indexOf("id: 'payments'"))
  const body = entry.slice(0, entry.indexOf('},'))
  same(/admin: true/.test(body), true, 'admin only')
  same(/scope: false/.test(body), true, 'no site in scope')
  same(/account: true/.test(body), true, 'answers for the account rather than a site')
})

check('the endpoint asks for the admin role rather than for a session', () => {
  const endpoint = read(ENDPOINT)
  same(endpoint.includes('authorizeAdmin'), true, 'authorizeAdmin is the door')
  same(
    /authorizeAccount\s*\(/.test(endpoint),
    false,
    'no plain session check stands in for the role check'
  )
})

check('nothing in the section can move money', () => {
  const endpoint = read(ENDPOINT)
  const faults = []
  // The endpoint answers GET and refuses everything else, and the Stripe reader
  // under it is given no method that could write.
  if (!/request\.method !== 'GET'/.test(endpoint)) faults.push('the endpoint accepts more than GET')
  const reader = read('lib/stripe/read.js')
  for (const verb of ['POST', 'DELETE', 'PUT', 'PATCH']) {
    if (reader.includes(`'${verb}'`)) faults.push(`the Stripe reader names ${verb}`)
    if (endpoint.includes(`'${verb}'`)) faults.push(`the endpoint names ${verb}`)
  }
  // The hook has no `act`, which is what every writing console feed calls its
  // change.
  if (/\bact\b\s*[,:=]/.test(read(HOOK))) faults.push('the feed offers a way to write')
  report(faults)
})

check('money attached to no customer never reaches the record', () => {
  const { clients, payments } = buildRecord({ ...FIXTURE, roster: ROSTER, now: 5000 })
  const ids = payments.map(one => one.id)
  report(
    [
      ids.includes('ch_gokart') && 'a go-kart hire reached the payments record',
      ids.includes('ch_store') && 'a game-store sale reached the payments record',
      clients.some(one => one.paidCents === 15316) && 'a go-kart hire reached a client total',
    ].filter(Boolean)
  )
})

check('a customer named as not a client is left out', () => {
  const { clients } = buildRecord({ ...FIXTURE, roster: ROSTER, now: 5000 })
  same(
    clients.some(one => one.key === 'notclient@example.com'),
    false,
    'the customer the roster excludes is not in the record'
  )
})

check('two customer records for one address read as one client', () => {
  const { clients } = buildRecord({ ...FIXTURE, roster: ROSTER, now: 5000 })
  const early = clients.filter(one => one.key === 'early@example.com')
  same(early.length, 1, 'one client rather than two half-clients')
  // The later record carries the name, and the earlier record's invoice is
  // still that client's money.
  same(early[0].business, 'Riverbend Karting', 'known by the business')
  same(early[0].setup?.cents, 6495, 'the up-front fee follows the address across both records')
})

check('an up-front fee is read from the line rather than from the total', () => {
  // The invoice that carried a year of care and the setup together. Calling the
  // whole total an up-front fee overstates the build by the price of a year.
  same(setupCents(FIXTURE.invoices[1], ROSTER), 25000, 'the setup line alone')
  const fee = recurringLine(FIXTURE.invoices[1], ROSTER)
  same(fee.cents, 30000, 'the year alone')
  same(fee.interval, 'year', 'and it is a year')
})

check('an invoice the roster overrides is an up-front fee in full', () => {
  const early = FIXTURE.invoices[2]
  same(setupCents(early, ROSTER), 6495, 'the whole invoice, whatever its lines say')
  same(recurringLine(early, ROSTER), null, 'and none of it is recurring')
})

check('an invoice for nothing is not a payment', () => {
  const { payments } = buildRecord({ ...FIXTURE, roster: ROSTER, now: 5000 })
  same(
    payments.some(one => one.id === 'in_zero'),
    false,
    'a zero-total invoice is not money'
  )
  same(
    payments.some(one => one.id === 'in_void'),
    false,
    'a cancelled invoice is not money either'
  )
})

check('a yearly fee counts as a twelfth of itself in the monthly total', () => {
  const { clients, totals } = buildRecord({ ...FIXTURE, roster: ROSTER, now: 5000 })
  const yearly = clients.find(one => one.key === 'hand@example.com')
  same(yearly.arrangement.interval, 'year', 'billed by the year')
  same(yearly.monthlyCents, 2500, 'three hundred a year is twenty-five a month')
  // $99.99 + $25.00 + $25.00
  same(totals.monthlyCents, 14999, 'the recurring total is every client at a month')
})

check('a client with no subscription behind them is flagged rather than hidden', () => {
  const { clients } = buildRecord({ ...FIXTURE, roster: ROSTER, now: 5000 })
  const byHand = clients.find(one => one.key === 'hand@example.com')
  same(Boolean(byHand), true, 'the client is in the record')
  same(byHand.arrangement.source, 'hand', 'and marked as billed by hand')
  same(
    byHand.troubles.some(one => one.code === 'no-subscription'),
    true,
    'and carries the reason it cannot be trusted'
  )
})

check('the page says what it costs before it says anything else', () => {
  const page = read(PAGE)
  const faults = []
  // Every figure on the page is cents divided once, in one function. A second
  // place dividing by a hundred is the first place one of them is wrong.
  const divides = page.match(/\/ 100/g) || []
  if (divides.length > 1) faults.push(`${divides.length} places divide cents into dollars`)
  if (!page.includes('tabular-nums')) faults.push('figures are not set on a fixed advance')
  report(faults)
})

let failed = 0
for (const [name, run] of cases) {
  try {
    run()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  no  ${name}\n      ${error.message}`)
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
if (failed) process.exit(1)
