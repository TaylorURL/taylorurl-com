/**
 * Holds the variant settings to the writes the console may make and the reads
 * the sender and the console take of them.
 *
 * The console decides two things about a variant, whether it is being sent
 * and how much of its segment it takes, and every way that decision can go
 * wrong is silent. A status nothing knows leaves a variant neither live nor
 * paused. A weight below nought is a share nothing can draw. A row for an id
 * the registry does not hold is a setting nobody reads. And pausing the last
 * live variant in a segment empties that segment's queue without a word: the
 * businesses in it are skipped run after run and nothing says why. So the
 * action is driven directly, against a database stand-in, and read back for
 * what it refused and what it wrote.
 *
 * The preview is driven the same way, so what the console shows is proved to
 * be the composer's own answer against a real row rather than a mock, and the
 * proof is driven against a postbox that reaches no mail server, so what it
 * hands over, and where, is read back.
 *
 *   npm run check:outreach-variant-writes
 */
import {
  HOLDOUTS,
  VARIANTS,
  WEIGHT_MAX,
  holdoutId,
  withSettings,
  wouldEmptySegment,
} from '../lib/outreach/variants.js'
import { STUDIO_INBOX } from '../lib/outreach/message.js'
import { variantSettings } from '../lib/outreach/queue.js'

// Nothing here may reach the network.
globalThis.fetch = () => {
  throw new Error('a check reached the network')
}

const { preview, proof, setVariant, variantResults } = await import('../api/outreach-admin.js')

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: got ${got}, wanted ${want}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

// ── The database stand-in ────────────────────────────────────────────────

/**
 * A client that answers every query from a plan, and records what was asked.
 *
 * The same stand-in the other outreach checks drive their routes against. The
 * storage bucket answers that nothing is on file, so a preview renders with no
 * capture and fetches none.
 */
function stubDb(plan) {
  const asked = []
  const writes = []
  const pending = new Map()

  const answerFor = key => {
    const planned = plan[key]
    if (planned === undefined) return { data: [], error: null, count: 0 }
    if (!Array.isArray(planned)) return planned
    const at = pending.get(key) ?? 0
    pending.set(key, at + 1)
    return planned[Math.min(at, planned.length - 1)]
  }

  const from = table => {
    const state = { table, op: 'select', payload: null, options: null }
    const chain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            const key = `${state.op}:${state.table}`
            asked.push(key)
            if (state.op !== 'select') {
              writes.push({ key, payload: state.payload, options: state.options })
            }
            const answer = answerFor(key)
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return (...args) => {
            if (state.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              state.op = prop
              state.payload = args[0] ?? null
              state.options = args[1] ?? null
            }
            return chain
          }
        },
      }
    )
    return chain
  }

  const storage = {
    from: () => ({
      list: async () => ({ data: [], error: null }),
      getPublicUrl: path => ({ data: { publicUrl: `https://shots.example.com/${path}` } }),
    }),
  }

  return { db: { from, storage }, asked, writes }
}

/** A refusal shaped the way a Supabase client reports one. */
const refused = what => ({ data: null, error: { message: what } })

/** The answer a database without the table gives. */
const ABSENT = {
  data: null,
  error: { code: '42P01', message: 'relation "outreach_variants" does not exist' },
}

/** A registry entry with the fields the settings read, and nothing they do not. */
const entry = over => ({
  id: 'one',
  name: 'One',
  segment: 'slow-site',
  status: 'live',
  weight: 1,
  needs: Object.freeze([]),
  open: () => ({}),
  ...over,
})

/** A segment with two live variants, which is the one shape a pause is allowed in. */
const PAIR = Object.freeze([entry({ id: 'one' }), entry({ id: 'two' })])

const upserts = writes => writes.filter(write => write.key === 'upsert:outreach_variants')

// ── The overlay ──────────────────────────────────────────────────────────

check('what is stored is laid over the registry, and nothing else moves', () => {
  const laid = withSettings(VARIANTS, [{ id: 'slow-site-audit', status: 'paused', weight: 3 }])
  same(laid.length, VARIANTS.length, 'variants after the overlay')
  const changed = laid.find(one => one.id === 'slow-site-audit')
  same(changed.status, 'paused', 'the stored status')
  same(changed.weight, 3, 'the stored weight')
  same(changed.open, VARIANTS.find(one => one.id === 'slow-site-audit').open, 'the opener')
  for (const one of laid) {
    if (one.id === 'slow-site-audit') continue
    same(
      one,
      VARIANTS.find(other => other.id === one.id),
      `${one.id} after the overlay`
    )
  }
  ok(Object.isFrozen(laid) && Object.isFrozen(changed), 'the overlay can be edited')
  same(
    laid.map(one => one.id).join(','),
    VARIANTS.map(one => one.id).join(','),
    'the order after the overlay'
  )
})

