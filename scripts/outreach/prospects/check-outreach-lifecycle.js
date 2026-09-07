/**
 * Holds the two ways a prospect gets a second look to the rules they are meant
 * to follow.
 *
 * Both are the same defect fixed in two places. A stage nothing reads again is
 * a stage rows fall into and stay in, so a list that only ever grows quietly
 * decides the pipeline's reach, and a number measured once quietly becomes a
 * claim about somebody's site that nobody has checked since. Taking a row back
 * and measuring it again are the answers, and both are dangerous in the same
 * direction: the first can start writing to a business somebody decided not to
 * write to, and the second can overwrite the figure a message already quoted.
 *
 * So the interesting assertions here are the refusals. A reason a person typed
 * is not taken back. A rule that reads a site rather than a row is not taken
 * back, because reviving one would fetch the site, find the same signs and skip
 * it again forever. A re-measure never walks a business to 'unreachable' and
 * never lands on a row the sender has since claimed. A business waiting on its
 * first reading is never held up by one being refreshed.
 *
 * Nothing here opens a socket. The database is a stand-in that records the
 * filters each query carried, and PageSpeed is a global fetch that answers from
 * a plan, so a run that reaches the measuring path measures nothing.
 */

import {
  HELD_REASON,
  OVERSIZED_HOST_TERMS,
  OVERSIZED_TERMS,
  STUDIO_REASON,
  UNSELLABLE,
  brandReason,
  chainDomainReason,
  closedReason,
  corporateReason,
  ownedReason,
  rowRuleWrote,
} from '../../../lib/outreach/prospects/exclusions.js'
import { installFixtureHeldDomains } from '../held-domains-fixture.js'

installFixtureHeldDomains()

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
 * A client that answers each query from a plan and keeps what it was asked.
 *
 * Every filter is recorded rather than applied, because what these checks are
 * about is the filters themselves: a write that reaches the right rows for the
 * wrong reason is the failure, and a stand-in that filtered its own fixtures
 * would answer correctly while the guard it is meant to prove was missing.
 *
 * Answers are keyed on the operation and the table, and a list of them is
 * handed out in order, which is how the several reads and writes one sweep
 * makes against a single table are told apart.
 */
function stubDb(plan) {
  const queries = []
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
            } else if (
              ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'is', 'not', 'or'].includes(prop)
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

/** Every query the stand-in was asked, of one kind against one table. */
const asked = (queries, key) => queries.filter(query => query.key === key)

/**
 * The prospect writes the sweep made, which is every one except the retry.
 *
 * Enrichment writes to `outreach_prospects` for two reasons now: the sweep
 * moves rows the rules have changed their mind about, and the retry offers
 * back sites that never answered. Both go through the same table, so a check
 * about the sweep asserting over every write to it is really asserting that
 * the retry does not exist.
 *
 * The retry is told apart by what it filters on, since only it reads at
 * 'unreachable'.
 */
const sweptWrites = queries =>
  asked(queries, 'update:outreach_prospects').filter(
    query => !filtered(query, 'eq', 'stage', 'unreachable')
  )

/** Whether a query carried a filter naming this column, at this operator. */
const filtered = (query, op, column, value) =>
  query.filters.some(
    ([kind, ...args]) =>
      kind === op && args[0] === column && (value === undefined || args[1] === value)
  )

/** A page of rows, shaped the way a Supabase read answers with one. */
const rows = data => ({ data, error: null, count: data.length })

// ── What a rule wrote, and what a person did ─────────────────────────────

check('every reason a row rule composes is one the sweep can take back', () => {
  const written = [
    HELD_REASON,
    STUDIO_REASON,
    ownedReason,
    closedReason(),
    ...UNSELLABLE.map(rule => rule.reason),
    ...OVERSIZED_TERMS.map(term => `too large: ${term}`),
    ...OVERSIZED_HOST_TERMS.map(term => `too large: ${term} in the domain`),
    brandReason('Roto-Rooter'),
    chainDomainReason('publicstorage.com', 3),
  ]
  for (const reason of written) {
    ok(rowRuleWrote(reason), `a rule wrote "${reason}" and the sweep does not recognise it`)
  }
})

