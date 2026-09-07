/**
 * Holds the client notifications endpoint to the four things that decide
 * whether it can be left open, and to the one thing it must never break.
 *
 * The one thing is the sheet. `lib/mail/frame.js` draws every message this
 * domain sends - the enquiry notice, the studio's own notices, an issue of the
 * newsletter and the signup confirmation - and teaching it to carry somebody
 * else's identity means editing the function all four of them go through. A
 * masthead change that looks harmless there silently reshapes every message the
 * studio sends, and nobody would find out from a page or a test. So the studio
 * masthead is frozen here as the exact string it has always produced, and all
 * four senders are rendered and read for it.
 *
 * The four are the ways a multi-tenant sender goes wrong.
 *
 * Sending as somebody else. The project is resolved by the digest of the secret
 * presented, never by the slug on the request, so the case that matters is a
 * real credential naming a project it does not own - which has to be refused in
 * the same words as a missing header and an unknown secret, or the endpoint
 * becomes a way to enumerate the studio's clients.
 *
 * Sending twice. The callers are crons. A sweep that never saw the answer to a
 * post will post it again, and the second one has to reach nobody. The claim is
 * written before the transport is touched and the database refuses the second,
 * so what is asserted is that the provider was handed nothing on the retry.
 *
 * Sending nothing and reporting success. A whole list paused, or standing above
 * the severity, or on the suppression list, is the exact shape of the complaint
 * this endpoint exists to answer: the alert that never arrived and never failed.
 * So a run reaching nobody has to say so in the body, and a run whose sends all
 * failed has to answer 502 and leave the claim retakeable.
 *
 * Waking somebody who did not ask to be woken. Only `urgent` carries the four
 * headers that ring a phone, and a recipient's floor decides whether they are
 * reached at all.
 *
 * No message is sent and no database is reached. The provider is a recorder and
 * the database is a stand-in that answers the calls the endpoint makes; the one
 * address that appears anywhere in this file is the studio's own.
 *
 * npm run check:notify
 */

import { createHash } from 'node:crypto'
import { INBOX, notice, sendNotice, URGENT_HEADERS } from '../../lib/mail/notice.js'
import { confirmationBodies } from '../../lib/mail/message.js'
import { htmlBody } from '../../api/contact.js'
import { renderIssueEmail } from '../../lib/mail/emailTemplate.js'
import {
  CAPS,
  SEVERITIES,
  brandOf,
  clientNotice,
  envelopeFor,
  floorsReached,
  reaches,
  readNotification,
  recipientsFor,
} from '../../lib/mail/notify.js'

// The credentials the endpoint reads at load. Neither opens anything: the
// provider is a recorder in every case that reaches one, and no Supabase client
// is ever built. They are set before the endpoint is imported rather than after,
// because a module reads its environment once.
process.env.RESEND_API_KEY = 'resend-key-for-the-cases'
const CRON_SECRET = 'a-cron-secret-for-the-cases'
process.env.CRON_SECRET = CRON_SECRET

const { deliver, resolve } = await import('../../api/notify.js')
const notifyHandler = (await import('../../api/notify.js')).default

let failures = 0
const check = (ok, said) => {
  if (!ok) {
    failures += 1
    console.error(`  FAIL ${said}`)
  }
}

/* ── The sheet ──────────────────────────────────────────────────────────── */

/**
 * The studio's masthead, exactly as it stood before the frame learned to carry
 * a brand. Every sender that speaks for the studio alone still draws this, byte
 * for byte, and a frame change that alters one character of it fails here.
 */
