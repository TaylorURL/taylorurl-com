/**
 * Proves the Call List rings the right businesses and never the one it must not.
 *
 * Three things are held here.
 *
 * Who may be rung at all. A business that asked for no further contact asked
 * not to hear from the studio, not merely not to be emailed, and the call list
 * reads the same rows through a different door than the sender, so nothing the
 * sender does protects it. The same goes for a row skipped by hand, a closed
 * business, and a listing with no number.
 *
 * What the list offers. The ranking put the wrong businesses first: of the
 * first 31 calls placed off it, 12 were Bad Lead, 10 of them Google listings
 * with no reviews at all, and the wrong numbers were a park on the county's 311
 * line and a mall's directory. The rules in `callList.js` take those out, along
 * with chains, shared numbers and anything already called, and every case here
 * is one of those failures.
 *
 * What a call records. Six results, only Call Back carries a time, and the
 * endpoint still refuses a call against a business the list would not offer.
 * The endpoint is driven against an in-memory database rather than read.
 *
 *   npm run check:call-list
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CALLBACK_LENGTHS,
  CALL_OUTCOMES,
  OFFERED_OUTCOMES,
  OUTCOME_IDS,
  callBody,
  callMakesLead,
  dialHref,
  interestIn,
  isCallable,
  outcomeEnds,
  outcomeTakesCallback,
  pullBand,
  pullOf,
  reviewsOf,
  uncallableReason,
} from '../../../lib/outreach/prospects/calls.js'
import {
  brandOf,
  droppedFor,
  indexOf,
  kept,
  phoneKey,
  reasonsFor,
} from '../../../lib/outreach/prospects/callList.js'
import { PHONE_ONLY_REASON } from '../../../lib/new-business/mirror.js'
import { list, record, tomorrowFrom } from '../../../api/calls-admin.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = path => readFileSync(join(ROOT, path), 'utf8')

/** Noon in Baytown on a Monday, after the clocks went back. */
const NOW = new Date('2026-11-02T18:00:00Z')

/** A row the way the table carries one, callable unless the case says otherwise. */
const row = over => ({
  id: 'p1',
  name: 'Channelview Barbers',
  phone: '(281) 862-9968',
  website: null,
  site_kind: 'none',
  stage: 'unreachable',
  trade: 'barber shop',
  town: 'Channelview',
  rating: 4.6,
  rating_count: 40,
  business_status: 'OPERATIONAL',
  calls: [],
  ...over,
})

// ── Who is on the list ──────────────────────────────────────────────────

check('a business with no site and a number is on the list', () => {
  same(uncallableReason(row()), null, 'a plain callable row')
  ok(isCallable(row({ site_kind: 'social', website: 'https://www.facebook.com/x' })), 'a page')
})

check('a business that asked for no further contact is never rung', () => {
  same(
    uncallableReason(row({ stage: 'unsubscribed' })),
    'the business asked for no further contact',
    'why an unsubscribed business is off the list'
  )
})

check('a skipped business and a business in conversation stay off', () => {
  ok(!isCallable(row({ stage: 'skipped' })), 'a skipped business reached the list')
  ok(!isCallable(row({ stage: 'replied' })), 'a business that replied reached the list')
})

check('a business with a site of its own belongs to the sender', () => {
  ok(!isCallable(row({ site_kind: 'own', website: 'https://x.com' })), 'it reached the list')
})

check('a listing with no number cannot be rung', () => {
  for (const phone of [null, '', '   ']) {
    ok(!isCallable(row({ phone })), `a listing with ${JSON.stringify(phone)} for a phone`)
  }
})

check('a closed business is not rung, either way it is closed', () => {
  for (const status of ['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY']) {
    ok(!isCallable(row({ business_status: status })), `a ${status} business reached the list`)
  }
  ok(isCallable(row({ business_status: null })), 'an unread status was read as a closure')
})

check('a number formatted for a person is flattened for a dialer', () => {
  same(dialHref('(281) 862-9968'), 'tel:2818629968', 'a formatted number')
  same(dialHref('+1 281-862-9968'), 'tel:+12818629968', 'a number carrying its country')
  same(dialHref(''), null, 'no number at all')
})

// ── What the trade says ─────────────────────────────────────────────────