check('a stored row the registry cannot use leaves the default standing', () => {
  const rows = [
    { id: 'retired-long-ago', status: 'paused', weight: 0 },
    { id: 'slow-site-audit', status: 'gone', weight: 'lots' },
    { id: 'no-site-listing', weight: -1 },
    { id: 'fair-site-audit', weight: 1.5 },
    { id: 'sound-site-audit', weight: WEIGHT_MAX + 1 },
    null,
    {},
  ]
  const laid = withSettings(VARIANTS, rows)
  same(laid.length, VARIANTS.length, 'variants after the overlay')
  for (const one of laid) {
    const shipped = VARIANTS.find(other => other.id === one.id)
    same(one.status, shipped.status, `${one.id} status`)
    same(one.weight, shipped.weight, `${one.id} weight`)
  }
  same(withSettings(VARIANTS, null).length, VARIANTS.length, 'no rows at all')
  same(withSettings(VARIANTS).length, VARIANTS.length, 'rows left out')
})

// ── The last live variant ────────────────────────────────────────────────

check('pausing or emptying the only live variant in a segment would empty it', () => {
  const only = [entry({ id: 'only' })]
  same(wouldEmptySegment(only, 'only', { status: 'paused' }), true, 'a pause')
  same(wouldEmptySegment(only, 'only', { status: 'draft' }), true, 'a draft')
  same(wouldEmptySegment(only, 'only', { weight: 0 }), true, 'a weight of nought')
  same(wouldEmptySegment(only, 'only', { weight: 5 }), false, 'a heavier weight')
  same(wouldEmptySegment(only, 'only', { status: 'live' }), false, 'live again')
})

check('one of two live variants can be paused, and the last cannot', () => {
  same(wouldEmptySegment(PAIR, 'one', { status: 'paused' }), false, 'the first of two')
  const oneLeft = [entry({ id: 'one', status: 'paused' }), entry({ id: 'two' })]
  same(wouldEmptySegment(oneLeft, 'two', { status: 'paused' }), true, 'the last of two')
  same(wouldEmptySegment(oneLeft, 'two', { weight: 0 }), true, 'the last of two, emptied')
  const weightless = [entry({ id: 'one', weight: 0 }), entry({ id: 'two' })]
  same(
    wouldEmptySegment(weightless, 'two', { status: 'paused' }),
    true,
    'live beside a weightless one'
  )
})

check('a segment with nothing live already can be changed freely', () => {
  const quiet = [entry({ id: 'one', status: 'paused' }), entry({ id: 'two', status: 'draft' })]
  same(wouldEmptySegment(quiet, 'one', { weight: 0 }), false, 'a weight on a paused variant')
  same(wouldEmptySegment(quiet, 'two', { status: 'paused' }), false, 'a draft paused')
  same(wouldEmptySegment(quiet, 'one', { status: 'live' }), false, 'brought live')
})

check('a change to another segment does not count against this one', () => {
  const two = [entry({ id: 'one' }), entry({ id: 'other', segment: 'no-site' })]
  same(wouldEmptySegment(two, 'other', { status: 'paused' }), true, 'the only no-site variant')
  same(wouldEmptySegment(two, 'nothing-of-the-kind', { status: 'paused' }), false, 'an unknown id')
})

// ── The write ────────────────────────────────────────────────────────────

check('an unknown id is refused before anything is read', async () => {
  const { db, asked, writes } = stubDb({})
  const answer = await setVariant(db, {
    action: 'variant',
    id: 'nothing-of-the-kind',
    status: 'paused',
  })
  same(answer.status, 400, 'the status')
  same(asked.length, 0, 'reads made')
  same(writes.length, 0, 'writes made')
})

for (const weight of [-1, 1.5, WEIGHT_MAX + 1, 'lots', Number.NaN]) {
  check(`a weight of ${weight} is refused`, async () => {
    const { db, writes } = stubDb({})
    const answer = await setVariant(db, { id: 'one', weight }, PAIR)
    same(answer.status, 400, 'the status')
    same(writes.length, 0, 'writes made')
  })
}

