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
 * back while its words are words the lists still act on, because reviving one
 * would fetch the site, find the same signs and skip it again forever; it comes
 * back only where every word in it has left those lists, which is the one shape
 * that loop cannot take. A re-measure never walks a business to 'unreachable' and
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
 * A read's column list is recorded for the same reason and answered the same
 * way. The fixture is handed back whole whatever was asked for, so a column
 * the job forgot to select is a column the job still receives here, and the
 * behaviour that depends on it goes on working in the check long after it has
 * stopped working in production. The list is asserted instead.
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
            } else if (prop === 'select' && query.op === 'select') {
              query.columns = String(args[0] ?? '')
                .split(',')
                .map(column => column.trim())
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

check('a size word taken out of a list leaves its own rows a way back', () => {
  // Spelled out here rather than mapped off the lists, which is the whole
  // point of the case: the check above builds what it expects from the same
  // arrays the rules read, so a term coming out takes the assertion with it on
  // the same commit and the rows already stored under it go unnoticed.
  for (const reason of [
    'too large: manufacturing',
    'too large: manufacturer',
    'too large: manufacturers',
    'too large: industries',
    'too large: corporation',
    'too large: manufacturing in the domain',
    'too large: industries in the domain',
    'too large: corporation in the domain',
  ]) {
    ok(rowRuleWrote(reason), `rows stopped by "${reason}" have no way back to the queue`)
  }
})

check('a reason read off a site is not taken back while the lists still hold it', () => {
  // The loop this refuses: the row carries no evidence of the rule, so
  // rowRuleOf answers null, the sweep revives it, the enricher fetches the
  // site, finds the same signs and skips it again, on every run for good.
  ok(!rowRuleWrote(corporateReason(['investor relations'])), 'a mark settles it alone')
  ok(!rowRuleWrote(corporateReason(['hiring through taleo.net'])), 'a hiring system does too')
  ok(!rowRuleWrote(corporateReason(['leadership team', 'our locations'])), 'two live hints')
  // A reason naming as many signs as one prints may have been cut short, and
  // the sign that decided it is the one that did not fit.
  ok(
    !rowRuleWrote(corporateReason(['careers', 'our locations', 'headquarters'])),
    'a reason at the cap may be hiding a fourth sign'
  )
})

check('a reason the lists can no longer write is taken back once', () => {
  ok(rowRuleWrote(corporateReason(['careers', 'headquarters'])), 'both words have left the lists')
  ok(rowRuleWrote(corporateReason(['employee portal'])), 'one hint is under the bar on its own')
})

check('a sentence somebody typed is never taken back', () => {
  const typed = [
    'called them, they already have a guy',
    'not a real business',
    'too large',
    'too large: site carries',
    'too large: site carries a lot of corporate stuff',
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

check('a row stopped by a size word since taken out comes back', async () => {
  // The whole of what taking a word out of the size lists is for. The rows it
  // stopped are already at 'skipped', sourcing never resets a stage, and
  // nothing else in the pipeline reads them again, so a sweep that does not
  // recognise the sentence leaves them there for good.
  const filed = stored({
    name: 'Ellis Fabrication Industries',
    skip_reason: 'too large: industries',
  })
  const { report, queries } = await sweepOver([filed])
  same(report.taken, 1, "the row skipped as 'too large: industries' was not taken back")
  const [write] = sweptWrites(queries)
  same(write.payload.stage, 'found', 'the row was not put back at found')
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
  const caught = stored({ stage: 'audited', skip_reason: null, name: 'Baytown Aggregates' })
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

/** The dead ends, and whether a row carrying each one still names a site. */
const DEAD_ENDS = [
  ['the site did not answer', true],
  ['no address published on the site', true],
  ['no site of their own, and a number on the listing', false],
  ['no site of their own, and no number on the listing', false],
  ['no website listed', false],
]

check('every dead end is asked again on its own clock', async () => {
  // The reasons say different things, so they come back at different ages and
  // the retry names which one it is taking. The last of them is the wording
  // the no-site rows carried before the search could prove anything, and it is
  // on the list so those rows are read once more and rewritten as what they
  // are rather than left behind by their own wording.
  const { queries } = await sweepOver([])
  const writes = retryWrites(queries)
  same(writes.length, DEAD_ENDS.length, 'a kind of dead end was never offered back')
  for (const [reason] of DEAD_ENDS) {
    ok(
      writes.some(write => filtered(write, 'eq', 'skip_reason', reason)),
      `a row reading "${reason}" is never looked at again`
    )
  }
  for (const write of writes) {
    ok(filtered(write, 'is', 'email'), 'a row that already has an address would be taken back')
    ok(filtered(write, 'lt', 'updated_at'), 'nothing bounds how often a site is asked again')
  }
})

check('only the dead ends about a site the row names insist on one', async () => {
  // Reading a site again is a fetch of it, so the two reasons about a site
  // that failed are asked for with a website on the row. The reasons about
  // there being no site are asked for without, because a row carrying one has
  // no website by definition and a query demanding one would match none of
  // them and report a clock that never runs as a clock that found nothing.
  const { queries } = await sweepOver([])
  for (const [reason, fromASite] of DEAD_ENDS) {
    const write = retryWrites(queries).find(one => filtered(one, 'eq', 'skip_reason', reason))
    ok(write, `"${reason}" was never asked for`)
    same(
      filtered(write, 'not', 'website'),
      fromASite,
      `whether "${reason}" was asked for with a website on the row`
    )
  }
})

// ── Settling a listing that names no site ────────────────────────────────

/**
 * A run of the enrichment job over a batch of one, against a web that answers
 * from a plan.
 *
 * The batch is what nothing else here reaches: every other case answers the
 * second read with an empty page, so the rules and the search that runs when a
 * listing names nothing have never been read by a check. They are the half of
 * this file that decides what a row with no website becomes.
 */
async function enrichOne(prospect, answer) {
  const { db, queries } = stubDb({
    'select:outreach_prospects': [rows([]), rows([prospect])],
    'update:outreach_prospects': rows([{ id: prospect.id }]),
  })
  const real = globalThis.fetch
  globalThis.fetch = answer
  try {
    const counts = { examined: 0, changed: 0 }
    const report = await enrichWork({ db, counts })
    const write = asked(queries, 'update:outreach_prospects').find(query =>
      filtered(query, 'eq', 'id', prospect.id)
    )
    return { report, write, queries }
  } finally {
    globalThis.fetch = real
  }
}

/** A listing Google carried no website for, which is where the search starts. */
const listed = (over = {}) => ({
  id: 'n1',
  name: 'Baytown Plumbing',
  town: 'Baytown',
  trade: 'plumber',
  website: null,
  phone: '(281) 555-0134',
  business_status: 'OPERATIONAL',
  ...over,
})

/** A web where nothing a business of that name would have registered answers. */
const nothingAnswers = async () => {
  throw new Error('did not answer')
}

check('a listing with no website is searched for one before anything is said', async () => {
  // Google not being told about a site is not the same fact as there being no
  // site, and a message opening on the second when the first is true loses its
  // reader in a sentence.
  let asked = 0
  const { write } = await enrichOne(listed(), async url => {
    asked += 1
    return { ok: true, url, text: async () => '<p>Baytown Plumbing, Baytown 281-555-0134</p>' }
  })
  same(asked, 1, 'candidates tried before one proved')
  same(write.payload.stage, 'found', 'a site that was found was not put back to be read')
  same(write.payload.website, 'https://baytownplumbing.com', 'the site written onto the row')
  same(write.payload.site_kind, 'own', 'the kind written onto the row')
})

check('a site the search found is counted as found rather than as a dead end', async () => {
  // The row comes back at 'found' and is read for an address on the next run,
  // so reporting it as unreachable is the run saying the search failed on
  // exactly the occasions it worked.
  const { report } = await enrichOne(listed(), async url => ({
    ok: true,
    url,
    text: async () => '<p>Baytown Plumbing, Baytown 281-555-0134</p>',
  }))
  same(report.found, 1, 'a rescued row was not counted as found')
  same(report.unreachable, 0, 'a rescued row was counted as a dead end')
})

check('a business with no site is filed as one, with the way in the listing carries', async () => {
  // The search looked under every name this business would have registered and
  // found nothing, which is the strongest thing the table can say about a
  // lead. What the row is short of is an address, and the number Google
  // printed is the route that is left, so the reason says which it has.
  const withPhone = await enrichOne(listed(), nothingAnswers)
  same(withPhone.write.payload.stage, 'unreachable', 'the stage')
  same(withPhone.write.payload.site_kind, 'none', 'the kind')
  same(
    withPhone.write.payload.skip_reason,
    'no site of their own, and a number on the listing',
    'the reason on a listing carrying a number'
  )

  const without = await enrichOne(listed({ phone: null }), nothingAnswers)
  same(
    without.write.payload.skip_reason,
    'no site of their own, and no number on the listing',
    'the reason on a listing carrying none'
  )
})

check('a number too broken to dial is read as no number rather than as one', async () => {
  // What counts as a number is site-search.js's answer, since that is what
  // proves a domain with one. A row deciding it here would tell somebody there
  // is a way in and hand them a column with nothing dialable in it.
  const { write } = await enrichOne(listed({ phone: 'ask for Ray' }), nothingAnswers)
  same(
    write.payload.skip_reason,
    'no site of their own, and no number on the listing',
    'the reason'
  )
})

check('the search is given the number the listing carries', async () => {
  // A page carrying the listing's own ten digits is that business's page, and
  // it is the only proof that settles a one-word trade name outright. A batch
  // read without the column leaves the search proving nothing on every row it
  // could have settled cheapest.
  const asking = []
  const { write, queries } = await enrichOne(listed({ name: 'Gulf Coast Welding' }), async url => {
    asking.push(url)
    return { ok: true, url, text: async () => '<p>Call us on 281-555-0134</p>' }
  })
  const [, batch] = asked(queries, 'select:outreach_prospects')
  ok(batch.columns.includes('phone'), 'the batch is read without the number the search needs')
  same(asking[0], 'https://gulfcoastwelding.com', 'the domain asked for first')
  same(write.payload.stage, 'found', 'a page carrying the listing number proved nothing')
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
