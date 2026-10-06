/**
 * Holds the preview tracker's endpoint to what it may take in.
 *
 * A batch is picked apart field by field before it reaches the database, so
 * the only things that can be stored are the names the tracker sends: event
 * kinds from a fixed list, labels and targets cut to length, numbers rounded.
 * A field nobody meant to send - a typed value, above all - has nowhere to go.
 *
 *   node scripts/outreach/prospects/check-preview-events.js
 */

import { cases, check, finish, ok, same } from '../../harness/checks.js'

const { cleanBatch, EVENT_TYPES } = await import('../../../api/preview-events.js')

const SID = '6f1c2b0a-4a0e-4c39-9d7c-2f0f6f3b7a10'
const VID = '0b7e1f22-8d2e-4f6a-a3c1-5e9d2c7b4f01'
const base = (over = {}) => ({
  v: 1,
  slug: 'epicplumbing',
  template: 'plumbing',
  sid: SID,
  vid: VID,
  path: 'services',
  ctx: { device: 'mobile', os: 'iOS', browser: 'Safari', viewport: '390x844', source: 'direct' },
  ev: [
    { t: 'click', at: 1759760000000, name: 'Call Now', kind: 'call', target: 'tel:+17135550100' },
  ],
  ...over,
})

check('a well-formed batch passes with its event intact', () => {
  const batch = cleanBatch(base())
  ok(batch, 'the batch was refused')
  same(batch.ev.length, 1, 'events kept')
  same(batch.ev[0].name, 'Call Now', 'label')
  same(batch.ev[0].kind, 'call', 'kind')
})

check('a field the tracker never sends is not carried on to the database', () => {
  const batch = cleanBatch(
    base({
      ev: [{ t: 'blur', name: 'email', value: 1200, text: 'someone@example.com', input: 'secret' }],
      ctx: { device: 'desktop', typed: 'secret' },
      extra: 'secret',
    })
  )
  ok(batch, 'the batch was refused')
  ok(!JSON.stringify(batch).includes('secret'), 'a stray field survived')
  ok(!JSON.stringify(batch).includes('someone@example.com'), 'a typed value survived')
})

check('an event kind outside the list is dropped', () => {
  const batch = cleanBatch(
    base({
      ev: [
        { t: 'keypress', name: 'a' },
        { t: 'scroll', value: 50 },
      ],
    })
  )
  same(batch.ev.length, 1, 'events kept')
  same(batch.ev[0].t, 'scroll', 'kind kept')
  ok(!EVENT_TYPES.has('keypress'), 'keystrokes are not an event kind')
})

check('a batch with a bad slug, session or visitor is refused', () => {
  same(cleanBatch(base({ slug: '../etc' })), null, 'bad slug')
  same(cleanBatch(base({ sid: 'not-a-uuid' })), null, 'bad session')
  same(cleanBatch(base({ vid: 42 })), null, 'bad visitor')
  same(cleanBatch(base({ ev: [] })), null, 'no events')
  same(cleanBatch('nonsense'), null, 'not an object')
})

check('labels and batch length are cut to size', () => {
  const ev = Array.from({ length: 500 }, () => ({
    t: 'hover',
    name: 'x'.repeat(500),
    value: 700.6,
  }))
  const batch = cleanBatch(base({ ev }))
  same(batch.ev.length, 200, 'events per batch')
  same(batch.ev[0].name.length, 80, 'label length')
  same(batch.ev[0].value, 701, 'value rounded')
})

await finish()

console.log(`preview events: ${cases.length} checks passed`)