check('a reason read off a site is never taken back', () => {
  // The loop this refuses: the row carries no evidence of the rule, so
  // rowRuleOf answers null, the sweep revives it, the enricher fetches the
  // site, finds the same signs and skips it again, on every run for good.
  const signs = corporateReason(['careers', 'our locations', 'headquarters'])
  ok(!rowRuleWrote(signs), 'a corporate-signs skip would be revived and re-skipped forever')
  ok(!rowRuleWrote(corporateReason(['investor relations'])), 'one sign is no different')
})

check('a sentence somebody typed is never taken back', () => {
  const typed = [
    'called them, they already have a guy',
    'not a real business',
    'too large',
    'national chain',
    'chain domain',
    '',
    null,
    undefined,
  ]
  for (const reason of typed) {
    ok(!rowRuleWrote(reason), `a hand skip reading "${reason}" would be undone by the sweep`)
  }
})

check('a hand skip cannot pass itself off as the one reason read by its shape', () => {
  // The chain domain reason is the only one not drawn from a list, so it is
  // matched on its whole format rather than on the words it opens with. A
  // person writing about a chain in the console's own field is writing a
  // sentence, not composing that reason.
  ok(rowRuleWrote(chainDomainReason('publicstorage.com', 3)), 'the chain domain format moved')
  ok(!rowRuleWrote('chain domain, three of them'), 'a sentence about a chain reads as the rule')
  ok(!rowRuleWrote('chain domain: they run a lot of these'), 'a typed reason reads as the rule')
  ok(!rowRuleWrote('national chain: they are one'), 'a brand nobody listed reads as the rule')
})

// ── The sweep, taking rows back ──────────────────────────────────────────

const { work: enrichWork } = await import('../../../api/outreach/enrich.js')

/** One stored row, at whatever stage and reason a case is about. */
const stored = (over = {}) => ({
  id: 'p1',
  name: 'Baytown Plumbing',
  trade: 'plumber',
  website: 'https://baytownplumbing.com',
  email: null,
  town: 'Baytown',
  stage: 'skipped',
  skip_reason: HELD_REASON,
  ...over,
})

/** A sweep over these stored rows, with nothing waiting at 'found'. */
async function sweepOver(data) {
  const { db, queries } = stubDb({
    'select:outreach_prospects': [rows(data), rows([])],
    'update:outreach_prospects': rows(data.map(row => ({ id: row.id }))),
  })
  const counts = { examined: 0, changed: 0 }
  const report = await enrichWork({ db, counts })
  return { report, queries, counts }
}

check('a skipped row no rule catches any more goes back to found', async () => {
  // The held list is the one a person edits, so a domain coming off it is the
  // ordinary way a rule stops applying. This row was held; nothing holds it now.
  const { report, queries } = await sweepOver([stored({ skip_reason: HELD_REASON })])
  same(report.taken, 1, 'the row was not taken back')

  const [write] = sweptWrites(queries)
  ok(write, 'nothing was written')
  same(write.payload.stage, 'found', 'the row was not put back at found')
  same(write.payload.skip_reason, null, 'the reason was left on the row')
})

check('taking a row back names the stage and the reason it was read at', async () => {
  // Between the read and the write a person can skip the same row by hand. Both
  // guards are what keeps this run from writing over that decision with what
  // the row said a moment earlier.
  const { queries } = await sweepOver([stored({ skip_reason: HELD_REASON })])
  const [write] = sweptWrites(queries)
  ok(filtered(write, 'eq', 'stage', 'skipped'), 'the write did not name the stage it read')
  ok(filtered(write, 'eq', 'skip_reason', HELD_REASON), 'the write did not name the reason it read')
})

check('a skipped row a rule still catches is left where it is', async () => {
  // Held by its own domain, which is still on the list.
  const held = stored({ website: 'https://taylorurl.com', skip_reason: STUDIO_REASON })
  const { report, queries } = await sweepOver([held])
  same(report.taken, 0, 'a row a rule still catches was taken back')
  same(sweptWrites(queries).length, 0, 'a still-held row was written to')
})

