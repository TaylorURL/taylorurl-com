/**
 * Proves that a visitor who ran the speed check becomes exactly one prospect,
 * under every rule the leads beside it answer to, and never a second one.
 *
 * The bridge runs at the tail of a request that has already streamed somebody
 * their score, and it is written so that nothing it decides can reach them.
 * Its result is returned to no caller and rendered on no page; a refusal leaves
 * one line in a server log. So a bridge that quietly files nothing looks
 * exactly like a bridge that works - the check answers, the page draws its
 * number, the visitor goes away happy, and the warmest lead this pipeline will
 * ever see lands in `speed_checks` where nothing reads it, which is precisely
 * the state of affairs the bridge was written to end. The opposite failure is
 * quieter still. A reading replayed, or a check row bridged twice by two
 * overlapping runs, would put a second prospect on the table for a business
 * already on it, and two rows for one business is two letters to one owner.
 * Neither failure raises, both are invisible from the console, and the only
 * place either can be caught is here.
 *
 * Nothing here opens a socket or reaches a database. The client is a stand-in
 * that answers each query from a plan and keeps what it was asked, and the
 * held-domain list is the fixture the rest of the checks use, so no real
 * company is named by a case.
 *
 *   npm run check:speed-check-bridge
 */

import {
  ASKED_EMAIL_SOURCE,
  bridge,
  prospectFromCheck,
} from '../../../lib/outreach/prospects/bridge.js'
import { ASKED_SOURCE, ranksAhead } from '../../../lib/outreach/sending/rank.js'
import { installFixtureHeldDomains } from '../held-domains-fixture.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

installFixtureHeldDomains()

// ── The database stand-in ────────────────────────────────────────────────

/**
 * A client that answers each query from a plan and keeps what it was asked.
 *
 * Every filter is recorded rather than applied, because the filters are what
 * these checks are about: a write reaching the right row for the wrong reason
 * is the failure, and a stand-in that filtered its own fixtures would answer
 * correctly while the guard it is meant to prove was missing.
 *
 * Answers are keyed on the operation and the table, and a list of them is
 * handed out in order, which is how the three reads the bridge makes against
 * one table are told apart.
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

/** Every query the stand-in was asked, of one kind against one table. */
const asked = (queries, key) => queries.filter(query => query.key === key)

/** Whether a query carried a filter naming this column, at this operator. */
const filtered = (query, op, column, value) =>
  query.filters.some(
    ([kind, ...args]) =>
      kind === op && args[0] === column && (value === undefined || args[1] === value)
  )

/** A page of rows, shaped the way a Supabase read answers with one. */
const rows = data => ({ data, error: null, count: data.length })

/** A run of the bridge over a planned table, with every query it made. */
async function bridgeOver(reading, plan = {}) {
  const { db, queries } = stubDb({
    'select:outreach_prospects': [
      rows(plan.bridged ?? []),
      rows(plan.byEmail ?? []),
      rows(plan.bySite ?? []),
    ],
    'update:outreach_prospects': plan.update ?? rows([]),
    'insert:outreach_prospects': plan.insert ?? { data: { id: 'made' }, error: null },
  })
  const result = await bridge(db, reading)
  return { result, queries }
}

/** Run something with the log silenced, for the paths that report a fault. */
async function quietly(run) {
  const real = console.error
  console.error = () => {}
  try {
    return await run()
  } finally {
    console.error = real
  }
}

/** One row of `public.speed_checks`, the way api/speed-check.js closes one. */
const reading = over => ({
  id: 'sc-1',
  email: 'Owner@Example.com',
  site: 'https://example.com/',
  host: 'example.com',
  caller_hash: 'a-hash',
  suppressed: false,
  status: 'done',
  score: 38,
  accessibility_score: 71,
  best_practices_score: 82,
  seo_score: 90,
  band: 'slow',
  audit_raw: { lighthouseResult: { categories: {} } },
  shot_url: null,
  created_at: '2026-09-01T14:00:00.000Z',
  finished_at: '2026-09-01T14:00:47.000Z',
  ...over,
})

