/**
 * Proves that a business written to is put on a chain, that each follow-up is
 * the next step's letter threaded under the first, that the chain ends where
 * it should and waits where it should, and that none of it counts against
 * the day's cap or runs before the columns it needs exist.
 *
 * Every failure here is silent in production. A follow-up drawn from the
 * first letters sends the same opener twice. A chain that does not end sends
 * a ninth letter. A follow-up counted against the cap starves the first
 * letters. A run that reads a column the database does not have yet stops
 * every send over it. So the picker is walked directly, and the send job is
 * driven through `work` against a database stand-in and a transport that
 * reaches no network, and the writes it makes are read back.
 *
 *   npm run check:outreach-follow-ups
 */

import { SEGMENTS, segmentOf } from '../../../lib/outreach/segments.js'
import { FOLLOW_UP_DAYS } from '../../../lib/outreach/sending/limits.js'
import {
  HOLDOUTS,
  VARIANTS,
  pickVariant,
  liveAhead,
  sendsAt,
  stepOf,
  familyHeld,
  familyOf,
  wouldEmptySegment,
} from '../../../lib/outreach/variants.js'
import { answersFrom, captureOnFile } from '../database-fixture.js'
import { installFixtureHeldDomains } from '../held-domains-fixture.js'
import { AFTERNOON, atMidAfternoon, TRANSPORT } from '../send-fixture.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

installFixtureHeldDomains()

// Nothing here may reach the network.
globalThis.fetch = () => {
  throw new Error('a check reached the network')
}

const { checkAddress, forgetDomains } = await import('../../../lib/outreach/prospects/address.js')
const { FOLLOW_UP_COLUMNS } = await import('../../../lib/outreach/sending/queue.js')
const { dueAfter, work: sendWork } = await import('../../../api/outreach/send.js')

const DAY_MS = 24 * 60 * 60 * 1000

// ── The rows ─────────────────────────────────────────────────────────────

const UNSUB = '11111111-1111-4111-8111-111111111111'

/** A business one letter in, owed the next since yesterday. */
const CONTACTED = {
  id: 'p2',
  name: 'Bayside Electrical',
  town: 'Baytown',
  trade: 'electrician',
  email: 'maria@example.com',
  website: 'https://baysideelectrical.example.com',
  site_kind: 'own',
  audit_score: 31,
  accessibility_score: 88,
  best_practices_score: 96,
  seo_score: 100,
  stage: 'contacted',
  unsub_token: UNSUB,
  // A letter that is still sending, since a business holding a retired one is
  // owed nothing more and every case about a chain running on would be asking
  // about a chain that has closed.
  variant_id: 'slow-site-intro',
  contacted_at: '2026-08-25T18:00:00.000Z',
  step: 1,
  next_due_at: '2026-08-28T18:00:00.000Z',
}

/** The first letter that business was sent, as the mail server filed it. */
const FIRST_MESSAGE = {
  id: 'm1',
  prospect_id: 'p2',
  subject: 'Trenton Taylor, TaylorURL',
  provider_id: '<first-1@example.com>',
  sent_at: '2026-08-25T18:00:00.000Z',
}

const SENDING = {
  sending_enabled: true,
  daily_cap: 12,
  from_name: 'TaylorURL',
  from_address: 'studio@example.com',
}
const DRAFTING = { ...SENDING, sending_enabled: false }

// ── Choosing ─────────────────────────────────────────────────────────────

/** A business in each segment, reading as that segment and holding no letter. */
const inSegment = segment => {
  const row = {
    ...CONTACTED,
    variant_id: null,
    accessibility_score: 100,
    best_practices_score: 100,
    seo_score: 100,
    ...(segment === 'no-site'
      ? { website: 'https://www.facebook.com/x', site_kind: 'social', audit_score: null }
      : {
          audit_score:
            segment === 'slow-site'
              ? 31
              : segment === 'fair-site'
                ? 67
                : segment === 'sound-site'
                  ? 96
                  : null,
        }),
  }
  if (segment === 'unmeasured') {
    row.audit_score = null
    row.seo_score = null
    row.accessibility_score = null
    row.best_practices_score = null
  }
  return row
}

