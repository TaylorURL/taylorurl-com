/**
 * Holds the cold letter to the addresses it may leave from.
 *
 * Every first letter asks lib/outreach/sending/senders.js which address it goes
 * from, and the answer decides which domain Google judges it by. So the cases
 * are the ways that answer can go wrong: an address read off the deployment
 * that is not one, a new domain sending a warm one's day in its first week, a
 * domain whose letters are coming back still being handed more, a business
 * near Baytown written to from somewhere else while a Baytown name had room.
 *
 * Then the other half, in api/outreach/watch.js: Google refusing a letter on
 * its own way out is a fault of the address it left from, not of the business
 * it was going to. The business stays writable, the letter is taken back, its
 * preview is put back to be sent again, and the refusal is filed where the
 * roster counts it.
 *
 * Nothing opens a socket. The database is a plan written beside each case.
 *
 *   node scripts/outreach/sending/check-senders.js
 */
import { isDeepStrictEqual, inspect } from 'node:util'
import { asked, rows, stubDb } from '../database-fixture.js'
import { inbound } from '../inbound-fixture.js'
import { check, finish, ok, same } from '../../harness/checks.js'

/** Ends a case unless `got` and `want` hold the same values, for lists and rows. */
const alike = (got, want, what) =>
  ok(isDeepStrictEqual(got, want), `${what}: expected ${inspect(want)}, got ${inspect(got)}`)

process.env.OUTREACH_SMTP_USER = 'studio@example.com'
process.env.OUTREACH_SMTP_PASSWORD = 'not-a-password'

const {
  RESTING,
  SENDER_DAILY,
  WARM_UP,
  dailyFor,
  hasOwnSenders,
  loginKeyOf,
  loginOf,
  ownLogins,
  pickSender,
  readSenders,
  restOf,
  rosterOf,
  sendersOf,
  withMailbox,
} = await import('../../../lib/outreach/sending/senders.js')
const { refusedAtSource, work } = await import('../../../api/outreach/watch.js')

/** Noon in Baytown, so the local day is never in doubt. */
const NOON = new Date('2026-11-02T18:00:00Z')
const SETTINGS = { from_address: 'trenton@first.example', from_name: 'First' }
const FALLBACK = { primary: 'studio@example.com', origin: 'https://www.first.example' }
const ADDED = [
  'trenton@baytownnew.example|Baytown New|2026-11-02',
  'trenton@other.example|Other|2026-10-01',
].join(';')

check('an entry that is not an address, a name and a date is left out', () => {
  const read = sendersOf('nobody|Name|2026-01-01; a@b.example||2026-01-01; c@d.example|C|soon')
  alike(read, [], 'senders read')
})

check('a well-formed entry is read, the address lowercased', () => {
  alike(
    sendersOf(' Trenton@New.Example | New | 2026-11-02 '),
    [{ address: 'trenton@new.example', name: 'New', since: '2026-11-02' }],
    'senders read'
  )
})

check('a new address warms up a week at a time, and the first is warm', () => {
  same(dailyFor(null, NOON), SENDER_DAILY, 'the first address')
  same(dailyFor('2026-11-02', NOON), WARM_UP[0], 'its first day')
  same(dailyFor('2026-10-26', NOON), WARM_UP[1], 'its second week')
  same(dailyFor('2026-01-01', NOON), WARM_UP.at(-1), 'long since warm')
  same(dailyFor('2026-11-03', NOON), 0, 'a day not yet begun')
  same(dailyFor(RESTING, NOON), 0, 'an address set to rest')
})

check('the row names the first address and the deployment the rest', () => {
  const roster = rosterOf(SETTINGS, FALLBACK, ADDED)
  alike(
    roster.map(one => [one.address, one.origin]),
    [
      ['trenton@first.example', 'https://www.first.example'],
      ['trenton@baytownnew.example', 'https://baytownnew.example'],
      ['trenton@other.example', 'https://other.example'],
    ],
    'the roster'
  )
})

check('an entry naming the first address sets it to rest without a second copy', () => {
  const roster = rosterOf(SETTINGS, FALLBACK, `trenton@first.example|First|${RESTING};${ADDED}`)
  same(roster.length, 3, 'addresses on the roster')
  same(roster[0].since, RESTING, 'the first address')
})

check('an address with a password of its own logs in as itself, and the rest are aliases', () => {
  same(
    loginKeyOf('Trenton@Baytown-New.example'),
    'OUTREACH_SMTP_PASSWORD_BAYTOWN_NEW_EXAMPLE',
    'key'
  )
  const env = { OUTREACH_SMTP_PASSWORD_OTHER_EXAMPLE: 'app-password' }
  alike(
    loginOf('trenton@other.example', env),
    { user: 'trenton@other.example', pass: 'app-password' },
    'own mailbox'
  )
  same(loginOf('trenton@baytownnew.example', env), null, 'alias')
  alike(
    ownLogins(ADDED, env).map(one => one.user),
    ['trenton@other.example'],
    'inboxes to read'
  )
})

check('an entry marked relay is a mailbox of its own that needs no password', () => {
  const [one] = sendersOf('trenton@other.example|Other|2026-10-01|relay')
  same(one.relay, true, 'relay')
  const roster = rosterOf(SETTINGS, FALLBACK, 'trenton@other.example|Other|2026-10-01|relay')
  same(roster[1].login, null, 'login')
  same(roster[1].relay, true, 'relay on the roster')
})

