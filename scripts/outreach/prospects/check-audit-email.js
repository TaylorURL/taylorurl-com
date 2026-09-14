/**
 * Drives the audit email door the way the call screen does, and holds it to
 * what a caller is promised.
 *
 *   npm run check:audit-email
 *
 * Everything worth checking here fails silently. A business sent its own report
 * twice reads as a studio that is not paying attention, and nothing in a log
 * says it happened: both requests succeeded, both wrote a row, and the only
 * record of the fault is in somebody else's inbox. A message that escaped a
 * business name wrongly is worse, because the name came off a listing somebody
 * scraped and the message went out signed by the studio.
 *
 * So the cases run the path rather than reading it. The database is stood in
 * for at the query - the filters, the `or` group the claim turns on and the
 * exact count header a ceiling is read off - and the provider is a recorder, so
 * a claim whose condition is written the wrong way round is a case that fails
 * here instead of a second message that arrives on a Tuesday.
 *
 * Nothing in this file opens a socket. Every domain reading is seeded into the
 * stand-in's own cache table, which is the path `checkAddress` takes before it
 * ever reaches a resolver, and the only transport is the recorder. No message
 * leaves and no address outside example.com appears.
 */

import { installHeldDomains } from '../../../lib/outreach/prospects/exclusions.js'
import { forgetDomains } from '../../../lib/outreach/prospects/address.js'
import { authorizeCaller } from '../../../lib/db/clients.js'
import { BIO_PORTRAIT, bioText } from '../../../lib/mail/bio.js'
import { TRADING_LINE } from '../../../lib/mail/identity.js'
import { cases, check, finish, ok, quietly, same } from '../../harness/checks.js'
import { token } from '../../auth/token-fixture.js'
import handler, { claimAudit, refusalFor, send } from '../../../api/calls-audit-email.js'

// Read by `shapeOf` before it will judge an address. Installed empty, because
// which businesses have asked to be left alone is a fact in the database and
// this file is about the door rather than about that list.
installHeldDomains([])

