/**
 * Proves that a business is given one message, keeps it, is only ever given
 * one it can carry, and that both rows say which one it was.
 *
 * Every failure here is silent. A business rolled twice gets a follow-up that
 * reads as a different company writing. A template that quotes a score reaching
 * a row with none prints a hole where the figure should be. A segment nobody
 * has written for sends a message with no opener in it. A message row and a
 * prospect row naming different ids leaves the results counting one thing and
 * the follow-up opening on another. None of it throws, and all of it has gone
 * out by the time anybody reads the row.
 *
 * `pickVariant` is walked directly, since it is a function of the row, the
 * registry and a roll it is handed. The send job is then driven through `work`
 * against a database stand-in, with sending closed so nothing reaches a
 * transport, and the writes it makes are read back for the ids they carry.
 *
 *   npm run check:outreach-assignment
 */

process.env.OUTREACH_SMTP_USER = 'studio@example.com'
process.env.OUTREACH_SMTP_PASSWORD = 'not-a-password'
process.env.OUTREACH_SEND_ARMED = 'true'

import { SEGMENTS, segmentOf } from '../../../lib/outreach/segments.js'
import {
  HOLDOUTS,
  VARIANTS,
  familyOf,
  holdoutId,
  pickVariant,
  variantById,
} from '../../../lib/outreach/variants.js'
import { CANDIDATE_COLUMNS, queueFor } from '../../../lib/outreach/sending/queue.js'
import { answersFrom, captureOnFile, refused } from '../database-fixture.js'
import { installFixtureHeldDomains } from '../held-domains-fixture.js'
import { AFTERNOON, atMidAfternoon, TRANSPORT } from '../send-fixture.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

installFixtureHeldDomains()

// Nothing here may reach the network. The address check is settled below
// against a resolver that answers from here, and the capture is found already
// stored, so a path that reaches this is a path that was not stubbed.
globalThis.fetch = () => {
  throw new Error('a check reached the network')
}

const { checkAddress, forgetDomains } = await import('../../../lib/outreach/prospects/address.js')
const { compose, work: sendWork } = await import('../../../api/outreach/send.js')

/** The reason a call refused, or nothing where it did not refuse. */
async function refusal(run) {
  try {
    await run()
  } catch (cause) {
    return cause.message
  }
  return null
}

// ── The rows ─────────────────────────────────────────────────────────────

const UNSUB = '11111111-1111-4111-8111-111111111111'

const BASE = {
  town: 'Baytown',
  trade: 'plumber',
  email: 'owner@example.com',
  unsub_token: UNSUB,
  variant_id: null,
}

/** A business with no site of its own, waiting where its kind waits. */
const SOCIAL = {
  ...BASE,
  id: 'p1',
  name: 'Baytown Plumbing',
  website: 'https://www.facebook.com/baytownplumbing',
  site_kind: 'social',
  audit_score: null,
  stage: 'enriched',
}

// Each business answers on its own address. The queue writes one message per
// address however many listings carry it, so two businesses sharing one would
// reach the sender as one. Every address sits at the one domain the resolver
// below is settled for.

/** A business whose slow site was measured. */
const SCORED = {
  ...BASE,
  id: 'p2',
  name: 'Bayside Electrical',
  email: 'maria@example.com',
  website: 'https://baysideelectrical.example.com',
  site_kind: 'own',
  audit_score: 31,
  accessibility_score: 88,
  best_practices_score: 96,
  seo_score: 100,
  stage: 'audited',
}

/** A business the audit passed through without a figure. */
const UNMEASURED = {
  ...BASE,
  id: 'p3',
  name: 'Northside Lawn Care',
  email: 'pat@example.com',
  website: 'https://northsidelawn.example.com',
  site_kind: 'own',
  audit_score: null,
  stage: 'audited',
}

/**
 * A business no letter can be chosen for.
 *
 * Every segment has a live letter now, the unmeasured included, so the only
 * way to reach this is a row stamped with an id from a registry this one
 * cannot reason about. Rolling such a business again would overwrite a
 * conversation nobody here can read, so it is left where it stands.
 */