check('a count is read against its own trade', () => {
  ok(pullOf(row({ rating_count: 200 }), 45) > pullOf(row({ rating_count: 400 }), 380), 'raw count')
  same(pullBand(row({ rating_count: 2 }), 38), 'quiet', 'two reviews where the middle is 38')
  same(pullBand(row({ rating_count: 40 }), 4), 'busy', 'forty where the middle is four')
  same(pullBand(row(), null), 'unread', 'a trade with no middle')
})

check('a listing Google answered with no reviews reads as none, an unread one as unread', () => {
  same(reviewsOf(row({ rating_count: null })), 0, 'answered, no reviews')
  same(reviewsOf(row({ rating_count: null, business_status: null })), null, 'never asked')
})

// ── What the list offers ────────────────────────────────────────────────

check('a number is its ten digits', () => {
  same(phoneKey('(281) 862-9968'), '2818629968', 'formatted')
  same(phoneKey('+1 281 862 9968'), '2818629968', 'with its country')
  same(phoneKey('862-9968'), null, 'seven digits')
  same(phoneKey(null), null, 'nothing')
})

check('a name is read as the brand it trades under', () => {
  same(brandOf('Farmers Insurance - Joseph Pugh'), 'farmersinsurance', 'an agent after a dash')
  same(brandOf('Alvarez Tire Repair # 2'), 'alvareztirerepair', 'a store number')
  same(brandOf('A-1 Loggins Tree Services'), 'a1logginstreeservices', 'a hyphen inside a name')
  same(brandOf('RE/MAX American Dream'), brandOf('Re Max American Dream'), 'punctuation')
})

/** The table the rules are read against, in the shape of the live failures. */
const LISTINGS = [
  { name: 'Farmers Insurance - Joseph Pugh', phone: '(281) 100-0001', town: 'Baytown' },
  { name: 'Farmers Insurance - Mary Lee', phone: '(281) 100-0002', town: 'Pasadena' },
  { name: 'Farmers Insurance', phone: '(281) 100-0003', town: 'Humble' },
  { name: 'Pecan Park', phone: '(281) 420-6597', town: 'Baytown' },
  { name: 'Champion Little League Park', phone: '(281) 420-6597', town: 'Baytown' },
  { name: 'Hollaway Park', phone: '(281) 420-6597', town: 'Baytown' },
  { name: 'BW James LLP', phone: '(281) 420-1040', town: 'Baytown' },
  { name: 'BW James LLP', phone: '(281) 420-1040', town: 'Baytown' },
  { name: 'BW James LLP', phone: '(281) 420-1040', town: 'Baytown' },
  { name: "Merchant's Towing", phone: '(281) 331-4784', town: 'Alvin' },
  { name: 'Merchants Wrecker Services', phone: '(281) 331-4784', town: 'Alvin' },
  { name: 'Two Shops', phone: '(281) 555-0101', town: 'Baytown' },
  { name: 'Two Shops', phone: '(281) 555-0102', town: 'Baytown' },
]
const INDEX = indexOf(LISTINGS, [{ phone: '(281) 331-4784' }])

check('a business already called is not offered again', () =>
  same(droppedFor(row({ calls: [{ outcome: 'no_answer' }] }), INDEX), 'already called', 'why')
)

check('a Google listing with no reviews at all is not offered', () => {
  // Ten of the first twelve Bad Leads were exactly this.
  const nobody = row({ name: 'StayFaded420', rating_count: null, trade_median: 37 })
  same(droppedFor(nobody, INDEX), 'no reviews on Google', 'why')
  // A company the pipeline found off the state's filings has no listing to
  // have reviews on, which is a different fact.
  same(droppedFor(row({ rating_count: null, business_status: null }), INDEX), null, 'unread')
})

check('a chain or franchise is not offered', () => {
  const agent = row({ name: 'Farmers Insurance - Joseph Pugh', phone: '(281) 100-0001' })
  same(droppedFor(agent, INDEX), 'chain or franchise', 'three listings in three towns')
  const local = row({ name: 'Two Shops', phone: '(281) 555-0101' })
  same(droppedFor(local, INDEX), null, 'two listings in one town is a business, not a chain')
})