check('every step draws the same letter, in every segment', () => {
  // The chain is one letter arriving again rather than a sequence of different
  // ones, so what is owed next month is what arrived this month. A step that
  // drew something else would be the reader getting a letter the first one did
  // not promise them.
  for (const segment of SEGMENTS) {
    const row = inSegment(segment)
    same(segmentOf(row), segment, `${segment} row reads as its segment`)
    const first = pickVariant(row, VARIANTS, 0)
    ok(first, `nothing at all for ${segment}`)
    same(first.id, `${segment}-intro`, `the first letter for ${segment}`)
    for (const step of [2, 3, 4, 13, 120]) {
      for (const roll of [0, 0.5, 0.99]) {
        const picked = pickVariant({ ...row, variant_id: first.id }, VARIANTS, roll, step)
        ok(picked, `nothing at step ${step} for ${segment}`)
        same(picked.id, first.id, `the letter drawn at step ${step}, roll ${roll}`)
        ok(!picked.holdout, 'a holdout was drawn at a later step')
      }
    }
  }
})

check('a chain has no step it runs out at', () => {
  // A step nothing was registered for used to be where a business stopped
  // hearing from the studio. The letter says one a month, so there is no such
  // step and the chain ends only when the reader ends it.
  for (const segment of SEGMENTS) {
    for (const step of [1, 2, 5, 40, 500]) {
      ok(
        VARIANTS.some(entry => entry.segment === segment && sendsAt(entry, step)),
        `${segment} has nothing at step ${step}`
      )
      ok(liveAhead(VARIANTS, segment, step, 'introduction'), `${segment} runs out at step ${step}`)
    }
  }
})

check('a first-letter draw lands on the letter that repeats', () => {
  const fresh = { ...CONTACTED, variant_id: null, stage: 'audited' }
  for (const roll of [0, 0.3, 0.6, 0.999]) {
    same(stepOf(pickVariant(fresh, VARIANTS, roll)), 1, `the step at ${roll}`)
    same(pickVariant(fresh, VARIANTS, roll).repeats, true, `what was drawn at ${roll} repeats`)
  }
})

check('nothing is drawn into a holdout at any step', () => {
  const holding = HOLDOUTS.map(entry =>
    entry.segment === 'slow-site' ? { ...entry, weight: 100, status: 'live' } : entry
  )
  ok(holding.length, 'the holdouts are still readable for the rows that hold one')
  for (const step of [1, 2, 9]) {
    for (const roll of [0, 0.5, 0.999]) {
      const picked = pickVariant(CONTACTED, VARIANTS, roll, step)
      ok(picked && !picked.holdout, `a business was held at step ${step} at ${roll}`)
    }
  }
})

check('the one letter takes the whole share of its segment', () => {
  for (const segment of SEGMENTS) {
    const drawn = VARIANTS.filter(
      entry =>
        entry.segment === segment &&
        stepOf(entry) === 1 &&
        entry.status === 'live' &&
        entry.weight > 0
    )
    same(drawn.map(entry => entry.id).join(), `${segment}-intro`, `the ${segment} letters drawn`)
  }
})

check('every segment opens on the one voice that still writes', () => {
  // The laid-out letters and the plain ones are both retired, so every
  // business opens on the introduction and hears it again each month. A
  // retired letter that finds its way back onto the draw is the one change
  // here nobody would notice from the outside.
  for (const segment of SEGMENTS) {
    const drawn = VARIANTS.filter(
      entry =>
        entry.segment === segment &&
        stepOf(entry) === 1 &&
        entry.status === 'live' &&
        entry.weight > 0
    )
    ok(drawn.length, `${segment} opens on nothing`)
    for (const entry of drawn) {
      same(familyOf(entry), 'introduction', `the family ${entry.id} opens ${segment} on`)
    }
  }
})