const NOW = new Date('2026-09-14T15:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

const KEY = 'a-resend-key-for-the-cases'
const CALLER = { userId: 'account-staff', email: 'dj@taylorurl.com', role: 'staff' }
const OWNER = 'owner@example.com'

/**
 * A measured business as the call list holds one.
 *
 * The name is markup and quotes on purpose. It is the one field on the row that
 * a person typed, and the message is the studio's own signature over it.
 */
const PROSPECT = {
  id: '6f3a1c2e-5b47-4d18-9a02-7c51e8d3b940',
  name: 'Bay <b>Side</b> & "Sons"',
  trade: 'electrician',
  town: 'Baytown',
  website: 'https://www.example.com/',
  site_kind: 'own',
  stage: 'audited',
  email: null,
  unsub_token: '0f19a4c7-2d68-4f31-8b5e-1a7c93d20e46',
  audit_emailed_at: null,
  audit_emailed_by: null,
  audit_emailed_to: null,
  audit_score: 39,
  accessibility_score: 71,
  best_practices_score: 78,
  seo_score: 85,
  audit_at: '2026-09-12T13:20:00Z',
  audit_raw: {
    strategy: 'mobile',
    final_url: 'https://www.example.com/',
    opportunities: [
      { id: 'unused-javascript', title: 'Reduce unused JavaScript', savings_ms: 760 },
      { id: 'redirects', title: 'Avoid multiple page redirects', savings_ms: 630 },
    ],
  },
}

/**
 * The call the caller logged before pressing send, carrying the time the
 * owner named. Six in the evening UTC on the day of the cases, which is four
 * in the afternoon Central: the message says the Central hour, and the check
 * reads it back in those words.
 */
const CALL = {
  id: 'call-1',
  prospect_id: PROSPECT.id,
  outcome: 'audit_booked',
  callback_at: '2026-09-14T21:00:00Z',
  called_at: '2026-09-14T14:30:00Z',
}

/** A domain reading as `outreach_domains` holds one, fresh enough to stand. */
const domainRow = (domain, verdict, reason = null) => ({
  domain,
  verdict,
  reason,
  checked_at: NOW.toISOString(),
})

/* ── The database, as a query answers ───────────────────────────────────── */

/** One `column.operator.value` clause out of an `or` group. */
function clauseOf(expression) {
  const column = expression.slice(0, expression.indexOf('.'))
  const rest = expression.slice(column.length + 1)
  if (rest === 'is.null') return row => row[column] == null
  if (rest.startsWith('lt.')) {
    const value = rest.slice('lt.'.length)
    return row => row[column] != null && String(row[column]) < value
  }
  throw new Error(`the endpoint used a clause these cases do not know: ${expression}`)
}

/**
 * A read, which collects its filters and answers rows or a count.
 *
 * Rows come back as copies, because that is what a driver hands over: a
 * request holding a live reference to the table would see a claim another
 * request took after it read, and the rollback would restore the claim it was
 * meant to undo.
 */
function reading(rows, counting) {
  const filters = []
  let matching = () => rows.filter(row => filters.every(pass => pass(row))).map(row => ({ ...row }))
  const api = {
    eq(column, value) {
      filters.push(row => String(row[column] ?? '') === String(value))
      return api
    },
    in(column, values) {
      filters.push(row => values.includes(row[column]))
      return api
    },
    gte(column, value) {
      filters.push(row => row[column] != null && String(row[column]) >= String(value))
      return api
    },
    not(column, operator, value) {
      if (operator !== 'is' || value !== null) {
        throw new Error(`the endpoint used a not() these cases do not know: ${operator} ${value}`)
      }
      filters.push(row => row[column] != null)
      return api
    },
    order(column, { ascending = true } = {}) {
      const before = matching
      matching = () =>
        before().sort((one, two) => {
          const flip = ascending ? 1 : -1
          return String(one[column] ?? '').localeCompare(String(two[column] ?? '')) * flip
        })
      return api
    },
    limit(count) {
      const before = matching
      matching = () => before().slice(0, count)
      return api
    },
    async maybeSingle() {
      return { data: matching()[0] ?? null, error: null }
    },
    then(resolve, reject) {
      const found = matching()
      const answer = counting
        ? { data: null, count: found.length, error: null }
        : { data: found, error: null }
      return Promise.resolve(answer).then(resolve, reject)
    },
  }
  return api
}

/** A write, which applies its patch to whatever its filters matched. */
function writing(table, rows, patch, writes) {
  const filters = []
  let done = false
  const apply = () => {
    if (done) return []
    done = true
    const hit = rows.filter(row => filters.every(pass => pass(row)))
    for (const row of hit) {
      writes.push({ table, id: row.id, patch })
      Object.assign(row, patch)
    }
    return hit
  }
  const api = {
    eq(column, value) {
      filters.push(row => String(row[column] ?? '') === String(value))
      return api
    },
    or(group) {
      const clauses = group.split(',').map(clauseOf)
      filters.push(row => clauses.some(pass => pass(row)))
      return api
    },
    select() {
      return Promise.resolve({ data: apply().map(row => ({ id: row.id })), error: null })
    },
    then(resolve, reject) {
      apply()
      return Promise.resolve({ data: null, error: null }).then(resolve, reject)
    },
  }
  return api
}

/**
 * The tables one case runs against, and what was written to them.
 *
 * A case builds a world, drives the endpoint against it, and reads the rows
 * back afterwards, so what the endpoint wrote is checked against the table
 * rather than against what the answer claimed.
 */
function world({
  prospects = [PROSPECT],
  calls = [CALL],
  suppression = [],
  domains = [],
  profiles = [],
} = {}) {
  const tables = {
    outreach_prospects: prospects.map(row => ({ ...row })),
    outreach_calls: calls.map(row => ({ ...row })),
    suppression,
    outreach_domains: domains,
    profiles,
  }
  const writes = []
  const db = {
    from(table) {
      const rows = tables[table]
      if (!rows) throw new Error(`these cases hold no table called ${table}`)
      return {
        select: (_columns, options) => reading(rows, Boolean(options?.count)),
        update: patch => writing(table, rows, patch, writes),
        upsert: async () => ({ error: null }),
      }
    },
  }
  return { db, tables, writes }
}

/** A provider that records what it was handed, and refuses when told to. */
function recorder({ refuses = false } = {}) {
  const handed = []
  const transport = async (message, key, envelope) => {
    handed.push({ message, key, envelope })
    if (refuses) throw new Error('resend returned 500')
    return 'message-id'
  }
  return { handed, transport }
}

/** One press of the button, against a world of its own. */
function press(stage, { body, account = CALLER, transport, key = KEY } = {}) {
  return send({ db: stage.db, account, body, now: NOW, transport, key })
}

/* ── The door ───────────────────────────────────────────────────────────── */

/** A response, as the platform hands one to a handler. */
function reply() {
  const answer = { status: 0, body: null, headers: {} }
  const api = {
    setHeader(name, value) {
      answer.headers[name] = value
    },
    status(code) {
      answer.status = code
      return api
    },
    json(payload) {
      answer.body = payload
      return api
    },
    answer,
  }
  return api
}

check('a request with no session is refused at the door', async () => {
  const response = reply()
  await handler({ url: '/api/calls-audit-email', method: 'POST', headers: {} }, response)
  same(response.answer.status, 401, 'refused')
  ok(
    /sign/i.test(response.answer.body.error),
    `the sentence reads: "${response.answer.body.error}"`
  )
})

check('a client account is refused by the role the door asks for', async () => {
  // The same helper the handler calls, driven the way check-caller-door.js
  // drives it. A client that reached this endpoint would be a client sending
  // mail as the studio.
  const clients = {
    verifier: {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'account-client', email: 'somebody@example.com' } },
          error: null,
        }),
      },
    },
    db: {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { role: 'client' }, error: null }) }),
        }),
      }),
    },
  }
  const answer = await authorizeCaller(clients, token('account-client'))
  same(answer.status, 403, 'refused')
  same(answer.userId, undefined, 'no account handed back')
})

