/**
 * What puts a business on a chain that fires on something that just happened,
 * and what it refuses to touch.
 *
 * The refusals are the part that matters. A trigger is a reason to write to
 * somebody nobody is writing to; it is not a reason to interrupt a
 * conversation, to take a business off a chain it is halfway through, or to
 * overrule a person who put it aside by hand. Every one of those is a letter
 * that costs more than it was worth.
 *
 *   node scripts/outreach/messages/check-triggers.js
 */
import {
  TRIGGER_COLUMNS,
  firstMatches,
  movable,
  patchFor,
  triggersFor,
} from '../../../lib/outreach/triggers.js'
import { CANDIDATE_COLUMNS } from '../../../lib/outreach/sending/queue.js'
import { CHAIN_REGISTRY } from '../../../lib/outreach/variants.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

const ready = { id: 'a', email: 'owner@example.com', stage: 'enriched' }

// ── Who may be put on a chain ───────────────────────────────────────────

check('a business that is ready and on no chain may be moved', () => {
  for (const stage of ['enriched', 'audited', 'queued']) {
    same(movable({ ...ready, stage }), true, `a business at ${stage}`)
  }
})

check('a business with no address may not be moved, since no letter could go', () =>
  same(movable({ ...ready, email: null }), false, 'movable')
)

check('a business already written to is left alone', () =>
  same(movable({ ...ready, contacted_at: '2026-10-01T00:00:00Z' }), false, 'movable')
)

check('a business that replied is left alone', () =>
  same(movable({ ...ready, replied_at: '2026-10-01T00:00:00Z' }), false, 'movable')
)

check('a business whose address does not exist is left alone', () =>
  same(movable({ ...ready, bounced_at: '2026-10-01T00:00:00Z' }), false, 'movable')
)

check('a business part way through a chain is never taken off it', () => {
  for (const chain of ['lawsuit', 'preview', 'broken-site', 'intro']) {
    same(movable({ ...ready, chain }), false, `a business on the ${chain} chain`)
  }
})

check('a business not yet ready to be written to is left alone', () => {
  for (const stage of ['found', 'skipped', 'unreachable', 'contacted', 'replied']) {
    same(movable({ ...ready, stage }), false, `a business at ${stage}`)
  }
})

// ── The order between triggers ──────────────────────────────────────────

check('the triggers are swept strongest signal first', () =>
  same(
    triggersFor(async () => [])
      .map(one => one.chain)
      .join(' '),
    'broken-site listing builder growing again',
    'the order'
  )
)

check('every trigger feeds a chain that exists', () => {
  for (const { chain } of triggersFor(async () => [])) {
    ok(CHAIN_REGISTRY.chainById(chain), `${chain} is not a chain`)
  }
})

check('a business matching two triggers hears about the stronger one', () => {
  const matched = firstMatches([
    { chain: 'broken-site', found: [{ ref: 'a', payload: { fault: 'certificate-expired' } }] },
    { chain: 'listing', found: [{ ref: 'a', payload: { fault: 'no-photos' } }] },
  ])
  same(matched.get('a').chain, 'broken-site', 'the chain it goes on')
  same(matched.get('a').payload.fault, 'certificate-expired', 'the fault it hears about')
})

check('a business matching only the weaker one still hears about it', () => {
  const matched = firstMatches([
    { chain: 'broken-site', found: [] },
    { chain: 'listing', found: [{ ref: 'b', payload: { fault: 'no-photos' } }] },
  ])
  same(matched.get('b').chain, 'listing', 'the chain')
})

check('a trigger that matched nothing takes nobody off another', () => {
  const matched = firstMatches([
    { chain: 'broken-site', found: [{ ref: 'a', payload: {} }] },
    { chain: 'listing', found: null },
  ])
  same(matched.size, 1, 'the businesses matched')
})

// ── What a match writes ─────────────────────────────────────────────────

const NOW = new Date('2026-10-28T12:00:00Z')

check('a match writes the chain, the fault and the sentence the letter opens on', () => {
  const patch = patchFor(
    'broken-site',
    {
      fault: 'certificate-expired',
      says: 'the security certificate expired 27 days ago',
      fault_at: '2026-10-01T00:00:00.000Z',
      checked_at: NOW.toISOString(),
    },
    NOW
  )
  same(patch.chain, 'broken-site', 'the chain')
  same(patch.fault, 'certificate-expired', 'the fault')
  same(patch.fault_says, 'the security certificate expired 27 days ago', 'the sentence')
  same(patch.fault_at, '2026-10-01T00:00:00.000Z', 'when it happened')
  same(patch.fault_checked_at, NOW.toISOString(), 'when it was checked')
})

check('a match with no sentence writes none rather than an empty one', () => {
  const patch = patchFor('listing', null, NOW)
  same(patch.fault_says, null, 'the sentence')
  same(patch.fault, null, 'the fault')
  same(patch.fault_checked_at, NOW.toISOString(), 'when it was checked')
})

check('the whole of what a trigger found is kept, not only what the letter reads', () => {
  const found = { fault: 'old-builder', says: 'the site is built on Wix', builder: 'Wix' }
  same(patchFor('builder', found, NOW).fault_payload.builder, 'Wix', 'what was kept')
})

// ── The reads agree ─────────────────────────────────────────────────────

check('the send queue reads every column a triggered letter needs', () => {
  // A letter on one of these chains cannot be written without its sentence, so
  // a queue read that left the column out would hold every one of those
  // businesses for a column nobody had asked for.
  const read = CANDIDATE_COLUMNS.split(',').map(one => one.trim())
  for (const column of ['chain', 'fault', 'fault_says']) {
    ok(read.includes(column), `the candidate read does not carry ${column}`)
  }
})

check('the triggers read every column they judge on', () => {
  const read = TRIGGER_COLUMNS.split(',').map(one => one.trim())
  for (const column of [
    'website',
    'business_status',
    'place_photos',
    'rating_count',
    'rating_count_first',
    'stage',
    'chain',
    'contacted_at',
    'replied_at',
    'bounced_at',
    'email',
  ]) {
    ok(read.includes(column), `the trigger read does not carry ${column}`)
  }
})

check('every column a triggered letter needs is one a trigger writes', () => {
  const written = Object.keys(patchFor('broken-site', {}, NOW))
  for (const chain of ['broken-site', 'listing', 'builder', 'growing']) {
    const first = CHAIN_REGISTRY.letters.find(one => one.chain === chain && one.step === 1)
    for (const column of first.needs) {
      ok(written.includes(column), `${chain} needs ${column}, which no trigger writes`)
    }
  }
})

await finish({
  hint: 'lib/outreach/triggers.js decides who is offered; chainwork’s adapters do the judging.',
})

console.log(
  `triggers: ${cases.length} checks passed — ${triggersFor(async () => []).length} triggers, ` +
    'strongest first, and none of them interrupts a conversation'
)
