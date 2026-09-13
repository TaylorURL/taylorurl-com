/**
 * Holds the outreach jobs to the writes they report having made.
 *
 * A Supabase write answers rather than throws, so awaiting one and reading
 * nothing off the answer is a write that can fail in complete silence. Two
 * failures follow from that, and both scale with the day's cap: a delivered
 * message whose status does not land stays at 'drafted' and goes out to the
 * same stranger an hour later, and an opt-out whose suppression does not land
 * leaves a business that asked to be left alone on the list with nothing
 * anywhere saying so.
 *
 * The checks come in four kinds. The static one reads both routes and refuses a
 * write whose answer nothing looks at, which holds the invariant rather than one
 * instance of it. The driven ones run each job against a database that refuses a
 * chosen write and assert the run fails rather than reports success - and, for
 * the opt-out, that the row a later run recognises the message by is not
 * written, so the next run reads the message again and finishes the job. The
 * third kind covers the postal address no message states, and the fourth covers
 * the one write that is taken again before it is given up on.
 *
 * Nothing here opens a socket. The mailbox arrives as a list and the transport
 * is a function answering with an id, so a run that reaches the send path sends
 * nothing.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { answersFrom, refused } from '../database-fixture.js'
import { installFixtureHeldDomains } from '../held-domains-fixture.js'
import { inbound } from '../inbound-fixture.js'
import { AFTERNOON, atMidAfternoon, TRANSPORT } from '../send-fixture.js'
import { cases, check, finish, ok, refusal, same } from '../../harness/checks.js'
import { MAIL_BOX, statesNoAddress } from '../../mail/mail-box-fixture.js'

installFixtureHeldDomains()

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../..')

const { checkAddress, forgetDomains } = await import('../../../lib/outreach/prospects/address.js')
const { work: watchWork } = await import('../../../api/outreach/watch.js')
const { work: sendWork } = await import('../../../api/outreach/send.js')
const { renderText, renderHtml } = await import('../../../lib/outreach/message.js')

// ── The database stand-in ────────────────────────────────────────────────

/**
 * A client that answers every query from a plan, and records what was asked.
 *
 * The plan is keyed on the operation and the table, since that pair is what
 * names a write in either route.
 *
 * The operation is fixed by the first mutating call in a chain rather than by
 * the last, so the `.select()` an insert takes to read its own row back leaves
 * that insert an insert.
 */
function stubDb(plan) {
  const asked = []
  const writes = []
  const answerFor = answersFrom(plan)

  const from = table => {
    const state = { table, op: 'select', payload: null }
    const chain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            const key = `${state.op}:${state.table}`
            asked.push(key)
            if (state.op !== 'select') writes.push({ key, payload: state.payload })
            const answer = answerFor(key)
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return (...args) => {
            if (state.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              state.op = prop
              state.payload = args[0] ?? null
            }
            return chain
          }
        },
      }
    )
    return chain
  }

  // The client the pipeline is handed has functions on it as well as tables,
  // and a reply now goes through one on its way to the lead record. A stub
  // that only models `from` answers "db.rpc is not a function" the moment the
  // code calls one, which reads as a fault in the code rather than a gap in
  // the double.
  const rpc = (name, args) => {
    const key = `rpc:${name}`
    asked.push(key)
    writes.push({ key, payload: args ?? null })
    return Promise.resolve(answerFor(key))
  }

  return { db: { from, rpc }, asked, writes }
}

// ── What the watch route is handed ───────────────────────────────────────

const PROSPECT = { id: 'p1', email: 'owner@example.com', stage: 'contacted', replied_at: null }

/** The lead row a carried reply lands on, as the merge function answers with one. */
const LEAD_ID = 'l1'

// ── The static invariant ─────────────────────────────────────────────────