check('a chain stays in the family it opened with, whatever else is live', () => {
  for (const segment of SEGMENTS) {
    const row = { ...inSegment(segment), variant_id: `${segment}-intro` }
    same(segmentOf(row), segment, 'the row reads as its segment')
    for (const step of [2, 3, 7]) {
      for (const roll of [0, 0.5, 0.99]) {
        const picked = pickVariant(row, VARIANTS, roll, step)
        ok(picked, `nothing at step ${step} for ${segment}`)
        same(familyOf(picked), 'introduction', `the family drawn at step ${step}, roll ${roll}`)
      }
    }
  }
})

check('a business holding a letter from before families reads as the designed chain', () => {
  same(familyHeld({ variant_id: null }), 'designed', 'a business holding nothing')
  same(familyHeld({ variant_id: 'retired-long-ago' }), 'designed', 'a letter nothing knows')
  same(familyHeld({ variant_id: 'slow-site-audit' }), 'designed', 'a designed letter')
  same(familyHeld({ variant_id: 'slow-site-plain' }), 'plain', 'a plain letter')
})

check('the one letter a segment has left may not be paused', () => {
  // It stands at every step, so pausing it is not a step going quiet: it is
  // the segment going quiet, which is a queue that skips its businesses every
  // run and says nothing about why.
  for (const segment of SEGMENTS) {
    same(
      wouldEmptySegment(VARIANTS, `${segment}-intro`, { status: 'paused' }),
      true,
      `pausing the ${segment} letter`
    )
    same(
      wouldEmptySegment(VARIANTS, `${segment}-intro`, { weight: 0 }),
      true,
      `weighting the ${segment} letter to nothing`
    )
  }
})

check('the next letter is owed a set number of days on', () => {
  const at = '2026-08-25T18:00:00.000Z'
  same(
    new Date(dueAfter(at)).getTime() - new Date(at).getTime(),
    FOLLOW_UP_DAYS * DAY_MS,
    'days between letters'
  )
  same(new Date(dueAfter(at, 1)).getTime() - new Date(at).getTime(), DAY_MS, 'one day on')
})

// ── The database stand-in ────────────────────────────────────────────────

/** The two columns `followUpColumns` probes with, which is how that read is known. */
const PROBE_COLUMNS = 'step, next_due_at'

/**
 * Which of the run's reads of the businesses a query is, read off the query
 * itself.
 *
 * The probe asks for the chain's two columns and nothing else; the follow-up
 * read asks for the chain's columns beside the candidate's; the priority pass
 * carries the `or` that picks up the rows ranking ahead of every score; and the
 * scored pass is the one ordered by the score. Each is answered by what it
 * asked for rather than by how many reads came before it, so a run that reads
 * the table one more time still hands every fixture to the read it was written
 * for. A query answering to none of them is one the plan has no fixture for,
 * and it says so rather than being handed another read's rows.
 */
const prospectRead = state => {
  if (state.columns === PROBE_COLUMNS) return 'columns'
  if (state.columns === FOLLOW_UP_COLUMNS) return 'due'
  if (state.where.some(clause => clause.how === 'or')) return 'priority'
  if (state.order.some(by => by.column === 'audit_score')) return 'scored'
  throw new Error(`a read of the businesses the plan does not know: ${state.columns}`)
}

/**
 * A client that answers every query from a plan, and records what was asked.
 * The same stand-in the assignment check drives the job against, with the
 * `or` filter kept as well, since that is how the cap leaves follow-ups out.
 *
 * A read of the businesses is answered by which of the run's reads it is:
 * `select:outreach_prospects:due` is the follow-up read's own fixture, and
 * `prospectRead` above says how each read is recognised.
 */
