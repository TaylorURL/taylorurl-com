/**
 * The database the outreach checks drive their jobs against.
 *
 * A Supabase query is a chain of calls that does nothing until it is awaited,
 * and what a check of these jobs has to know is which queries were made, of
 * which kind, against which table and under which filters - not what a real
 * table happened to hold. So every stand-in answers from a plan written beside
 * the case and keeps what it was asked, and nothing reaches a database.
 *
 * The stand-ins do not all keep the same record. A write check keeps what each
 * write carried, a queue check keeps the order a read asked for, and those live
 * beside the check that reads them. How a plan answers, the shapes a client
 * answers in and the client that keeps every filter are the same wherever they
 * are used, so they are here. So is the way the console endpoint's answer to a
 * refused write is read, since it words that answer the same way whichever
 * action was refused.
 */
import { ok } from '../harness/checks.js'

/**
 * Answers a query from a plan.
 *
 * A plan is keyed by operation and table - `select:outreach_messages` - and an
 * entry is either one answer or a list of them. A list is served an element per
 * query, the last standing for any after it, which is how several reads of one
 * table in a single run are told apart, and how a case that cares about the
 * first read alone says only that. A query the plan does not name is answered
 * with no rows and no error.
 *
 * A stand-in that can tell which of a run's reads a query is passes that as the
 * role. An entry under `select:outreach_prospects:due` then answers that read,
 * and the plain key answers whatever the named keys leave over.
 */
export function answersFrom(plan) {
  const pending = new Map()
  return (key, role = null) => {
    const named = role === null ? null : `${key}:${role}`
    const at = named !== null && plan[named] !== undefined ? named : key
    const planned = plan[at]
    if (planned === undefined) return { data: [], error: null, count: 0 }
    if (!Array.isArray(planned)) return planned
    const call = pending.get(at) ?? 0
    pending.set(at, call + 1)
    return planned[Math.min(call, planned.length - 1)]
  }
}

/** A refusal shaped the way a Supabase client reports one. */
export const refused = what => ({ data: null, error: { message: what } })

/**
 * Ends a case unless an answer to a refusal gives its reason in a sentence of
 * its own rather than in `what`, the words the refusal carried. The body is
 * drawn on a console screen, and the driver's words belong in the log.
 */
export function answersInItsOwnWords(answer, what) {
  ok(!answer.body.error.includes(what), `the driver is not quoted: ${answer.body.error}`)
  ok(
    /^[A-Z].*[.?]$/.test(answer.body.error),
    `the reason reads as a sentence: ${answer.body.error}`
  )
}

/** A page of rows, shaped the way a Supabase read answers with one. */
export const rows = data => ({ data, error: null, count: data.length })

/**
 * A storage bucket that already holds whatever capture it is asked for, so a
 * message that shows a business its own site is composed without a picture
 * being fetched.
 */
export const captureOnFile = {
  from: () => ({
    list: async (_, { search }) => ({ data: [{ name: search }], error: null }),
    getPublicUrl: path => ({ data: { publicUrl: `https://shots.example.com/${path}` } }),
    upload: async () => ({ error: null }),
  }),
}

/**
 * A client that answers each query from a plan and keeps every query it was
 * asked, filters and all.
 *
 * Every filter is recorded rather than applied, because the filters are what
 * these checks are about: a write that reaches the right rows for the wrong
 * reason is the failure, and a stand-in that filtered its own fixtures would
 * answer correctly while the guard it is meant to prove was missing.
 *
 * A read's column list is recorded for the same reason and answered the same
 * way. The fixture is handed back whole whatever was asked for, so a column
 * the job forgot to select is a column the job still receives here, and the
 * behaviour that depends on it goes on working in the check long after it has
 * stopped working in production. The list is asserted instead.
 */
export function stubDb(plan) {
  const queries = []
  const answerFor = answersFrom(plan)

  const from = table => {
    const query = { table, op: 'select', payload: null, filters: [] }
    const chain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            query.key = `${query.op}:${query.table}`
            queries.push(query)
            const answer = answerFor(query.key)
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return (...args) => {
            if (query.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              query.op = prop
              query.payload = args[0] ?? null
            } else if (prop === 'select' && query.op === 'select') {
              query.columns = String(args[0] ?? '')
                .split(',')
                .map(column => column.trim())
            } else if (
              ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'is', 'not', 'or', 'ilike'].includes(
                prop
              )
            ) {
              query.filters.push([prop, ...args])
            }
            return chain
          }
        },
      }
    )
    return chain
  }

  return { db: { from }, queries }
}

/** Every query `stubDb` was asked, of one kind against one table. */
export const asked = (queries, key) => queries.filter(query => query.key === key)

/** Whether a query carried a filter naming this column, at this operator. */
export const filtered = (query, op, column, value) =>
  query.filters.some(
    ([kind, ...args]) =>
      kind === op && args[0] === column && (value === undefined || args[1] === value)
  )