const STUDIO_MASTHEAD = `<tr><td bgcolor="#000000" style="padding:26px 40px;background-color:#000000;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">
      <tr>
        <td align="left" valign="middle" style="line-height:0;font-size:0;"><img src="https://www.taylorurl.com/images/email/wordmark-on-dark.png" alt="TaylorURL" width="120" height="36" style="display:block;width:120px;height:36px;border:0;outline:none;text-decoration:none;" /></td>
        <td align="right" valign="middle"><div style="font-family:'Geist Mono', Consolas, 'Courier New', Courier, monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.7;color:#9a9a9a;">TaylorURL LLC</div><div style="font-family:'Geist Mono', Consolas, 'Courier New', Courier, monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.7;color:#9a9a9a;">Baytown, TX</div><div style="font-family:'Geist Mono', Consolas, 'Courier New', Courier, monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.7;color:#9a9a9a;">(281) 862-8687</div></td>
      </tr>
    </table>
  </td></tr>`

const STUDIO_NOTICE = notice({
  label: 'Speed Check',
  subject: 'A subject',
  rows: [
    ['One', '1'],
    ['Two', '2'],
  ],
  body: 'Carried words.',
  replyTo: 'someone@example.com',
})

const SENDERS = {
  'the studio notice': STUDIO_NOTICE.html,
  'the signup confirmation': confirmationBodies(
    'https://www.taylorurl.com/confirm?t=1',
    'https://www.taylorurl.com/unsubscribe?t=1'
  ).html,
  'the enquiry notice': htmlBody({
    name: 'Sam',
    email: 'sam@example.com',
    company: 'Ace',
    projectType: 'site',
    contactMethod: 'either',
    phone: '',
    message: 'Hello there',
    form: 'contact',
    path: '/',
    campaign: null,
    referrer: '',
  }),
  'a newsletter issue': renderIssueEmail({
    issue: {
      id: 'issue',
      slug: 'first-light',
      title: 'First light',
      preheader: 'What went out',
      body: [{ type: 'paragraph', text: 'A line of copy.' }],
    },
    subscriber: {
      id: 'sub',
      email: 'reader@example.com',
      unsub_token: '11111111-2222-4333-8444-555555555555',
    },
    unsubscribeEndpoint: 'https://www.taylorurl.com/unsubscribe',
    siteUrl: 'https://www.taylorurl.com',
  }).html,
}

for (const [named, html] of Object.entries(SENDERS)) {
  check(html.includes(STUDIO_MASTHEAD), `${named} no longer draws the studio masthead unchanged`)
}

// The studio's own accent, in the eyebrow every one of them opens a passage
// with. A brand colour leaking into the default would repaint all four.
check(STUDIO_NOTICE.html.includes('#1a4ed8'), 'a studio notice lost its own accent')

/* ── The project a credential resolves to ───────────────────────────────── */

const digestOf = value => createHash('sha256').update(value).digest('hex')

const DESK_SECRET = 'a-project-secret-for-the-cases'
const SHOP_SECRET = 'another-project-secret-for-the-cases'

/**
 * Two tenants, so every case about one project is also a case about the other
 * one it must not be able to reach. Neither is a real client and the only
 * address anywhere below is the studio's own.
 */
const DESK = {
  id: 'project-desk',
  slug: 'desk',
  name: 'Example Desk',
  from_name: 'Example Desk',
  from_address: 'notifications@taylorurl.com',
  reply_to: 'trenton@taylorurl.com',
  accent: '#4b45d4',
  mark_url: '/site-icons/example.com.png',
  mark_ground: 'light',
  site_url: 'https://www.example.com',
  link_label: 'Open The Desk',
  footer_line: 'Example Desk · example.com',
  burst_limit: 12,
  daily_limit: 120,
  active: true,
}

const SHOP = {
  ...DESK,
  id: 'project-shop',
  slug: 'shop',
  name: 'Example Shop',
  from_name: 'Example Shop',
  footer_line: 'Example Shop · example.org',
  site_url: 'https://www.example.org',
}

/** How a value compares in a column that does not care about case. */
const same = (held, value) =>
  typeof held === 'string' && typeof value === 'string'
    ? held.toLowerCase() === value.toLowerCase()
    : held === value