/* ── What may be sent ───────────────────────────────────────────────────── */

check('a business that asked for no further contact is refused', async () => {
  const refused = refusalFor({ ...PROSPECT, stage: 'unsubscribed' }, NOW)
  same(refused.status, 409, 'refused')
  ok(/no further contact/.test(refused.body.error), `the sentence reads: "${refused.body.error}"`)
})

check('a business somebody skipped is refused', async () => {
  const refused = refusalFor({ ...PROSPECT, stage: 'skipped' }, NOW)
  same(refused.status, 409, 'refused')
})

check('a business with no reading on file is refused', async () => {
  const refused = refusalFor({ ...PROSPECT, audit_score: null, audit_at: null }, NOW)
  same(refused.status, 409, 'refused')
  ok(/no audit on file/.test(refused.body.error), `the sentence reads: "${refused.body.error}"`)
})

check('a business already sent its audit today says who sent it', async () => {
  const refused = refusalFor(
    {
      ...PROSPECT,
      audit_emailed_at: new Date(NOW.getTime() - 60_000).toISOString(),
      audit_emailed_by: 'account-other',
      audit_emailed_to: OWNER,
    },
    NOW
  )
  same(refused.status, 409, 'refused')
  same(refused.body.audit_emailed_by, 'account-other', 'who sent it')
  same(refused.body.audit_emailed_to, OWNER, 'where it went')
})

check('a reading a day old is sendable again', async () => {
  const refused = refusalFor(
    {
      ...PROSPECT,
      audit_emailed_at: new Date(NOW.getTime() - DAY_MS - 60_000).toISOString(),
      audit_emailed_by: 'account-other',
      audit_emailed_to: OWNER,
    },
    NOW
  )
  same(refused, null, 'nothing refused it')
})