// ── What never becomes a prospect ────────────────────────────────────────

check('a check still running does not become a prospect', () => {
  // The row is opened before the work starts, so a check in flight is on the
  // table with no score on it at all. Filing it would put a business in the
  // send queue at 'audited' carrying a reading that does not exist.
  const running = reading({ status: 'running', score: null, finished_at: null })
  same(prospectFromCheck(running), null, 'a running check')
})

check('a check that failed does not become a prospect', () => {
  const failed = reading({ status: 'failed', score: null, fault: 'the site did not answer' })
  same(prospectFromCheck(failed), null, 'a failed check')
})

check('a check that came back with no reading does not become a prospect', () => {
  // 'done' and scoreless is a real shape: the run finished and PageSpeed
  // answered with nothing usable.
  for (const score of [null, undefined, '', 'x', NaN]) {
    same(prospectFromCheck(reading({ score })), null, `a check scoring ${String(score)}`)
  }
})

check('a check from somebody on the suppression list does not become a prospect', () => {
  // Asking a stranger for a reading is not a way back onto a list they left.
  // api/speed-check.js reads `public.suppression` before it opens the row, and
  // this is the flag it wrote.
  same(prospectFromCheck(reading({ suppressed: true })), null, 'a suppressed check')
})

check('a check with no address does not become a prospect', () => {
  for (const email of [null, undefined, '', '   ', 42]) {
    same(prospectFromCheck(reading({ email })), null, `a check addressed ${String(email)}`)
  }
})

check('a check that is nothing at all does not become a prospect', () => {
  same(prospectFromCheck(null), null, 'no check')
  same(prospectFromCheck(undefined), null, 'an absent check')
  same(prospectFromCheck({}), null, 'an empty check')
})

check('every refusal is named rather than answered with a bare no', async () => {
  // The reason is the only thing that reaches a person, in a log line, so a
  // bridge that files nothing has to say which rule it was.
  const named = [
    ['not_finished', reading({ status: 'running', score: null })],
    ['not_finished', reading({ status: 'failed', score: null })],
    ['no_reading', reading({ score: null })],
    ['suppressed', reading({ suppressed: true })],
    ['no_email', reading({ email: null })],
  ]
  for (const [reason, row] of named) {
    const { result, queries } = await bridgeOver(row)
    same(result.action, 'refused', `the action for ${reason}`)
    same(result.reason, reason, 'the reason')
    same(queries.length, 0, `a check refused as ${reason} still read the table`)
  }
})

check('the address rules refuse a check before anything is written', async () => {
  // The same rules that govern a scraped address govern one somebody typed.
  const refused = [
    ['malformed', reading({ email: 'not an address' })],
    ['role_box', reading({ email: 'noreply@example.com' })],
    ['held_domain', reading({ email: 'owner@heldplumbing.example' })],
  ]
  for (const [reason, row] of refused) {
    const { result, queries } = await bridgeOver(row)
    same(result.action, 'refused', `the action for ${reason}`)
    same(result.reason, reason, 'the reason')
    same(asked(queries, 'insert:outreach_prospects').length, 0, `${reason} still filed a row`)
  }
})

check('a site on the held list is refused however the check reached it', async () => {
  const held = reading({ site: 'https://heldplumbing.example/', host: 'heldplumbing.example' })
  const { result, queries } = await bridgeOver(held)
  same(result.action, 'refused', 'the action')
  same(result.reason, 'held_host', 'the reason')
  same(asked(queries, 'insert:outreach_prospects').length, 0, 'a held site was filed anyway')
})

// ── The row a finished check builds ──────────────────────────────────────

check('a bridged row is an asked-for lead carrying the reading it arrived with', () => {
  const built = prospectFromCheck(reading())
  ok(built, 'a finished check built nothing')
  same(built.source, ASKED_SOURCE, 'the source')
  same(built.source, 'speed-check', 'the source, as the column holds it')
  same(built.source_ref, 'sc-1', 'the source_ref')
  same(built.stage, 'audited', 'the stage')
  same(built.place_id, null, 'the place id')
  same(built.email_source, ASKED_EMAIL_SOURCE, 'the email source')
})

