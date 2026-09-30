/**
 * Holds the overdue rule, the site status answer and the Monday letters to
 * what a client is promised.
 *
 * A site goes offline once an invoice has sat unpaid a full week past the day
 * it was owed, and not an hour before. It stays up when nobody is billed for
 * it, when it is exempt, and when the invoice is paid, void or not yet due. A
 * client a week behind hears about it on Monday from nine, once that day
 * whatever the schedule does, and is told about a site only where the site is
 * actually offline.
 *
 * Nothing here opens a socket. The database, Stripe and the mailbox are stand-ins
 * that record what they were asked, and every address is a reserved one.
 *
 * npm run check:overdue
 */

import { check, finish, ok, quietly, same } from '../harness/checks.js'
import { daysLate, holdsSite, owedSince, siteName } from '../../lib/billing/overdue.js'
import { greetingFor, overdueReminder } from '../../lib/mail/overdue.js'
import { isPaused } from '../../api/site-status.js'
import { isSendingTime, remind } from '../../api/billing-reminders.js'

const DAY = 24 * 60 * 60
// Noon Central on Wednesday 30 September 2026.
const NOW = new Date('2026-09-30T17:00:00Z')
const nowSeconds = Math.floor(NOW.getTime() / 1000)

function invoice(fields = {}) {
  return {
    id: 'in_fixture',
    number: 'EXAMPLE-0001',
    status: 'open',
    collection_method: 'send_invoice',
    amount_due: 4999,
    amount_remaining: 4999,
    due_date: nowSeconds - 8 * DAY,
    created: nowSeconds - 10 * DAY,
    customer: 'cus_fixture_a',
    customer_email: 'owner@example.com',
    hosted_invoice_url: 'https://pay.example.com/invoice/0001',
    ...fields,
  }
}

/* ── The rule ───────────────────────────────────────────────────────────── */

check('a week to the second past the due date holds the site', () =>
  ok(holdsSite(invoice({ due_date: nowSeconds - 7 * DAY }), NOW), 'held at seven days')
)
check('a minute short of the week does not', () =>
  ok(!holdsSite(invoice({ due_date: nowSeconds - 7 * DAY + 60 }), NOW), 'not held a minute early')
)
check('an invoice not yet due is not late at all', () =>
  same(daysLate(invoice({ due_date: nowSeconds + 3 * DAY }), NOW), 0, 'days late')
)
check('a paid, void, draft or settled invoice never holds a site', () => {
  for (const fields of [
    { status: 'paid' },
    { status: 'void' },
    { status: 'draft' },
    { status: 'uncollectible' },
    { amount_remaining: 0 },
  ]) {
    ok(
      !holdsSite(invoice({ ...fields, due_date: nowSeconds - 30 * DAY }), NOW),
      JSON.stringify(fields)
    )
  }
})
check('a card-on-file invoice is owed from the moment it was finalised', () => {
  const card = invoice({
    collection_method: 'charge_automatically',
    due_date: null,
    status_transitions: { finalized_at: nowSeconds - 9 * DAY },
  })
  same(owedSince(card), nowSeconds - 9 * DAY, 'owed since')
  ok(holdsSite(card, NOW), 'held after nine days of a refused card')
})
check('a site is keyed on its bare lowercase host', () => {
  same(siteName('https://www.Example.com/about?x=1'), 'example.com', 'scheme and www')
  same(siteName('shop.example.com'), 'shop.example.com', 'bare')
  same(siteName(''), null, 'nothing')
  same(siteName('not a host'), null, 'not a host')
})

/* ── The status answer ──────────────────────────────────────────────────── */

function sitesDb(rows) {
  return {
    from(table) {
      same(table, 'client_sites', 'table')
      const filters = {}
      const query = {
        select: () => query,
        eq: (column, value) => ((filters[column] = value), query),
        maybeSingle: async () => ({
          data: rows.find(row => row.domain === filters.domain) || null,
          error: null,
        }),
      }
      return query
    },
  }
}

function stripeWith(invoices, asked = []) {
  return async (path, query) => {
    asked.push({ path, query })
    return {
      rows: invoices.filter(row => !query.customer || row.customer === query.customer),
      complete: true,
    }
  }
}

const SITES = [
  { domain: 'late.example.com', stripe_customer: 'cus_fixture_a', exempt: false },
  { domain: 'exempt.example.com', stripe_customer: 'cus_fixture_a', exempt: true },
  { domain: 'unbilled.example.com', stripe_customer: null, exempt: false },
  { domain: 'current.example.com', stripe_customer: 'cus_fixture_b', exempt: false },
]
const OPEN = [
  invoice({ customer: 'cus_fixture_a' }),
  invoice({ customer: 'cus_fixture_b', due_date: nowSeconds - 2 * DAY }),
]