check('a business that has reopened is taken back without anybody editing a list', async () => {
  // The trading status is the one rule that stops applying on its own. The
  // sourcing job writes the map's new answer onto the row, and the sweep is
  // what turns that into a business worth writing to again.
  ok(rowRuleWrote(closedReason()), 'a shop that reopened would stay skipped for good')

  const shut = stored({ skip_reason: closedReason(), business_status: 'CLOSED_PERMANENTLY' })
  same((await sweepOver([shut])).report.taken, 0, 'a business still shut was taken back')

  const open = stored({ skip_reason: closedReason(), business_status: 'OPERATIONAL' })
  same((await sweepOver([open])).report.taken, 1, 'a business that reopened was left skipped')
})

check('a skipped row is never written to say it is skipped again', async () => {
  // Every twenty minutes, against every row the lists still hold. The write
  // would change nothing and move updated_at on all of them.
  const { queries } = await sweepOver([
    stored({ website: 'https://taylorurl.com', skip_reason: STUDIO_REASON }),
  ])
  for (const write of asked(queries, 'update:outreach_prospects')) {
    ok(write.payload.stage !== 'skipped', 'a skipped row was skipped a second time')
  }
})

check('a hand skip survives the sweep', async () => {
  const typed = stored({ skip_reason: 'called them, they already have a guy' })
  const { report, queries } = await sweepOver([typed])
  same(report.taken, 0, 'a business a person took out was put back by the sweep')
  same(sweptWrites(queries).length, 0, 'a hand skip was written to')
})

check('a row a rule now catches is still skipped on the way through', async () => {
  // The sweep reads the rules in both directions, and the direction it already
  // had has to go on working.
  const caught = stored({ stage: 'audited', skip_reason: null, name: 'Baytown Industries' })
  const { report, queries } = await sweepOver([caught])
  same(report.skipped, 1, 'a row the size rule catches was not skipped')
  const [write] = asked(queries, 'update:outreach_prospects')
  same(write.payload.stage, 'skipped', 'the row was not moved to skipped')
})

check('the sweep counts only the rows that came back', async () => {
  // Two guards ride on the write, so what was asked for and what changed are
  // different numbers, and a run reporting the first says nothing.
  const { db, queries } = stubDb({
    'select:outreach_prospects': [rows([stored()]), rows([])],
    'update:outreach_prospects': rows([]),
  })
  const report = await enrichWork({ db, counts: { examined: 0, changed: 0 } })
  same(report.taken, 0, 'a write that changed nothing was counted as a row taken back')
  same(sweptWrites(queries).length, 1, 'the write was never attempted')
})

// ── Asking a site that never answered ───────────────────────

/** The writes the retry made, which are the ones that read at 'unreachable'. */
const retryWrites = queries =>
  asked(queries, 'update:outreach_prospects').filter(query =>
    filtered(query, 'eq', 'stage', 'unreachable')
  )
const retryWrite = queries => retryWrites(queries)[0]

check('a site that never answered is offered back to the queue', async () => {
  // A site down for the minute the enricher read it says nothing about whether
  // the business publishes an address, so it is asked again rather than left
  // at 'unreachable' for good.
  const { queries } = await sweepOver([])
  const write = retryWrite(queries)
  ok(write, 'nothing was ever offered back')
  same(write.payload.stage, 'found', 'the row was not put back at found')
  same(write.payload.skip_reason, null, 'the old failure was left on the row')
})

check('each dead end is asked again on its own clock', async () => {
  // The two reasons say different things, so they come back at different ages
  // and the retry names which one it is taking.
  const { queries } = await sweepOver([])
  const writes = retryWrites(queries)
  same(writes.length, 2, 'both kinds of dead end were not offered back')
  ok(
    writes.some(write => filtered(write, 'eq', 'skip_reason', 'the site did not answer')),
    'a site that never answered is never asked again'
  )
  ok(
    writes.some(write => filtered(write, 'eq', 'skip_reason', 'no address published on the site')),
    'a site that printed no address is never read again'
  )
  for (const write of writes) {
    ok(filtered(write, 'is', 'email'), 'a row that already has an address would be taken back')
    ok(filtered(write, 'lt', 'updated_at'), 'nothing bounds how often a site is asked again')
  }
})

// ── Measuring a site again ───────────────────────────────────────────────

process.env.GOOGLE_PAGESPEED_API_KEY = 'not-a-key'
const {
  work: auditWork,
  afterFailure,
  BATCH: AUDIT_BATCH,
} = await import('../../../api/outreach/audit.js')