function stubDb(plan) {
  const asked = []
  const writes = []
  const answerFor = answersFrom(plan)

  const from = table => {
    const state = { table, op: 'select', payload: null, where: [], order: [], columns: null }
    const chain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            const key = `${state.op}:${state.table}`
            const role =
              state.op === 'select' && state.table === 'outreach_prospects'
                ? prospectRead(state)
                : null
            asked.push({ key, role, where: state.where })
            if (state.op !== 'select')
              writes.push({ key, payload: state.payload, where: state.where })
            let answer = answerFor(key, role)
            // A row read back from an insert carries what was written, the
            // way the database's own answer does.
            if (state.op === 'insert' && answer?.data && state.payload) {
              const { subject, body_text, body_html, to_address } = state.payload
              answer = {
                ...answer,
                data: { ...answer.data, subject, body_text, body_html, to_address },
              }
            }
            // A row written over and read back carries what was written and
            // the id the write named, the way the database's own answer does.
            if (state.op === 'update' && answer && !('data' in answer) && state.payload) {
              const id = state.where.find(clause => clause.column === 'id')?.value ?? null
              const { subject, body_text, body_html, to_address } = state.payload
              answer = { ...answer, data: { id, subject, body_text, body_html, to_address } }
            }
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return (...args) => {
            if (state.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              state.op = prop
              state.payload = args[0] ?? null
            }
            if (prop === 'select') state.columns = args[0] ?? null
            if (prop === 'order') state.order.push({ column: args[0], options: args[1] ?? null })
            if (['eq', 'is', 'in', 'neq', 'lte', 'gte', 'not', 'or'].includes(prop)) {
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
  data: { id: 'm2', subject: 'x', body_text: 'x', body_html: 'x', to_address: 'maria@example.com' },
  error: null,
}

/**
 * The reads a run makes, each answer named for the read it belongs to. The
 * businesses are asked whether the chain's columns exist, asked twice for the
 * queue a first letter is drawn from - the rows that beat a score, then the
 * scored rows themselves - and asked who is owed a follow-up. `queue` stands on
 * the scored pass, which is where a measured business comes back.
 */
const plan = ({
  due = [],
  queue = [],
  ready = true,
  first = [FIRST_MESSAGE],
  variants = [],
  suppressed = [],
} = {}) => ({
  'select:outreach_variants': { data: variants, error: null },
  'select:outreach_prospects:columns': ready
    ? { data: [], error: null }
    : { data: null, error: { code: '42703', message: 'column "step" does not exist' } },
  'select:outreach_prospects:priority': { data: [], error: null },
  'select:outreach_prospects:scored': { data: queue, error: null },
  'select:outreach_prospects:due': { data: due, error: null },
  // Two reads land here where the queue is empty: the day's count, then the
  // first letter a follow-up threads under. A case that gives the run a
  // candidate adds the two the queue makes and overrides this.
  'select:outreach_messages': [
    { count: 0, error: null },
    { data: first, error: null },
  ],
  'select:suppression': { data: suppressed.map(email => ({ email })), error: null },
  'insert:outreach_messages': drafted,
  'update:outreach_messages': { error: null },
  'update:outreach_prospects': { error: null },
})

forgetDomains()
await checkAddress(null, 'maria@example.com', {
  now: AFTERNOON,
  resolveMx: async () => [{ exchange: 'mx.example.com', priority: 10 }],
})

const inserted = writes => writes.filter(write => write.key === 'insert:outreach_messages')
const prospectWrites = writes => writes.filter(write => write.key === 'update:outreach_prospects')

// ── The send job ─────────────────────────────────────────────────────────

check(
  'a business owed a follow-up is sent the next step, threaded under its first letter',
  async () => {
    TRANSPORT.clear()
    const { db, writes, asked } = stubDb(plan({ due: [{ ...CONTACTED }] }))
    const counts = { examined: 0, changed: 0 }

    const answer = await atMidAfternoon(() => sendWork({ db, settings: SENDING, counts }))

    same(answer.followed, 1, 'follow-ups sent')
    same(answer.closed, 0, 'chains closed')
    same(TRANSPORT.sent.length, 1, 'messages handed to the transport')
    const [mail] = TRANSPORT.sent
    same(mail.inReplyTo, FIRST_MESSAGE.provider_id, 'the message it threads under')
    same(mail.references, FIRST_MESSAGE.provider_id, 'the thread it names')

    const [draft] = inserted(writes)
    same(draft.payload.step, 2, 'the step on the message row')
    // The same letter as the first, which is what the first one promised: one
    // of these a month. The subject is its own rather than threaded, since a
    // reminder is the letter arriving again and not a reply to it.
    same(draft.payload.variant_id, CONTACTED.variant_id, 'the letter drawn')
    same(mail.subject, 'Trenton Taylor, TaylorURL', `the subject: ${mail.subject}`)

    const moved = prospectWrites(writes).find(write => 'step' in (write.payload ?? {}))
    ok(moved, 'the business was not moved on')
    same(moved.payload.step, 2, 'the step on the business')
    same(
      moved.payload.next_due_at,
      new Date(AFTERNOON + FOLLOW_UP_DAYS * DAY_MS).toISOString(),
      'when the next letter is owed'
    )
    ok(
      !prospectWrites(writes).some(write => 'variant_id' in (write.payload ?? {})),
      'a follow-up stamped the business with a letter'
    )

    const capRead = asked.find(call => call.key === 'select:outreach_messages')
    ok(
      capRead.where.some(clause => clause.how === 'or' && /step/.test(String(clause.column))),
      'the cap counted follow-ups'
    )
    const dueRead = asked.find(call => call.role === 'due')
    ok(dueRead, 'the businesses owed a follow-up were never read')
    ok(
      dueRead.where.some(
        clause => clause.how === 'eq' && clause.column === 'stage' && clause.value === 'contacted'
      ),
      'the follow-up read did not ask for contacted businesses alone'
    )
  }
)

check('a business deep into its chain is still owed the next one', async () => {
  // There is no last letter. A business that has heard the introduction twelve
  // times is owed a thirteenth, because that is what it was told would happen
  // and the only thing that stops it is the reader.
  TRANSPORT.clear()
  const { db, writes } = stubDb(plan({ due: [{ ...CONTACTED, step: 12 }] }))

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.followed, 1, 'follow-ups sent')
  same(answer.closed, 0, 'chains closed')
  same(TRANSPORT.sent.length, 1, 'messages handed to the transport')
  const moved = prospectWrites(writes).find(write => 'step' in (write.payload ?? {}))
  same(moved.payload.step, 13, 'the step on the business')
  same(
    moved.payload.next_due_at,
    new Date(AFTERNOON + FOLLOW_UP_DAYS * DAY_MS).toISOString(),
    'when the next letter is owed'
  )
})

check('a reminder is owed a month on rather than a few days', async () => {
  // The letter says one a month. A cadence that drifted tighter would make the
  // message a promise the sender does not keep, which is the one claim in it a
  // reader can check without leaving their inbox.
  same(FOLLOW_UP_DAYS, 30, 'days between letters')
})

check('pausing the one letter holds the chain rather than skipping it', async () => {
  TRANSPORT.clear()
  const paused = VARIANTS.filter(
    entry => entry.segment === 'slow-site' && entry.status === 'live'
  ).map(entry => ({ id: entry.id, status: 'paused', weight: 1 }))
  const { db } = stubDb(plan({ due: [{ ...CONTACTED }], variants: paused }))

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.followed, 0, 'follow-ups sent')
  same(answer.closed, 1, 'chains closed')
  same(TRANSPORT.sent.length, 0, 'messages handed to the transport')
})

check('an address since held off the list ends the chain without a letter', async () => {
  TRANSPORT.clear()
  const { db, writes } = stubDb({
    ...plan({ due: [{ ...CONTACTED }] }),
    'select:suppression': { data: [{ email: 'maria@example.com' }], error: null },
  })

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.followed, 0, 'follow-ups sent')
  same(answer.closed, 1, 'chains closed')
  same(TRANSPORT.sent.length, 0, 'messages handed to the transport')
  same(inserted(writes).length, 0, 'message rows written')
})