check('a status the sender does not know is refused', async () => {
  const { db, writes } = stubDb({})
  const answer = await setVariant(db, { id: 'one', status: 'gone' }, PAIR)
  same(answer.status, 400, 'the status')
  same(writes.length, 0, 'writes made')
})

check('a change carrying neither a status nor a weight is refused', async () => {
  const { db, writes } = stubDb({})
  const answer = await setVariant(db, { id: 'one', name: 'Something Else' }, PAIR)
  same(answer.status, 400, 'the status')
  same(writes.length, 0, 'writes made')
})

/** The first letters, which are the ones a segment cannot be left without. */
const FIRST = VARIANTS.filter(one => (one.step ?? 1) === 1)

/**
 * The stored rows that leave one first letter in a segment live and pause the
 * rest.
 *
 * The named one is written live rather than left to the registry, because a
 * letter the registry ships paused is not the last live letter in anything,
 * and a case about the last live letter would then be asking about a segment
 * with none.
 */
const allBut = (segment, id) =>
  FIRST.filter(one => one.segment === segment).map(one => ({
    id: one.id,
    status: one.id === id ? 'live' : 'paused',
    weight: 1,
  }))

check('a follow-up can be paused even when it is the only letter at its step', async () => {
  const lone = VARIANTS.find(one => (one.step ?? 1) > 1)
  ok(lone, 'no follow-up is registered')
  const { db, writes } = stubDb({
    'upsert:outreach_variants': {
      data: { id: lone.id, status: 'paused', weight: 1, updated_at: null },
      error: null,
    },
  })
  const answer = await setVariant(db, { id: lone.id, status: 'paused' })
  same(answer.status, 200, `pausing ${lone.id}`)
  same(upserts(writes).length, 1, 'rows written')
})

check('the last live first letter in a segment cannot be paused', async () => {
  for (const variant of FIRST) {
    const { db, asked, writes } = stubDb({
      'select:outreach_variants': { data: allBut(variant.segment, variant.id), error: null },
    })
    const answer = await setVariant(db, { id: variant.id, status: 'paused' })
    same(answer.status, 409, `pausing ${variant.id}`)
    ok(
      answer.body.error.includes(variant.segment),
      `the refusal names the segment: ${answer.body.error}`
    )
    same(writes.length, 0, 'writes made')
    ok(
      asked.includes('select:outreach_variants'),
      'the stored settings were not read before deciding'
    )
  }
})

check('the last live variant in a segment cannot be weighted to nothing', async () => {
  const { db, writes } = stubDb({
    'select:outreach_variants': { data: allBut('slow-site', 'slow-site-audit'), error: null },
  })
  const answer = await setVariant(db, { id: 'slow-site-audit', weight: 0 })
  same(answer.status, 409, 'the status')
  same(writes.length, 0, 'writes made')
})

check(
  'one of several live letters in a segment can be paused under the code’s own defaults',
  async () => {
    const { db, writes } = stubDb({
      'upsert:outreach_variants': {
        data: { id: 'slow-site-audit', status: 'paused', weight: 1, updated_at: null },
        error: null,
      },
    })
    const answer = await setVariant(db, { id: 'slow-site-audit', status: 'paused' })
    same(answer.status, 200, 'the status')
    same(upserts(writes).length, 1, 'rows written')
  }
)

check('what is already stored is read before the last live variant is counted', async () => {
  // The registry ships two live; the store has paused one; pausing the other
  // would empty the segment, and the code's defaults alone would not show it.
  const { db, writes } = stubDb({
    'select:outreach_variants': { data: [{ id: 'one', status: 'paused', weight: 1 }], error: null },
  })
  const answer = await setVariant(db, { id: 'two', status: 'paused' }, PAIR)
  same(answer.status, 409, 'the status')
  same(writes.length, 0, 'writes made')
})