check('an address that reaches nobody is refused before anything is read', async () => {
  const stage = world()
  const { handed, transport } = recorder()
  const answer = await press(stage, {
    body: { id: PROSPECT.id, email: 'noreply@example.com' },
    transport,
  })
  same(answer.status, 400, 'refused')
  same(handed.length, 0, 'nothing was handed over')
  same(stage.writes.length, 0, 'nothing was written')
})

check('an address that is not an address is refused', async () => {
  const stage = world()
  const { handed, transport } = recorder()
  const answer = await press(stage, { body: { id: PROSPECT.id, email: 'owner at' }, transport })
  same(answer.status, 400, 'refused')
  same(handed.length, 0, 'nothing was handed over')
})

check('a business nothing knows about is a 404', async () => {
  const stage = world({ prospects: [], domains: [domainRow('example.com', 'deliverable')] })
  const answer = await press(stage, { body: { id: PROSPECT.id, email: OWNER } })
  same(answer.status, 404, 'refused')
})

check('an address on the suppression list is refused', async () => {
  forgetDomains()
  const stage = world({
    suppression: [{ email: OWNER }],
    domains: [domainRow('example.com', 'deliverable')],
  })
  const { handed, transport } = recorder()
  const answer = await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  same(answer.status, 409, 'refused')
  ok(/no more mail/.test(answer.body.error), `the sentence reads: "${answer.body.error}"`)
  same(handed.length, 0, 'nothing was handed over')
  same(stage.writes.length, 0, 'nothing was written')
})

check('a domain that takes no mail is refused before the row is claimed', async () => {
  forgetDomains()
  const stage = world({
    prospects: [{ ...PROSPECT, website: 'https://www.nomail.example/' }],
    domains: [domainRow('nomail.example', 'undeliverable', 'no_mx')],
  })
  const { handed, transport } = recorder()
  const answer = await press(stage, {
    body: { id: PROSPECT.id, email: 'owner@nomail.example' },
    transport,
  })
  same(answer.status, 422, 'refused')
  same(handed.length, 0, 'nothing was handed over')
  same(stage.tables.outreach_prospects[0].audit_emailed_at, null, 'the row was left unclaimed')
})

check('a deployment with no mail key refuses before claiming anything', async () => {
  const stage = world({ domains: [domainRow('example.com', 'deliverable')] })
  const answer = await press(stage, { body: { id: PROSPECT.id, email: OWNER }, key: '' })
  same(answer.status, 503, 'refused')
  same(stage.writes.length, 0, 'nothing was written')
})

check('a business with no callback logged is refused, and told to log one', async () => {
  forgetDomains()
  const stage = world({ calls: [], domains: [domainRow('example.com', 'deliverable')] })
  const { handed, transport } = recorder()
  const answer = await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  same(answer.status, 409, 'refused')
  ok(/Log the callback first/.test(answer.body.error), `the sentence reads: "${answer.body.error}"`)
  same(handed.length, 0, 'nothing was handed to the transport')
  same(stage.writes.length, 0, 'nothing was written')
})

check('a callback already behind them is refused the same way', async () => {
  forgetDomains()
  const stage = world({
    calls: [{ ...CALL, callback_at: '2026-09-14T14:00:00Z' }],
    domains: [domainRow('example.com', 'deliverable')],
  })
  const { handed, transport } = recorder()
  const answer = await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  same(answer.status, 409, 'refused')
  ok(/has passed/.test(answer.body.error), `the sentence reads: "${answer.body.error}"`)
  same(handed.length, 0, 'nothing was handed to the transport')
})

check('the newest logged time is the one the message says, not the first', async () => {
  forgetDomains()
  const stage = world({
    calls: [
      {
        ...CALL,
        id: 'call-1',
        callback_at: '2026-09-14T19:00:00Z',
        called_at: '2026-09-14T13:00:00Z',
      },
      {
        ...CALL,
        id: 'call-2',
        callback_at: '2026-09-14T21:00:00Z',
        called_at: '2026-09-14T14:30:00Z',
      },
    ],
    domains: [domainRow('example.com', 'deliverable')],
  })
  const { handed, transport } = recorder()
  await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  const { text } = handed[0].message
  ok(text.includes('4:00 PM Central'), 'the newest time is not the one said')
  ok(!text.includes('2:00 PM Central'), 'the older time is still in the message')
})