check('a bridged row carries every score across unchanged', () => {
  // The audit job reads the stage and skips a measured row, so a score that
  // did not come across would be a business measured twice, or worse, a
  // message quoting a number nobody took.
  const from = reading()
  const built = prospectFromCheck(from)
  same(built.audit_score, from.score, 'the mobile score')
  same(built.accessibility_score, from.accessibility_score, 'the accessibility score')
  same(built.best_practices_score, from.best_practices_score, 'the best practices score')
  same(built.seo_score, from.seo_score, 'the SEO score')
  same(built.audit_raw, from.audit_raw, 'the report')
  same(built.audit_at, from.finished_at, 'when the reading was taken')
})

check('a reading is stamped with when it was taken rather than with the clock', () => {
  // The audit job's staleness window counts from this, and a row stamped now
  // for a reading taken six hours ago would sit unrefreshed for six hours
  // longer than it should.
  same(prospectFromCheck(reading()).audit_at, '2026-09-01T14:00:47.000Z', 'a finished check')
  same(
    prospectFromCheck(reading({ finished_at: null })).audit_at,
    '2026-09-01T14:00:00.000Z',
    'a check with no finishing stamp falls back to when it opened'
  )
})

check('a bridged row carries the address in the form every other row stores it in', () => {
  const built = prospectFromCheck(reading({ email: '  Owner@Example.com ' }))
  same(built.email, 'owner@example.com', 'the address')
})

check('a bridged row is named from the site, because a check knows no other name', () => {
  // The check knows an address and a site and nothing else, and the name
  // column will not take a null, so the registered label is read for the one
  // piece of a name it holds.
  same(prospectFromCheck(reading()).name, 'Example', 'a label with nothing to split on')
  same(
    prospectFromCheck(reading({ site: 'https://baytown-plumbing.com/' })).name,
    'Baytown Plumbing',
    'a hyphenated label'
  )
  same(
    prospectFromCheck(reading({ site: 'https://baytown-plumbing.co.uk/' })).name,
    'Baytown Plumbing',
    'a hyphenated label under a two-part suffix'
  )
  ok(prospectFromCheck(reading()).name, 'the name column will not take an empty string')
})

check('a business nothing on the table matches is filed as a new prospect', async () => {
  const { result, queries } = await bridgeOver(reading())
  same(result.action, 'created', 'the action')
  same(result.id, 'made', 'the id of the row filed')

  const [filed] = asked(queries, 'insert:outreach_prospects')
  ok(filed, 'nothing was filed')
  same(filed.payload.source_ref, 'sc-1', 'the check the row came from')
  same(filed.payload.stage, 'audited', 'the stage it was filed at')
  same(asked(queries, 'update:outreach_prospects').length, 0, 'a new business was also updated')
})

// ── A reading that ran twice ─────────────────────────────────────────────

check('a reading bridged once does not quietly become a second business on a replay', async () => {
  // The loop this refuses: a check row bridged, then bridged again by a retry,
  // a replayed request or two overlapping runs, putting a second prospect on
  // the table for a business already on it. Two rows for one business is two
  // letters to one owner, and nothing downstream would notice.
  const { result, queries } = await bridgeOver(reading(), { bridged: [{ id: 'p-existing' }] })
  same(result.action, 'refused', 'the action')
  same(result.reason, 'already_bridged', 'the reason')
  same(result.id, 'p-existing', 'the row it was already bridged to')
  same(asked(queries, 'insert:outreach_prospects').length, 0, 'a second business was filed')
  same(asked(queries, 'update:outreach_prospects').length, 0, 'the row it found was written to')
})

