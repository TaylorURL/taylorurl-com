/**
 * Holds every cold sender to the mailbox's rest and its cap.
 *
 * Every cold letter leaves from one Gmail mailbox, and Gmail judges that
 * mailbox by all it carries. Once Gmail refuses it - the day's sending limit
 * spent, the mailbox throttled, the login turned away - each further attempt
 * is the mailbox knocking on a closed door, and a sender that goes on to the
 * next letter after a refusal knocks once for every letter in its batch, every
 * run. The fault this check stands guard over was exactly that: hundreds of
 * refused attempts in a day, all after Gmail had already said no.
 *
 * So the cases are what Gmail actually answers. The refusals are the strings
 * the mail server sends, with the fields nodemailer hands back, and a
 * recipient's bounce sits beside them to prove a letter about one address
 * still leaves the rest of the batch going. Then the rest: how long each kind
 * holds the mailbox, and that a shorter one never cuts a longer one short.
 * Then `deliver`, which every route to the mail server goes through, against a
 * mailbox that is resting and one that is full, with a transport that records
 * every call so a letter turned away is seen never to reach it. Last, each of
 * the three senders is run against a refusal, and stops at it.
 *
 * Nothing opens a socket. The settings row and the sent letters live in an
 * in-memory table or a planned answer, and the transport is a function.
 *
 *   node scripts/outreach/sending/check-mailbox-rest.js
 */
import nodemailer from 'nodemailer'
import { AFTERNOON, atMidAfternoon, settleAddress } from '../send-fixture.js'
import { asked, filtered, stubDb } from '../database-fixture.js'
import { installFixtureHeldDomains } from '../held-domains-fixture.js'
import { cases, check, finish, ok, quietly, raised, same } from '../../harness/checks.js'

installFixtureHeldDomains()

/**
 * The mail server every route in this process reaches. The send route builds
 * its transport once and holds it, so this is installed before anything is
 * sent and answers from `SERVER.refuse` between cases.
 */
const SERVER = { refuse: null, attempts: [] }
nodemailer.createTransport = () => ({
  sendMail: async message => {
    SERVER.attempts.push(message)
    if (SERVER.refuse) throw SERVER.refuse()
    return { messageId: `<sent-${SERVER.attempts.length}@example.com>` }
  },
})
const serverWill = refuse => {
  SERVER.refuse = refuse
  SERVER.attempts.splice(0, SERVER.attempts.length)
}

const {
  MAILBOX_DAY_MS,
  MAILBOX_PAUSE_MS,
  MailboxClosed,
  mailboxRefusalOf,
  readMailbox,
  restMailbox,
} = await import('../../../lib/outreach/sending/mailbox.js')
const { Undeliverable } = await import('../../../lib/outreach/prospects/address.js')
const { deliver, work: sendWork } = await import('../../../api/outreach/send.js')
const { work: newBusinessWork } = await import('../../../api/new-business/send.js')
const { work: previewsWork } = await import('../../../api/outreach/previews.js')

// ── What Gmail says ──────────────────────────────────────────────────────

/** A refusal shaped the way nodemailer hands one back. */
const gmail = (words, fields) => () => Object.assign(new Error(words), fields)

const DAILY_LIMIT = gmail(
  'Message failed: 550-5.4.5 Daily user sending limit exceeded. For more information on Gmail\n550-5.4.5 sending limits go to\n550 5.4.5  https://support.google.com/a/answer/166852 41be03b00d2f7-b6a2a3c5d4esm1234567a12.34 - gsmtp',
  {
    code: 'EMESSAGE',
    command: 'DATA',
    responseCode: 550,
    response:
      '550-5.4.5 Daily user sending limit exceeded. For more information on Gmail\n550-5.4.5 sending limits go to\n550 5.4.5  https://support.google.com/a/answer/166852 41be03b00d2f7-b6a2a3c5d4esm1234567a12.34 - gsmtp',
  }
)

const TRY_LATER = gmail(
  'Data command failed: 421-4.7.0 Try again later, closing connection. (EHLO)\n421-4.7.0  For more information, go to\n421 4.7.0  https://support.google.com/a/answer/3221692 a640c23a62f3a-ab7c5e6f7a8sm123456766b.12 - gsmtp',
  {
    code: 'EPROTOCOL',
    command: 'EHLO',
    responseCode: 421,
    response:
      '421-4.7.0 Try again later, closing connection. (EHLO)\n421-4.7.0  For more information, go to\n421 4.7.0  https://support.google.com/a/answer/3221692 a640c23a62f3a-ab7c5e6f7a8sm123456766b.12 - gsmtp',
  }
)