const UNFITTING = { ...UNMEASURED, variant_id: 'a-registry-ago' }

const row = over => ({ ...SCORED, ...over })

/** A registry entry with the fields the picker reads, and nothing it does not. */
const entry = over => ({
  id: 'one',
  name: 'One',
  segment: 'slow-site',
  status: 'live',
  weight: 1,
  needs: [],
  open: () => ({}),
  ...over,
})

// ── Choosing ─────────────────────────────────────────────────────────────

check('a business already holding a variant keeps it whatever the roll', () => {
  // Re-qualified under another segment since, and the first message still
  // stands: a follow-up under another id reads as a different company writing.
  const held = row({ variant_id: 'no-site-intro' })
  for (const roll of [0, 0.5, 0.99]) {
    same(pickVariant(held, VARIANTS, roll)?.id, 'no-site-intro', `the pick at ${roll}`)
  }
})

check('a held variant whose family is retired is drawn again, and never held out', () => {
  // The introduction letters for the segment still send, so what is gone is
  // the family rather than the segment, which is the case a business given a
  // designed letter and never written to stands in.
  const held = row({ variant_id: 'no-site-listing' })
  for (const roll of [0, 0.5, 0.99]) {
    const drawn = pickVariant(held, VARIANTS, roll)
    ok(drawn, `the pick at ${roll}`)
    ok(drawn.id !== 'no-site-listing', `the retired letter was kept at ${roll}`)
    same(familyOf(drawn) === 'designed', false, `the family drawn at ${roll}`)
    same(drawn.holdout ?? false, false, `a business already written for was held out at ${roll}`)
  }
})

check('a held variant is kept even once it has been paused', () => {
  // The letter itself is off and its own chain still sends, which is a switch
  // flipped in the console rather than a family retired.
  const paused = VARIANTS.map(one =>
    one.id === 'no-site-intro' ? { ...one, status: 'paused' } : one
  )
  same(
    pickVariant(row({ variant_id: 'no-site-intro' }), paused, 0.5)?.id,
    'no-site-intro',
    'the pick'
  )
})

check('a held id the registry no longer knows fits nothing, and is not rolled again', () => {
  same(pickVariant(row({ variant_id: 'retired-long-ago' }), VARIANTS, 0), null, 'the pick')
})

check('a variant is never given to a row missing something it needs', () => {
  const registry = [entry({ needs: ['accessibility_score'] })]
  same(pickVariant(row({ accessibility_score: null }), registry, 0), null, 'a null reading')
  same(pickVariant(row({ accessibility_score: undefined }), registry, 0), null, 'an absent reading')
  same(pickVariant(row({ accessibility_score: 0 }), registry, 0)?.id, 'one', 'a reading of nought')
  same(pickVariant(row({ accessibility_score: 88 }), registry, 0)?.id, 'one', 'a reading')
})

check('a segment with no live variant fits nothing', () => {
  const registry = [entry({ status: 'paused' }), entry({ id: 'two', status: 'draft' })]
  same(pickVariant(SCORED, registry, 0), null, 'the pick among paused and draft')
  same(pickVariant(SCORED, [], 0), null, 'the pick from an empty registry')
})

check('a business nothing has measured is written to like any other', () => {
  // It used to fit nothing at all, because every letter opened on a reading.
  // The introduction opens on none, so the one thing that made this business
  // unwritable is gone.
  same(pickVariant(UNMEASURED, VARIANTS, 0)?.id, 'unmeasured-intro', 'the pick')
})

check('a variant is only chosen for the segment it is written for', () => {
  const registry = [entry({ segment: 'no-site' })]
  same(pickVariant(SCORED, registry, 0), null, 'a slow site offered a no-site message')
  same(pickVariant(SOCIAL, registry, 0)?.id, 'one', 'a no-site business offered it')
})

check('a variant weighing nothing is never chosen', () => {
  const registry = [entry({ id: 'none', weight: 0 }), entry({ id: 'some', weight: 1 })]
  for (const roll of [0, 0.5, 0.999]) {
    same(pickVariant(SCORED, registry, roll)?.id, 'some', `the pick at ${roll}`)
  }
  same(
    pickVariant(SCORED, [entry({ weight: 0 })], 0),
    null,
    'the pick when nothing weighs anything'
  )
})

