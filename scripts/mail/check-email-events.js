/**
 * Proves that Resend's reporting is admitted only when it carries a credential
 * this endpoint accepts, and that a repeated delivery of one event does not move
 * a figure.
 *
 * Both halves fail silently if they are wrong. A signature check that accepts
 * anything leaves an endpoint any stranger can write open and click figures
 * into; a check that accepts nothing leaves a dashboard reading zero on a list
 * that is being read. And a webhook is delivered at least once by design, so a
 * count that rises on every redelivery is a rate that climbs on its own.
 *
 * The database is a stand-in that answers the same calls in the same order and
 * records what it was asked to write, since what is under test is which write
 * each event causes rather than whether Postgres accepts it.
 */

import { createHmac } from 'node:crypto'
import { apply, signed } from '../../api/newsletter-events.js'
import { cases, check, finish, same } from '../harness/checks.js'

const SECRET = 'whsec_dGhpcyBpcyBub3QgYSByZWFsIHNlY3JldCwgaXQgaXMgYSB0ZXN0'

/** A Svix signature over exactly these bytes, as Resend sends one. */
function sign(id, stamp, body, secret = SECRET) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  return createHmac('sha256', key).update(`${id}.${stamp}.${body}`).digest('base64')
}

function headers(id, stamp, signature) {
  return { 'svix-id': id, 'svix-timestamp': stamp, 'svix-signature': `v1,${signature}` }
}

/**
 * A database that answers the calls this endpoint makes and keeps what it was
 * told to write.
 */
function stub({ send = null, subscriber = null } = {}) {
  const writes = []
  const table = name => {
    const call = { table: name, filters: {} }
    const chain = {
      select() {
        return chain
      },
      eq(column, value) {
        call.filters[column] = value
        return chain
      },
      update(patch) {
        call.patch = patch
        writes.push({ ...call, kind: 'update' })
        return chain
      },
      upsert(row) {
        writes.push({ table: name, kind: 'upsert', row })
        return Promise.resolve({ error: null })
      },
      maybeSingle() {
        if (name === 'newsletter_sends') return Promise.resolve({ data: send, error: null })
        if (name === 'subscribers') return Promise.resolve({ data: subscriber, error: null })
        return Promise.resolve({ data: null, error: null })
      },
      then(resolve) {
        return Promise.resolve({ data: null, error: null }).then(resolve)
      },
    }
    return chain
  }
  return { db: { from: table }, writes }
}

const patchFor = (writes, table) =>
  writes.find(w => w.table === table && w.kind === 'update')?.patch

check('a genuine signature is admitted', () => {
  const body = '{"type":"email.opened"}'
  const ok = signed(headers('msg_1', '1700000000', sign('msg_1', '1700000000', body)), body, SECRET)
  same(ok, true, 'accepted')
})

check('a signature over different bytes is refused', () => {
  const body = '{"type":"email.opened"}'
  const ok = signed(
    headers('msg_1', '1700000000', sign('msg_1', '1700000000', '{"type":"email.clicked"}')),
    body,
    SECRET
  )
  same(ok, false, 'refused')
})

check('a signature under a different id is refused', () => {
  const body = '{"type":"email.opened"}'
  const ok = signed(headers('msg_2', '1700000000', sign('msg_1', '1700000000', body)), body, SECRET)
  same(ok, false, 'refused')
})

check('one good signature among several is enough', () => {
  const body = '{"type":"email.opened"}'
  const head = headers('msg_1', '1700000000', sign('msg_1', '1700000000', body))
  head['svix-signature'] = `v1,notthisone ${head['svix-signature']}`
  same(signed(head, body, SECRET), true, 'accepted')
})

check('a missing header is refused rather than thrown over', () => {
  same(signed({}, '{"type":"email.opened"}', SECRET), false, 'refused')
})

check('a first open sets the timestamp and the count', async () => {
  const { db, writes } = stub({ send: { id: 's1', opened_at: null, open_count: 0 } })
  same(
    await apply(db, {
      type: 'email.opened',
      created_at: '2026-08-29T10:00:00Z',
      data: { email_id: 're_1', to: ['a@b.com'] },
    }),
    'recorded',
    'outcome'
  )
  const patch = patchFor(writes, 'newsletter_sends')
  same(patch.opened_at, '2026-08-29T10:00:00.000Z', 'first open')
  same(patch.open_count, 1, 'count')
})