check('a resting studio mailbox shuts only the addresses that go under its login', () => {
  const senders = [
    open('trenton@first.example', 30, 0, { login: null, relay: false }),
    open('trenton@other.example', 30, 4, { login: null, relay: true }),
  ]
  same(withMailbox({ senders, capacity: 56 }, { open: true }).capacity, 56, 'open mailbox')
  const shut = withMailbox({ senders, capacity: 56 }, { open: false })
  alike(
    shut.senders.map(one => one.open),
    [false, true],
    'the studio shut, the relay open'
  )
  same(shut.capacity, 26, 'the day left to the relay')
  ok(hasOwnSenders('trenton@other.example|Other|2026-10-01|relay', {}), 'a relay address')
  ok(!hasOwnSenders(ADDED, {}), 'aliases alone')
  ok(!hasOwnSenders(`trenton@other.example|Other|${RESTING}|relay`, {}), 'a relay set to rest')
})

check('a week is judged once it has enough letters in it, and rests over five per cent', () => {
  same(restOf({ sent: 10, bounced: 5 }), null, 'ten letters, half bounced')
  same(restOf({ sent: 100, bounced: 5 }), null, 'exactly five per cent')
  ok(restOf({ sent: 100, bounced: 6 }), 'six per cent rests the address')
})

const open = (address, daily, today, extra = {}) => ({
  address,
  domain: address.split('@')[1],
  daily,
  today,
  open: true,
  ...extra,
})

check('a business near Baytown is written from a Baytown name while one has room', () => {
  const senders = [open('a@other.example', 30, 0), open('a@baytownnew.example', 10, 9)]
  same(pickSender(senders, { town: 'Mont Belvieu' }).address, 'a@baytownnew.example', 'near')
  same(pickSender(senders, { town: 'Pearland' }).address, 'a@other.example', 'further off')
  senders[1].today = 10
  same(pickSender(senders, { town: 'Baytown' }).address, 'a@other.example', 'Baytown full')
})

check('of two that fit, the one with more room goes, and none open is none', () => {
  const senders = [open('a@one.example', 30, 25), open('a@two.example', 10, 2)]
  same(pickSender(senders, { town: 'Houston' }).address, 'a@two.example', 'more room')
  same(
    pickSender([open('a@one.example', 30, 0, { open: false })], { town: 'Houston' }),
    null,
    'a resting address'
  )
})

check('a refusal at source counts against the address it left from', async () => {
  const sent = Array.from({ length: 20 }, (_, n) => ({
    prospect_id: `p${n}`,
    from_address: 'trenton@other.example',
    sent_at: '2026-10-30T15:00:00Z',
    step: 1,
  }))
  const { db } = stubDb({
    'select:outreach_messages': [
      rows(sent),
      rows([]),
      rows([{ to_address: 'trenton@other.example' }]),
    ],
  })
  const { senders, capacity } = await readSenders(db, SETTINGS, FALLBACK, NOON, ADDED)
  const other = senders.find(one => one.address === 'trenton@other.example')
  alike(other.week, { sent: 21, bounced: 1, today: 0 }, 'its week')
  ok(other.open, 'one refusal in twenty-one is under the line')
  same(capacity, SENDER_DAILY + WARM_UP[0] + WARM_UP.at(-1), 'the day across all three')
})

/** Google's own report of a letter its outbound filter would not carry. */
const REFUSAL = [
  'Reporting-MTA: dns; googlemail.com',
  'X-Original-Message-ID: <letter-1@other.example>',
  'Final-Recipient: rfc822; owner@example.com',
  'Action: failed',
  'Status: 5.7.1',
  'Diagnostic-Code: smtp; Message rejected. For more information, go to https://support.google.com/mail/answer/69585',
].join('\n')

check('a refusal at source is told apart from a business server bouncing', () => {
  ok(refusedAtSource(REFUSAL), 'Google refusing the letter')
  ok(
    !refusedAtSource(
      'Reporting-MTA: dns; googlemail.com\nRemote-MTA: dns; mx.example.com\nStatus: 5.1.1\n'
    ),
    'a recipient server answering 5.1.1'
  )
})

check('a refused letter is taken back and its business is not suppressed', async () => {
  const { db, queries } = stubDb({
    'select:outreach_prospects': rows([
      { id: 'p1', email: 'owner@example.com', stage: 'contacted' },
    ]),
    'select:outreach_messages': [rows([]), rows([{ id: 'm1' }])],
  })
  const report = inbound(REFUSAL, {
    bounce: true,
    envelope: {
      messageId: '<refusal-1@example.com>',
      subject: 'Delivery Status Notification (Failure)',
      from: [{ address: 'mailer-daemon@example.com' }],
      to: [{ address: 'trenton@other.example' }],
      date: '2026-10-30T15:00:00Z',
    },
  })
  await work({ db, counts: { examined: 0, changed: 0 }, read: async () => [report] })

  same(asked(queries, 'upsert:suppression').length, 0, 'suppressions written')
  same(asked(queries, 'update:outreach_prospects').length, 0, 'prospect stages moved')
  const [taken] = asked(queries, 'update:outreach_messages')
  same(taken?.payload?.status, 'failed', 'the letter')
  const [found] = queries.filter(query => query.key === 'select:outreach_messages').slice(1)
  ok(
    found.filters.some(
      ([op, column, value]) =>
        op === 'eq' && column === 'provider_id' && value === '<letter-1@other.example>'
    ),
    'the letter is found by the Message-ID the report quotes'
  )
  const [preview] = asked(queries, 'update:preview_sites')
  same(preview?.payload?.sent_at, null, 'the preview, put back to send')
  const [filed] = asked(queries, 'insert:outreach_messages')
  alike(
    [filed?.payload?.status, filed?.payload?.to_address],
    ['failed', 'trenton@other.example'],
    'the notice'
  )
})

await finish()

console.log('senders: all cases pass')