check('the roll lands in proportion to the weights', () => {
  const registry = [entry({ id: 'light', weight: 1 }), entry({ id: 'heavy', weight: 3 })]
  for (const roll of [0, 0.1, 0.249]) {
    same(pickVariant(SCORED, registry, roll)?.id, 'light', `the pick at ${roll}`)
  }
  for (const roll of [0.25, 0.5, 0.999]) {
    same(pickVariant(SCORED, registry, roll)?.id, 'heavy', `the pick at ${roll}`)
  }
})

check('a roll off the scale still lands on a variant', () => {
  const registry = [entry({ id: 'first' }), entry({ id: 'last' })]
  same(pickVariant(SCORED, registry, 1)?.id, 'last', 'a roll of one')
  same(pickVariant(SCORED, registry, 7)?.id, 'last', 'a roll past one')
  same(pickVariant(SCORED, registry, -1)?.id, 'first', 'a roll under nought')
  same(pickVariant(SCORED, registry, Number.NaN)?.id, 'first', 'a roll that is not a number')
  same(pickVariant(SCORED, registry)?.id, 'first', 'no roll')
})

check('the registry handed in is the one read, not the code’s own', () => {
  const registry = [entry({ id: 'elsewhere' })]
  same(pickVariant(SCORED, registry, 0)?.id, 'elsewhere', 'the pick')
})

check('a letter with a test on the row is chosen only where the row passes it', () => {
  // The gate on the column is what refuses a row with nothing to test, so a
  // letter names the column it tests as well as testing it.
  const short = row({ seo_score: 60 })
  const tested = [
    entry({ id: 'tested', needs: ['seo_score'], when: business => business.seo_score < 90 }),
  ]
  same(pickVariant(short, tested, 0.5)?.id, 'tested', 'a row that passes')
  same(pickVariant(row({ seo_score: 100 }), tested, 0.5), null, 'a row that fails')
  same(pickVariant(row({ seo_score: null }), tested, 0.5), null, 'a row with nothing to test')
})

check('the roll spreads one kind of business across every letter written for it', () => {
  const short = row({ seo_score: 60 })
  // The first letters that are still sending: a follow-up is drawn at its own
  // step, and a retired letter takes no slice of the line at all.
  const written = VARIANTS.filter(
    one =>
      one.segment === 'slow-site' &&
      (one.step ?? 1) === 1 &&
      one.status === 'live' &&
      one.weight > 0
  ).map(one => one.id)
  // One voice opens every chain, so this line is a single slice today. What
  // the walk is for is that every letter standing on it is reachable by some
  // roll, which is the thing that breaks when a weight or an order is wrong,
  // and that is worth checking at any width.
  ok(written.length > 0, 'nothing is written for a slow site')
  // The letters do not weigh the same, so an even walk of the line misses the
  // light ones. The roll is walked finely enough that the narrowest slice on
  // the line is still landed in.
  const chosen = new Set()
  const STEPS = 200
  for (let step = 0; step < STEPS; step += 1) {
    chosen.add(pickVariant(short, VARIANTS, (step + 0.5) / STEPS).id)
  }
  same([...chosen].sort().join(' '), [...written].sort().join(' '), 'the letters chosen')
})

check('a letter the row fails the test for takes no slice of the draw', () => {
  // The scored business is sound on SEO, so the search reading is out and the
  // draw runs over the letters left, which a roll near the end lands on the
  // last of: the introduction, which is last in the registry.
  const picked = pickVariant(SCORED, VARIANTS, 0.999)
  same(picked.id, 'slow-site-intro', 'the last slice')
  for (const roll of [0, 0.3, 0.6, 0.999]) {
    ok(
      pickVariant(SCORED, VARIANTS, roll).id !== 'slow-site-search',
      `the search reading was chosen at ${roll} for a site sound on SEO`
    )
  }
})