check('one of two live variants can be paused, and the write carries only the status', async () => {
  const { db, writes } = stubDb({
    'upsert:outreach_variants': {
      data: { id: 'one', status: 'paused', weight: 1, updated_at: '2026-08-29T18:00:00Z' },
      error: null,
    },
  })
  const answer = await setVariant(db, { id: 'one', status: 'paused' }, PAIR)
  same(answer.status, 200, 'the status')
  same(answer.body.variant.status, 'paused', 'the variant answered with')
  same(answer.body.variant.id, 'one', 'the id answered with')
  const written = upserts(writes)
  same(written.length, 1, 'rows written')
  const { payload, options } = written[0]
  same(payload.id, 'one', 'the row written')
  same(payload.status, 'paused', 'the status written')
  ok(!('weight' in payload), 'a weight was written that was not given')
  ok(payload.updated_at, 'the moment it changed is not written')
  same(options?.onConflict, 'id', 'the key the write lands on')
})

check('a weight alone is written alone', async () => {
  const { db, writes } = stubDb({
    'upsert:outreach_variants': {
      data: { id: 'two', status: 'live', weight: 4, updated_at: '2026-08-29T18:00:00Z' },
      error: null,
    },
  })
  const answer = await setVariant(db, { id: 'two', weight: '4' }, PAIR)
  same(answer.status, 200, 'the status')
  same(answer.body.variant.weight, 4, 'the weight answered with')
  const { payload } = upserts(writes)[0]
  same(payload.weight, 4, 'the weight written, as a number')
  ok(!('status' in payload), 'a status was written that was not given')
})

check('nothing outside the status and the weight is ever written', async () => {
  const { db, writes } = stubDb({
    'upsert:outreach_variants': {
      data: { id: 'one', status: 'draft', weight: 2, updated_at: '2026-08-29T18:00:00Z' },
      error: null,
    },
  })
  await setVariant(
    db,
    { id: 'one', status: 'draft', weight: 2, name: 'Renamed', segment: 'no-site', open: 'x' },
    PAIR
  )
  const { payload } = upserts(writes)[0]
  const allowed = new Set(['id', 'status', 'weight', 'updated_at'])
  for (const column of Object.keys(payload)) {
    ok(allowed.has(column), `the write carried ${column}`)
  }
})

check('a refused write is answered rather than reported as saved', async () => {
  const { db } = stubDb({ 'upsert:outreach_variants': refused('upsert refused') })
  const answer = await setVariant(db, { id: 'one', status: 'paused' }, PAIR)
  same(answer.status, 500, 'the status')
  same(answer.body.error, 'upsert refused', 'the reason given')
})

check('a database without the table names the migration', async () => {
  const { db } = stubDb({ 'upsert:outreach_variants': ABSENT })
  const answer = await setVariant(db, { id: 'one', status: 'paused' }, PAIR)
  same(answer.status, 503, 'the status')
  ok(answer.body.error.includes('migration'), `the reason given: ${answer.body.error}`)
})

// ── The read the sender takes ────────────────────────────────────────────

check('a database without the table answers with nothing, so the defaults stand', async () => {
  const { db } = stubDb({ 'select:outreach_variants': ABSENT })
  const rows = await variantSettings(db)
  same(rows.length, 0, 'rows read')
})

check('any other refusal of the read stops the caller', async () => {
  const { db } = stubDb({ 'select:outreach_variants': refused('the read was refused') })
  let why = null
  try {
    await variantSettings(db)
  } catch (cause) {
    why = cause.message
  }
  same(why, 'the read was refused', 'the reason given')
})

check('what is stored is read back as it was stored', async () => {
  const stored = [{ id: 'slow-site-audit', status: 'paused', weight: 2, updated_at: null }]
  const { db } = stubDb({ 'select:outreach_variants': { data: stored, error: null } })
  const rows = await variantSettings(db)
  same(rows, stored, 'the rows read')
})

// ── The results ──────────────────────────────────────────────────────────

check('what went out is counted per variant, with what came back', () => {
  const sent = [
    { variant_id: 'slow-site-audit', opened_at: '2026-08-29T18:00:00Z', clicked_at: null },
    { variant_id: 'slow-site-audit', opened_at: null, clicked_at: null },
    {
      variant_id: 'slow-site-audit',
      opened_at: '2026-08-29T18:00:00Z',
      clicked_at: '2026-08-29T18:10:00Z',
    },
    { variant_id: 'no-site-listing', opened_at: null, clicked_at: null },
  ]
  const rows = variantResults(VARIANTS, sent)
  same(rows.length, VARIANTS.length, 'rows, one per variant and nothing else')
  const slow = rows.find(row => row.id === 'slow-site-audit')
  same(slow.sent, 3, 'sent under the speed reading')
  same(slow.opened, 2, 'opened')
  same(slow.clicked, 1, 'clicked')
  same(Math.round(slow.open_rate * 10) / 10, 66.7, 'the open rate')
  same(Math.round(slow.click_rate * 10) / 10, 33.3, 'the click rate')
  same(slow.name, 'Speed Reading', 'the name beside the count')
  same(slow.segment, 'slow-site', 'the segment beside the count')
  const fair = rows.find(row => row.id === 'fair-site-audit')
  same(fair.sent, 0, 'sent under a variant nothing went out under')
  same(fair.open_rate, null, 'the open rate of nothing')
  ok(!('open' in slow), 'the opener travelled with the counts')
})