check('a later open keeps the first and moves the last', async () => {
  const { db, writes } = stub({
    send: { id: 's1', opened_at: '2026-08-01T00:00:00.000Z', open_count: 3 },
  })
  await apply(db, {
    type: 'email.opened',
    created_at: '2026-08-29T10:00:00Z',
    data: { email_id: 're_1', to: ['a@b.com'] },
  })
  const patch = patchFor(writes, 'newsletter_sends')
  same(patch.opened_at, '2026-08-01T00:00:00.000Z', 'first open held')
  same(patch.last_open_at, '2026-08-29T10:00:00.000Z', 'last open')
  same(patch.open_count, 4, 'count')
})

check('a delivery already recorded is not written again', async () => {
  const { db, writes } = stub({ send: { id: 's1', delivered_at: '2026-08-01T00:00:00.000Z' } })
  same(
    await apply(db, { type: 'email.delivered', data: { email_id: 're_1', to: ['a@b.com'] } }),
    'repeat',
    'outcome'
  )
  same(writes.length, 0, 'writes')
})

check('a bounce suppresses the address and marks the subscriber', async () => {
  const { db, writes } = stub({
    send: { id: 's1', bounced_at: null },
    subscriber: { id: 'p1', status: 'subscribed', bounce_count: 1 },
  })
  await apply(db, {
    type: 'email.bounced',
    created_at: '2026-08-29T10:00:00Z',
    data: { email_id: 're_1', to: ['A@B.com'], bounce: { subType: 'HardBounce' } },
  })
  same(patchFor(writes, 'subscribers').status, 'bounced', 'subscriber status')
  same(patchFor(writes, 'subscribers').bounce_count, 2, 'bounce count')
  const held = writes.find(w => w.table === 'suppression')
  same(held.row.email, 'a@b.com', 'suppressed address, lowercased')
  same(held.row.reason, 'bounced', 'reason')
  same(patchFor(writes, 'newsletter_sends').bounced_at, '2026-08-29T10:00:00.000Z', 'bounced at')
})

check('a complaint outranks a bounce and is never overwritten by one', async () => {
  const { db, writes } = stub({
    send: { id: 's1' },
    subscriber: { id: 'p1', status: 'complained', bounce_count: 0 },
  })
  await apply(db, { type: 'email.bounced', data: { email_id: 're_1', to: ['a@b.com'] } })
  same(patchFor(writes, 'subscribers'), undefined, 'the subscriber is left alone')
})

check('somebody who unsubscribed is left where they stand', async () => {
  const { db, writes } = stub({
    send: { id: 's1' },
    subscriber: { id: 'p1', status: 'unsubscribed', bounce_count: 0 },
  })
  await apply(db, { type: 'email.complained', data: { email_id: 're_1', to: ['a@b.com'] } })
  same(patchFor(writes, 'subscribers'), undefined, 'the subscriber is left alone')
})

check('an event for a message with no row still suppresses', async () => {
  const { db, writes } = stub({ send: null, subscriber: { id: 'p1', status: 'subscribed' } })
  same(
    await apply(db, { type: 'email.bounced', data: { email_id: 're_x', to: ['a@b.com'] } }),
    'unmatched',
    'outcome'
  )
  same(writes.find(w => w.table === 'suppression')?.row.reason, 'bounced', 'still suppressed')
  same(
    patchFor(writes, 'newsletter_sends'),
    undefined,
    'nothing written to a row that is not there'
  )
})

check('an event this endpoint has no use for writes nothing', async () => {
  const { db, writes } = stub({ send: { id: 's1' } })
  same(
    await apply(db, { type: 'email.delivery_delayed', data: { email_id: 're_1' } }),
    'ignored',
    'outcome'
  )
  same(writes.length, 0, 'writes')
})

await finish()

console.log(`email events: all ${cases.length} cases pass`)