const TOO_MANY_LOGINS = gmail(
  'Invalid login: 454-4.7.0 Too many login attempts, please try again later. For more information,\n454-4.7.0 go to\n454 4.7.0  https://support.google.com/mail/answer/7126229 d75a77b69052e-4b2a3c4d5e6sm12345671cf.12 - gsmtp',
  {
    code: 'EAUTH',
    command: 'AUTH PLAIN',
    responseCode: 454,
    response:
      '454-4.7.0 Too many login attempts, please try again later. For more information,\n454-4.7.0 go to\n454 4.7.0  https://support.google.com/mail/answer/7126229 d75a77b69052e-4b2a3c4d5e6sm12345671cf.12 - gsmtp',
  }
)

const BAD_LOGIN = gmail(
  'Invalid login: 535-5.7.8 Username and Password not accepted. For more information, go to\n535 5.7.8  https://support.google.com/mail/?p=BadCredentials 5b1f17b1804b1-45a1b2c3d4esm1234567f9.12 - gsmtp',
  {
    code: 'EAUTH',
    command: 'AUTH PLAIN',
    responseCode: 535,
    response:
      '535-5.7.8 Username and Password not accepted. For more information, go to\n535 5.7.8  https://support.google.com/mail/?p=BadCredentials 5b1f17b1804b1-45a1b2c3d4esm1234567f9.12 - gsmtp',
  }
)

const NO_SUCH_USER = gmail(
  "Can't send mail - all recipients were rejected: 550-5.1.1 The email account that you tried to reach does not exist. Please try\n550-5.1.1 double-checking the recipient's email address for typos or\n550-5.1.1 unnecessary spaces. For more information, go to\n550 5.1.1  https://support.google.com/mail/?p=NoSuchUser 6a1803df08f44-6fa1b2c3d4esm123456786d6.12 - gsmtp",
  {
    code: 'EENVELOPE',
    command: 'RCPT TO',
    responseCode: 550,
    response:
      "550-5.1.1 The email account that you tried to reach does not exist. Please try\n550-5.1.1 double-checking the recipient's email address for typos or\n550-5.1.1 unnecessary spaces. For more information, go to\n550 5.1.1  https://support.google.com/mail/?p=NoSuchUser 6a1803df08f44-6fa1b2c3d4esm123456786d6.12 - gsmtp",
  }
)

check('a spent daily limit is a refusal of the mailbox, for a day', () => {
  const refusal = mailboxRefusalOf(DAILY_LIMIT())
  same(refusal?.kind, 'daily-limit', 'kind')
  same(refusal.restMs, MAILBOX_DAY_MS, 'rest')
  ok(refusal.said.startsWith('550-5.4.5 Daily user sending limit exceeded'), refusal.said)
  // The same words with nothing but the message, as another client might
  // carry them, read the same way.
  same(
    mailboxRefusalOf(new Error('550 5.4.5 Daily user sending limit exceeded'))?.kind,
    'daily-limit',
    'kind from the message alone'
  )
})

check('a throttle is a refusal of the mailbox, for an hour', () => {
  for (const [name, refuse] of [
    ['421 4.7.0', TRY_LATER],
    ['454 4.7.0', TOO_MANY_LOGINS],
  ]) {
    const refusal = mailboxRefusalOf(refuse())
    same(refusal?.kind, 'throttled', `${name} kind`)
    same(refusal.restMs, MAILBOX_PAUSE_MS, `${name} rest`)
  }
})

check('a refused login is a refusal of the mailbox, for an hour', () => {
  const refusal = mailboxRefusalOf(BAD_LOGIN())
  same(refusal?.kind, 'login', 'kind')
  same(refusal.restMs, MAILBOX_PAUSE_MS, 'rest')
})