check(
  'a business not at contacted, or owed nothing, is left alone whatever the read says',
  async () => {
    TRANSPORT.clear()
    const { db, writes } = stubDb(
      plan({
        due: [
          { ...CONTACTED, stage: 'replied' },
          { ...CONTACTED, id: 'p3', next_due_at: null },
        ],
      })
    )

    const answer = await atMidAfternoon(() =>
      sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
    )

    same(answer.followed, 0, 'follow-ups sent')
    same(answer.closed, 0, 'chains closed')
    same(TRANSPORT.sent.length, 0, 'messages handed to the transport')
    same(writes.length, 0, 'writes made')
  }
)

check('with sending closed, follow-ups wait and nothing is drafted for them', async () => {
  TRANSPORT.clear()
  const { db, writes } = stubDb(plan({ due: [{ ...CONTACTED }] }))

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: DRAFTING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.followed, 0, 'follow-ups sent')
  same(inserted(writes).length, 0, 'message rows written')
})

check('without the chain’s columns, first letters go and the chain is not read', async () => {
  TRANSPORT.clear()
  const { db, asked, writes } = stubDb(plan({ due: [{ ...CONTACTED }], ready: false }))

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.followed, 0, 'follow-ups sent')
  // The probe and the queue's two passes, and no fourth read: the chain is
  // what the run leaves unread when the columns behind it are not there.
  same(
    asked.filter(call => call.key === 'select:outreach_prospects').length,
    3,
    'reads of the businesses'
  )
  ok(
    !asked.some(call => call.role === 'due'),
    'the chain was read over columns the database does not have'
  )
  const capRead = asked.find(call => call.key === 'select:outreach_messages')
  ok(
    !capRead.where.some(clause => clause.how === 'or'),
    'the cap asked for a column that is not there'
  )
  same(inserted(writes).length, 0, 'message rows written')
})