check('a number many businesses share is not an owner’s line', () => {
  const park = row({ name: 'Pecan Park', phone: '(281) 420-6597' })
  same(droppedFor(park, INDEX), 'number shared by several businesses', 'a city department')
  const firm = row({ name: 'BW James LLP', phone: '(281) 420-1040' })
  same(droppedFor(firm, INDEX), null, 'one firm listed three times under its own name')
})

check('a number already rung under another listing is not offered', () => {
  const second = row({ name: 'Merchants Wrecker Services', phone: '(281) 331-4784' })
  same(droppedFor(second, INDEX), 'number already called under another listing', 'why')
})

check('a listing far busier than its trade is not a small business', () => {
  const mall = row({ name: 'Deerbrook Marketplace', rating_count: 2625, trade_median: 7 })
  same(droppedFor(mall, INDEX), 'far more reviews than its trade', 'a mall filed as printing')
  // The tyre shop that turned out to be the best lead on the list: busy, and
  // still a shop.
  const busy = row({ name: "Luna's Tire Shop", rating_count: 411, trade_median: 35 })
  same(droppedFor(busy, INDEX), null, 'a busy shop')
})

check('a number that is not a number is not offered', () => {
  same(droppedFor(row({ phone: '862-9968' }), INDEX), 'not a full phone number', 'seven digits')
  same(droppedFor(row({ phone: '214-748-3647' }), INDEX), 'not a full phone number', 'a ceiling')
})

check('a second listing of one number is offered once', () => {
  const one = row({ id: 'a', name: 'BW James LLP', phone: '(281) 420-1040' })
  const two = row({ id: 'b', name: 'BW James LLP', phone: '(281) 420-1040' })
  same(
    kept([one, two], INDEX)
      .map(each => each.id)
      .join(','),
    'a',
    'the first'
  )
  same(kept([one], INDEX, new Set(['2814201040'])).length, 0, 'a number a call back holds')
})

check('every row says why it is there, in plain words', () => {
  same(reasonsFor(row()).join(' · '), 'No website', 'nothing online')
  same(
    reasonsFor(row({ site_kind: 'social', website: 'https://www.facebook.com/kats' }))[0],
    'Only a Facebook page',
    'a Facebook page'
  )
  same(
    reasonsFor(row({ site_kind: 'social', website: 'https://kats.square.site/' }))[0],
    'Only a Square booking page',
    'a booking page'
  )
  same(
    reasonsFor(row({ site_kind: 'social', website: 'https://www.bbb.org/us/tx/x' }))[0],
    'Only a BBB listing',
    'a directory, without its article'
  )
  same(
    reasonsFor(row({ rating_count: 2, trade_median: 38 })).join(' · '),
    'No website · Only 2 reviews, most nearby have 38',
    'few reviews for its trade'
  )
  same(reasonsFor(row({ audit_score: 31 }))[1], 'Slow site, speed 31 of 100', 'a slow site')
  same(
    reasonsFor(row({ new_business: true, formed_on: '2026-09-27', website: 'https://x.com' })).join(
      ' · '
    ),
    'New business, registered Sep 27, 2026 · No email address on its site',
    'a new company'
  )
  ok(reasonsFor(row({ proof: 'trade', rating_count: 1, trade_median: 40 })).length <= 3, 'three')
})

// ── What a call records ─────────────────────────────────────────────────

check('the six results offered, in the order they are drawn', () => {
  same(
    OFFERED_OUTCOMES.join(','),
    'spoke,no_answer,voicemail,callback,not_interested,wrong_number',
    'the results'
  )
  same(
    CALL_OUTCOMES.filter(one => one.offered)
      .map(one => one.label)
      .join(', '),
    'Spoke, No Answer, Voicemail, Call Back, Not Interested, Bad Number',
    'the labels'
  )
})

check('every outcome the column holds can still be read back', () => {
  const snapshot = JSON.parse(read('scripts/db/db-constraints.json'))
  const column = snapshot.columns?.outreach_calls?.outcome
  ok(column, 'the schema snapshot carries no outcome column for outreach_calls')
  same([...OUTCOME_IDS].sort().join(','), [...column.allows].sort().join(','), 'the outcomes')
  for (const id of OFFERED_OUTCOMES) ok(column.allows.includes(id), `${id} is not allowed`)
})