check('a bounce about one recipient is not a refusal of the mailbox', () => {
  same(mailboxRefusalOf(NO_SUCH_USER()), null, '550 5.1.1')
  same(
    mailboxRefusalOf(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' })),
    null,
    'a timeout'
  )
})

check(
  'an address refused before the server, or a letter the mailbox turned away, is neither',
  () => {
    same(
      mailboxRefusalOf(
        new Undeliverable('owner@nowhere.example', { verdict: 'undeliverable', reason: 'no_mx' })
      ),
      null,
      'Undeliverable'
    )
    same(mailboxRefusalOf(new MailboxClosed({ reason: 'resting' })), null, 'MailboxClosed')
    ok(
      !(new MailboxClosed({ reason: 'x' }) instanceof Undeliverable),
      'MailboxClosed is its own kind'
    )
  }
)

// ── A database held in memory ────────────────────────────────────────────

/**
 * Tables as lists of rows, read and written through the chain a Supabase
 * client takes, with the filters applied rather than recorded.
 *
 * The rest is written under a condition - only where the rest standing ends
 * sooner - and the cap is a count under a date. Both are questions about
 * which rows a filter reaches, so these cases need a table that answers them
 * rather than a plan that answers whatever it was told to.
 */
function memoryDb(tables) {
  const instant = value => (value === null || value === undefined ? null : Date.parse(value))
  const test = (op, column, value) => row => {
    const held = row[column]
    if (op === 'eq') return held === value
    if (op === 'is') return value === null ? held === null || held === undefined : held === value
    if (op === 'in') return value.includes(held)
    if (op === 'gte') return held !== null && held !== undefined && instant(held) >= instant(value)
    if (op === 'lt') return held !== null && held !== undefined && instant(held) < instant(value)
    throw new Error(`the memory table does not answer ${op}`)
  }

  const from = table => {
    const query = {
      op: 'select',
      payload: null,
      tests: [],
      head: false,
      single: false,
      limit: null,
    }
    const rowsOf = () => (tables[table] ??= [])
    const run = () => {
      const hit = rowsOf().filter(row => query.tests.every(passes => passes(row)))
      if (query.op === 'insert') {
        rowsOf().push(...[].concat(query.payload).map(row => ({ ...row })))
        return { data: null, error: null }
      }
      if (query.op === 'update') {
        for (const row of hit) Object.assign(row, query.payload)
        return { data: null, error: null }
      }
      if (query.op === 'delete') {
        tables[table] = rowsOf().filter(row => !hit.includes(row))
        return { data: null, error: null }
      }
      if (query.head) return { data: null, error: null, count: hit.length }
      if (query.single) return { data: hit[0] ?? null, error: null }
      const rows = query.limit === null ? hit : hit.slice(0, query.limit)
      return { data: rows, error: null, count: rows.length }
    }
    const chain = {
      select: (_columns, options) => {
        if (options?.head) query.head = true
        return chain
      },
      insert: payload => Object.assign(query, { op: 'insert', payload }) && chain,
      update: payload => Object.assign(query, { op: 'update', payload }) && chain,
      delete: () => Object.assign(query, { op: 'delete' }) && chain,
      eq: (column, value) => query.tests.push(test('eq', column, value)) && chain,
      is: (column, value) => query.tests.push(test('is', column, value)) && chain,
      in: (column, value) => query.tests.push(test('in', column, value)) && chain,
      gte: (column, value) => query.tests.push(test('gte', column, value)) && chain,
      lt: (column, value) => query.tests.push(test('lt', column, value)) && chain,
      not: (column, op, value) => {
        const passes = test(op, column, value)
        query.tests.push(row => !passes(row))
        return chain
      },
      or: expression => {
        const either = expression.split(',').map(term => {
          const [column, op, ...rest] = term.split('.')
          const value = rest.join('.')
          return test(op, column, value === 'null' ? null : value)
        })
        query.tests.push(row => either.some(passes => passes(row)))
        return chain
      },
      order: () => chain,
      limit: count => Object.assign(query, { limit: count }) && chain,
      maybeSingle: () => Object.assign(query, { single: true }) && chain,
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    }
    return chain
  }
  return { db: { from }, tables }
}

const HOUR = 60 * 60 * 1000
const at = offset => new Date(AFTERNOON + offset)
const iso = offset => at(offset).toISOString()

/** The settings row, with the mailbox open and no cap unless the case says. */
const settingsRow = extra => ({
  id: 1,
  from_name: 'TaylorURL',
  from_address: 'studio@example.com',
  mailbox_rests_until: null,
  mailbox_rest_reason: null,
  mailbox_daily_cap: null,
  ...extra,
})

// ── The rest ─────────────────────────────────────────────────────────────

check('a 5.4.5 rests the mailbox for 24 hours from the refusal', async () => {
  const { db, tables } = memoryDb({ outreach_settings: [settingsRow()] })
  await restMailbox(db, mailboxRefusalOf(DAILY_LIMIT()), at(0))
  const row = tables.outreach_settings[0]
  same(row.mailbox_rests_until, iso(24 * HOUR), 'rests until')
  ok(
    row.mailbox_rest_reason.includes('5.4.5'),
    `the reason says what Gmail said: ${row.mailbox_rest_reason}`
  )
  same((await readMailbox(db, at(23 * HOUR))).open, false, 'closed a minute short of the day')
  same((await readMailbox(db, at(24 * HOUR + 1000))).open, true, 'open once the day is out')
})

check('a 421 rests the mailbox for an hour from the refusal', async () => {
  const { db, tables } = memoryDb({ outreach_settings: [settingsRow()] })
  await restMailbox(db, mailboxRefusalOf(TRY_LATER()), at(0))
  same(tables.outreach_settings[0].mailbox_rests_until, iso(HOUR), 'rests until')
  same((await readMailbox(db, at(HOUR / 2))).open, false, 'closed half an hour in')
  same((await readMailbox(db, at(HOUR + 1000))).open, true, 'open after the hour')
})

check('a later, shorter rest never shortens a longer one', async () => {
  const { db, tables } = memoryDb({ outreach_settings: [settingsRow()] })
  await restMailbox(db, mailboxRefusalOf(DAILY_LIMIT()), at(0))
  await restMailbox(db, mailboxRefusalOf(TRY_LATER()), at(10 * 60 * 1000))
  same(tables.outreach_settings[0].mailbox_rests_until, iso(24 * HOUR), 'the day still stands')
  ok(tables.outreach_settings[0].mailbox_rest_reason.includes('5.4.5'), 'and its reason with it')
  same((await readMailbox(db, at(2 * HOUR))).open, false, 'closed after the hour has passed')
})

check('a later, longer rest moves the end out', async () => {
  const { db, tables } = memoryDb({ outreach_settings: [settingsRow()] })
  await restMailbox(db, mailboxRefusalOf(TRY_LATER()), at(0))
  await restMailbox(db, mailboxRefusalOf(DAILY_LIMIT()), at(5 * 60 * 1000))
  same(
    tables.outreach_settings[0].mailbox_rests_until,
    iso(5 * 60 * 1000 + 24 * HOUR),
    'rests until'
  )
})

check('a rest set further out by another sender is not shortened either', async () => {
  const { db, tables } = memoryDb({
    outreach_settings: [settingsRow({ mailbox_rests_until: iso(20 * HOUR) })],
  })
  await restMailbox(db, mailboxRefusalOf(BAD_LOGIN()), at(0))
  same(tables.outreach_settings[0].mailbox_rests_until, iso(20 * HOUR), 'rests until')
})

check('no rest and no cap is an open mailbox', async () => {
  const { db } = memoryDb({ outreach_settings: [settingsRow()] })
  const mailbox = await readMailbox(db, at(0))
  same(mailbox.open, true, 'open')
  same(mailbox.room, null, 'no ceiling')
})

check('a rest lifted by hand opens the mailbox on the next reading', async () => {
  const { db, tables } = memoryDb({ outreach_settings: [settingsRow()] })
  await restMailbox(db, mailboxRefusalOf(DAILY_LIMIT()), at(0))
  tables.outreach_settings[0].mailbox_rests_until = null
  same((await readMailbox(db, at(HOUR))).open, true, 'open')
})

check('a rest that could not be written down still closes this process', async () => {
  const { db, tables } = memoryDb({ outreach_settings: [settingsRow()] })
  const refusedWrite = { data: null, error: { message: 'the write was refused' } }
  const refusing = {
    from: table => {
      const chain = db.from(table)
      if (table !== 'outreach_settings') return chain
      return { ...chain, update: () => ({ eq: () => ({ or: async () => refusedWrite }) }) }
    },
  }
  await quietly(() => restMailbox(refusing, mailboxRefusalOf(TRY_LATER()), at(0)))
  same(tables.outreach_settings[0].mailbox_rests_until, null, 'the row, which never heard')
  same((await readMailbox(refusing, at(HOUR / 2))).open, false, 'closed half an hour in')
  same((await readMailbox(refusing, at(HOUR + 1000))).open, true, 'open after the hour')
})

// ── deliver, in front of the transport ───────────────────────────────────

const FROM = { name: 'TaylorURL', address: 'studio@example.com' }
const letterTo = to => ({
  id: 'message-1',
  subject: 'Hello',
  body_text: 'text',
  body_html: '<p>text</p>',
  to_address: to,
})

/** A transport that records every call, refusing with `refuse` when given one. */
function recorder(refuse = null) {
  const sent = []
  return {
    sent,
    build: () => ({
      sendMail: async message => {
        sent.push(message)
        if (refuse) throw refuse()
        return { messageId: `<recorded-${sent.length}@example.net>` }
      },
    }),
  }
}

const ALPHA = 'owner@alpha-plumbing.example'
const BRAVO = 'owner@bravo-roofing.example'
const CHARLIE = 'owner@charlie-fencing.example'
await Promise.all([ALPHA, BRAVO, CHARLIE].map(settleAddress))

/** Letters that left the mailbox, and some that did not, around the afternoon. */
const sentRows = () => ({
  outreach_messages: [
    { direction: 'outbound', status: 'sent', sent_at: iso(-1 * HOUR) },
    { direction: 'outbound', status: 'sent', sent_at: iso(-20 * HOUR) },
    { direction: 'outbound', status: 'sent', sent_at: iso(-25 * HOUR) },
    { direction: 'outbound', status: 'failed', sent_at: null },
    { direction: 'outbound', status: 'drafted', sent_at: null },
    { direction: 'inbound', status: 'received', sent_at: null },
  ],
  new_business_messages: [
    { status: 'sent', sent_at: iso(-3 * HOUR) },
    { status: 'failed', sent_at: null },
    { status: 'sent', sent_at: iso(-30 * HOUR) },
  ],
})

check('a resting mailbox turns a letter away before the transport is touched', () =>
  atMidAfternoon(async () => {
    const { db } = memoryDb({
      outreach_settings: [
        settingsRow({ mailbox_rests_until: iso(HOUR), mailbox_rest_reason: 'x' }),
      ],
    })
    const mail = recorder()
    const cause = await raised(() => deliver(db, letterTo(ALPHA), FROM, '', mail.build))
    ok(cause instanceof MailboxClosed, `the letter was not turned away: ${cause}`)
    ok(!(cause instanceof Undeliverable), 'it was turned away as an address')
    same(mail.sent.length, 0, 'letters handed to the transport')
  })
)

check('a full mailbox turns a letter away, counting both tables across 24 hours', () =>
  atMidAfternoon(async () => {
    // Two cold letters and one new-business letter inside the day: three.
    const { db } = memoryDb({
      outreach_settings: [settingsRow({ mailbox_daily_cap: 3 })],
      ...sentRows(),
    })
    const mail = recorder()
    const cause = await raised(() => deliver(db, letterTo(ALPHA), FROM, '', mail.build))
    ok(cause instanceof MailboxClosed, `the letter was not turned away: ${cause}`)
    ok(cause.reason.includes('carried 3'), cause.reason)
    same(mail.sent.length, 0, 'letters handed to the transport')
  })
)

check('a mailbox with room for one carries one and turns the next away', () =>
  atMidAfternoon(async () => {
    const { db } = memoryDb({
      outreach_settings: [settingsRow({ mailbox_daily_cap: 4 })],
      ...sentRows(),
    })
    const mail = recorder()
    same(await deliver(db, letterTo(ALPHA), FROM, '', mail.build), '<recorded-1@example.net>', 'id')
    const cause = await raised(() => deliver(db, letterTo(BRAVO), FROM, '', mail.build))
    ok(cause instanceof MailboxClosed, `the second letter was not turned away: ${cause}`)
    same(mail.sent.length, 1, 'letters handed to the transport')
  })
)

check('a refusal of the mailbox rests it, and the next letter goes nowhere near Gmail', () =>
  atMidAfternoon(async () => {
    const { db, tables } = memoryDb({ outreach_settings: [settingsRow()] })
    const mail = recorder(DAILY_LIMIT)
    const first = await raised(() => deliver(db, letterTo(ALPHA), FROM, '', mail.build))
    same(first?.responseCode, 550, 'the refusal is handed back as Gmail gave it')
    same(tables.outreach_settings[0].mailbox_rests_until, iso(24 * HOUR), 'rests until')
    const second = await raised(() => deliver(db, letterTo(BRAVO), FROM, '', mail.build))
    ok(second instanceof MailboxClosed, `the next letter was not turned away: ${second}`)
    same(mail.sent.length, 1, 'letters handed to the transport')
  })
)

check('a recipient bounce rests nothing', () =>
  atMidAfternoon(async () => {
    const { db, tables } = memoryDb({ outreach_settings: [settingsRow()] })
    const mail = recorder(NO_SUCH_USER)
    await raised(() => deliver(db, letterTo(ALPHA), FROM, '', mail.build))
    await raised(() => deliver(db, letterTo(BRAVO), FROM, '', mail.build))
    same(tables.outreach_settings[0].mailbox_rests_until, null, 'rests until')
    same(mail.sent.length, 2, 'letters handed to the transport')
  })
)

// ── New businesses ───────────────────────────────────────────────────────

const lead = (id, email) => ({
  id,
  name: `${id.toUpperCase()} SERVICES LLC`,
  slug: `${id}services`,
  city: 'BAYTOWN',
  state: 'TX',
  formed_on: '2026-08-20',
  email,
  stage: 'emailable',
  unsub_token: `00000000-0000-4000-8000-00000000000${id.length}`,
})

const newBusinessTables = extra => ({
  outreach_settings: [settingsRow({ mailbox_daily_cap: 40 })],
  new_business_leads: [lead('a', ALPHA), lead('b', BRAVO), lead('c', CHARLIE)],
  new_business_messages: [],
  outreach_messages: [],
  suppression: [],
  ...extra,
})

const runNewBusiness = (db, transport) =>
  quietly(() =>
    atMidAfternoon(() =>
      newBusinessWork({
        db,
        settings: { sending_enabled: true, daily_cap: 20 },
        counts: { examined: 0, changed: 0 },
        now: new Date(),
        transport,
        wait: async () => {},
      })
    )
  )

check('the new-business run stops at the first refusal of the mailbox', async () => {
  const { db, tables } = memoryDb(newBusinessTables())
  const mail = recorder(DAILY_LIMIT)
  const answer = await runNewBusiness(db, mail.build)

  same(mail.sent.length, 1, 'letters handed to the transport')
  same(tables.new_business_messages.length, 1, 'rows written')
  same(tables.new_business_messages[0].status, 'failed', 'the refused letter is on file as refused')
  ok(answer.stoppedBy?.includes('5.4.5'), `the run says why it stopped: ${answer.stoppedBy}`)
  same(
    tables.new_business_leads.map(row => row.stage).join(','),
    'emailable,emailable,emailable',
    'stages'
  )
  same(tables.outreach_settings[0].mailbox_rests_until, iso(24 * HOUR), 'rests until')

  const again = await runNewBusiness(db, mail.build)
  ok(again.skipped?.includes('resting'), `the next run is skipped: ${JSON.stringify(again)}`)
  same(mail.sent.length, 1, 'letters handed to the transport across both runs')
  same(tables.new_business_messages.length, 1, 'rows written across both runs')
})

check('the new-business run does nothing while the mailbox is full', async () => {
  const { db, tables } = memoryDb(
    newBusinessTables({
      outreach_settings: [settingsRow({ mailbox_daily_cap: 3 })],
      ...sentRows(),
    })
  )
  const mail = recorder()
  const answer = await runNewBusiness(db, mail.build)
  ok(answer.skipped?.includes('cap is 3'), `the run is skipped: ${JSON.stringify(answer)}`)
  same(mail.sent.length, 0, 'letters handed to the transport')
  same(tables.new_business_messages.length, 3, 'rows, which are the three already there')
})

check('the new-business run goes on past a recipient bounce', async () => {
  const { db, tables } = memoryDb(newBusinessTables())
  const mail = recorder(NO_SUCH_USER)
  const answer = await runNewBusiness(db, mail.build)
  same(mail.sent.length, 3, 'letters handed to the transport')
  same(answer.failed, 3, 'letters refused')
  same(answer.stoppedBy, null, 'stopped by')
  same(tables.outreach_settings[0].mailbox_rests_until, null, 'rests until')
})

// ── Outreach ─────────────────────────────────────────────────────────────

/** Runs `run` with every pause answered at once, so a run's spacing costs nothing. */
async function withoutPauses(run) {
  const real = globalThis.setTimeout
  globalThis.setTimeout = (callback, _ms, ...args) => real(callback, 0, ...args)
  try {
    return await run()
  } finally {
    globalThis.setTimeout = real
  }
}

const OUTREACH = {
  sending_enabled: true,
  daily_cap: 50,
  from_name: 'TaylorURL',
  from_address: 'studio@example.com',
  mailbox_rests_until: null,
  mailbox_rest_reason: null,
  mailbox_daily_cap: null,
}

/** Two businesses with no site of their own, each holding a reviewed draft. */
const prospect = (id, email) => ({
  id,
  name: `Business ${id}`,
  town: 'Baytown',
  trade: 'plumber',
  website: null,
  email,
  audit_score: null,
  site_kind: 'social',
  stage: 'enriched',
  unsub_token: `11111111-1111-1111-1111-11111111111${id.length}`,
})
const A = prospect('p-a', ALPHA)
const B = prospect('p-b', BRAVO)
const draftFor = (id, row) => ({
  id,
  prospect_id: row.id,
  subject: 'Your listing',
  body_text: 'text',
  body_html: '<p>text</p>',
  to_address: row.email,
  status: 'drafted',
  variant_id: 'no-site-intro',
  created_at: '2026-08-29T17:30:00.000Z',
  sent_at: null,
})
const DRAFT_A = draftFor('m-a', A)
const DRAFT_B = draftFor('m-b', B)

/**
 * The reads a send run makes, answered in order. Where the mailbox has a cap,
 * its own count of the cold letters comes first; then what the day's cap has
 * been spent on, the addresses already written to, and the drafts.
 */
const outreachPlan = ({ mailboxCount = null, extra = {} } = {}) => ({
  'select:outreach_messages': [
    ...(mailboxCount === null ? [] : [{ count: mailboxCount, error: null }]),
    { count: 0, error: null },
    { data: [], error: null },
    { data: [DRAFT_A, DRAFT_B], error: null },
  ],
  'select:outreach_prospects': { data: [A, B], error: null },
  'select:suppression': { data: [], error: null },
  'select:preview_sites': {
    data: [
      { prospect_id: A.id, expires_at: null },
      { prospect_id: B.id, expires_at: null },
    ],
    error: null,
  },
  ...extra,
})

const naming = (queries, id) =>
  queries.filter(query => query.op !== 'select' && filtered(query, 'eq', 'id', id))

const runOutreach = (db, settings = OUTREACH) =>
  quietly(() =>
    withoutPauses(() =>
      atMidAfternoon(() => sendWork({ db, settings, counts: { examined: 0, changed: 0 } }))
    )
  )

check('the outreach run does nothing while the mailbox rests', async () => {
  serverWill(null)
  const { db, queries } = stubDb(outreachPlan())
  const answer = await runOutreach(db, {
    ...OUTREACH,
    mailbox_rests_until: iso(HOUR),
    mailbox_rest_reason: 'Gmail is throttling the mailbox',
  })
  ok(answer.skipped?.includes('resting'), `the run is skipped: ${JSON.stringify(answer)}`)
  same(queries.length, 0, 'queries made')
  same(SERVER.attempts.length, 0, 'letters handed to the transport')
})

check('the outreach run stops at the first refusal of the mailbox', async () => {
  serverWill(DAILY_LIMIT)
  const { db, queries } = stubDb(outreachPlan())
  const answer = await runOutreach(db)

  same(SERVER.attempts.length, 1, 'letters handed to the transport')
  same(answer.failed, 1, 'letters refused')
  ok(answer.stoppedBy?.includes('5.4.5'), `the run says why it stopped: ${answer.stoppedBy}`)
  const failed = asked(queries, 'update:outreach_messages').filter(
    query => query.payload?.status === 'failed'
  )
  same(failed.length, 1, 'letters filed as refused')
  ok(filtered(failed[0], 'eq', 'id', DRAFT_A.id), 'the refused letter is the one filed')
  same(naming(queries, B.id).length, 0, 'writes to the business behind it')
  same(naming(queries, DRAFT_B.id).length, 0, 'writes to its draft')
  const rest = asked(queries, 'update:outreach_settings')
  same(rest.length, 1, 'rests recorded')
  same(rest[0].payload.mailbox_rests_until, iso(24 * HOUR), 'rests until')
})

check(
  'the outreach run stops where the mailbox fills, leaving the next draft as it was',
  async () => {
    serverWill(null)
    const { db, queries } = stubDb(outreachPlan({ mailboxCount: 0 }))
    const answer = await runOutreach(db, { ...OUTREACH, mailbox_daily_cap: 1 })

    same(SERVER.attempts.length, 1, 'letters handed to the transport')
    same(answer.sent, 1, 'letters sent')
    ok(answer.mailboxClosed?.includes('cap is 1'), `the run says why: ${answer.mailboxClosed}`)
    same(answer.postponed, 1, 'businesses left for the next run')
    same(naming(queries, B.id).length, 0, 'writes to the business behind it')
    same(naming(queries, DRAFT_B.id).length, 0, 'writes to its draft')
  }
)

check('a letter the mailbox turns away keeps its draft and goes back to wait', async () => {
  serverWill(null)
  // The claim lands, and in the moment after it another sender's refusal
  // reaches this process: the mailbox is now resting, and `deliver` turns the
  // letter away in front of the transport.
  let db
  const restArrives = {
    then: resolve =>
      restMailbox(db, mailboxRefusalOf(TRY_LATER())).then(() => resolve({ error: null })),
  }
  const stubbed = stubDb(
    outreachPlan({ extra: { 'update:outreach_prospects': [restArrives, { error: null }] } })
  )
  db = stubbed.db
  const answer = await runOutreach(db)

  same(SERVER.attempts.length, 0, 'letters handed to the transport')
  ok(answer.mailboxClosed?.includes('resting'), `the run says why: ${answer.mailboxClosed}`)
  same(answer.failed, 0, 'letters filed as refused')
  same(naming(stubbed.queries, DRAFT_A.id).length, 0, 'writes to the draft, which stays drafted')
  const moves = naming(stubbed.queries, A.id).map(query => query.payload?.stage)
  same(moves.join(','), 'queued,enriched', 'the business is claimed and put back where it waits')
  same(naming(stubbed.queries, B.id).length, 0, 'writes to the business behind it')
})

// ── Previews ─────────────────────────────────────────────────────────────

const site = (id, prospectId) => ({
  id,
  slug: `${id}-preview`,
  name: `Business ${id}`,
  prospect_id: prospectId,
  letter: null,
  shot_url: null,
  message_id: `first-${id}`,
  sent_at: iso(-10 * 24 * HOUR),
  follow_up_due_at: iso(-HOUR),
  follow_up_sent_at: null,
  follow_ups: 0,
  expires_at: null,
})
const onChain = row => ({ ...row, stage: 'contacted', replied_at: null, bounced_at: null })

const previewsPlan = ({ mailboxCount = null } = {}) => ({
  'select:preview_sites': { data: [site('s1', A.id), site('s2', B.id)], error: null },
  'select:outreach_prospects': [
    { data: onChain(A), error: null },
    { data: onChain(B), error: null },
  ],
  'select:suppression': { data: [], error: null },
  'select:outreach_messages': [
    ...(mailboxCount === null ? [] : [{ count: mailboxCount, error: null }]),
    { count: 2, data: null, error: null },
    { data: { subject: 'Your listing', provider_id: '<first@example.com>' }, error: null },
  ],
  'insert:outreach_messages': [
    { data: { ...letterTo(A.email), id: 'm-s1' }, error: null },
    { data: { ...letterTo(B.email), id: 'm-s2' }, error: null },
  ],
})

const runPreviews = (db, request, settings = OUTREACH) =>
  quietly(() =>
    atMidAfternoon(() =>
      previewsWork({ db, settings, counts: { examined: 0, changed: 0 }, request })
    )
  )

check(
  'a preview asked for while the mailbox rests is answered 503, with nothing drafted',
  async () => {
    serverWill(null)
    const { db, queries } = stubDb(previewsPlan())
    const answer = await runPreviews(
      db,
      { method: 'POST', body: { slug: 's1-preview' } },
      { ...OUTREACH, mailbox_rests_until: iso(HOUR), mailbox_rest_reason: 'Gmail is throttling' }
    )
    same(answer.status, 503, 'status')
    ok(answer.skipped?.includes('resting'), `the answer says why: ${answer.skipped}`)
    same(queries.length, 0, 'queries made')
    same(SERVER.attempts.length, 0, 'letters handed to the transport')
  }
)

check('the preview follow-ups stop at the first refusal of the mailbox, answered 503', async () => {
  serverWill(DAILY_LIMIT)
  const { db, queries } = stubDb(previewsPlan())
  const answer = await runPreviews(db, { method: 'GET' })

  same(answer.status, 503, 'status')
  ok(answer.skipped?.includes('5.4.5'), `the answer says why: ${answer.skipped}`)
  same(SERVER.attempts.length, 1, 'letters handed to the transport')
  same(asked(queries, 'insert:outreach_messages').length, 1, 'letters drafted')
  same(asked(queries, 'select:outreach_prospects').length, 1, 'businesses read')
  const failed = asked(queries, 'update:outreach_messages').filter(
    query => query.payload?.status === 'failed'
  )
  same(failed.length, 1, 'letters filed as refused')
  same(asked(queries, 'update:outreach_settings').length, 1, 'rests recorded')
})

check('the preview follow-ups stop where the mailbox fills, drafting nothing past it', async () => {
  serverWill(null)
  const { db, queries } = stubDb(previewsPlan({ mailboxCount: 0 }))
  const answer = await runPreviews(db, { method: 'GET' }, { ...OUTREACH, mailbox_daily_cap: 1 })

  same(answer.status, 503, 'status')
  ok(answer.skipped?.includes('cap is 1'), `the answer says why: ${answer.skipped}`)
  same(SERVER.attempts.length, 1, 'letters handed to the transport')
  same(asked(queries, 'insert:outreach_messages').length, 1, 'letters drafted')
  ok(answer.note.includes('s1-preview sent follow-up 1'), answer.note)
})

await finish()

console.log(`mailbox rest: all ${cases.length} cases pass`)