check('every kind of business the registry writes for is given the variant for its kind', () => {
  const fits = {
    'no-site': SOCIAL,
    'slow-site': SCORED,
    'fair-site': row({ audit_score: 67 }),
    'sound-site': row({ audit_score: 96, accessibility_score: 100, best_practices_score: 100 }),
  }
  for (const segment of SEGMENTS) {
    if (segment === 'unmeasured') continue
    const business = fits[segment]
    same(segmentOf(business), segment, 'the fitting business reads as its own segment')
    for (const roll of [0, 0.99]) {
      const picked = pickVariant(business, VARIANTS, roll)
      ok(picked, `nothing fits a ${segment} business`)
      same(picked.segment, segment, `the variant's segment at ${roll}`)
    }
  }
})

check('choosing reads the row and leaves it as it was', () => {
  const before = JSON.stringify(SCORED)
  const first = pickVariant(SCORED, VARIANTS, 0.3)
  const second = pickVariant(SCORED, VARIANTS, 0.3)
  same(second, first, 'two picks with one roll')
  same(JSON.stringify(SCORED), before, 'the row after choosing')
})

check('the candidate read carries the variant a business already holds', () => {
  const columns = CANDIDATE_COLUMNS.split(',').map(column => column.trim())
  ok(columns.includes('variant_id'), 'variant_id is not read with the candidate')
})

// ── The holdout, retired ─────────────────────────────────────────────────

/** The holdouts with one segment's holding a weight, the way the console set one. */
const holding = (segment, weight) =>
  HOLDOUTS.map(entry => (entry.segment === segment ? { ...entry, weight, status: 'live' } : entry))

check('nothing is drawn into a holdout, whatever the roll and whatever it weighs', () => {
  // A holdout was a slice of a segment given no letter at all, so that what
  // the letters did could be read against a group that heard nothing. One
  // letter goes to everybody now, so there is nothing to measure and nobody to
  // withhold it from. A weight set in the console changes none of that.
  const letter = (picked, what) => {
    ok(picked && !picked.holdout, `${what}: a business was held`)
    ok(typeof picked.open === 'function', `${what}: what was drawn cannot be opened`)
  }
  for (const roll of [0, 0.5, 0.74, 0.95, 0.999, 1]) {
    letter(pickVariant(SCORED, VARIANTS, roll), `the code's own holdouts at ${roll}`)
    letter(pickVariant(SCORED, VARIANTS, roll), `a stored weight at ${roll}`)
  }
  same(
    holding('slow-site', 9).find(entry => entry.weight === 9).segment,
    'slow-site',
    'the fixture'
  )
})

check('a business already held out is drawn again rather than left held', () => {
  // Nothing was ever written to it, so there is no voice to keep and no
  // conversation to be consistent with. It is a business the pipeline has not
  // spoken to, which is exactly what the queue is for.
  const drawn = pickVariant({ ...SCORED, variant_id: holdoutId('slow-site') }, VARIANTS, 0)
  same(drawn.id, 'slow-site-intro', 'what a once-held business is given')
  same(drawn.holdout ?? false, false, 'whether it is still a holdout')
})

check('a business once held out is back in the queue', () => {
  const queue = queueFor({
    candidates: [{ ...SCORED, variant_id: holdoutId('slow-site') }, { ...SOCIAL }],
    held: new Set(),
    messages: new Map(),
    sending: false,
  })
  same(queue.length, 2, 'businesses in the queue')
})

// ── Composing ────────────────────────────────────────────────────────────

check('a composed message says which variant it was written under', () => {
  // The letter is named by the draw rather than by an id written here, so
  // retiring one moves the case with the registry instead of breaking it.
  const drawn = pickVariant(SCORED, VARIANTS, Math.random()).id
  const message = compose(SCORED, null, null, variantById(drawn))
  same(message.variant, drawn, 'the id')
  same(message.subject, variantById(drawn).open(SCORED, '', null).subject, 'the subject')
})

check('a variant handed to the composer is the one it opens with', () => {
  const listing = variantById('no-site-listing')
  const message = compose(SCORED, null, null, listing)
  same(message.variant, 'no-site-listing', 'the id')
  same(message.subject, 'no website of your own', `the subject reads: ${message.subject}`)
})