check('a reply and an inquiry are counted under the letter that prompted them', () => {
  const sent = [
    {
      variant_id: 'slow-site-audit',
      opened_at: '2026-08-29T18:00:00Z',
      clicked_at: '2026-08-29T18:10:00Z',
      enquired_at: '2026-08-29T18:12:00Z',
    },
    { variant_id: 'slow-site-audit', opened_at: null, clicked_at: null, enquired_at: null },
    { variant_id: 'slow-site-holding', opened_at: null, clicked_at: null, enquired_at: null },
    { variant_id: 'slow-site-holding', opened_at: null, clicked_at: null, enquired_at: null },
    { variant_id: null, opened_at: null, clicked_at: null, enquired_at: '2026-08-29T18:12:00Z' },
  ]
  const given = [
    { variant_id: 'slow-site-audit', replied_at: '2026-08-30T15:00:00Z' },
    { variant_id: 'slow-site-audit', replied_at: null },
    { variant_id: 'slow-site-holding', replied_at: '2026-08-30T15:00:00Z' },
    { variant_id: 'slow-site-holding', replied_at: '2026-08-30T16:00:00Z' },
    { variant_id: holdoutId('slow-site'), replied_at: null },
  ]
  const rows = variantResults([...VARIANTS, ...HOLDOUTS], sent, given)
  const speed = rows.find(row => row.id === 'slow-site-audit')
  same(speed.sent, 2, 'sent under the speed reading')
  same(speed.enquired, 1, 'inquiries under it')
  same(speed.replied, 1, 'replies under it')
  same(speed.enquiry_rate, 50, 'its inquiry rate')
  same(speed.reply_rate, 50, 'its reply rate')
  const holding = rows.find(row => row.id === 'slow-site-holding')
  same(holding.replied, 2, 'replies under the question')
  same(holding.reply_rate, 100, 'its reply rate')
  same(holding.enquired, 0, 'inquiries under it')
  same(holding.enquiry_rate, 0, 'its inquiry rate')
  const held = rows.find(row => row.id === holdoutId('slow-site'))
  same(held.assigned, 1, 'businesses held out')
  same(held.replied, 0, 'replies from businesses sent nothing')
  same(held.reply_rate, null, 'the reply rate of nothing sent')
  const before = rows.find(row => row.id === null)
  same(before.enquired, 1, 'inquiries before ids were recorded')
  same(before.replied, null, 'replies before ids were recorded, which nothing counted')
  same(before.reply_rate, null, 'the reply rate of what was not counted')
  const shown = rows.find(row => row.id === 'fair-site-audit')
  same(shown.condition, null, 'a letter with no condition')
  same(
    rows.find(row => row.id === 'fair-site-search').condition,
    'the SEO score is under 90',
    'a letter with one'
  )
})

check('a message sent under an id the registry no longer knows keeps its count', () => {
  const rows = variantResults(VARIANTS, [
    { variant_id: 'retired-long-ago', opened_at: null, clicked_at: null },
    { variant_id: 'retired-long-ago', opened_at: '2026-08-29T18:00:00Z', clicked_at: null },
  ])
  const retired = rows.find(row => row.id === 'retired-long-ago')
  ok(retired, 'the retired id has no row')
  same(retired.sent, 2, 'sent under it')
  same(retired.name, null, 'a name for an id nothing knows')
  same(rows.length, VARIANTS.length + 1, 'rows')
})

check('messages sent before any id was recorded are one row, and only where there are any', () => {
  const none = variantResults(VARIANTS, [])
  ok(!none.some(row => row.id === null), 'a row for nothing')
  const some = variantResults(VARIANTS, [
    { variant_id: null, opened_at: '2026-08-29T18:00:00Z', clicked_at: null },
  ])
  const before = some.find(row => row.id === null)
  ok(before, 'no row for the messages before variants')
  same(before.sent, 1, 'sent before variants')
  same(before.opened, 1, 'opened before variants')
  same(some[some.length - 1], before, 'the row comes last')
})