check(
  'a site whose client is a week late is paused, and Stripe is asked for that client alone',
  async () => {
    const asked = []
    const paused = await isPaused('late.example.com', {
      db: sitesDb(SITES),
      list: stripeWith(OPEN, asked),
      now: NOW,
    })
    ok(paused, 'paused')
    same(
      JSON.stringify(asked),
      JSON.stringify([{ path: 'invoices', query: { customer: 'cus_fixture_a', status: 'open' } }]),
      'the one read'
    )
  }
)
check(
  'an exempt site, an unbilled site, an unknown site and a current client all stay up',
  async () => {
    for (const site of [
      'exempt.example.com',
      'unbilled.example.com',
      'nobody.example.com',
      'current.example.com',
    ]) {
      const asked = []
      const paused = await isPaused(site, {
        db: sitesDb(SITES),
        list: stripeWith(OPEN, asked),
        now: NOW,
      })
      ok(!paused, `${site} stays up`)
      if (site !== 'current.example.com') same(asked.length, 0, `${site} asks Stripe`)
    }
  }
)

/* ── The letter ─────────────────────────────────────────────────────────── */

check("the greeting uses a person's first name and nothing else", () => {
  same(greetingFor({ name: 'Dana Whitfield' }), 'Hi Dana,', 'person')
  same(
    greetingFor({ name: 'Example Diner', metadata: { contact_name: 'Lee Park' } }),
    'Hi Lee,',
    'contact on a business'
  )
  same(greetingFor({ name: 'Example Scale Services' }), 'Hello,', 'business')
  same(greetingFor({ name: 'Speedway 146' }), 'Hello,', 'business with a number')
  same(greetingFor({}), 'Hello,', 'no name')
})
check('one late invoice: its number, amount, due day, a link on its own line and the site', () => {
  const letter = overdueReminder({
    customer: { name: 'Dana Whitfield' },
    invoices: [invoice({ amount_remaining: 209900, due_date: 1791331200 })],
    sites: ['late.example.com'],
  })
  same(letter.subject, 'Invoice EXAMPLE-0001 is past due', 'subject')
  ok(letter.text.startsWith('Hi Dana,\n\n'), 'greeting first')
  ok(
    letter.text.includes(
      "I haven't received the $2,099.00 for invoice EXAMPLE-0001, which was due October 6."
    ),
    letter.text
  )
  ok(letter.text.includes('\nhttps://pay.example.com/invoice/0001\n'), 'the link sits alone')
  ok(
    letter.text.includes('Your website, late.example.com, is offline until you pay the invoice'),
    'the site'
  )
  ok(letter.text.endsWith('Trenton Taylor\nTaylorURL'), 'signed')
  ok(letter.html.includes('<a href="https://pay.example.com/invoice/0001">'), 'linked in html')
  ok(!/style=|background|<table/i.test(letter.html), 'no styling in the html')
})
check('a refused card is named as the reason, and no site means no site line', () => {
  const letter = overdueReminder({
    customer: { name: 'Dana Whitfield' },
    invoices: [
      invoice({
        collection_method: 'charge_automatically',
        due_date: null,
        status_transitions: { finalized_at: 1789318800 },
      }),
    ],
    sites: [],
  })
  ok(
    letter.text.includes("from September 13, because the card on file didn't go through."),
    letter.text
  )
  ok(!letter.text.includes('offline'), 'no site line')
})
check('several invoices share one letter', () => {
  const letter = overdueReminder({
    customer: { name: 'Dana Whitfield' },
    invoices: [
      invoice(),
      invoice({
        number: 'EXAMPLE-0002',
        hosted_invoice_url: 'https://pay.example.com/invoice/0002',
      }),
    ],
    sites: ['a.example.com', 'b.example.com'],
  })
  same(letter.subject, '2 invoices are past due', 'subject')
  ok(letter.text.includes('EXAMPLE-0001') && letter.text.includes('EXAMPLE-0002'), 'both named')
  ok(
    letter.text.includes(
      'Your websites, a.example.com and b.example.com, are offline until you pay these invoices'
    ),
    'both sites'
  )
})

/* ── The Monday run ─────────────────────────────────────────────────────── */

check('the letters go on Monday from nine Central and at no other time', () => {
  ok(isSendingTime(new Date('2026-10-05T14:00:00Z')), 'Monday 9:00 CDT')
  ok(isSendingTime(new Date('2026-10-05T15:00:00Z')), 'Monday 10:00 CDT')
  ok(!isSendingTime(new Date('2026-10-05T13:59:00Z')), 'Monday 8:59 CDT')
  ok(!isSendingTime(new Date('2026-12-07T14:00:00Z')), 'Monday 8:00 CST')
  ok(isSendingTime(new Date('2026-12-07T15:00:00Z')), 'Monday 9:00 CST')
  ok(!isSendingTime(new Date('2026-10-06T14:00:00Z')), 'Tuesday')
})