check('a first letter puts the business on the chain once the columns exist', async () => {
  TRANSPORT.clear()
  const fresh = {
    ...CONTACTED,
    id: 'p9',
    stage: 'audited',
    variant_id: null,
    contacted_at: null,
    step: 0,
    next_due_at: null,
  }
  const { db, writes } = stubDb({
    ...plan({ queue: [fresh] }),
    'insert:outreach_messages': {
      data: { ...drafted.data, id: 'm9' },
      error: null,
    },
  })

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.sent, 1, 'first letters sent')
  const [draft] = inserted(writes)
  same(draft.payload.step, 1, 'the step on the first message')
  const moved = prospectWrites(writes).find(write => write.payload?.stage === 'contacted')
  ok(moved, 'the business was not marked contacted')
  same(moved.payload.step, 1, 'the step on the business')
  same(
    moved.payload.next_due_at,
    new Date(AFTERNOON + FOLLOW_UP_DAYS * DAY_MS).toISOString(),
    'when the first follow-up is owed'
  )
})

check(
  'a business the run cannot write to is stepped past, not counted against the run',
  async () => {
    TRANSPORT.clear()
    // Five owed, the first three since taken off the list. A run that took the
    // first FOLLOW_UPS_PER_RUN off the queue and stopped would spend its slots
    // on businesses it sends nothing to and reach neither of the others; one
    // that steps past what it cannot write to reaches both.
    const gone = [1, 2, 3].map(at => ({ ...CONTACTED, id: `w${at}`, email: `w${at}@example.com` }))
    const owed = [1, 2].map(at => ({
      ...CONTACTED,
      id: `f${at}`,
      email: `f${at}@example.com`,
      audit_score: 67,
    }))
    for (const row of owed) {
      await checkAddress(null, row.email, {
        now: AFTERNOON,
        resolveMx: async () => [{ exchange: 'mx.example.com', priority: 10 }],
      })
    }
    const { db } = stubDb(
      plan({
        due: [...gone, ...owed],
        suppressed: gone.map(row => row.email),
        first: owed.map(row => ({ ...FIRST_MESSAGE, prospect_id: row.id })),
      })
    )

    const answer = await atMidAfternoon(() =>
      sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
    )

    same(answer.closed, 3, 'chains closed')
    same(answer.followed, 2, 'follow-ups sent')
    same(TRANSPORT.sent.length, 2, 'messages handed to the transport')
  }
)