// ── The preview ──────────────────────────────────────────────────────────

const BASE = {
  town: 'Baytown',
  trade: 'plumber',
  email: 'owner@example.com',
  unsub_token: '11111111-1111-4111-8111-111111111111',
  variant_id: null,
}
const SOCIAL = {
  ...BASE,
  id: 'p1',
  name: 'Baytown Plumbing',
  website: 'https://www.facebook.com/baytownplumbing',
  site_kind: 'social',
  audit_score: null,
  stage: 'enriched',
}
const SCORED = {
  ...BASE,
  id: 'p2',
  name: 'Bayside Electrical',
  website: 'https://baysideelectrical.example.com',
  site_kind: 'own',
  audit_score: 31,
  stage: 'audited',
}

check('a variant nothing knows cannot be previewed', async () => {
  const { db, asked } = stubDb({})
  const answer = await preview(db, { variant: 'nothing-of-the-kind' })
  same(answer.status, 400, 'the status')
  same(asked.length, 0, 'reads made')
})

check('a preview is the composer against the next business in the queue for it', async () => {
  const { db } = stubDb({ 'select:outreach_prospects': { data: [SOCIAL, SCORED], error: null } })
  const answer = await preview(db, { variant: 'slow-site-audit' })
  same(answer.status, 200, 'the status')
  same(answer.body.variant, 'slow-site-audit', 'the variant rendered')
  same(answer.body.prospect.id, 'p2', 'the business rendered for')
  same(answer.body.prospect.queued, true, 'whether it is waiting in the queue')
  same(answer.body.prospect.segment, 'slow-site', 'the segment it reads as')
  same(answer.body.subject, 'your site on a phone', 'the subject')
  ok(answer.body.html.includes('Bayside Electrical'), 'the laid-out half names the business')
  ok(
    answer.body.text.includes('https://baysideelectrical.example.com'),
    'the plain half names the page measured'
  )
  ok(answer.body.text.includes('31 out of 100'), 'the plain half carries the score')
  ok(!answer.body.html.includes('/api/outreach/open?'), 'a preview carries an open counter')
})

check(
  'a business already holding another variant is passed over for one holding none',
  async () => {
    const held = { ...SCORED, id: 'p3', variant_id: 'no-site-listing' }
    const free = { ...SCORED, id: 'p4', email: 'maria@example.com' }
    const { db } = stubDb({ 'select:outreach_prospects': { data: [held, free], error: null } })
    const answer = await preview(db, { variant: 'slow-site-audit' })
    same(answer.body.prospect.id, 'p4', 'the business rendered for')
  }
)

check('with nothing waiting, a business on file that reads as the segment is used', async () => {
  const { db, asked } = stubDb({
    'select:outreach_prospects': [
      { data: [], error: null },
      { data: [SOCIAL, SCORED], error: null },
    ],
  })
  const answer = await preview(db, { variant: 'no-site-listing' })
  same(answer.status, 200, 'the status')
  same(answer.body.prospect.id, 'p1', 'the business rendered for')
  same(answer.body.prospect.queued, false, 'whether it is waiting in the queue')
  same(asked.filter(call => call === 'select:outreach_prospects').length, 2, 'reads of the table')
})

check('a segment nobody on file is in has nothing to render against', async () => {
  const { db } = stubDb({ 'select:outreach_prospects': { data: [SOCIAL], error: null } })
  const answer = await preview(db, { variant: 'sound-site-audit' })
  same(answer.status, 404, 'the status')
})

// ── The proof ────────────────────────────────────────────────────────────

/** A delivery that keeps what it was handed and reaches no mail server. */
function postbox() {
  const sent = []
  return {
    sent,
    post: async message => {
      sent.push(message)
      return '<proof-1@example.com>'
    },
  }
}

/** The settings row as the console has it, which is where the sender's own address comes from. */
const SAVED = {
  data: {
    id: 1,
    sending_enabled: false,
    sourcing_enabled: false,
    daily_cap: 12,
    towns: [],
    trades: [],
    from_name: 'Trenton Taylor, TaylorURL',
    from_address: 'trenton@example.com',
  },
  error: null,
}