check('a business nothing fits is refused rather than sent an empty message', () => {
  let refused = null
  try {
    compose(UNFITTING, null, null)
  } catch (cause) {
    refused = cause.message
  }
  ok(refused && refused.includes('unmeasured'), `the composer answered: ${refused}`)
})

// ── The database stand-in ────────────────────────────────────────────────

/**
 * A client that answers every query from a plan, and records what was asked.
 *
 * The same stand-in the outreach write checks drive the jobs against, with two
 * additions: the filters a write names are kept, since the prospect's variant
 * is written under a filter that has to be there, and the storage bucket
 * answers that the capture is already on file, so no picture is fetched.
 */
function stubDb(plan) {
  const asked = []
  const writes = []
  const answerFor = answersFrom(plan)

  const from = table => {
    const state = { table, op: 'select', payload: null, where: [] }
    const chain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            const key = `${state.op}:${state.table}`
            asked.push(key)
            if (state.op !== 'select')
              writes.push({ key, payload: state.payload, where: state.where })
            const answer = answerFor(key)
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return (...args) => {
            if (state.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              state.op = prop
              state.payload = args[0] ?? null
            }
            if (['eq', 'is', 'in', 'neq'].includes(prop)) {
              state.where.push({ how: prop, column: args[0], value: args[1] })
            }
            return chain
          }
        },
      }
    )
    return chain
  }

  return { db: { from, storage: captureOnFile }, asked, writes }
}

/** The row a drafted message reads back as. */
const drafted = {
  data: { id: 'm1', subject: 'x', body_text: 'x', body_html: 'x', to_address: 'owner@example.com' },
  error: null,
}

/** A message already composed for a business, which a run delivers rather than writes. */
const DRAFTED = {
  id: 'm9',
  prospect_id: 'p2',
  subject: 'Bayside Electrical scores 31 out of 100 on mobile',
  body_text: 'text',
  body_html: '<p>html</p>',
  to_address: 'maria@example.com',
  status: 'drafted',
  created_at: '2026-08-29T17:00:00.000Z',
  sent_at: null,
}

/**
 * The reads a send run makes before it reaches its queue, answered in order.
 *
 * Three land on `outreach_messages`: the day's count, the addresses already
 * written to, and the draft the prospect holds. The middle answers with
 * nothing, since every case here is a business hearing from the studio first.
 */
const sendPlan = (candidates, extra = {}) => ({
  'select:outreach_messages': [
    { count: 0, error: null },
    { data: [], error: null },
    { data: [], error: null },
  ],
  'select:outreach_prospects': { data: candidates, error: null },
  'select:suppression': { data: [], error: null },
  'insert:outreach_messages': drafted,
  'update:outreach_prospects': { error: null },
  ...extra,
})

forgetDomains()
await checkAddress(null, 'owner@example.com', {
  now: AFTERNOON,
  resolveMx: async () => [{ exchange: 'mx.example.com', priority: 10 }],
})

/** Sending closed, so every run writes drafts and reaches no transport. */
const DRAFTING = {
  sending_enabled: false,
  daily_cap: 12,
  from_name: 'TaylorURL',
  from_address: 'studio@example.com',
}

/** Sending open, for the one case that has to deliver a draft already written. */
const SENDING = { ...DRAFTING, sending_enabled: true }

const inserted = writes => writes.filter(write => write.key === 'insert:outreach_messages')
const given = writes =>
  writes.filter(
    write => write.key === 'update:outreach_prospects' && 'variant_id' in (write.payload ?? {})
  )

// ── The send job ─────────────────────────────────────────────────────────