function passes(row, [kind, column, a, b]) {
  if (kind === 'eq') return same(row[column], a)
  if (kind === 'in') return a.some(value => same(row[column], value))
  if (kind === 'gte') return String(row[column]) >= String(a)
  if (kind === 'lt') return String(row[column]) < String(a)
  if (kind === 'is') return a === null ? row[column] === null || row[column] === undefined : false
  if (kind === 'not') return b === null ? row[column] !== null && row[column] !== undefined : false
  // An `or=(clause,clause)` group, written as PostgREST takes one. Taking a
  // claim back is the only place this endpoint builds one, and a stand-in that
  // read the group as a single filter would answer every retake yes.
  if (kind === 'or') return a.split(',').some(clause => holds(row, clause))
  return true
}

/** One `column.operator.value` clause of an `or` group, against one row. */
function holds(row, clause) {
  const at = clause.indexOf('.')
  const column = clause.slice(0, at)
  const read = expression => {
    if (expression.startsWith('not.')) return !read(expression.slice(4))
    const cut = expression.indexOf('.')
    const operator = cut === -1 ? expression : expression.slice(0, cut)
    const value = cut === -1 ? '' : expression.slice(cut + 1)
    if (operator === 'is') return value === 'null' ? row[column] == null : Boolean(row[column])
    if (operator === 'lt') return String(row[column] ?? '') < value
    if (operator === 'gte') return String(row[column] ?? '') >= value
    if (operator === 'eq') return same(String(row[column] ?? ''), value)
    return false
  }
  return read(clause.slice(at + 1))
}

/**
 * A stand-in for the one client the endpoint holds, answering the calls it
 * actually makes rather than pretending to be Postgres.
 *
 * The unique pair on the ledger is enforced here because that constraint is the
 * whole of the idempotency: a stand-in that accepted the second claim would let
 * a double send pass every case below.
 */
function stubDb(state) {
  return {
    from(name) {
      if (state.missing && state.missing.includes(name)) return refusing(name)

      const rows = state.tables[name] || (state.tables[name] = [])
      const unique = (state.unique || {})[name]
      const filters = []
      let mode = 'select'
      let payload = null
      let counting = false
      let single = false

      const run = () => {
        if (mode === 'insert') {
          if (
            unique &&
            rows.some(row => unique.every(column => same(row[column], payload[column])))
          ) {
            return { data: null, error: { code: '23505', message: 'duplicate key value' } }
          }
          const held = {
            id: `${name}-${rows.length + 1}`,
            created_at: new Date().toISOString(),
            claimed_at: new Date().toISOString(),
            sent_at: null,
            failed_at: null,
            error: null,
            ...payload,
          }
          rows.push(held)
          return single
            ? { data: { id: held.id }, error: null }
            : { data: [{ id: held.id }], error: null }
        }

        const hit = rows.filter(row => filters.every(filter => passes(row, filter)))
        if (mode === 'update') {
          for (const row of hit) Object.assign(row, payload)
          return { data: hit.map(row => ({ id: row.id })), error: null }
        }
        if (counting) return { count: hit.length, data: null, error: null }
        if (single) return { data: hit[0] ?? null, error: null }
        return { data: hit, error: null }
      }

      const builder = {
        select(_columns, options) {
          counting = Boolean(options && options.count)
          return builder
        },
        insert(row) {
          mode = 'insert'
          payload = row
          return builder
        },
        update(patch) {
          mode = 'update'
          payload = patch
          return builder
        },
        eq: (column, value) => (filters.push(['eq', column, value]), builder),
        in: (column, values) => (filters.push(['in', column, values]), builder),
        gte: (column, value) => (filters.push(['gte', column, value]), builder),
        is: (column, value) => (filters.push(['is', column, value]), builder),
        not: (column, operator, value) => (filters.push(['not', column, operator, value]), builder),
        or: group => (filters.push(['or', null, group.replace(/^\(|\)$/g, '')]), builder),
        order: () => builder,
        limit: () => builder,
        maybeSingle() {
          single = true
          return builder
        },
        then: (onDone, onFail) => Promise.resolve(run()).then(onDone, onFail),
      }
      return builder
    },
  }
}