check('a re-measure that fails keeps the reading the row already had', () => {
  // A site slow to answer today is not a business out of reach. It was measured
  // once, the number stands, and the send queue keeps it.
  const after = afterFailure({ again: true, audit_attempts: 2 })
  same(after.stage, undefined, 'a failed re-measure walked a measured business back a stage')
  same(after.audit_attempts, 3, 'the count did not rise')
  same(after.skip_reason, undefined, 'a failed re-measure wrote a reason over the row')
})

check('a first reading that fails often enough still stops', () => {
  // The behaviour that was already there, which the re-measure must not have
  // taken with it.
  same(afterFailure({ audit_attempts: 1 }).stage, undefined, 'one refusal stopped a row')
  same(
    afterFailure({ audit_attempts: 2 }).stage,
    'unreachable',
    'a site that refuses every time is still being asked'
  )
})

/** One prospect as either queue hands it over. */
const measurable = (id, over = {}) => ({
  id,
  website: `https://${id}.example.com`,
  site_kind: null,
  audit_attempts: 0,
  ...over,
})

/** What PageSpeed answers with, so a run reaching the report opens no socket. */
const REPORT = {
  ok: true,
  status: 200,
  json: async () => ({
    lighthouseResult: { categories: { performance: { score: 0.42 } }, audits: {} },
  }),
}

/** A run of the audit job over these two queues, against a report that is a fixture. */
async function auditOver({ waiting = [], stale = [] } = {}) {
  const { db, queries } = stubDb({
    'select:outreach_prospects': [rows(waiting), rows(stale)],
    'update:outreach_prospects': rows([{ id: 'written' }]),
  })
  const real = globalThis.fetch
  globalThis.fetch = async () => REPORT
  try {
    const counts = { examined: 0, changed: 0 }
    const report = await auditWork({ db, counts })
    return { report, queries }
  } finally {
    globalThis.fetch = real
  }
}

check('a stale reading is asked for at audited, under the attempt limit, with a site', async () => {
  const { queries } = await auditOver()
  const reads = asked(queries, 'select:outreach_prospects')
  same(reads.length, 2, 'the stale queue was not read')

  const [, stale] = reads
  ok(filtered(stale, 'eq', 'stage', 'audited'), 'a row past audited would be re-measured')
  ok(filtered(stale, 'lt', 'audit_at'), 'every reading would be taken again, not the stale ones')
  ok(filtered(stale, 'lt', 'audit_attempts'), 'a dead site would take the spare capacity for good')
  ok(filtered(stale, 'not', 'website'), 'a row with no site would be measured')
})

check('a full batch of first readings leaves nothing to refresh', async () => {
  // A business with no number at all cannot be written to, and one with an old
  // number can, so the backlog takes the whole run before anything is refreshed.
  // The batch is the job's own, since a run is only full at whatever size it
  // currently reads, and a literal here would pass at the old one.
  const waiting = Array.from({ length: AUDIT_BATCH }, (_, at) => measurable(`w${at}`))
  const { queries } = await auditOver({ waiting })
  same(
    asked(queries, 'select:outreach_prospects').length,
    1,
    'a re-measure held up a first reading'
  )
})

check('a re-measure is written only while the row still stands at audited', async () => {
  // The send job reads 'audited' too, so a row being measured can be claimed
  // and drafted while its report is still running. The message quotes the old
  // number, and this is what stops the row disagreeing with it.
  const { queries } = await auditOver({ stale: [measurable('s1')] })
  const [write] = asked(queries, 'update:outreach_prospects')
  ok(write, 'the re-measure wrote nothing')
  ok(filtered(write, 'eq', 'stage', 'audited'), 'a re-measure would land on a row already sent to')
})

check('a first reading is written whatever the row has since become', async () => {
  // The guard belongs to the re-measure alone. An enriched row is in nobody
  // else's queue, and holding its first reading to a stage it has already left
  // would lose the measurement.
  const { queries } = await auditOver({ waiting: [measurable('w1')] })
  const [write] = asked(queries, 'update:outreach_prospects')
  ok(write, 'the first reading wrote nothing')
  ok(!filtered(write, 'eq', 'stage'), 'a first reading was held to a stage')
})

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
  console.error(`\n${failures.length} of ${cases.length} outreach lifecycle checks failed`)
  process.exit(1)
}

console.log(`outreach lifecycle: ${cases.length} checks passed`)