check('a drafted message and its business both carry the variant chosen', async () => {
  const { db, writes } = stubDb(sendPlan([{ ...SOCIAL }, { ...SCORED }]))
  const counts = { examined: 0, changed: 0 }

  const answer = await withRoll(0, () =>
    atMidAfternoon(() => sendWork({ db, settings: DRAFTING, counts }))
  )

  same(answer.drafted, 2, 'messages drafted')
  same(answer.unmatched, 0, 'businesses nothing fits')
  const drafts = inserted(writes)
  same(drafts.length, 2, 'message rows written')
  // The business with no site of its own goes first, ahead of every scored one.
  const first = pickVariant(SOCIAL, VARIANTS, 0).id
  const second = pickVariant(SCORED, VARIANTS, 0).id
  same(drafts[0].payload.variant_id, first, 'the first draft')
  same(drafts[1].payload.variant_id, second, 'the second draft')

  const held = given(writes)
  same(held.length, 2, 'businesses given a variant')
  same(held[0].payload.variant_id, first, 'the first business')
  same(held[1].payload.variant_id, second, 'the second business')
  for (const write of held) {
    ok(write.payload.variant_assigned_at, 'the moment it was given is not written')
    ok(
      write.where.some(one => one.how === 'eq' && one.column === 'id'),
      'the write does not name the business'
    )
    ok(
      write.where.some(
        one => one.how === 'is' && one.column === 'variant_id' && one.value === null
      ),
      'the write could overturn a variant already held'
    )
  }
})

check('a business already holding a variant is not rolled again', async () => {
  // A slow site that was first written to as a no-site business keeps that
  // conversation, and its row is not written to again.
  const { db, writes } = stubDb(sendPlan([{ ...SCORED, variant_id: 'no-site-intro' }]))

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: DRAFTING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.drafted, 1, 'messages drafted')
  same(inserted(writes)[0].payload.variant_id, 'no-site-intro', 'the draft')
  same(given(writes).length, 0, 'variant writes to a business already holding one')
})

check('a business nothing fits is left where it stands, and the run goes on', async () => {
  const { db, writes, asked } = stubDb(sendPlan([{ ...UNFITTING }, { ...SOCIAL }]))
  const counts = { examined: 0, changed: 0 }

  const answer = await atMidAfternoon(() => sendWork({ db, settings: DRAFTING, counts }))

  same(answer.unmatched, 1, 'businesses nothing fits')
  same(answer.drafted, 1, 'messages drafted')
  same(counts.changed, 1, 'rows counted as changed')
  same(inserted(writes).length, 1, 'message rows written')
  same(inserted(writes)[0].payload.prospect_id, 'p1', 'the business drafted for')
  ok(
    !writes.some(write => write.where.some(one => one.column === 'id' && one.value === 'p3')),
    'the business nothing fits was written to'
  )
  ok(!asked.includes('upsert:subscribers'), 'a draft put somebody on the list')
})

check('a refused variant write stops the run', async () => {
  const { db, writes } = stubDb(
    sendPlan([{ ...SOCIAL }], { 'update:outreach_prospects': refused('variant write refused') })
  )
  const counts = { examined: 0, changed: 0 }

  const why = await atMidAfternoon(() =>
    refusal(() => sendWork({ db, settings: DRAFTING, counts }))
  )

  same(why, 'variant write refused', 'the reason the run gave')
  same(inserted(writes).length, 1, 'the draft written before the refusal')
  same(counts.changed, 0, 'rows counted as changed')
})

check('a draft already written is delivered as it was, and nothing is chosen for it', async () => {
  TRANSPORT.clear()
  const { db, writes, asked } = stubDb(
    sendPlan([{ ...SCORED }], {
      'select:outreach_messages': [
        { count: 0, error: null },
        { data: [], error: null },
        { data: [DRAFTED], error: null },
      ],
      'update:outreach_messages': { error: null },
    })
  )

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.sent, 1, 'messages sent')
  same(TRANSPORT.sent.length, 1, 'messages handed to the transport')
  same(TRANSPORT.sent[0].subject, DRAFTED.subject, 'the subject that went out')
  ok(!asked.includes('insert:outreach_messages'), 'a second draft was written over the first')
  same(given(writes).length, 0, 'variant writes for a business whose draft already stood')
})

check('a variant paused in the console is not chosen', async () => {
  // Every letter for the segment is paused, since one left live would be chosen.
  const { db, writes } = stubDb(
    sendPlan([{ ...SCORED }], {
      'select:outreach_variants': {
        data: VARIANTS.filter(one => one.segment === 'slow-site').map(one => ({
          id: one.id,
          status: 'paused',
          weight: 1,
        })),
        error: null,
      },
    })
  )

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: DRAFTING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.unmatched, 1, 'businesses nothing fits')
  same(answer.drafted, 0, 'messages drafted')
  same(inserted(writes).length, 0, 'message rows written')
})