check('a draft written before the letters existed is drafted again under one', async () => {
  TRANSPORT.clear()
  const fresh = {
    ...CONTACTED,
    id: 'p9',
    stage: 'audited',
    variant_id: null,
    contacted_at: null,
    step: 0,
    next_due_at: null,
  }
  const stale = {
    id: 'm8',
    prospect_id: 'p9',
    subject: 'Bayside Electrical scores 31 out of 100 on mobile',
    body_text: 'the old words',
    body_html: '<p>the old words</p>',
    to_address: 'maria@example.com',
    status: 'drafted',
    variant_id: null,
    created_at: '2026-08-28T17:00:00.000Z',
    sent_at: null,
  }
  const { db, writes } = stubDb({
    ...plan({ queue: [fresh] }),
    'select:outreach_messages': [
      { count: 0, error: null },
      { data: [], error: null },
      { data: [stale], error: null },
      { data: [], error: null },
    ],
  })

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.sent, 1, 'first letters sent')
  same(inserted(writes).length, 0, 'message rows written afresh')
  const rewritten = writes.find(
    write => write.key === 'update:outreach_messages' && 'variant_id' in (write.payload ?? {})
  )
  ok(rewritten, 'the draft was not written again')
  ok(
    rewritten.where.some(clause => clause.column === 'id' && clause.value === stale.id),
    'a different row was written'
  )
  ok(
    rewritten.where.some(clause => clause.column === 'status' && clause.value === 'drafted'),
    'the write did not ask for a row still drafted'
  )
  same(stepOf(VARIANTS.find(entry => entry.id === rewritten.payload.variant_id)), 1, 'the letter')
  same(rewritten.payload.step, 1, 'the step on the row')
  ok(rewritten.payload.body_text !== stale.body_text, 'the words were kept')
  const given = prospectWrites(writes).find(write => 'variant_id' in (write.payload ?? {}))
  ok(given, 'the business was not given its letter')
  ok(!given.payload.variant_id.endsWith('-holdout'), 'a drafted business was held out')
})

// A draft written under a live letter, in the stretch of time it goes out in,
// is the message somebody read and it leaves as they read it. Nothing is
// composed for it and nothing on the row moves.
//
// That stretch is a half of a day rather than the life of the draft, and the
// boundary is where it is for a reason a queue days deep makes plain. A draft
// carries the words the composer produced when it was written, and the letter
// is edited between one day and the next, so a draft held past its own day
// goes out saying what the studio has stopped saying. The greeting gets that
// wrong out loud and the copy gets it wrong quietly. The check under this one
// is the second of those.
check('a draft written under a letter, on the day it goes, goes as it was written', async () => {
  TRANSPORT.clear()
  const fresh = { ...CONTACTED, id: 'p9', stage: 'audited', variant_id: 'slow-site-intro' }
  const kept = {
    id: 'm8',
    prospect_id: 'p9',
    subject: 'Bayside Electrical scores 31 out of 100 on mobile',
    body_text: 'the words as reviewed',
    body_html: '<p>the words as reviewed</p>',
    to_address: 'maria@example.com',
    status: 'drafted',
    variant_id: 'slow-site-intro',
    // Midday in Texas, an hour before the run, so the draft and the delivery
    // fall in one half of one day.
    created_at: '2026-08-29T17:00:00.000Z',
    sent_at: null,
  }
  const { db, writes } = stubDb({
    ...plan({ queue: [fresh] }),
    'select:outreach_messages': [
      { count: 0, error: null },
      { data: [], error: null },
      { data: [kept], error: null },
      { data: [], error: null },
    ],
  })

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.sent, 1, 'first letters sent')
  same(inserted(writes).length, 0, 'message rows written afresh')
  ok(
    !writes.some(
      write => write.key === 'update:outreach_messages' && 'body_text' in (write.payload ?? {})
    ),
    'a reviewed draft was written over'
  )
  same(TRANSPORT.sent[0]?.text, kept.body_text, 'the words handed to the transport')
})