function mondayDb({ claimed = [] } = {}) {
  const reminders = claimed.map(row => ({ ...row }))
  const log = []
  const db = {
    reminders,
    log,
    from(table) {
      const filters = {}
      let action = 'select'
      let payload = null
      const query = {
        select: () => query,
        limit: () => query,
        eq: (column, value) => ((filters[column] = value), query),
        insert: async row => {
          log.push(['insert', table, row])
          if (
            reminders.some(
              r => r.stripe_customer === row.stripe_customer && r.sent_on === row.sent_on
            )
          ) {
            return { error: { code: '23505', message: 'duplicate key' } }
          }
          reminders.push({ ...row })
          return { error: null }
        },
        update: body => ((action = 'update'), (payload = body), query),
        delete: () => ((action = 'delete'), query),
        then(resolve, reject) {
          const matches = r => Object.entries(filters).every(([k, v]) => r[k] === v)
          if (table === 'stripe_roster') {
            return Promise.resolve({
              data: [{ kind: 'not_client', ref: 'cus_fixture_studio', note: 'the studio' }],
              error: null,
            }).then(resolve, reject)
          }
          if (table === 'client_sites') {
            return Promise.resolve({ data: SITES, error: null }).then(resolve, reject)
          }
          if (action === 'update') {
            reminders.filter(matches).forEach(r => Object.assign(r, payload))
            log.push(['update', table, { ...filters }])
          }
          if (action === 'delete') {
            for (let i = reminders.length - 1; i >= 0; i -= 1)
              if (matches(reminders[i])) reminders.splice(i, 1)
            log.push(['delete', table, { ...filters }])
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  return db
}

const CUSTOMERS = [
  { id: 'cus_fixture_a', name: 'Dana Whitfield', email: 'owner@example.com', metadata: {} },
  { id: 'cus_fixture_b', name: 'Current Client', email: 'current@example.com', metadata: {} },
  { id: 'cus_fixture_studio', name: 'The Studio', email: 'studio@example.com', metadata: {} },
]
const MONDAY = new Date('2026-10-05T14:05:00Z')
const MONDAY_OPEN = [
  invoice({ customer: 'cus_fixture_a', due_date: Math.floor(MONDAY.getTime() / 1000) - 8 * DAY }),
  invoice({ customer: 'cus_fixture_b', due_date: Math.floor(MONDAY.getTime() / 1000) - 2 * DAY }),
  invoice({
    customer: 'cus_fixture_studio',
    due_date: Math.floor(MONDAY.getTime() / 1000) - 40 * DAY,
  }),
]
const mondayList = async path => ({
  rows: path === 'customers' ? CUSTOMERS : MONDAY_OPEN,
  complete: true,
})

check(
  'Monday writes once to the late client, and not to the current one or the studio',
  async () => {
    const db = mondayDb()
    const sent = []
    const outcome = await remind({
      db,
      list: mondayList,
      send: async (letter, email) => (sent.push({ letter, email }), 'msg_fixture'),
      now: MONDAY,
    })
    same(sent.length, 1, 'letters')
    same(sent[0].email, 'owner@example.com', 'to')
    ok(
      sent[0].letter.text.includes('Your website, late.example.com, is offline'),
      'names the paused site'
    )
    ok(!sent[0].letter.text.includes('exempt.example.com'), 'leaves the exempt site out')
    same(JSON.stringify(outcome.sent), '["EXAMPLE-0001"]', 'outcome')
    same(db.reminders[0].provider_id, 'msg_fixture', 'recorded')
    same(db.reminders[0].sent_on, '2026-10-05', 'recorded day')
  }
)
check('a client already written to that day is not written to again', async () => {
  const db = mondayDb({ claimed: [{ stripe_customer: 'cus_fixture_a', sent_on: '2026-10-05' }] })
  const sent = []
  const outcome = await remind({
    db,
    list: mondayList,
    send: async (l, e) => (sent.push(e), 'x'),
    now: MONDAY,
  })
  same(sent.length, 0, 'letters')
  same(JSON.stringify(outcome.already), '["EXAMPLE-0001"]', 'reported as already written')
})
check('a letter that fails gives its claim back for the later firing', async () => {
  const db = mondayDb()
  const outcome = await quietly(() =>
    remind({
      db,
      list: mondayList,
      send: async () => {
        throw new Error('transport down')
      },
      now: MONDAY,
    })
  )
  same(JSON.stringify(outcome.failed), '["EXAMPLE-0001"]', 'reported as failed')
  same(db.reminders.length, 0, 'claims left')
})

await finish()

console.log(
  'overdue: a site goes offline a full week past the day its invoice was owed and not before, ' +
    'stays up when exempt, unbilled, unknown, paid or not yet due, and the Monday run writes ' +
    'once from nine Central to each late client, names only a site that is actually offline, ' +
    'skips the studio, and gives a failed letter back to the later firing'
)