/* ── The message ────────────────────────────────────────────────────────── */

check('one press sends one message, and the row records it', async () => {
  forgetDomains()
  const stage = world({
    domains: [domainRow('example.com', 'deliverable')],
    profiles: [{ id: CALLER.userId, full_name: 'Dylan Jordan' }],
  })
  const { handed, transport } = recorder()
  const answer = await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })

  same(answer.status, 200, 'sent')
  same(answer.body.ok, true, 'the answer says so')
  same(answer.body.audit_emailed_to, OWNER, 'where it went')
  same(answer.body.audit_emailed_by, CALLER.userId, 'who sent it')
  same(answer.body.audit_emailed_by_name, 'Dylan Jordan', 'the name the screen draws')
  same(handed.length, 1, 'the transport was handed the message exactly once')

  const row = stage.tables.outreach_prospects[0]
  same(row.audit_emailed_to, OWNER, 'the row records the address')
  same(row.audit_emailed_by, CALLER.userId, 'the row records the caller')
  ok(row.audit_emailed_at, 'the row records when')
  same(row.email, OWNER, 'the address the caller was given is written onto the row')
  same(row.email_source, 'call', 'and where it came from')

  const { envelope, message } = handed[0]
  same(envelope.to.join(), OWNER, 'the envelope is addressed to the owner')
  same(envelope.urgent, false, "a stranger's message does not arrive shouting")
  // Not a list, so no one-click header: one copy goes to the one person who
  // asked for it on the phone, and the stop already on record is honoured by
  // the refusal above rather than by a link in the message.
  ok(!envelope.headers?.['List-Unsubscribe'], 'the message carries a one-click header')
  same(message.replyTo, CALLER.email, "an answer reaches the caller's own inbox")
})

check("the message escapes what a person typed into the business's name", async () => {
  forgetDomains()
  const stage = world({ domains: [domainRow('example.com', 'deliverable')] })
  const { handed, transport } = recorder()
  await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  const { html } = handed[0].message

  ok(!html.includes('<b>Side</b>'), 'the raw tag reached the message')
  ok(html.includes('Bay &lt;b&gt;Side&lt;/b&gt;'), 'the name was not escaped')
  ok(html.includes('&amp;'), 'the ampersand was not escaped')
  ok(html.includes('&quot;Sons&quot;'), 'the quotes were not escaped')
})

check('both halves carry the four scores, the date and the next call', async () => {
  forgetDomains()
  const stage = world({ domains: [domainRow('example.com', 'deliverable')] })
  const { handed, transport } = recorder()
  await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  const { html, text } = handed[0].message

  for (const label of ['Performance', 'Accessibility', 'Best Practices', 'SEO']) {
    ok(html.includes(label), `the laid-out half leaves out ${label}`)
    ok(text.includes(label), `the plain half leaves out ${label}`)
  }
  for (const score of ['39', '71', '78', '85']) {
    ok(html.includes(score), `the laid-out half leaves out the ${score}`)
    ok(text.includes(score), `the plain half leaves out the ${score}`)
  }
  ok(/September 12, 2026/.test(html), 'the laid-out half does not say when it was measured')
  ok(/September 12, 2026/.test(text), 'the plain half does not say when it was measured')
  // The message closes on the call the caller booked, said in the Central
  // hour the owner heard on the phone, and on nothing else: no button, no
  // link onto the site, because the reader already said yes to the call.
  ok(
    html.includes('Monday, September 14 at 4:00 PM Central'),
    'the laid-out half does not say when we ring'
  )
  ok(
    text.includes('Monday, September 14 at 4:00 PM Central'),
    'the plain half does not say when we ring'
  )
  ok(!html.includes('/start'), 'the laid-out half still points at /start')
  ok(!text.includes('/start'), 'the plain half still points at /start')
  ok(!/Start a Project/i.test(html), 'the laid-out half still carries the button')
  ok(html.includes('pagespeed.web.dev'), 'the reader is not given the test to run themselves')
  ok(text.includes('pagespeed.web.dev'), 'the plain half leaves the test out')
})

