/**
 * Proves the call list rings the right businesses, in the right order, and
 * never rings the one it must not.
 *
 * Three failures are possible here and all three are silent.
 *
 * The first is the serious one. A business that asked for no further contact
 * is unsubscribed, and that ask was about hearing from the studio rather than
 * about email specifically. The call list reads a different table of the same
 * rows through a different endpoint, so nothing the sender does protects it: a
 * rule dropped here and somebody rings a person who has already said stop, and
 * the only place that shows up is on the phone. The same goes for a row a
 * person skipped by hand on the outreach board, which the list would otherwise
 * quietly put back.
 *
 * The second is the ordering, which is a number nothing stores and nothing
 * displays. It exists for the length of one sort and is gone, so an axis that
 * ranks the wrong business first fails without leaving a mark - the list is
 * full, the calls get made, and the only thing that changed is who was rung
 * first. The reading it leans on is the review count measured against the
 * middle count for the same trade, and the failure to catch is the one where
 * that measurement collapses back into the raw count: sixty restaurants at the
 * top and every trade that collects reviews slowly buried under them. That
 * looks exactly like the ranking working.
 *
 * The third is the drift `check-db-values.js` exists for, which cannot see
 * this one. The outcomes are built as objects and the ids are read off them at
 * run time rather than written as literals into a call, so the scan that holds
 * every write to its column counts them as dynamic and passes. The column and
 * the dropdown are compared here instead, against the schema's own snapshot.
 *
 *   npm run check:call-list
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BUSY_FLOOR,
  CALL_OUTCOMES,
  OUTCOME_IDS,
  PULLS,
  QUIET_CEILING,
  TRADE_FLOOR,
  callRank,
  dialHref,
  isCallable,
  medianOf,
  outcomeEnds,
  outcomeNeedsCallback,
  pullBand,
  pullOf,
  uncallableReason,
} from '../../../lib/outreach/prospects/calls.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want)
    throw new Error(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

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
  rating_count: 40,
  business_status: 'OPERATIONAL',
  ...over,
})

/** A row as the endpoint hands it to the sort: the listing plus its history. */
const listed = over => ({ ...row(), pull: 'steady', calls: [], callback_at: null, ...over })

/** A call as the table holds one. */
const call = over => ({
  id: 'c1',
  outcome: 'no_answer',
  note: null,
  callback_at: null,
  called_at: '2026-09-01T15:00:00.000Z',
  ...over,
})

// ── Who is on the list ──────────────────────────────────────────────────

check('a business with no site and a number is on the list', () => {
  same(uncallableReason(row()), null, 'a plain callable row')
  ok(isCallable(row()), 'the plainest row on the list is not callable')
})

check('a listing pointing at a platform is on the list too', () => {
  const facebook = row({ site_kind: 'social', website: 'https://www.facebook.com/mikes' })
  ok(isCallable(facebook), 'a business whose only presence is a Facebook page is not callable')
})

check('a business that asked for no further contact is never rung', () => {
  const gone = row({ stage: 'unsubscribed' })
  ok(!isCallable(gone), 'an unsubscribed business reached the call list')
  same(
    uncallableReason(gone),
    'the business asked for no further contact',
    'why an unsubscribed business is off the list'
  )
})

check('a business somebody skipped by hand stays skipped', () => {
  ok(!isCallable(row({ stage: 'skipped' })), 'a skipped business reached the call list')
})

check('a business already in conversation is a lead rather than a number', () => {
  ok(!isCallable(row({ stage: 'replied' })), 'a business that replied reached the call list')
})

check('a business with a site of its own belongs to the sender', () => {
  const own = row({ site_kind: 'own', website: 'https://baytownplumbing.com' })
  ok(!isCallable(own), 'a business the sender can write to reached the call list')
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
})

check('a listing whose status was never read is still rung', () => {
  // A third of the table was written by a sweep that did not ask for the
  // field. Reading that absence as a closure would empty the list of every
  // row the pipeline knows least about.
  ok(isCallable(row({ business_status: null })), 'an unread status was read as a closure')
})

check('every stage the sender leaves a business at is callable', () => {
  for (const stage of ['found', 'enriched', 'audited', 'unreachable', 'contacted', 'bounced']) {
    ok(isCallable(row({ stage })), `a business at ${stage} is not callable`)
  }
})

// ── The number itself ───────────────────────────────────────────────────

check('a number formatted for a person is flattened for a dialer', () => {
  same(dialHref('(281) 862-9968'), 'tel:2818629968', 'a formatted number')
  same(dialHref('+1 281-862-9968'), 'tel:+12818629968', 'a number carrying its country')
  same(dialHref(''), null, 'no number at all')
  same(dialHref(null), null, 'a null number')
})

// ── What the trade says ─────────────────────────────────────────────────

check('the middle of a list is its middle, at either length', () => {
  same(medianOf([1, 2, 3]), 2, 'an odd list')
  same(medianOf([1, 2, 3, 4]), 2.5, 'an even list')
  same(medianOf([]), null, 'an empty list')
  same(medianOf([null, undefined, 'x']), null, 'a list of nothing readable')
})

check('a count is read against its own trade rather than against every trade', () => {
  // The failure this exists to catch. A barber shop with 200 reviews is
  // exceptional; a restaurant with 400 is ordinary. Ranked on the raw count
  // the restaurant leads, and every trade that collects reviews slowly is
  // buried under the ones that collect them fast.
  const barber = row({ trade: 'barber shop', rating_count: 200 })
  const diner = row({ trade: 'restaurant', rating_count: 400 })
  const barberPull = pullOf(barber, 45)
  const dinerPull = pullOf(diner, 380)
  ok(barberPull > dinerPull, 'the raw count outranked the reading against the trade')
  same(pullBand(barber, 45), 'busy', 'a barber shop well ahead of its trade')
  same(pullBand(diner, 380), 'steady', 'a diner in the middle of its trade')
})