check('the replay guard reads the check id and nothing else', async () => {
  const { queries } = await bridgeOver(reading(), { bridged: [{ id: 'p-existing' }] })
  const [guard] = asked(queries, 'select:outreach_prospects')
  ok(guard, 'the replay guard never ran')
  ok(filtered(guard, 'eq', 'source_ref', 'sc-1'), 'the guard did not look the check up by its id')
  same(queries.length, 1, 'the guard answered and the bridge carried on reading anyway')
})

// ── A business already on the table ──────────────────────────────────────

/** A stored prospect, the way the match read hands one back. */
const stored = (over = {}) => ({
  id: 'p-1',
  email: 'owner@example.com',
  website: 'https://example.com',
  stage: 'enriched',
  contacted_at: null,
  ...over,
})

check('a business already on the table by address is linked rather than duplicated', async () => {
  const { result, queries } = await bridgeOver(reading(), { byEmail: [stored()] })
  same(result.action, 'linked', 'the action')
  same(result.id, 'p-1', 'the row it linked to')
  same(asked(queries, 'insert:outreach_prospects').length, 0, 'a second row was filed anyway')

  const writes = asked(queries, 'update:outreach_prospects')
  same(writes.length, 1, 'the number of writes')
  ok(filtered(writes[0], 'eq', 'id', 'p-1'), 'the write did not name the row it matched')
})

check('a linked row is promoted to the head of the queue as a business that asked', async () => {
  // Setting only source_ref would leave a business already swept off the map
  // sorting as an ordinary scored row, which is the common case and the one
  // the bridge exists for.
  const { queries } = await bridgeOver(reading(), { byEmail: [stored()] })
  const [write] = asked(queries, 'update:outreach_prospects')
  same(write.payload.source, ASKED_SOURCE, 'the source')
  same(write.payload.source_ref, 'sc-1', 'the check it came from')
  same(write.payload.audit_score, 38, 'the reading')
})

check('a listing the enricher never found an address for is given the one just typed', async () => {
  // Matching on the site is what this is for: a map listing one message away
  // from being useful, missing only this.
  const bare = stored({ email: null, website: 'https://example.com/contact' })
  const { result, queries } = await bridgeOver(reading(), { bySite: [bare] })
  same(result.action, 'linked', 'the action')
  const [write] = asked(queries, 'update:outreach_prospects')
  same(write.payload.email, 'owner@example.com', 'the address')
  same(write.payload.email_source, ASKED_EMAIL_SOURCE, 'where the address came from')
})

check('an address already on the row is never written over', async () => {
  const held = stored({ email: 'shop@example.com' })
  const { queries } = await bridgeOver(reading(), { byEmail: [held] })
  const [write] = asked(queries, 'update:outreach_prospects')
  same(write.payload.email, undefined, 'the address on the row was replaced')
  same(write.payload.email_source, undefined, 'where the address came from was rewritten')
})

check(
  'a site match is settled on the host rather than on the substring that found it',
  async () => {
    // The table stores whole URLs and has no host column, so the read is a loose
    // pattern. A row that merely contains the host is a different business, and
    // linking to it would file this reading against somebody else.
    const other = stored({ id: 'p-other', email: null, website: 'https://example.org' })
    const { result, queries } = await bridgeOver(reading(), { bySite: [other] })
    same(result.action, 'created', 'a business at a different host was linked to')
    same(
      asked(queries, 'update:outreach_prospects').length,
      0,
      'a different business was written to'
    )
  }
)

// ── Who the reading speaks for ───────────────────────────────────────────