check('pausing the one letter stops the sending rather than sending under it', async () => {
  // A paused letter used to be a switch flipped for an afternoon, with the
  // businesses under it still written to so a conversation stayed one voice.
  // There is one letter now, so pausing it is the operator saying stop, and
  // honouring the stamp would be the switch doing nothing. The console refuses
  // the write that empties a segment; this is what happens if the row is there
  // anyway.
  const { db, writes } = stubDb(
    sendPlan([{ ...SCORED, variant_id: 'slow-site-intro' }], {
      'select:outreach_variants': {
        data: [{ id: 'slow-site-intro', status: 'paused', weight: 1 }],
        error: null,
      },
    })
  )

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: DRAFTING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.drafted, 0, 'messages drafted')
  same(answer.unmatched, 1, 'businesses nothing fits')
  same(inserted(writes).length, 0, 'message rows written')
})

check('a business holding a letter from a retired family is drafted under a live one', async () => {
  // What the businesses stamped with a designed letter and never written to
  // stood in: the stamp names a letter no draw can produce, and leaving it
  // there is a queue holding people for a message that is never coming.
  const { db, writes } = stubDb(sendPlan([{ ...SCORED, variant_id: 'slow-site-audit' }]))

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: DRAFTING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.drafted, 1, 'messages drafted')
  const drawn = inserted(writes)[0].payload.variant_id
  ok(drawn !== 'slow-site-audit', 'the retired letter was drafted again')
  same(familyOf(variantById(drawn)) === 'designed', false, 'the family drafted under')
})

check('a database without the variant settings sends under the code’s own defaults', async () => {
  const { db, writes } = stubDb(
    sendPlan([{ ...SCORED }], {
      'select:outreach_variants': {
        data: null,
        error: { code: '42P01', message: 'relation "outreach_variants" does not exist' },
      },
    })
  )

  const answer = await withRoll(0, () =>
    atMidAfternoon(() => sendWork({ db, settings: DRAFTING, counts: { examined: 0, changed: 0 } }))
  )

  same(answer.drafted, 1, 'messages drafted')
  same(inserted(writes)[0].payload.variant_id, pickVariant(SCORED, VARIANTS, 0).id, 'the draft')
})

/** The send path run with the roll pinned, so a check can put a business where it likes. */
async function withRoll(roll, run) {
  const real = Math.random
  Math.random = () => roll
  try {
    return await run()
  } finally {
    Math.random = real
  }
}

check('a holdout brought live in the console still holds nobody back', async () => {
  // The console refuses this write now, and the sender would ignore it anyway.
  // Both matter: one is the door and the other is the lock behind it.
  const { db, writes } = stubDb(
    sendPlan([{ ...SCORED }], {
      'select:outreach_variants': {
        data: [{ id: holdoutId('slow-site'), status: 'live', weight: 9 }],
        error: null,
      },
    })
  )
  const counts = { examined: 0, changed: 0 }

  const answer = await withRoll(0.999, () =>
    atMidAfternoon(() => sendWork({ db, settings: DRAFTING, counts }))
  )

  same(answer.held ?? 0, 0, 'businesses held out')
  same(answer.drafted, 1, 'messages drafted')
  same(inserted(writes)[0].payload.variant_id, 'slow-site-intro', 'the draft')
})

check('a business already held out is written to like any other', async () => {
  const { db, writes } = stubDb(sendPlan([{ ...SCORED, variant_id: holdoutId('slow-site') }]))
  const counts = { examined: 0, changed: 0 }

  const answer = await atMidAfternoon(() => sendWork({ db, settings: DRAFTING, counts }))

  same(answer.drafted, 1, 'messages drafted')
  same(inserted(writes)[0].payload.variant_id, 'slow-site-intro', 'the draft')
})

// ── Run them ────────────────────────────────────────────────────────────

await finish()

console.log(`outreach assignment: ${cases.length} checks passed`)