check('the three readings are cut where they say they are', () => {
  same(pullBand(row({ rating_count: BUSY_FLOOR * 40 }), 40), 'busy', 'exactly at the busy floor')
  same(
    pullBand(row({ rating_count: QUIET_CEILING * 40 }), 40),
    'quiet',
    'exactly at the quiet ceiling'
  )
  same(pullBand(row({ rating_count: 40 }), 40), 'steady', 'exactly the middle of its trade')
})

check('a trade with no middle to take reads unread rather than being ranked', () => {
  same(pullBand(row(), null), 'unread', 'a trade under the floor')
  same(pullBand(row({ rating_count: null }), 40), 'unread', 'a listing with no count')
  same(pullOf(row({ rating_count: '40' }), 40), null, 'a count that is not a number')
  ok(TRADE_FLOOR >= 5, 'the trade floor is low enough to be a middle of anything')
})

check('every reading a listing can come to is one of the four named', () => {
  const reached = new Set([
    pullBand(row({ rating_count: 200 }), 40),
    pullBand(row({ rating_count: 40 }), 40),
    pullBand(row({ rating_count: 4 }), 40),
    pullBand(row(), null),
  ])
  same([...reached].sort().join(','), [...PULLS].sort().join(','), 'the readings reached')
})

// ── The order to work it in ─────────────────────────────────────────────

const now = new Date('2026-09-06T16:00:00.000Z')

check('a callback that has come due leads everything', () => {
  const due = listed({ callback_at: '2026-09-06T15:00:00.000Z', calls: [call()] })
  const fresh = listed({ pull: 'busy' })
  ok(callRank(due, now) < callRank(fresh, now), 'a due callback did not lead')
})

check('a callback still to come waits behind the cold work', () => {
  const later = listed({ callback_at: '2026-09-08T15:00:00.000Z', calls: [call()] })
  const fresh = listed({ pull: 'unread' })
  ok(callRank(fresh, now) < callRank(later, now), 'a callback not yet due jumped the queue')
})

check('a number nobody has tried comes before one tried this morning', () => {
  const fresh = listed({ pull: 'unread' })
  const tried = listed({ calls: [call({ called_at: '2026-09-06T14:00:00.000Z' })] })
  ok(callRank(fresh, now) < callRank(tried, now), 'a number rung today was offered again first')
})

check('among untried numbers the busiest of its trade leads', () => {
  const ranks = PULLS.map(pull => callRank(listed({ pull }), now))
  for (let index = 1; index < ranks.length; index += 1) {
    ok(ranks[index - 1] < ranks[index], `${PULLS[index - 1]} did not lead ${PULLS[index]}`)
  }
})

check('among tried numbers the oldest attempt comes back round first', () => {
  const old = listed({ calls: [call({ called_at: '2026-08-01T15:00:00.000Z' })] })
  const recent = listed({ calls: [call({ called_at: '2026-09-05T15:00:00.000Z' })] })
  ok(callRank(old, now) < callRank(recent, now), 'the most recent attempt was offered first')
})

// ── What a call comes to ────────────────────────────────────────────────

check('the outcomes the console offers are the ones the column accepts', () => {
  // The scan that holds every write to its column reads literals, and these
  // are read off objects at run time. So the two are compared here instead.
  const snapshot = JSON.parse(readFileSync(join(ROOT, 'scripts/db/db-constraints.json'), 'utf8'))
  const column = snapshot.columns?.outreach_calls?.outcome
  ok(column, 'the schema snapshot carries no outcome column for outreach_calls')
  same(
    [...OUTCOME_IDS].sort().join(','),
    [...column.allows].sort().join(','),
    'the outcomes offered against the ones the column takes'
  )
})

check('every outcome carries a label and a tone, and none repeats an id', () => {
  same(new Set(OUTCOME_IDS).size, CALL_OUTCOMES.length, 'two outcomes sharing an id')
  for (const outcome of CALL_OUTCOMES) {
    ok(outcome.label && outcome.tone, `${outcome.id} is missing a label or a tone`)
  }
})

check('the outcomes that end a business are the ones that should', () => {
  for (const id of ['booked', 'not_interested', 'wrong_number']) {
    ok(outcomeEnds(id), `${id} left the business on the list`)
  }
  for (const id of ['no_answer', 'voicemail', 'gatekeeper', 'spoke', 'callback']) {
    ok(!outcomeEnds(id), `${id} took the business off the list`)
  }
})

check('a call back is the one outcome that has to name a time', () => {
  ok(outcomeNeedsCallback('callback'), 'a call back was accepted with no time on it')
  for (const id of OUTCOME_IDS.filter(one => one !== 'callback')) {
    ok(!outcomeNeedsCallback(id), `${id} was made to name a callback time`)
  }
})

check('an id nothing offers is not an outcome', () => {
  ok(!outcomeEnds('sold'), 'an unknown id ended a business')
  ok(!outcomeNeedsCallback(''), 'an empty id demanded a callback')
})

// ── Run them ────────────────────────────────────────────────────────────

const failures = []
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure)
  console.error(`\n${failures.length} of ${cases.length} call list checks failed`)
  process.exit(1)
}

console.log(`call list: ${cases.length} checks passed`)