check('a proof of a variant nothing knows is refused before anything is read', async () => {
  const { db, asked, writes } = stubDb({})
  const { sent, post } = postbox()
  const answer = await proof(db, { id: 'nothing-of-the-kind' }, VARIANTS, post)
  same(answer.status, 400, 'the status')
  same(asked.length, 0, 'reads made')
  same(sent.length, 0, 'proofs sent')
  same(writes.length, 0, 'writes made')
})

check('a holdout has no proof to send', async () => {
  const { db, asked } = stubDb({})
  const { sent, post } = postbox()
  const answer = await proof(db, { id: holdoutId('slow-site') }, VARIANTS, post)
  same(answer.status, 400, 'the status')
  same(asked.length, 0, 'reads made')
  same(sent.length, 0, 'proofs sent')
})

check(
  'a proof is the composer against the business the preview would choose, sent to the studio and written nowhere',
  async () => {
    const { db, writes } = stubDb({
      'select:outreach_prospects': { data: [SOCIAL, SCORED], error: null },
      'select:outreach_settings': SAVED,
    })
    const { sent, post } = postbox()
    const answer = await proof(db, { id: 'slow-site-audit' }, VARIANTS, post)
    same(answer.status, 200, 'the status')
    same(answer.body.ok, true, 'whether it says it went')
    same(answer.body.variant, 'slow-site-audit', 'the variant sent')
    same(answer.body.to, STUDIO_INBOX, 'where it says it went')
    same(answer.body.prospect.id, 'p2', 'the business it was written for')
    same(answer.body.prospect.queued, true, 'whether that business is waiting in the queue')
    same(sent.length, 1, 'proofs sent')
    const [handed] = sent
    same(handed.to, STUDIO_INBOX, 'the address handed to the mailer')
    same(handed.subject, '[Proof] your site on a phone', 'the subject')
    same(handed.from.address, 'trenton@example.com', 'the address it left from')
    same(handed.from.name, 'Trenton Taylor, TaylorURL', 'the name it left under')
    ok(handed.html.includes('Bayside Electrical'), 'the laid-out half names the business')
    ok(handed.text.includes('31 out of 100'), 'the plain half carries the score')
    ok(!handed.html.includes('/api/outreach/open?'), 'a proof carries an open counter')
    same(writes.length, 0, 'writes made')
  }
)

check('a proof goes to the studio whatever address the body names', async () => {
  const { db } = stubDb({
    'select:outreach_prospects': { data: [SOCIAL, SCORED], error: null },
    'select:outreach_settings': SAVED,
  })
  const { sent, post } = postbox()
  const answer = await proof(
    db,
    { id: 'no-site-listing', to: 'somebody@example.com' },
    VARIANTS,
    post
  )
  same(answer.status, 200, 'the status')
  same(sent[0].to, STUDIO_INBOX, 'the address handed to the mailer')
  same(answer.body.prospect.id, 'p1', 'the business it was written for')
})

check('a proof the mail server refuses is answered rather than reported as sent', async () => {
  const { db, writes } = stubDb({
    'select:outreach_prospects': { data: [SOCIAL, SCORED], error: null },
    'select:outreach_settings': SAVED,
  })
  const answer = await proof(db, { id: 'slow-site-audit' }, VARIANTS, async () => {
    throw new Error('the mail server is unwell')
  })
  same(answer.status, 502, 'the status')
  ok(
    answer.body.error.includes('the mail server is unwell'),
    `the refusal says why: ${answer.body.error}`
  )
  same(writes.length, 0, 'writes made')
})

check('a proof for a segment nobody on file is in has nothing to send', async () => {
  const { db } = stubDb({ 'select:outreach_prospects': { data: [SOCIAL], error: null } })
  const { sent, post } = postbox()
  const answer = await proof(db, { id: 'sound-site-audit' }, VARIANTS, post)
  same(answer.status, 404, 'the status')
  same(sent.length, 0, 'proofs sent')
})

// ── The holdout ──────────────────────────────────────────────────────────

