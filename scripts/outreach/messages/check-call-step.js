/**
 * A chain step that rings rather than writes.
 *
 * The broken-site chain rings on its second step. That is the one case where a
 * telephone beats a second letter: the owner of a site that has stopped
 * working may not be reading the inbox the first letter went to, and what is
 * being reported is urgent enough to be worth interrupting somebody over.
 *
 * Two things have to hold. The step has to reach the desk at all - the desk
 * otherwise rings only businesses with no site of their own, which is exactly
 * the rule this case gets wrong - and it has to cost nothing a telephone call
 * does not cost: not the day's sending, not an address's room, not the
 * mailbox's.
 *
 *   node scripts/outreach/messages/check-call-step.js
 */
import {
  callOwed,
  callReason,
  deskMessage,
  deskPatch,
} from '../../../lib/outreach/sending/desk-step.js'
import { isCallable, uncallableReason } from '../../../lib/outreach/prospects/calls.js'
import { CHAIN_REGISTRY, VARIANTS } from '../../../lib/outreach/variants.js'
import { FOLLOW_UP_COLUMNS } from '../../../lib/outreach/sending/queue.js'
import { nextDueFor } from '../../../api/outreach/send.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

const NOW = new Date('2026-10-28T12:00:00Z')
const day = n => new Date(Date.UTC(2026, 9, n, 12, 0, 0)).toISOString()
const broken = CHAIN_REGISTRY.chainById('broken-site')

const business = {
  id: 'a',
  name: 'Harbor Tire & Auto',
  phone: '(281) 555-0100',
  website: 'https://harbortire.example',
  site_kind: 'own',
  stage: 'contacted',
  business_status: 'OPERATIONAL',
  fault_says: 'the security certificate expired 27 days ago',
}

// ── The chain has a step that rings ─────────────────────────────────────

check('the broken-site chain rings on its second step', () => {
  same(broken.steps[1].channel, 'call', 'the channel')
  same(broken.steps[1].letter, null, 'a call carries no words')
  same(CHAIN_REGISTRY.dueAt(broken, 2), 3, 'the day it falls due')
})

check('the ringing step is registered like any other', () => {
  const call = VARIANTS.find(one => one.chain === 'broken-site' && one.step === 2)
  ok(call, 'the step is not in the registry')
  same(call.channel, 'call', 'the channel')
  same(call.open, null, 'the words')
})

check('the letters either side of it are letters', () => {
  same(broken.steps[0].channel, 'email', 'the first')
  same(broken.steps[2].channel, 'email', 'the third')
  same(CHAIN_REGISTRY.dueAt(broken, 3), 7, 'when the third falls due')
})

// ── What it writes ──────────────────────────────────────────────────────

check('the caller is given the chain’s own sentence about this business', () =>
  same(
    callReason(business, broken),
    'Broken site: the security certificate expired 27 days ago',
    'the line'
  )
)

check('a business with no sentence still gives the caller the chain', () =>
  ok(
    callReason({ id: 'b' }, broken).startsWith('Broken site:'),
    `the line read ${JSON.stringify(callReason({ id: 'b' }, broken))}`
  )
)

check('the step is written on the business, with the chain that asked', () => {
  const patch = deskPatch(business, broken, 2, NOW)
  same(patch.call_due_at, NOW.toISOString(), 'when it fell due')
  same(patch.call_due_chain, 'broken-site', 'the chain')
  same(patch.step, 2, 'the step the business has reached')
})

check('the step is recorded on the same list as the letters', () => {
  const row = deskMessage(business, broken, 2, 'no-site-broken-site-call', NOW)
  same(row.chain, 'broken-site', 'the chain')
  same(row.channel, 'call', 'the channel')
  same(row.step, 2, 'the step')
  same(row.status, 'sent', 'what it is recorded as')
  same(row.body_text, undefined, 'a body')
  same(row.to_address, undefined, 'an address')
})

check('the chain moves on from a ringing step the way it does from a letter', () => {
  // The chain does not wait on whether anybody rang. A chain that waited would
  // stop whenever the desk was busy.
  const soon = new Date(day(4))
  same(nextDueFor(broken, 2, day(1), soon), day(8), 'the third letter, seven days from the first')
  same(deskPatch(business, broken, 2, NOW).next_due_at, null, 'what the patch leaves it at')
})

check('each chain reads its own days for the step after one that has gone', () => {
  const intro = CHAIN_REGISTRY.chainById('intro')
  const early = new Date(day(2))
  same(nextDueFor(intro, 1, day(1), early), day(15), 'the cold intro reminder')
  same(nextDueFor(intro, 2, day(1), early), null, 'a third intro letter')
  const preview = CHAIN_REGISTRY.chainById('preview')
  same(nextDueFor(preview, 1, day(1), early), day(4), "the preview's first follow-up")
})

check('a day that has already passed is owed at once rather than skipped', () =>
  same(nextDueFor(broken, 2, day(1), new Date(day(20))), day(20), 'when it is owed')
)

// ── It reaches the desk ─────────────────────────────────────────────────

check('a business with a site of its own is written to rather than rung', () =>
  same(
    uncallableReason(business),
    'the business has a site of its own, so the sender can write to it',
    'the reason'
  )
)

check('a chain asking for the call puts it on the desk anyway', () => {
  const owed = { ...business, call_due_at: NOW.toISOString() }
  same(uncallableReason(owed), null, 'the reason')
  same(isCallable(owed), true, 'callable')
})

check('a call already made takes it back off the desk', () => {
  const rung = { ...business, call_due_at: day(1), called_at: day(2) }
  same(callOwed(rung), false, 'still owed')
  ok(uncallableReason(rung), 'it is still on the desk after being rung')
})

check('a call made before the chain asked does not count as this one', () => {
  const older = { ...business, call_due_at: day(10), called_at: day(2) }
  same(callOwed(older), true, 'still owed')
  same(uncallableReason(older), null, 'the reason')
})

check('a business that asked to stop is never rung, whatever a chain says', () => {
  const stopped = { ...business, call_due_at: NOW.toISOString(), stage: 'unsubscribed' }
  same(uncallableReason(stopped), 'the business asked for no further contact', 'the reason')
})

check('a business with no number is never rung, whatever a chain says', () =>
  ok(uncallableReason({ ...business, call_due_at: NOW.toISOString(), phone: '' }), 'it was rung')
)

check('a business Google says is closed is never rung', () =>
  ok(
    uncallableReason({
      ...business,
      call_due_at: NOW.toISOString(),
      business_status: 'PERMANENTLY_CLOSED',
    }),
    'it was rung'
  )
)

// ── The reads agree ─────────────────────────────────────────────────────

check('the follow-up read carries what a ringing step needs', () => {
  const read = FOLLOW_UP_COLUMNS.split(',').map(one => one.trim())
  for (const column of ['call_due_at', 'call_due_chain', 'called_at']) {
    ok(read.includes(column), `the follow-up read does not carry ${column}`)
  }
})

await finish({
  hint: 'lib/outreach/sending/desk-step.js is what a ringing step writes.',
})

console.log(
  `call step: ${cases.length} checks passed — the broken-site chain rings on day ` +
    `${CHAIN_REGISTRY.dueAt(broken, 2)} and writes again on day ${CHAIN_REGISTRY.dueAt(broken, 3)}`
)