const MUTATIONS = /\.(insert|update|upsert|delete)\(/

/**
 * Every write in a route whose answer nothing reads.
 *
 * A write starts at the nearest `await db` at or above it, and from there the
 * answer has to be bound - to a name or by destructuring the error out of it -
 * and that error has to be both read and capable of stopping the run. Two
 * things are therefore asked for rather than one exact spelling: the error is
 * referenced, and a throw stands within reach of it.
 *
 * The looser test is deliberate, because the shape a write takes changes with
 * what it is allowed to do about a failure. `if (written.error) throw` is one
 * answer; a write taken again inside a bounded window before it gives up is
 * another, and it reads its error to decide whether to try again rather than to
 * throw on the spot. Demanding the first spelling would have refused the second
 * on the grounds of its punctuation. What no shape may do is leave the answer
 * unread, and that is what this refuses.
 *
 * That the throw actually fires is not left to a regular expression. The driven
 * cases below run each job against a database that refuses a write and assert
 * the run fails.
 */
function uncheckedWrites(source) {
  const lines = source.split('\n')
  const loose = []

  for (const [index, line] of lines.entries()) {
    if (!MUTATIONS.test(line)) continue

    let start = index
    while (start >= 0 && !lines[start].includes('await db')) start -= 1
    if (start < 0) continue

    const opens = lines[start]
    const reach = lines.slice(start, index + 40).join('\n')
    const fault = `line ${index + 1}: ${line.trim()}`

    const named = /const\s+(\w+)\s*=\s*await db/.exec(opens)
    if (named) {
      const read = new RegExp(`\\b${named[1]}\\.error\\b`).test(reach)
      if (!read || !/\bthrow\b/.test(reach)) loose.push(fault)
      continue
    }

    if (/const\s*\{[^}]*\berror\b[^}]*\}\s*=\s*await db/.test(opens)) {
      if (!/\berror\b/.test(lines.slice(index, index + 40).join('\n'))) loose.push(fault)
      continue
    }

    loose.push(fault)
  }

  return loose
}

for (const route of ['api/outreach/send.js', 'api/outreach/watch.js']) {
  check(`every write in ${route} is read for its error`, async () => {
    const loose = uncheckedWrites(readFileSync(join(ROOT, route), 'utf8'))
    ok(!loose.length, `writes whose answer nothing reads:\n  ${loose.join('\n  ')}`)
  })
}

// ── Watch: a write that does not land stops the run ──────────────────────

check('watch fails the run when the opt-out suppression is refused', async () => {
  const { db, asked } = stubDb({
    'select:outreach_messages': { data: [], error: null },
    'select:outreach_prospects': { data: [PROSPECT], error: null },
    'update:outreach_prospects': { error: null },
    'upsert:suppression': refused('suppression write refused'),
  })

  const counts = { examined: 0, changed: 0 }
  const why = await refusal(() =>
    watchWork({ db, counts, read: async () => [inbound('please unsubscribe me')] })
  )

  same(why, 'suppression write refused', 'the reason the run gave')
  same(counts.changed, 0, 'rows counted as changed')
  ok(
    !asked.includes('insert:outreach_messages'),
    'the message is marked as handled while its suppression is missing, so no later run retries it'
  )
})

check('watch fails the run when the bounce suppression is refused', async () => {
  const report = inbound('', {
    bounce: true,
    body: 'Final-Recipient: rfc822; owner@example.com\nStatus: 5.1.1\n',
    envelope: {
      messageId: '<bounce-1@example.com>',
      subject: 'Delivery Status Notification (Failure)',
      from: [{ address: 'mailer-daemon@example.com' }],
      to: [{ address: 'studio@example.com' }],
      date: '2026-08-29T15:00:00.000Z',
    },
  })

  const { db, asked } = stubDb({
    'select:outreach_messages': { data: [], error: null },
    'select:outreach_prospects': { data: [PROSPECT], error: null },
    'update:outreach_prospects': { error: null },
    'upsert:suppression': refused('suppression write refused'),
  })

  const counts = { examined: 0, changed: 0 }
  const why = await refusal(() => watchWork({ db, counts, read: async () => [report] }))

  same(why, 'suppression write refused', 'the reason the run gave')
  ok(
    !asked.includes('insert:outreach_messages'),
    'the bounce is recorded ahead of the suppression it depends on'
  )
})

check('watch fails the run when the stage write is refused', async () => {
  const { db } = stubDb({
    'select:outreach_messages': { data: [], error: null },
    'select:outreach_prospects': { data: [PROSPECT], error: null },
    'update:outreach_prospects': refused('stage write refused'),
  })

  const counts = { examined: 0, changed: 0 }
  const why = await refusal(() =>
    watchWork({ db, counts, read: async () => [inbound('thanks, tell me more')] })
  )

  same(why, 'stage write refused', 'the reason the run gave')
  same(counts.changed, 0, 'rows counted as changed')
})