check('a stranger who ran a check on a site does not take the business behind it', async () => {
  // The loop this refuses: anybody can run a check on anybody's site, because
  // api/speed-check.js takes the site and the address as two independent fields
  // and compares them at no point. Filling the row from that match would bind a
  // stranger's mailbox to a business that never asked and put the pair at the
  // head of the send queue - a pitch about a plumber, to somebody who is not the
  // plumber, first in line. It would also be permanent: the row would leave
  // 'found', which is the only stage api/outreach/enrich.js reads, so the
  // plumber's own address would never be looked for again.
  const plumber = stored({ email: null, stage: 'found' })
  const stranger = reading({ id: 'sc-9', email: 'stranger@example.net' })
  const { result, queries } = await bridgeOver(stranger, { bySite: [plumber] })
  same(result.action, 'linked', 'the action')

  const [write] = asked(queries, 'update:outreach_prospects')
  same(write.payload.email, undefined, "a stranger's address was written onto the business")
  same(write.payload.email_source, undefined, 'where the address came from was written')
  same(write.payload.source, undefined, 'the row was stamped as a business that asked')
  same(write.payload.source_ref, undefined, "the row was stamped with a stranger's check")
  same(write.payload.stage, undefined, 'the stage was promoted')
  ok(
    !ranksAhead({ ...plumber, ...write.payload }),
    'a stranger put a business at the head of the send queue'
  )
  same(
    asked(queries, 'insert:outreach_prospects').length,
    0,
    'a stranger was filed as a lead of their own instead'
  )
})

check('a reading somebody else asked for still counts as a reading of that site', async () => {
  // The measurement is true whoever went looking for it, and the row is where
  // the pipeline keeps one. What it must not cost is the row's place in front of
  // the enricher, which is the one thing that can still find the real address.
  const plumber = stored({ email: null, stage: 'found' })
  const stranger = reading({ id: 'sc-9', email: 'stranger@example.net' })
  const { queries } = await bridgeOver(stranger, { bySite: [plumber] })

  const [write] = asked(queries, 'update:outreach_prospects')
  same(write.payload.audit_score, 38, 'the reading')
  same(write.payload.audit_at, '2026-09-01T14:00:47.000Z', 'when it was taken')

  const after = { ...plumber, ...write.payload }
  same(after.stage, 'found', 'the row stopped being one the enricher will read')
  same(after.email, null, 'the row stopped waiting for an address of its own')
})

check("an address at the site's own domain is the business, and fills the row", async () => {
  // What matching on the site is for. The owner arrives carrying the one thing
  // the enricher could not find, and their address says so by being at the
  // domain the site is registered under.
  const owners = [
    ['the domain itself', 'owner@example.com'],
    ['a mailbox under it', 'owner@mail.example.com'],
  ]
  for (const [what, email] of owners) {
    const bare = stored({
      email: null,
      stage: 'found',
      website: 'https://www.example.com/contact',
    })
    const { queries } = await bridgeOver(reading({ email }), { bySite: [bare] })
    const [write] = asked(queries, 'update:outreach_prospects')
    same(write.payload.email, email, `an address at ${what}`)
    same(write.payload.email_source, ASKED_EMAIL_SOURCE, 'where the address came from')
    same(write.payload.stage, 'audited', 'the stage')
    ok(ranksAhead({ ...bare, ...write.payload }), `${what} did not read as a business that asked`)
  }
})

check(
  'a row already carrying the address is the business, whatever domain it sits at',
  async () => {
    // The rule is about a site somebody typed, not about the address. A free
    // mailbox can never corroborate a site match, because an owner on a personal
    // mail host and a stranger on the same host are the same address at the same
    // domain. It says nothing about a row the table already reaches at that
    // address, which is where a good share of these businesses are actually read.
    const onFreeMail = stored({ email: 'plumbing@example.net' })
    const { queries } = await bridgeOver(reading({ email: 'plumbing@example.net' }), {
      byEmail: [onFreeMail],
    })
    const [write] = asked(queries, 'update:outreach_prospects')
    same(write.payload.source, ASKED_SOURCE, 'the source')
    same(write.payload.source_ref, 'sc-1', 'the check it came from')
    same(write.payload.stage, 'audited', 'the stage')
    ok(
      ranksAhead({ ...onFreeMail, ...write.payload }),
      'a business that asked was kept out of the head of the queue'
    )
  }
)

