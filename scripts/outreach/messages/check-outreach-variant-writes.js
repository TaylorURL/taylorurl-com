/**
 * Holds the variant settings to the reads the sender takes of them.
 *
 * The sender decides two things about a variant from what is stored, whether it
 * is being sent and how much of its segment it takes, and every way that can go
 * wrong is silent. A status nothing knows leaves a variant neither live nor
 * paused. A weight below nought is a share nothing can draw. A row for an id
 * the registry does not hold is a setting nobody reads. And a segment with no
 * live variant left empties its queue without a word. So the stored rows are
 * laid over the registry, and the read is driven against a database stand-in.
 *
 *   npm run check:outreach-variant-writes
 */
import { VARIANTS, WEIGHT_MAX, withSettings } from '../../../lib/outreach/variants.js'
import { variantSettings } from '../../../lib/outreach/sending/queue.js'
import { answersFrom, refused } from '../database-fixture.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'
import { OFFLINE } from '../../harness/offline.js'

// Nothing here may reach the network.
globalThis.fetch = OFFLINE

// ── The database stand-in ────────────────────────────────────────────────

/**
 * Which of the reads behind a sample a query is, read off the query itself.
 *
 * The queue is two passes over the businesses - the one carrying the rows that
 * beat a score, which is the one carrying the `or`, and the scored one, which is
 * the one ordered by the score - and where nothing in it fits, the whole file is
 * read newest first. Each is answered by what it asked for rather than by how
 * many reads came before it, so a queue that reads the table one more time still
 * hands every fixture to the read it was written for. A query answering to none
 * of them is one the plan has no fixture for, and it says so rather than being
 * handed another read's rows.
 */
const prospectRead = state => {
  if (state.where.some(clause => clause.how === 'or')) return 'priority'
  if (state.order.some(by => by.column === 'audit_score')) return 'scored'
  if (state.order.some(by => by.column === 'created_at')) return 'filed'
  if (state.where.some(clause => clause.how === 'eq' && clause.column === 'id')) return 'one'
  throw new Error('a read of the businesses the plan does not know')
}

/**
 * A client that answers every query from a plan, and records what was asked.
 *
 * The same stand-in the other outreach checks drive their routes against. The
 * storage bucket answers that nothing is on file, so a preview renders with no
 * capture and fetches none.
 *
 * A read of the businesses is answered by which of the reads behind a sample
 * it is: `select:outreach_prospects:filed` is the whole file's own fixture, and
 * `prospectRead` above says how each read is recognised.
 */
function stubDb(plan) {
  const asked = []
  const writes = []
  const answerFor = answersFrom(plan)

  const from = table => {
    const state = { table, op: 'select', payload: null, options: null, where: [], order: [] }
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
            asked.push(key)
            if (state.op !== 'select') {
              writes.push({ key, payload: state.payload, options: state.options })
            }
            const answer = answerFor(key, role)
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return (...args) => {
            if (state.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              state.op = prop
              state.payload = args[0] ?? null
              state.options = args[1] ?? null
            }
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

  const storage = {
    from: () => ({
      list: async () => ({ data: [], error: null }),
      getPublicUrl: path => ({ data: { publicUrl: `https://shots.example.com/${path}` } }),
    }),
  }

  return { db: { from, storage }, asked, writes }
}

/** The answer a database without the table gives. */
const ABSENT = {
  data: null,
  error: { code: '42P01', message: 'relation "outreach_variants" does not exist' },
}

// ── The overlay ──────────────────────────────────────────────────────────

check('what is stored is laid over the registry, and nothing else moves', () => {
  const laid = withSettings(VARIANTS, [{ id: 'slow-site-intro', status: 'paused', weight: 3 }])
  same(laid.length, VARIANTS.length, 'variants after the overlay')
  const changed = laid.find(one => one.id === 'slow-site-intro')
  same(changed.status, 'paused', 'the stored status')
  same(changed.weight, 3, 'the stored weight')
  same(changed.open, VARIANTS.find(one => one.id === 'slow-site-intro').open, 'the opener')
  for (const one of laid) {
    if (one.id === 'slow-site-intro') continue
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
    { id: 'slow-site-intro', status: 'gone', weight: 'lots' },
    { id: 'no-site-intro', weight: -1 },
    { id: 'fair-site-intro', weight: 1.5 },
    { id: 'sound-site-intro', weight: WEIGHT_MAX + 1 },
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
  const stored = [{ id: 'slow-site-intro', status: 'paused', weight: 2, updated_at: null }]
  const { db } = stubDb({ 'select:outreach_variants': { data: stored, error: null } })
  const rows = await variantSettings(db)
  same(rows, stored, 'the rows read')
})

// ── Run them ────────────────────────────────────────────────────────────

await finish()

console.log(`outreach variants: ${cases.length} checks passed`)