check('watch counts a reply only once every one of its writes has landed', async () => {
  const { db } = stubDb({
    'select:outreach_messages': [
      { data: [], error: null },
      { data: [], error: null },
    ],
    'select:outreach_prospects': { data: [PROSPECT], error: null },
    'update:outreach_prospects': { error: null },
    'insert:outreach_messages': { error: null },
    'rpc:lead_record': { data: { ok: true, lead_id: LEAD_ID, fresh: true }, error: null },
    'update:leads': { error: null },
  })

  const counts = { examined: 0, changed: 0 }
  const answer = await watchWork({
    db,
    counts,
    read: async () => [inbound('thanks, tell me more')],
  })

  same(answer.replies, 1, 'replies read')
  same(counts.changed, 1, 'rows counted as changed')
})

check('a person answering a cold letter becomes a lead', () => {
  // The reply is what turns a name off a map into somebody worth following up,
  // and it is the only thing that does. Read here because the failure is
  // silent in both directions: a prospect who never replied appearing as a
  // lead buries the ones who did, and a reply that never becomes one leaves
  // the console showing nothing while somebody waits for an answer.
  const text = readFileSync(join(ROOT, 'api/outreach/watch.js'), 'utf8')
  same(text.includes('carryReply('), true, 'the reply is not carried to the lead record')
  same(text.includes('SOURCES.outreachReply'), true, 'the door is not named')
  same(
    text.includes('if (!asked.optOut) {'),
    true,
    'somebody asking to be left alone must not become a lead'
  )
})

// ── Send: the writes around the transport ────────────────────────────────

forgetDomains()
await checkAddress(null, 'owner@example.com', {
  now: AFTERNOON,
  resolveMx: async () => [{ exchange: 'mx.example.com', priority: 10 }],
})

const SETTINGS = {
  sending_enabled: true,
  daily_cap: 5,
  from_name: 'TaylorURL',
  from_address: 'studio@example.com',
}

/** A business with no site of its own, so no capture is fetched for it. */
const SENDABLE = {
  id: 'p9',
  name: 'Baytown Plumbing',
  town: 'Baytown',
  trade: 'plumber',
  website: null,
  email: 'owner@example.com',
  audit_score: null,
  site_kind: 'social',
  stage: 'enriched',
  unsub_token: '11111111-1111-1111-1111-111111111111',
}

/** A message already composed, so the run delivers rather than writes one. */
const DRAFTED = {
  id: 'm9',
  prospect_id: 'p9',
  subject: 'Your listing',
  body_text: 'text',
  body_html: '<p>html</p>',
  to_address: 'owner@example.com',
  status: 'drafted',
  variant_id: 'no-site-intro',
  created_at: '2026-08-29T17:00:00.000Z',
  sent_at: null,
}

/**
 * The reads a send run makes before it reaches its queue, answered in order.
 *
 * Three of them land on `outreach_messages`: what the cap has been spent on
 * today, the addresses already written to, and the draft this prospect is
 * holding. The middle one answers with nothing here, since these checks are
 * about a business hearing from the studio for the first time.
 */
const sendPlan = extra => ({
  'select:outreach_messages': [
    { count: 0, error: null },
    { data: [], error: null },
    { data: [DRAFTED], error: null },
  ],
  'select:outreach_prospects': { data: [SENDABLE], error: null },
  'select:suppression': { data: [], error: null },
  'update:outreach_prospects': { error: null },
  ...extra,
})

check('a delivered message puts nobody on the mailing list', async () => {
  TRANSPORT.clear()
  const { db, writes } = stubDb(sendPlan())

  await atMidAfternoon(() =>
    sendWork({ db, settings: SETTINGS, counts: { examined: 0, changed: 0 } })
  )

  same(TRANSPORT.sent.length, 1, 'messages handed to the transport')
  // Receiving a cold message is not asking for a newsletter. The sender used
  // to write a `subscribers` row for every address it wrote to, which built a
  // list out of people who had never agreed to be on one. It writes none, and
  // the only ways onto that list are the sign-up form and the console.
  const listed = writes.filter(write => write.key.endsWith(':subscribers'))
  same(listed.length, 0, 'subscribers rows written for one delivered message')
})