check('the address is asked about before the site, since it is the stronger match', async () => {
  const { queries } = await bridgeOver(reading(), { byEmail: [stored()] })
  const reads = asked(queries, 'select:outreach_prospects')
  same(reads.length, 2, 'the site was read even though the address answered')
  ok(filtered(reads[1], 'eq', 'email', 'owner@example.com'), 'the address read')
})

// ── A row a message has already left for ─────────────────────────────────

check('a business already written to does not have its stage walked backwards', async () => {
  // Its stage is the record of a message that actually left. Moving it back to
  // 'audited' would put it in the send queue again, and the table would stop
  // agreeing with what the business was sent.
  const contacted = stored({ stage: 'contacted', contacted_at: '2026-08-30T09:00:00.000Z' })
  const { result, queries } = await bridgeOver(reading(), { byEmail: [contacted] })
  same(result.action, 'linked', 'the action')

  const [write] = asked(queries, 'update:outreach_prospects')
  same(write.payload.stage, undefined, 'the stage of a contacted row was rewritten')
  same(write.payload.source, undefined, 'the source of a contacted row was rewritten')
  same(write.payload.source_ref, undefined, 'the source_ref of a contacted row was rewritten')
  same(write.payload.email, undefined, 'the address of a contacted row was rewritten')
  same(write.payload.audit_score, 38, 'a contacted row was not given the new reading')
})

check('only a row nothing has measured is moved forward to audited', async () => {
  // The three unmeasured stages are what a reading was the missing piece of.
  for (const stage of ['found', 'enriched', 'unreachable']) {
    const { queries } = await bridgeOver(reading(), { byEmail: [stored({ stage })] })
    const [write] = asked(queries, 'update:outreach_prospects')
    same(write.payload.stage, 'audited', `a row at ${stage} was not moved to audited`)
  }
  for (const stage of ['audited', 'queued', 'replied', 'unsubscribed', 'skipped']) {
    const { queries } = await bridgeOver(reading(), { byEmail: [stored({ stage })] })
    const [write] = asked(queries, 'update:outreach_prospects')
    same(write.payload.stage, undefined, `a row at ${stage} was moved`)
  }
})

// ── What the visitor's reading survives ──────────────────────────────────

check('a database that refuses answers with a refusal rather than an exception', async () => {
  // The bridge runs after the visitor's score has been streamed to them. A
  // throw here lands in the handler's outer catch and turns a reading that was
  // delivered into a fault line on the page.
  const dead = { data: null, error: { message: 'connection refused' } }
  const plans = [
    ['the replay guard', { bridged: dead }],
    ['the address match', { byEmail: dead }],
    ['the site match', { bySite: dead }],
    ['the write', { update: dead, byEmail: rows([stored()]) }],
    ['the filing', { insert: dead }],
  ]
  for (const [what, over] of plans) {
    const { db } = stubDb({
      'select:outreach_prospects': [
        over.bridged ?? rows([]),
        over.byEmail ?? rows([]),
        over.bySite ?? rows([]),
      ],
      'update:outreach_prospects': over.update ?? rows([]),
      'insert:outreach_prospects': over.insert ?? { data: { id: 'made' }, error: null },
    })
    const result = await quietly(() => bridge(db, reading()))
    same(result.action, 'refused', `${what} threw instead of refusing`)
    same(result.reason, 'unavailable', `the reason after ${what} refused`)
  }
})

check('a client that is not a client at all is refused rather than thrown from', async () => {
  const result = await quietly(() => bridge(null, reading()))
  same(result.action, 'refused', 'the action')
  same(result.reason, 'unavailable', 'the reason')
})

check('a refusal never says which mailbox it was about', async () => {
  // The reason travels to a log and, through the caller, into nothing a
  // visitor sees. It names the rule and never the person.
  const { result } = await bridgeOver(reading({ email: 'noreply@example.com' }))
  for (const value of Object.values(result)) {
    ok(!String(value).includes('@'), `a refusal carried an address: ${String(value)}`)
  }
})

// ── Run them ────────────────────────────────────────────────────────────

await finish()

console.log(`speed check bridge: ${cases.length} checks passed`)