check('what each result does next', () => {
  ok(outcomeTakesCallback('callback'), 'Call Back carries a time')
  for (const id of ['spoke', 'no_answer', 'voicemail', 'not_interested', 'wrong_number']) {
    ok(!outcomeTakesCallback(id), `${id} carries a time`)
  }
  ok(outcomeEnds('not_interested') && outcomeEnds('wrong_number'), 'the two that end it')
  same(interestIn('not_interested'), false, 'a no')
  same(interestIn('no_answer'), null, 'nobody reached')
})

check('a call that reached somebody becomes a lead, and only that', () => {
  ok(callMakesLead('spoke'), 'a conversation')
  ok(callMakesLead('callback'), 'a call back')
  ok(!callMakesLead('no_answer') && !callMakesLead('voicemail'), 'nobody reached')
  ok(!callMakesLead('not_interested') && !callMakesLead('wrong_number'), 'a no')
})

check('only Call Back is sent with a time', () => {
  const back = callBody({ id: 'p1', outcome: 'callback', hours: 24, note: ' ring Tue ' })
  ok(back.callback_at, 'a call back went with no time')
  same(back.note, 'ring Tue', 'the note, trimmed')
  same(callBody({ id: 'p1', outcome: 'no_answer', hours: 24 }).callback_at, null, 'no answer')
  same(
    callBody({ id: 'p1', outcome: 'callback', at: '2026-11-05T15:00:00.000Z' }).callback_at,
    '2026-11-05T15:00:00.000Z',
    'a time typed in'
  )
  ok(
    CALLBACK_LENGTHS.every(length => length.hours > 0 && length.label),
    'a length with no label'
  )
})

// ── The endpoint, against a database in memory ──────────────────────────

/**
 * Enough of the Supabase client for the endpoint: filters are applied to the
 * rows held, writes are recorded, and the two functions are answered by hand.
 */