check('send fails the run when a delivered message cannot be marked sent', async () => {
  TRANSPORT.clear()
  const { db } = stubDb(sendPlan({ 'update:outreach_messages': refused('status write refused') }))
  const counts = { examined: 0, changed: 0 }

  const why = await atMidAfternoon(() =>
    refusal(() => sendWork({ db, settings: SETTINGS, counts }))
  )

  same(TRANSPORT.sent.length, 1, 'messages handed to the transport')
  same(why, 'status write refused', 'the reason the run gave')
  same(counts.changed, 0, 'rows counted as changed')
})

check('a bookkeeping failure does not mark a delivered message failed', async () => {
  TRANSPORT.clear()
  const { db, writes } = stubDb(
    sendPlan({ 'update:outreach_messages': refused('status write refused') })
  )

  await atMidAfternoon(() =>
    refusal(() => sendWork({ db, settings: SETTINGS, counts: { examined: 0, changed: 0 } }))
  )

  // Every write against the message row asks for 'sent'. One asking for
  // 'failed' would be the run reading its own refusal as a send that never
  // left, which files a delivered message for another attempt.
  const filed = writes.filter(write => write.key === 'update:outreach_messages')
  ok(filed.length > 0, 'the message row was never written to')
  ok(
    filed.every(write => write.payload?.status === 'sent'),
    `a delivered message was filed as ${filed.find(w => w.payload?.status !== 'sent')?.payload?.status}`
  )
})

check('a refused status write is taken again rather than lost', async () => {
  TRANSPORT.clear()
  const { db, asked } = stubDb(
    sendPlan({
      'update:outreach_messages': [refused('the first attempt was refused'), { error: null }],
    })
  )
  const counts = { examined: 0, changed: 0 }

  const answer = await atMidAfternoon(() => sendWork({ db, settings: SETTINGS, counts }))

  same(answer.sent, 1, 'messages sent')
  same(counts.changed, 1, 'rows counted as changed')
  same(TRANSPORT.sent.length, 1, 'messages handed to the transport')
  same(
    asked.filter(call => call === 'update:outreach_messages').length,
    2,
    'attempts at the status write'
  )
})

check('a status write that never lands still stops the run', async () => {
  TRANSPORT.clear()
  const { db, asked } = stubDb(
    sendPlan({ 'update:outreach_messages': refused('every attempt was refused') })
  )
  const counts = { examined: 0, changed: 0 }
  const started = Date.now()

  const why = await atMidAfternoon(() =>
    refusal(() => sendWork({ db, settings: SETTINGS, counts }))
  )

  same(why, 'every attempt was refused', 'the reason the run gave')
  same(counts.changed, 0, 'rows counted as changed')
  same(
    asked.filter(call => call === 'update:outreach_messages').length,
    3,
    'attempts at the status write'
  )
  // The bound is wall clock as much as attempts, since a full run has little of
  // its five minutes left to lend to any one of them.
  ok(Date.now() - started < 5000, 'the attempts ran past the window they are allowed')
})

check('send fails the run when a sent message cannot move its prospect on', async () => {
  TRANSPORT.clear()
  const { db } = stubDb(
    sendPlan({
      'update:outreach_messages': { error: null },
      // The claim taken before the transport lands; the move to 'contacted'
      // after it does not.
      'update:outreach_prospects': [{ error: null }, refused('stage write refused')],
    })
  )
  const counts = { examined: 0, changed: 0 }

  const why = await atMidAfternoon(() =>
    refusal(() => sendWork({ db, settings: SETTINGS, counts }))
  )

  same(why, 'stage write refused', 'the reason the run gave')
})

check('send counts a message only once every one of its writes has landed', async () => {
  TRANSPORT.clear()
  const { db } = stubDb(sendPlan({ 'update:outreach_messages': { error: null } }))
  const counts = { examined: 0, changed: 0 }

  const answer = await atMidAfternoon(() => sendWork({ db, settings: SETTINGS, counts }))

  same(answer.sent, 1, 'messages sent')
  same(counts.changed, 1, 'rows counted as changed')
  same(TRANSPORT.sent.length, 1, 'messages handed to the transport')
})