check('neither half quotes a figure, because the price comes off the next call', async () => {
  forgetDomains()
  const stage = world({ domains: [domainRow('example.com', 'deliverable')] })
  const { handed, transport } = recorder()
  await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  const { html, text, subject } = handed[0].message

  for (const [half, body] of [
    ['subject', subject],
    ['the laid-out half', html],
    ['the plain half', text],
  ]) {
    const typed = body.match(/\$[0-9][0-9,.]*/g)
    ok(!typed, `${half} quotes a figure: ${typed}`)
  }
})

check('neither half carries an unsubscribe link or a biography', async () => {
  forgetDomains()
  const stage = world({ domains: [domainRow('example.com', 'deliverable')] })
  const { handed, transport } = recorder()
  await press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  const { text, html } = handed[0].message

  // It is one report to one person who asked for it, not a list, so nothing
  // in it offers a way off one. And the reader booked a call with a person
  // this morning, so nobody introduces themselves under the report either.
  for (const [what, part] of [
    ['the text', text],
    ['the laid-out half', html],
  ]) {
    ok(!/unsubscribe/i.test(part), `${what} carries an unsubscribe link`)
    ok(!part.includes(BIO_PORTRAIT), `${what} carries the portrait`)
    ok(!part.includes(bioText()), `${what} carries the biography`)
    ok(part.includes(TRADING_LINE), `${what} does not say who sent it`)
  }
})

/* ── The claim ──────────────────────────────────────────────────────────── */

check('two presses at once send one message', async () => {
  forgetDomains()
  const stage = world({ domains: [domainRow('example.com', 'deliverable')] })
  const { handed, transport } = recorder()

  const [first, second] = await Promise.all([
    press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport }),
    press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport }),
  ])

  same(handed.length, 1, 'the transport was handed the message more than once')
  const answers = [first.status, second.status].sort()
  same(answers.join(), '200,409', 'one sent and one was told somebody else had')
})

check('a claim already taken today matches nothing', async () => {
  const stage = world({
    prospects: [{ ...PROSPECT, audit_emailed_at: NOW.toISOString(), audit_emailed_by: 'other' }],
  })
  const took = await claimAudit(stage.db, {
    id: PROSPECT.id,
    email: OWNER,
    userId: CALLER.userId,
    row: PROSPECT,
    now: NOW,
  })
  same(took, false, 'the claim was taken from under somebody')
})

check('a transport that refuses gives the claim back and says nothing was sent', async () => {
  forgetDomains()
  const stage = world({ domains: [domainRow('example.com', 'deliverable')] })
  const { handed, transport } = recorder({ refuses: true })
  const answer = await quietly(() =>
    press(stage, { body: { id: PROSPECT.id, email: OWNER }, transport })
  )

  same(answer.status, 502, 'the caller is told the send failed')
  ok(/nothing was sent/i.test(answer.body.error), `the sentence reads: "${answer.body.error}"`)
  same(handed.length, 1, 'the transport was reached')

  const row = stage.tables.outreach_prospects[0]
  same(row.audit_emailed_at, null, 'the claim was left standing on a message nobody got')
  same(row.audit_emailed_by, null, 'the caller was left recorded as having sent it')
  same(row.audit_emailed_to, null, 'the address was left recorded as having been written to')
})

const passed = await finish({
  hint: 'One press is one message, and a refused send leaves the business sendable.',
})

console.log(
  `\naudit email door: ${passed}/${cases.length} passed. One press sends one message, two at ` +
    'once send one, a refused send gives the row back, and neither half of the message quotes a ' +
    'figure.'
)