check('a holdout cannot be set at all, and nothing is written when one is tried', async () => {
  // Nobody is held out. A weight set here would read in the console as
  // withholding letters from a slice of a segment and would do nothing at all,
  // which is worse than the switch not being there.
  const { db, writes } = stubDb({
    'upsert:outreach_variants': {
      data: { id: holdoutId('slow-site'), status: 'live', weight: 1, updated_at: null },
      error: null,
    },
  })
  for (const change of [{ weight: 1 }, { weight: 0 }, { status: 'live' }, { status: 'paused' }]) {
    const answer = await setVariant(db, { id: holdoutId('slow-site'), ...change })
    same(answer.status, 409, `the status for ${JSON.stringify(change)}`)
  }
  same(writes.length, 0, 'writes made')
})

check('a holdout weighing anything does not let the last live variant be paused', async () => {
  const { db, writes } = stubDb({
    'select:outreach_variants': {
      data: [
        { id: holdoutId('slow-site'), status: 'live', weight: 5 },
        ...allBut('slow-site', 'slow-site-audit'),
      ],
      error: null,
    },
  })
  const answer = await setVariant(db, { id: 'slow-site-audit', status: 'paused' })
  same(answer.status, 409, 'the status')
  same(writes.length, 0, 'writes made')
})

check('a holdout beside two live variants keeps a segment no more alive than one', () => {
  const beside = [...PAIR, { ...entry({ id: 'slow-site-holdout', weight: 5 }), holdout: true }]
  same(wouldEmptySegment(beside, 'one', { status: 'paused' }), false, 'the first of two')
  const oneLeft = [
    entry({ id: 'one', status: 'paused' }),
    entry({ id: 'two' }),
    { ...entry({ id: 'slow-site-holdout', weight: 5 }), holdout: true },
  ]
  same(wouldEmptySegment(oneLeft, 'two', { status: 'paused' }), true, 'the last of two')
})

check('a holdout has nothing to preview', async () => {
  const { db, asked } = stubDb({})
  const answer = await preview(db, { variant: holdoutId('slow-site') })
  same(answer.status, 400, 'the status')
  same(asked.length, 0, 'reads made')
})

check('what is stored is laid over the holdouts the way it is over the variants', () => {
  const laid = withSettings(HOLDOUTS, [{ id: holdoutId('fair-site'), weight: 3 }])
  same(laid.length, HOLDOUTS.length, 'holdouts after the overlay')
  const changed = laid.find(one => one.id === holdoutId('fair-site'))
  same(changed.weight, 3, 'the stored weight')
  same(changed.holdout, true, 'whether it is still a holdout')
  for (const one of laid) {
    if (one.id === holdoutId('fair-site')) continue
    same(one.weight, 0, `${one.id} weight`)
  }
})

check('the businesses given each id are counted beside what was sent', () => {
  const given = [
    { variant_id: 'slow-site-audit' },
    { variant_id: 'slow-site-audit' },
    { variant_id: holdoutId('slow-site') },
    { variant_id: 'retired-long-ago' },
    { variant_id: null },
  ]
  const sent = [{ variant_id: 'slow-site-audit', opened_at: null, clicked_at: null }]
  const rows = variantResults([...VARIANTS, ...HOLDOUTS], sent, given)
  const slow = rows.find(row => row.id === 'slow-site-audit')
  same(slow.assigned, 2, 'businesses given the speed reading')
  same(slow.sent, 1, 'messages sent under it')
  const held = rows.find(row => row.id === holdoutId('slow-site'))
  ok(held, 'the holdout has no row')
  same(held.holdout, true, 'whether the row says it is a holdout')
  same(held.assigned, 1, 'businesses held out')
  same(held.sent, 0, 'messages sent to the held out')
  same(held.open_rate, null, 'the open rate of nothing')
  const retired = rows.find(row => row.id === 'retired-long-ago')
  ok(retired, 'an id nothing knows but a business holds has no row')
  same(retired.assigned, 1, 'businesses holding the retired id')
  same(retired.sent, 0, 'messages sent under the retired id')
  ok(!rows.some(row => row.id === null), 'a row for nothing')
  same(rows.length, VARIANTS.length + HOLDOUTS.length + 1, 'rows')
})

check('the row for the messages before ids carries no count of businesses', () => {
  const rows = variantResults(VARIANTS, [{ variant_id: null, opened_at: null, clicked_at: null }])
  const before = rows.find(row => row.id === null)
  same(before.sent, 1, 'sent before ids')
  same(before.assigned, null, 'businesses given nothing in particular')
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
  console.error(`\n${failures.length} of ${cases.length} outreach variant write checks failed`)
  process.exit(1)
}

console.log(`outreach variant writes: ${cases.length} checks passed`)