// ── The postal address ───────────────────────────────────────────────────

/** One message, in the shape both halves take. */
const message = (contact = {}) => ({
  subject: 'Your website',
  marker: '// Speed Reading',
  greeting: 'there',
  lines: ['One line.'],
  figure: {
    label: 'PageSpeed',
    meta: 'Mobile',
    value: '52',
    unit: 'out of 100',
    band: 'poor',
    meaning: 'Slower than most visitors will wait for.',
    site: null,
    also: [],
    note: null,
  },
  after: ['A second line.'],
  close: 'Closing line.',
  work: [],
  track: null,
  contact: { phone: '', unsubscribe: 'https://example.com/u/1', ...contact },
})

// ── The way to check the figure ──────────────────────────────────────────

const { verify } = await import('../../../lib/outreach/audit/bands.js')

/** A message whose reading was taken on a real address and carries the check. */
const checked = () => {
  const content = message()
  content.figure.site = { url: 'https://www.example.com/?a=1&b=2', name: 'Example', shot: null }
  content.figure.note = verify('https://www.example.com/?a=1&b=2')
  return content
}

check("the check runs Google's test on the reader's own address, from both halves", () => {
  const content = checked()
  const href =
    'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.example.com%2F%3Fa%3D1%26b%3D2&form_factor=mobile'

  const text = renderText(content)
  ok(text.includes(`\n${href}\n`), 'the text half puts the address on a line of its own')
  ok(
    text.includes('CHECK IT YOURSELF (GOOGLE PAGESPEED INSIGHTS)'),
    'the text half labels the check'
  )

  const html = renderHtml(content)
  ok(html.includes(`href="${href.replace(/&/g, '&amp;')}"`), 'the laid-out half links the address')
  ok(html.includes('>pagespeed.web.dev</a>'), 'the link reads as the host it goes to')
  ok(html.includes('Check It Yourself'), 'the laid-out half labels the check')
  ok(html.includes('Google PageSpeed Insights'), 'the laid-out half names whose test it is')
})

check('a reading with no way to check it renders without the row', () => {
  const html = renderHtml(message())
  ok(!html.includes('Check It Yourself'), 'no label without a note')
  ok(!html.includes('pagespeed.web.dev'), 'no link without a note')
})

check('a send run with no postal address configured composes and sends', async () => {
  const script = `
    const { work } = await import(${JSON.stringify(join(ROOT, 'api/outreach/send.js'))})
    const db = { from: () => new Proxy({}, { get: (_, p) =>
      p === 'then' ? (r => r({ data: [], error: null, count: 0 })) : () => db.from() }) }
    try {
      const answer = await work({ db, settings: ${JSON.stringify(SETTINGS)}, counts: { examined: 0, changed: 0 } })
      console.log('RAN', JSON.stringify(answer))
    } catch (cause) {
      console.log('REFUSED', cause.message)
    }
  `
  const said = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    env: { ...process.env, OUTREACH_POSTAL_ADDRESS: '' },
    encoding: 'utf8',
  }).trim()

  ok(said.startsWith('RAN'), `the run finished rather than refusing: ${said}`)
})

check('a message renders with no address on its contact block', async () => {
  const content = message()
  ok(await renderText(content), 'the text half rendered')
  ok(await renderHtml(content), 'the laid-out half rendered')
})

check('neither half states the mail box', () => {
  const content = message()
  statesNoAddress(renderText(content), 'the text half')
  statesNoAddress(renderHtml(content), 'the laid-out half')
})

check('an address a stale caller still sets reaches neither half', () => {
  const content = message({ address: MAIL_BOX })
  statesNoAddress(renderText(content), 'the text half')
  statesNoAddress(renderHtml(content), 'the laid-out half')
})

check('the send route neither reads the variable nor names an address', () => {
  const source = readFileSync(join(ROOT, 'api/outreach/send.js'), 'utf8')
  ok(!source.includes('OUTREACH_POSTAL_ADDRESS'), 'the variable is not read')
  ok(!/postal/i.test(source), 'no postal address is named')
})

// ── Run them ────────────────────────────────────────────────────────────

await finish()

console.log(`outreach writes: ${cases.length} checks passed`)