function database(tables, { ranking = [] } = {}) {
  const writes = []
  const rpcs = []
  let made = 0
  const from = table => {
    const filters = []
    let op = 'select'
    let payload = null
    let columns = '*'
    let order = null
    let cut = null
    let limit = null
    let single = false
    const builder = {
      select(wanted = '*') {
        if (op === 'select') columns = wanted
        return builder
      },
      eq(column, value) {
        filters.push(one => one[column] === value)
        return builder
      },
      in(column, values) {
        filters.push(one => values.includes(one[column]))
        return builder
      },
      not(column) {
        filters.push(one => one[column] !== null && one[column] !== undefined)
        return builder
      },
      lt(column, value) {
        filters.push(one => one[column] && Date.parse(one[column]) < Date.parse(value))
        return builder
      },
      order(column, { ascending = true } = {}) {
        order = { column, ascending }
        return builder
      },
      range(start, end) {
        cut = [start, end]
        return builder
      },
      limit(count) {
        limit = count
        return builder
      },
      maybeSingle() {
        single = true
        return builder
      },
      insert(values) {
        op = 'insert'
        payload = values
        return builder
      },
      update(values) {
        op = 'update'
        payload = values
        return builder
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    const run = () => {
      const held = (tables[table] ??= [])
      if (op === 'insert') {
        made += 1
        const written = { id: `made-${made}`, called_at: NOW.toISOString(), ...payload }
        held.push(written)
        writes.push({ table, op, row: written })
        return { data: single ? written : [written], error: null }
      }
      let rows = held.filter(one => filters.every(test => test(one)))
      if (op === 'update') {
        for (const one of rows) Object.assign(one, payload)
        writes.push({ table, op, row: payload })
        return { data: rows, error: null }
      }
      if (order) {
        rows = [...rows].sort((one, two) => {
          const by = String(one[order.column]).localeCompare(String(two[order.column]))
          return order.ascending ? by : -by
        })
      }
      const count = rows.length
      if (cut) rows = rows.slice(cut[0], cut[1] + 1)
      if (limit !== null) rows = rows.slice(0, limit)
      if (columns.includes('outreach_prospects(phone)')) {
        rows = rows.map(call => ({
          id: call.id,
          outreach_prospects: {
            phone: tables.outreach_prospects.find(one => one.id === call.prospect_id)?.phone,
          },
        }))
      }
      return single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null, count }
    }
    return builder
  }
  const rpc = async (name, args) => {
    rpcs.push({ name, args })
    if (name === 'lead_record') return { data: { lead_id: 'lead-1', fresh: true }, error: null }
    const take = args.p_take
    const page = args.p_page
    return {
      data: {
        rows: ranking.slice((page - 1) * take, page * take),
        page,
        pages: Math.max(1, Math.ceil(ranking.length / take)),
      },
      error: null,
    }
  }
  return { from, rpc, writes, rpcs }
}

/** A business on the table. */
const business = (id, over = {}) => ({ ...row({ id, name: id }), ...over, calls: undefined })

/** A call on the record. */
const rung = (id, prospect, at, over = {}) => ({
  id,
  prospect_id: prospect,
  outcome: 'spoke',
  note: null,
  callback_at: null,
  called_at: at,
  ...over,
})

function table() {
  const prospects = [
    business('overdue', { phone: '(281) 200-0001' }),
    business('later-today', { phone: '(281) 200-0002' }),
    business('tomorrow', { phone: '(281) 200-0003' }),
    business('superseded', { phone: '(281) 200-0004' }),
    business('ended', { phone: '(281) 200-0005' }),
    business('stopped', { phone: '(281) 200-0006', stage: 'unsubscribed' }),
    business('asked', {
      phone: '(281) 200-0007',
      site_kind: 'own',
      website: 'https://harbortire.example',
      call_due_at: '2026-11-01T15:00:00+00:00',
      call_due_reason: 'Broken site: the certificate expired',
    }),
    business('asked-and-rung', {
      phone: '(281) 200-0008',
      site_kind: 'own',
      website: 'https://other.example',
      call_due_at: '2026-10-30T15:00:00+00:00',
    }),
    business('nb-older', {
      phone: '(512) 300-0001',
      source: 'new-business',
      skip_reason: PHONE_ONLY_REASON,
      website: 'https://older.example',
      rating_count: null,
      business_status: null,
      trade: null,
    }),
    business('nb-newer', {
      phone: '(512) 300-0002',
      source: 'new-business',
      skip_reason: PHONE_ONLY_REASON,
      website: 'https://newer.example',
      rating_count: null,
      business_status: null,
      trade: null,
    }),
    business('nb-rung', {
      phone: '(512) 300-0003',
      source: 'new-business',
      skip_reason: PHONE_ONLY_REASON,
      rating_count: null,
      business_status: null,
    }),
    business('nb-stopped', {
      phone: '(512) 300-0004',
      source: 'new-business',
      skip_reason: PHONE_ONLY_REASON,
      stage: 'unsubscribed',
      rating_count: null,
      business_status: null,
    }),
  ]
  const calls = [
    rung('c1', 'overdue', '2026-09-08T20:32:00+00:00', {
      callback_at: '2026-09-22T20:31:00+00:00',
    }),
    rung('c2', 'later-today', '2026-11-02T15:00:00+00:00', {
      outcome: 'callback',
      callback_at: '2026-11-02T22:00:00+00:00',
    }),
    rung('c3', 'tomorrow', '2026-11-02T15:00:00+00:00', {
      outcome: 'callback',
      callback_at: '2026-11-03T15:00:00+00:00',
    }),
    rung('c4', 'superseded', '2026-10-01T15:00:00+00:00', {
      callback_at: '2026-10-02T15:00:00+00:00',
    }),
    rung('c5', 'superseded', '2026-10-03T15:00:00+00:00', { outcome: 'no_answer' }),
    rung('c6', 'ended', '2026-10-01T15:00:00+00:00', { callback_at: '2026-10-02T15:00:00+00:00' }),
    rung('c7', 'ended', '2026-10-02T15:00:00+00:00', { outcome: 'not_interested' }),
    rung('c8', 'stopped', '2026-10-01T15:00:00+00:00', {
      outcome: 'callback',
      callback_at: '2026-10-02T15:00:00+00:00',
    }),
    rung('c9', 'asked-and-rung', '2026-10-31T15:00:00+00:00', { outcome: 'no_answer' }),
    rung('c10', 'nb-rung', '2026-10-31T15:00:00+00:00', { outcome: 'no_answer' }),
  ]
  const ranked = [
    {
      ...row({ id: 'r-nobody', name: 'StayFaded420', phone: '(281) 400-0001' }),
      rating_count: null,
      trade_median: 37,
    },
    {
      ...row({ id: 'r-mall', name: 'Deerbrook Marketplace', phone: '(281) 400-0002' }),
      rating_count: 2625,
      trade: 'printing',
      trade_median: 7,
    },
    {
      ...row({
        id: 'r-good',
        name: 'Kat Shirts',
        phone: '(281) 400-0003',
        site_kind: 'social',
        website: 'https://www.facebook.com/kats',
      }),
      rating_count: 2,
      trade_median: 38,
    },
    {
      ...row({ id: 'r-same-number', name: 'Overdue Again', phone: '(281) 200-0001' }),
      trade_median: 38,
    },
    {
      ...row({ id: 'r-new', name: 'New Co', phone: '(512) 300-0009' }),
      skip_reason: PHONE_ONLY_REASON,
      trade_median: null,
    },
    {
      ...row({ id: 'r-rung', name: 'Rung Before', phone: '(281) 400-0004' }),
      calls: [{ outcome: 'callback' }],
      trade_median: 38,
    },
    {
      ...row({ id: 'r-plain', name: 'Plain Plumbing', phone: '(281) 400-0005', trade: 'plumber' }),
      rating_count: 20,
      trade_median: 9,
    },
  ]
  const leads = [
    { prospect_id: 'nb-older', formed_on: '2026-10-15', stage: 'phone_only' },
    { prospect_id: 'nb-newer', formed_on: '2026-10-20', stage: 'phone_only' },
    { prospect_id: 'nb-rung', formed_on: '2026-10-25', stage: 'phone_only' },
    { prospect_id: 'nb-stopped', formed_on: '2026-10-26', stage: 'phone_only' },
  ]
  return database(
    { outreach_prospects: prospects, outreach_calls: calls, new_business_leads: leads, leads: [] },
    { ranking: ranked }
  )
}

check('today ends at midnight in Baytown, not in Greenwich', () =>
  same(tomorrowFrom(NOW).toISOString(), '2026-11-03T06:00:00.000Z', 'the end of the day')
)

check('call backs due today or overdue lead the list, oldest first', async () => {
  const answer = await list(table(), {}, NOW)
  same(answer.status, 200, 'the status')
  same(
    answer.body.due.map(one => one.id).join(','),
    'overdue,asked,later-today',
    'what is owed today'
  )
  const [overdue, asked, later] = answer.body.due
  same(overdue.due.kind, 'callback', 'a call back')
  same(asked.due.kind, 'asked', 'a call a chain asked for')
  same(asked.reasons[0], 'Broken site: the certificate expired', 'the chain’s own line')
  same(later.calls[0].outcome, 'callback', 'the history comes with it')
})

check(
  'a call back a newer call replaced, a business that ended, and a stop are not owed',
  async () => {
    const owed = (await list(table(), {}, NOW)).body.due.map(one => one.id)
    for (const id of ['tomorrow', 'superseded', 'ended', 'stopped', 'asked-and-rung']) {
      ok(!owed.includes(id), `${id} was offered as due`)
    }
  }
)

check('the ranking is offered with the bad leads taken out', async () => {
  const db = table()
  const answer = await list(db, {}, NOW)
  same(answer.body.rows.map(one => one.id).join(','), 'r-good,r-plain', 'what is left to call')
  same(
    answer.body.rows[0].reasons.join(' · '),
    'Only a Facebook page · Only 2 reviews, most nearby have 38 · We have built for its trade',
    'why the first one is there, including the barber shops we have built for'
  )
  const asked = db.rpcs.find(one => one.name === 'call_list_page').args
  same(asked.p_view, 'list', 'the ranking view')
  same(asked.p_state, 'fresh', 'never called')
})

check('the new-business companies are a view of their own, newest first', async () => {
  const answer = await list(table(), { view: 'new' }, NOW)
  same(answer.body.rows.map(one => one.id).join(','), 'nb-newer,nb-older', 'the companies')
  same(answer.body.rows[0].reasons[0], 'New business, registered Oct 20, 2026', 'why')
  same(answer.body.rows[0].new_business, true, 'marked as one')
})

check('only the six results are recorded', async () => {
  for (const outcome of ['gatekeeper', 'audit_booked', 'booked', 'bad_lead', 'nonsense']) {
    const answer = await record(table(), { id: UUID, outcome }, OWNER)
    same(answer.status, 400, `${outcome} was taken`)
  }
})

/** A business id the endpoint will read, and the owner recording against it. */
const UUID = '6f1c3a52-6a0e-4b8e-9d1f-0c2a8e5b7d10'
const OWNER = { userId: '9b2e4f10-1d3c-4a5b-8e7f-102030405060' }

/** A database holding one business, and the endpoint's answer to a call against it. */
async function callOn(over, body) {
  const db = database({
    outreach_prospects: [business(UUID, over)],
    outreach_calls: [],
    leads: [],
  })
  const answer = await record(db, { id: UUID, ...body }, OWNER)
  return { db, answer }
}

check('a time goes with Call Back and nothing else', async () => {
  const later = new Date(Date.now() + 86_400_000).toISOString()
  const { answer } = await callOn({}, { outcome: 'no_answer', callback_at: later })
  same(answer.status, 400, 'a no answer with a time')
  const past = await callOn({}, { outcome: 'callback', callback_at: '2020-01-01T00:00:00Z' })
  same(past.answer.status, 400, 'a call back in the past')
})

check('a business the list would not offer takes no call', async () => {
  same((await callOn({ stage: 'unsubscribed' }, { outcome: 'spoke' })).answer.status, 409, 'stop')
  same((await callOn({ stage: 'skipped' }, { outcome: 'spoke' })).answer.status, 409, 'skipped')
  same((await callOn({ phone: '' }, { outcome: 'spoke' })).answer.status, 409, 'no number')
  const missing = database({ outreach_prospects: [], outreach_calls: [] })
  same((await record(missing, { id: UUID, outcome: 'spoke' }, OWNER)).status, 404, 'unknown')
  same((await record(missing, { id: 'x', outcome: 'spoke' }, OWNER)).status, 400, 'not an id')
})

check('a call back nobody timed is filed a day out', async () => {
  const { db, answer } = await callOn({}, { outcome: 'callback', note: 'try tomorrow' })
  same(answer.status, 200, 'the status')
  const call = db.writes.find(one => one.table === 'outreach_calls').row
  const hours = (Date.parse(call.callback_at) - Date.now()) / 3_600_000
  ok(hours > 23.9 && hours <= 24, `the call back lands ${hours} hours out`)
  same(call.note, 'try tomorrow', 'the note')
  same(call.called_by, OWNER.userId, 'who rang')
  same(answer.body.callback_at, call.callback_at, 'the time comes back to the page')
})

check('a conversation becomes a lead and a ring-out does not', async () => {
  const spoke = await callOn({}, { outcome: 'spoke' })
  ok(
    spoke.db.rpcs.some(one => one.name === 'lead_record'),
    'a conversation made no lead'
  )
  const nobody = await callOn({}, { outcome: 'no_answer' })
  ok(!nobody.db.rpcs.some(one => one.name === 'lead_record'), 'a ring-out made a lead')
  const no = await callOn({}, { outcome: 'not_interested' })
  ok(!no.db.rpcs.some(one => one.name === 'lead_record'), 'a no made a lead')
  same(no.db.writes[0].row.interested, false, 'a no is stored as one')
})

check('nothing is claimed: the business is not handed to anybody', async () => {
  const { db } = await callOn({}, { outcome: 'spoke' })
  ok(
    !db.writes.some(one => one.table === 'outreach_prospects' && 'assigned_to' in one.row),
    'the call wrote an owner onto the business'
  )
})

// ── The page ────────────────────────────────────────────────────────────

check('the page is the owner’s list and nothing else', () => {
  const page = read('src/app/views/console/pages/calls/CallListPage.jsx')
  ok(/useCallList/.test(page), 'the page does not read the list')
  ok(/CALL_OUTCOMES\.filter\(outcome => outcome\.offered\)/.test(page), 'the results drawn')
  ok(/href=\{row\.dial\}/.test(page), 'the number is not a link to dial')
  for (const gone of ['staff', 'shift', 'presence', 'scriptFor', 'handbook', 'assigned']) {
    ok(!new RegExp(gone, 'i').test(page), `the page still mentions ${gone}`)
  }
})

await finish()

console.log(`call list: ${cases.length} checks passed`)