/** A table the migration has not created yet, refusing the way Postgres does. */
function refusing(name) {
  const answer = {
    data: null,
    count: null,
    error: { code: '42P01', message: `relation "public.${name}" does not exist` },
  }
  const builder = new Proxy(
    {
      then: (onDone, onFail) => Promise.resolve(answer).then(onDone, onFail),
    },
    {
      get(target, key) {
        if (key in target) return target[key]
        return () => builder
      },
    }
  )
  return builder
}

function freshState(extra = {}) {
  return {
    unique: { notify_deliveries: ['project_id', 'idempotency_key'] },
    tables: {
      notify_projects: [
        { ...DESK, secret_sha256: digestOf(DESK_SECRET) },
        { ...SHOP, secret_sha256: digestOf(SHOP_SECRET) },
      ],
      notify_recipients: [
        {
          id: 'r1',
          project_id: DESK.id,
          email: 'trenton@taylorurl.com',
          name: 'Trenton Taylor',
          min_severity: 'info',
          active: true,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      notify_deliveries: [],
      suppression: [],
    },
    ...extra,
  }
}

{
  const db = stubDb(freshState())

  const own = await resolve(db, `Bearer ${DESK_SECRET}`, 'desk')
  check(own.project && own.project.slug === 'desk', 'a project could not send as itself')

  const other = await resolve(db, `Bearer ${DESK_SECRET}`, 'shop')
  check(other.status === 401, "a project's secret was allowed to name another project")

  const unknown = await resolve(db, 'Bearer nothing-like-a-secret', 'desk')
  check(unknown.status === 401, 'an unrecognised secret was not refused')

  const unnamed = await resolve(db, `Bearer ${DESK_SECRET}`, '')
  check(unnamed.status === 401, 'a call naming no project was allowed')

  const empty = await resolve(db, 'Bearer ', 'desk')
  check(empty.status === 401, 'a bearer with no token was allowed')

  const said = new Set([other.error, unknown.error, unnamed.error, empty.error])
  check(said.size === 1, 'the refusals are worded differently and say which projects exist')

  // The studio's own scheduler is the one caller that may speak for a project
  // it holds no secret for, and the header is what selects one on that path.
  const scheduled = await resolve(db, `Bearer ${CRON_SECRET}`, 'shop')
  check(
    scheduled.project && scheduled.project.slug === 'shop',
    'the studio could not post for a project'
  )
}

/* ── What a caller may post ─────────────────────────────────────────────── */

const posted = body => readNotification(body, DESK)

check(posted({ subject: '', body: 'x' }).error, 'a notification with no subject was accepted')
check(
  posted({ subject: 'A setup' }).error,
  'a notification with neither lines nor body was accepted'
)
check(
  posted({ subject: 'A setup', body: 'x', severity: 'loud' }).error,
  'an unknown severity was accepted'
)
check(
  posted({ subject: 'A setup', body: 'x', link: { url: 'http://www.example.com' } }).error,
  'a link that is not https was accepted'
)
check(
  posted({ subject: 'A setup', body: 'x', link: { url: 'javascript:alert(1)' } }).error,
  'a javascript link was accepted'
)
check(
  posted({ subject: 'A setup', body: 'x', idempotency_key: 'not a key' }).error,
  'a malformed idempotency key was accepted'
)
check(
  posted({ subject: 'A setup', body: 'x' }).notification,
  'an ordinary notification was refused'
)
check(
  posted({ subject: 'A setup', lines: [['Side', 'SELL']] }).notification,
  'a notification carrying lines alone was refused'
)

{
  const read = posted({
    subject: `  A${' '.repeat(4)}setup\non US30  `,
    severity: 'urgent',
    lines: [
      ['Side', 'SELL'],
      ['bad'],
      [1, 2],
      ...Array.from({ length: 30 }, (_, at) => [`L${at}`, `V${at}`]),
    ],
    body: 'x'.repeat(9000),
    link: { url: 'https://www.example.com/app/signals' },
    unknown_field: 'ignored',
  }).notification

  check(read.subject === 'A setup on US30', 'the subject was not single-lined and collapsed')
  check(read.lines.length === CAPS.lines, 'the line cap did not hold')
  check(read.lines[0][0] === 'Side', 'a malformed pair took a good one with it')
  check(read.body.length === CAPS.body, 'the body cap did not hold')
  check(
    read.link.label === 'Open The Desk',
    "the link did not fall back to the project's own label"
  )
  check(/^[A-Za-z0-9:_.-]+$/.test(read.key), 'a caller naming no key was not given one')
}
check(SEVERITIES.join(',') === 'info,warning,urgent', 'the published severity ladder changed')
check(CAPS.request === 16 * 1024, 'the published request ceiling changed')
check(CAPS.subject === 140 && CAPS.body === 4000, 'the published field caps changed')

/* ── The ladder ─────────────────────────────────────────────────────────── */

check(reaches('urgent', 'info'), 'an urgent notification did not reach a seat taking everything')
check(!reaches('info', 'urgent'), 'a quiet notification woke a seat that asked for urgent alone')
check(reaches('warning', 'warning'), 'a notification did not reach its own floor')
check(!reaches('info', 'nonsense'), 'a floor nobody recognises was mailed anyway')
check(floorsReached('warning').join(',') === 'info,warning', 'the floors an alert reaches changed')

/* ── The provider ───────────────────────────────────────────────────────── */

let handed = []
let refuse = false

globalThis.fetch = async (url, options) => {
  handed.push({ url, body: JSON.parse(options.body), headers: options.headers })
  if (refuse) return { ok: false, status: 422, text: async () => 'the provider refused' }
  return {
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({ id: `provider-${handed.length}` }),
  }
}

/** Runs one delivery with the log quiet, since several of these are failures. */
async function run(db, project, body) {
  const read = readNotification(body, project)
  if (read.error) throw new Error(read.error)
  const said = console.error
  console.error = () => {}
  try {
    return await deliver(db, project, read.notification)
  } finally {
    console.error = said
  }
}

const SETUP = {
  subject: 'A+ short setup on US30',
  severity: 'urgent',
  lines: [
    ['Instrument', 'US30'],
    ['Side', 'SELL'],
  ],
  body: 'Bearish order block swept the high and closed back inside.',
  link: { url: 'https://www.example.com/app/signals' },
  idempotency_key: 'signal:9f3c1d20-4a77-4a1e-9a8e-6d2b0c5f1e33',
}

/* One notification, sent once. */
{
  const state = freshState()
  const db = stubDb(state)
  handed = []

  const first = await run(db, DESK, SETUP)
  check(first.status === 200, 'an ordinary notification did not answer 200')
  check(first.body.delivered === 1 && first.body.recipients === 1, 'the delivery was miscounted')
  check(first.body.duplicate === false, 'a first send was reported as a duplicate')
  check(handed.length === 1, 'the provider was handed the wrong number of messages')
  check(
    Array.isArray(handed[0].body.to) && handed[0].body.to.length === 1,
    'recipients were handed over in one shared to and can see each other'
  )
  check(
    handed[0].body.from === 'Example Desk <notifications@taylorurl.com>',
    'the message did not leave as the project'
  )
  check(state.tables.notify_deliveries[0].sent_at, 'a sent notification was not stamped sent')
  check(
    state.tables.notify_deliveries[0].provider_ids.length === 1,
    "the provider's own id was discarded"
  )

  /* The same key again reaches nobody. */
  const again = await run(db, DESK, SETUP)
  check(again.status === 200, 'a retry of a sent key did not answer 200')
  check(again.body.duplicate === true, 'a retry of a sent key was not reported as a duplicate')
  check(
    again.body.id === first.body.id,
    'a retry of a sent key was answered with a different id, so the two reads as two notifications'
  )
  check(again.body.delivered === 0, 'a retry of a sent key sent something')
  check(handed.length === 1, 'a retry of a sent key was handed to the provider a second time')
  check(state.tables.notify_deliveries.length === 1, 'a retry of a sent key wrote a second row')
}

/* A run whose sends all fail answers 502 and leaves the claim retakeable. */
{
  const state = freshState()
  const db = stubDb(state)
  handed = []
  refuse = true

  const failed = await run(db, DESK, SETUP)
  check(failed.status === 502, 'a run that reached nobody did not answer 502')
  check(failed.body.error, 'a failed run said nothing about it')
  const row = state.tables.notify_deliveries[0]
  check(row.failed_at && !row.sent_at, 'a failed run did not mark its claim failed')
  check(row.error, 'a failed run kept no reason')

  refuse = false
  const retried = await run(db, DESK, SETUP)
  check(retried.status === 200, 'the same key could not be retried after a failure')
  check(retried.body.delivered === 1, 'a retried notification reached nobody')
  check(state.tables.notify_deliveries.length === 1, 'a retry wrote a second ledger row')
  check(state.tables.notify_deliveries[0].sent_at, 'a retaken claim was not stamped sent')
}

/* An address on the suppression list is reached by nothing.
 *
 * And the row it leaves behind is what the caller's next pass is answered from,
 * so this case follows the same key through two more posts. A send that reached
 * nobody carries a failure rather than a send: the row is finished, so nothing
 * is left claimed forever, and the key is retakeable, so the caller is told the
 * same true thing every pass instead of being told `duplicate` - the one answer
 * it is entitled to read as delivered - from the second pass on. Lifting the
 * suppression is the whole point of keeping it retakeable: what produced the
 * empty list is what changes, and the next post after it changes is the one
 * that goes. */
{
  const state = freshState()
  state.tables.suppression.push({ email: 'TRENTON@taylorurl.com', reason: 'unsubscribed' })
  const db = stubDb(state)
  handed = []

  const dropped = await run(db, DESK, SETUP)
  check(dropped.status === 200, 'a run with nobody left to reach did not answer 200')
  check(dropped.body.recipients === 0, 'a suppressed address was still counted as a recipient')
  check(dropped.body.delivered === 0, 'a suppressed address was mailed')
  check(dropped.body.reason, 'a run that reached nobody did not say so')
  check(handed.length === 0, 'the provider was handed a suppressed address')
  const nobody = state.tables.notify_deliveries[0]
  check(!nobody.sent_at, 'a run reaching nobody was stamped as sent')
  check(nobody.failed_at, 'a run reaching nobody was left claimed forever')
  check(nobody.error, 'a run reaching nobody kept no reason')

  const again = await run(db, DESK, SETUP)
  check(again.body.duplicate !== true, 'a second post of a key that reached nobody was called sent')
  check(again.body.delivered === 0, 'a suppressed address was mailed on the second post')
  check(again.body.reason, 'a second post of a key that reached nobody stopped saying so')
  check(handed.length === 0, 'the provider was handed a suppressed address on the second post')
  check(state.tables.notify_deliveries.length === 1, 'a second post wrote a second ledger row')

  state.tables.suppression.length = 0
  const reached = await run(db, DESK, SETUP)
  check(reached.body.delivered === 1, 'lifting a suppression did not let the held key go out')
  check(handed.length === 1, 'lifting a suppression did not reach the provider')
  check(state.tables.notify_deliveries.length === 1, 'the delivered key wrote a second ledger row')
  check(state.tables.notify_deliveries[0].sent_at, 'a delivered key was not stamped sent')
}

/* A seat standing above the severity is not woken by a quiet notification. */
{
  const state = freshState()
  state.tables.notify_recipients[0].min_severity = 'urgent'
  const db = stubDb(state)
  handed = []

  const quiet = await run(db, DESK, { ...SETUP, severity: 'info', idempotency_key: 'quiet:1' })
  check(quiet.body.recipients === 0, 'a seat taking urgent alone was woken by a notice')
  check(handed.length === 0, 'a notice reached a seat that asked for urgent alone')

  const loud = await run(db, DESK, { ...SETUP, severity: 'urgent', idempotency_key: 'loud:1' })
  check(loud.body.delivered === 1, 'an urgent notification did not reach the seat waiting for one')
}

/* A paused seat is nobody. */
{
  const state = freshState()
  state.tables.notify_recipients[0].active = false
  const db = stubDb(state)
  handed = []
  const paused = await run(db, DESK, SETUP)
  check(paused.body.recipients === 0, 'a paused seat was still mailed')
  check(handed.length === 0, 'the provider was handed a paused seat')
}

/* One project's recipients are never another project's. */
{
  const state = freshState()
  const db = stubDb(state)
  const held = await recipientsFor(db, SHOP, 'urgent')
  check(held.length === 0, "a project read another project's recipients")
}

/* The day's ceiling holds, and says how long for. */
{
  const state = freshState()
  const now = new Date().toISOString()
  for (let at = 0; at < 120; at += 1) {
    state.tables.notify_deliveries.push({
      id: `old-${at}`,
      project_id: DESK.id,
      idempotency_key: `old-${at}`,
      created_at: now,
    })
  }
  const db = stubDb(state)
  handed = []
  const refused = await run(db, DESK, SETUP)
  check(refused.status === 429, 'the daily ceiling did not hold')
  check(refused.retryAfter === 86400, 'the daily ceiling did not say how long to wait')
  check(handed.length === 0, 'a notification past the daily ceiling was still sent')
  check(state.tables.notify_deliveries.length === 120, 'a refused notification wrote a ledger row')
}

/* Only urgent rings a phone. */
{
  for (const severity of SEVERITIES) {
    const state = freshState()
    const db = stubDb(state)
    handed = []
    await run(db, DESK, { ...SETUP, severity, idempotency_key: `by-severity:${severity}` })
    const carried = handed[0].body.headers
    if (severity === 'urgent') {
      check(
        carried && carried.Importance === URGENT_HEADERS.Importance,
        'an urgent notification did not carry the urgent headers'
      )
    } else {
      check(!carried, `a ${severity} notification was marked urgent`)
    }
  }
}

/* A deployment ahead of its migration says so rather than pretending. */
{
  const state = freshState()
  state.missing = ['notify_projects', 'notify_recipients', 'notify_deliveries']
  const db = stubDb(state)
  let refusal = null
  try {
    await resolve(db, `Bearer ${DESK_SECRET}`, 'desk')
  } catch (cause) {
    refusal = cause
  }
  check(refusal && refusal.code === '42P01', 'a missing table was swallowed rather than raised')
}

/* ── Nothing of the studio is on a client's message ─────────────────────── */

{
  const message = clientNotice(DESK, posted(SETUP).notification)
  const drawn = message.html

  check(!drawn.includes('wordmark-on-dark'), "a client message drew the studio's wordmark")
  check(!drawn.includes('#1a4ed8'), "a client message drew the studio's accent")
  check(!drawn.includes('TaylorURL LLC'), "a client message carried the studio's annotation")
  check(!drawn.includes('trenton-taylor-email'), 'a client message carried the bio portrait')
  check(!drawn.includes('(281) 862-8687'), "a client message carried the studio's phone number")
  check(!drawn.includes('I was a district manager'), 'a client message carried the bio')
  check(!drawn.includes(STUDIO_MASTHEAD), 'a client message opened on the studio masthead')

  check(drawn.includes('#4b45d4'), "a client message did not draw the project's own accent")
  check(drawn.includes('Example Desk'), 'a client message did not name the project')
  check(
    drawn.includes('/site-icons/example.com.png'),
    "a client message did not draw the project's own mark"
  )
  check(
    drawn.includes('Example Desk · example.com'),
    'a client message did not sign off as the project'
  )
  check(drawn.includes('Open The Desk'), 'a client message drew no way to the thing it is about')
  check(
    message.text.includes('https://www.example.com/app/signals'),
    'the plain half carried no address'
  )
  check(message.replyTo === 'trenton@taylorurl.com', 'a reply to a client message reaches nobody')

  // The mark is a badge rather than a name drawn out, so the name has to be set
  // as text beside it - which is also what a reader blocking images is left with.
  const brand = brandOf(DESK)
  check(brand.wordmark === false, "a client's badge was treated as a wordmark")
  check(brand.ground === 'light', 'a pale mark was drawn on the black slab')
  check(brand.annotation.join() === 'example.com', "the masthead did not name the project's domain")
  check(
    brand.markUrl.startsWith('https://') && brand.markUrl.endsWith('/site-icons/example.com.png'),
    'a mark named by path did not become an address a mail client can fetch'
  )

  const envelope = envelopeFor(DESK, 'info')
  check(envelope.urgent === false, 'a notice was marked urgent on the envelope')
  check(
    envelopeFor({ ...DESK, from_name: 'Example Desk, Inc.' }, 'info').from.startsWith('"'),
    'a display name carrying a comma was not quoted and splits the header'
  )
}

/* ── The door itself ────────────────────────────────────────────────────── */

async function callHandler(request) {
  const answer = { status: 0, body: null, headers: {} }
  // Several of these are refusals the endpoint is right to log, and a passing
  // run should read as a passing run.
  const said = console.error
  console.error = () => {}
  const response = {
    setHeader(name, value) {
      answer.headers[String(name).toLowerCase()] = value
    },
    status(code) {
      answer.status = code
      return response
    },
    json(payload) {
      answer.body = payload
      return response
    },
  }
  try {
    await notifyHandler({ headers: {}, ...request }, response)
  } finally {
    console.error = said
  }
  return answer
}

{
  const wrongMethod = await callHandler({ method: 'DELETE' })
  check(wrongMethod.status === 405, 'a method the endpoint does not take was not refused')
  check(wrongMethod.headers.allow === 'GET, POST', 'a 405 did not name the methods it takes')
  check(
    wrongMethod.headers['cache-control'] === 'private, no-store',
    'a refusal was left cacheable'
  )

  const tooLarge = await callHandler({
    method: 'POST',
    headers: { 'content-length': String(CAPS.request + 1) },
  })
  check(tooLarge.status === 413, 'a body past the ceiling was not refused')

  // No keys are set in this process, so the endpoint answers the one thing it
  // can: it is not configured. That it gets this far proves the size ceiling and
  // the bearer check run in front of the database rather than behind it.
  const bare = await callHandler({ method: 'POST', headers: {} })
  check(bare.status === 401, 'a call carrying no credential reached the database')

  const unconfigured = await callHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${DESK_SECRET}`, 'x-notify-project': 'desk' },
  })
  check(unconfigured.status === 503, 'a deployment holding no database keys did not say so')
  check(
    unconfigured.headers['cache-control'] === 'private, no-store',
    'an answer was left cacheable'
  )
}

/* ── The studio's own notices are untouched ─────────────────────────────── */

{
  handed = []
  await sendNotice(STUDIO_NOTICE, 'resend-key-for-the-cases')
  const said = handed[0].body
  check(said.from === 'TaylorURL Website <website@taylorurl.com>', 'a studio notice changed sender')
  check(said.to.join() === INBOX, 'a studio notice changed inbox')
  check(said.headers && said.headers.Importance === 'high', 'a studio notice stopped being urgent')
  check(said.reply_to === 'someone@example.com', 'a studio notice lost its reply address')
}

if (failures) {
  console.error(`notify: ${failures} checks failed`)
  process.exit(1)
}

console.log(
  'notify: the four senders that speak for the studio draw the same masthead byte for byte, a ' +
    "project's secret cannot name another project and every refusal is worded alike, a posted key " +
    'is claimed before the transport is touched so a retry sends nothing, a run whose sends all ' +
    'failed answers 502 and leaves the claim retakeable, a suppressed or paused or higher-standing ' +
    'seat is reported as nobody reached rather than as a success, only urgent carries the urgent ' +
    "headers, the ceilings hold and say how long for, and a client's message carries none of the " +
    "studio's mark, accent, annotation, number or bio"
)