check('a draft held past its own day is written again before it goes', async () => {
  // The quiet half of the problem. Nothing about these words reads as wrong
  // from here: the letter is live, the family is current, and the row looks
  // like every other draft in the queue. Only the day it was written on says
  // so, and a queue that takes days to reach its own drafts holds a great many
  // of them. Under a rule that read the half of the day alone, a draft written
  // yesterday afternoon and sent this afternoon went out as it stood, so an
  // edit to the letter reached every business except the ones already waiting
  // for it.
  TRANSPORT.clear()
  const fresh = { ...CONTACTED, id: 'p9', stage: 'audited', variant_id: 'slow-site-intro' }
  const overnight = {
    id: 'm8',
    prospect_id: 'p9',
    subject: 'Bayside Electrical scores 31 out of 100 on mobile',
    body_text: 'the words as they stood a week ago',
    body_html: '<p>the words as they stood a week ago</p>',
    to_address: 'maria@example.com',
    status: 'drafted',
    variant_id: 'slow-site-intro',
    // Yesterday, at the hour the run fires at, so the half of the day reads
    // the same and the date is the whole of the difference.
    created_at: '2026-08-28T18:00:00.000Z',
    sent_at: null,
  }
  const { db, writes } = stubDb({
    ...plan({ queue: [fresh] }),
    'select:outreach_messages': [
      { count: 0, error: null },
      { data: [], error: null },
      { data: [overnight], error: null },
      { data: [], error: null },
    ],
  })

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.sent, 1, 'first letters sent')
  same(inserted(writes).length, 0, 'message rows written afresh')
  const rewritten = writes.find(
    write => write.key === 'update:outreach_messages' && 'body_text' in (write.payload ?? {})
  )
  ok(rewritten, 'a draft written yesterday went out with yesterday’s words')
  // The letter is live, so this is the same letter said again rather than a
  // fresh pick. A business does not change letters because a day turned.
  same(rewritten.payload.variant_id, overnight.variant_id, 'the letter written under')
  ok(rewritten.payload.body_text !== overnight.body_text, 'the stored words were kept')
  same(TRANSPORT.sent[0]?.text, rewritten.payload.body_text, 'the words handed to the transport')
})

check('a draft written under a retired family is written again before it goes', async () => {
  // The other half of closing a retired chain. A business part way through one
  // hears nothing more; a business with a laid-out letter still sitting in the
  // queue is written to under a letter the studio actually sends, since
  // nothing has reached it yet and the words on the row are a version behind.
  TRANSPORT.clear()
  const fresh = { ...CONTACTED, id: 'p9', stage: 'audited', variant_id: 'slow-site-audit' }
  const laid = {
    id: 'm8',
    prospect_id: 'p9',
    subject: 'Bayside Electrical scores 31 out of 100 on mobile',
    body_text: 'the laid-out words',
    body_html: '<p>the laid-out words</p>',
    to_address: 'maria@example.com',
    status: 'drafted',
    variant_id: 'slow-site-audit',
    created_at: '2026-08-28T17:00:00.000Z',
    sent_at: null,
  }
  const { db, writes } = stubDb({
    ...plan({ queue: [fresh] }),
    'select:outreach_messages': [
      { count: 0, error: null },
      { data: [], error: null },
      { data: [laid], error: null },
      { data: [], error: null },
    ],
  })

  const answer = await atMidAfternoon(() =>
    sendWork({ db, settings: SENDING, counts: { examined: 0, changed: 0 } })
  )

  same(answer.sent, 1, 'first letters sent')
  same(inserted(writes).length, 0, 'message rows written afresh')
  const rewritten = writes.find(
    write => write.key === 'update:outreach_messages' && 'variant_id' in (write.payload ?? {})
  )
  ok(rewritten, 'the draft was not written again')
  ok(rewritten.payload.variant_id !== laid.variant_id, 'the retired letter was written again')
  same(
    familyOf(VARIANTS.find(entry => entry.id === rewritten.payload.variant_id)) === 'designed',
    false,
    'the family written under'
  )
  ok(TRANSPORT.sent[0]?.text !== laid.body_text, 'the laid-out words went as they were')

  // Both rows say the same letter, or the results count one and the follow-up
  // opens in another's family.
  const given = writes.find(
    write => write.key === 'update:outreach_prospects' && 'variant_id' in (write.payload ?? {})
  )
  ok(given, 'the business kept the retired letter on its row')
  same(given.payload.variant_id, rewritten.payload.variant_id, 'the letter on the business')
  ok(
    given.where.some(one => one.column === 'variant_id' && one.value === laid.variant_id),
    'the write could overturn a letter another run had settled'
  )
})

// ── Run them ────────────────────────────────────────────────────────────

await finish()

console.log(`outreach follow-ups: ${cases.length} checks passed`)
