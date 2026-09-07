/**
 * The mailing list's endpoint: who is on it, who joins it, and who leaves.
 *
 * `subscribers` and `suppression` both carry row-level security with no public
 * policy, so every read and every write in here is made with the service role
 * and the service role never leaves this function. The console holds a session
 * and nothing else.
 *
 * The session is verified against the project before anything else happens,
 * the account behind it is resolved from `profiles`, and any role other than
 * admin is refused. That is the same pair of steps the console-admin endpoint
 * takes, made here rather than passed upstream because the list has no
 * function of its own behind it.
 *
 * GET answers one of two views:
 *
 *   ?view=list     one page of the rows a filter selects, the count of every
 *                  status across the whole list, and the segments in use
 *   ?view=issues   what has been sent to the list, and what came back
 *
 * What came back is Resend's own reporting, written onto the send rows by
 * api/newsletter-events.js as its webhook arrives. This endpoint only reads
 * it: a rate here is delivered, opened and clicked against what actually left,
 * so an issue still going out reads as a share of what has gone so far.
 *
 * POST carries one action:
 *
 *   { action: 'add',    email, name, segment, consent }
 *   { action: 'remove', id }
 *   { action: 'import', rows: [{ email, name, line }], segment }
 *
 * Removal writes the address into `suppression` before it deletes the row, so
 * an import can never put back somebody who was taken off. An address already
 * in that table is refused on the way in, whichever door it arrives at.
 *
 * Every address is trimmed, lowercased, and matched against the same rule
 * before it reaches the database, and one import carries at most IMPORT_LIMIT
 * rows: a file of any size is a request of a known size.
 */
import { servedHereOr404 } from '../lib/http/guard.js'
import { countOf, readAll } from '../lib/db/rows.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { field, uuid } from '../lib/db/fields.js'

/** Rows in one page of the list, newest first. */
const PAGE_SIZE = 100
/** Issues the newsletter view reports on, newest first. */
const ISSUE_LIMIT = 12
/** Pages a request may skip past, so an out-of-range page cannot scan the table. */
const PAGE_MAX = 400
// Rows the status counts and the segment list are taken over. It is a ceiling
// on a read that pages up to it rather than a limit on one request, which
// stops at a thousand rows and says nothing about the rest. The list's own
// total is counted exactly whatever this is.
const SUMMARY_LIMIT = 10_000
/** Rows one import may carry. */
const IMPORT_LIMIT = 1000
/** Addresses per suppression lookup, so a long import stays inside a URL. */
const LOOKUP_BATCH = 200

const STATUSES = ['pending', 'subscribed', 'unsubscribed', 'bounced', 'complained']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX = 254
const ROW_COLUMNS =
  'id, email, name, status, segment, source, consent_at, confirmed_at, unsubscribed_at, bounce_count, created_at'

/** The address as it is stored: trimmed and lowercased, or null if it is not one. */
function address(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email.length <= EMAIL_MAX && EMAIL.test(email) ? email : null
}

/** The characters an address search is worth running on; the rest are dropped. */
function term(value) {
  const search = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return search.replace(/[^a-z0-9@._+-]/g, '').slice(0, 120) || null
}

/** The page a request asks for, held inside what the table can answer for. */
function pageOf(value) {
  const page = Number.parseInt(value, 10)
  if (!Number.isFinite(page) || page < 0) return 0
  return Math.min(page, PAGE_MAX)
}

/** Every filter the list takes, applied to a read of it. */
function narrow(rows, { status, segment, search }) {
  if (status) rows = rows.eq('status', status)
  if (segment) rows = rows.eq('segment', segment)
  if (search) rows = rows.ilike('email', `%${search}%`)
  return rows
}

/**
 * One page of the rows a filter selects, the whole list's counts, and the
 * segments in use.
 *
 * The page is a range with an exact count beside it rather than the first so
 * many rows, so a list longer than one page is a list the console can walk
 * rather than one that stops without saying it has.
 *
 * The summary is read over the list rather than over the filter, because the
 * count of everyone unsubscribed is the same figure whatever the table below
 * it is showing. It pages the table up to a ceiling and reports how far it
 * got; the total beside it is counted exactly, so a list past that ceiling
 * still reports a true size.
 */
async function list(db, query) {
  const filters = {
    status: STATUSES.includes(query.status) ? query.status : null,
    segment: field(query.segment, 120),
    search: term(query.search),
  }
  const page = pageOf(query.page)
  const from = page * PAGE_SIZE

  const [people, summary, total] = await Promise.all([
    narrow(
      db
        .from('subscribers')
        .select(ROW_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
      filters
    ),
    readAll(() => db.from('subscribers').select('status, segment'), { max: SUMMARY_LIMIT }),
    countOf(db.from('subscribers').select('id', { count: 'exact', head: true })),
  ])
  if (people.error) return { status: 500, body: { error: faulted(people.error, LIST_UNREAD) } }

  const counts = Object.fromEntries(STATUSES.map(name => [name, 0]))
  for (const row of summary.rows) {
    if (row.status in counts) counts[row.status] += 1
  }
  const segments = [...new Set(summary.rows.map(row => row.segment).filter(Boolean))].sort()

  return {
    status: 200,
    body: {
      generated_at: new Date().toISOString(),
      total,
      // How many rows the status counts and the segment list were taken over,
      // which is every row unless the list is past the ceiling.
      summarised: summary.rows.length,
      counts,
      segments,
      people: people.data,
      matching: people.count ?? 0,
      page,
      size: PAGE_SIZE,
    },
  }
}

/**
 * What has been sent to the list, and what came back.
 *
 * Every figure is counted over the send rows of the issue rather than over a
 * page of them, so a rate is the whole issue's. Delivery, opens, clicks,
 * bounces and complaints are Resend's readings; sent and failed are this
 * system's own, and the two are kept apart because they answer to different
 * evidence - one is what the transport accepted, the other is what happened
 * afterwards.
 */
async function issues(db) {
  const { data: sent, error } = await db
    .from('newsletter_issues')
    .select('id, slug, title, status, sent_at, published_at')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(ISSUE_LIMIT)
  if (error) throw error
  if (!sent.length)
    return { status: 200, body: { generated_at: new Date().toISOString(), issues: [] } }

  const ids = sent.map(row => row.id)
  const { rows } = await readAll(() =>
    db
      .from('newsletter_sends')
      .select(
        'issue_id, sent_at, failed_at, delivered_at, opened_at, open_count, ' +
          'clicked_at, click_count, bounced_at, complained_at'
      )
      .in('issue_id', ids)
  )

  const tally = new Map(
    ids.map(id => [
      id,
      {
        recipients: 0,
        sent: 0,
        failed: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      },
    ])
  )
  for (const row of rows) {
    const held = tally.get(row.issue_id)
    if (!held) continue
    held.recipients += 1
    if (row.sent_at) held.sent += 1
    if (row.failed_at) held.failed += 1
    if (row.delivered_at) held.delivered += 1
    if (row.opened_at) held.opened += 1
    if (row.clicked_at) held.clicked += 1
    if (row.bounced_at) held.bounced += 1
    if (row.complained_at) held.complained += 1
  }

  const share = (part, whole) => (whole ? (part / whole) * 100 : null)

  return {
    status: 200,
    body: {
      generated_at: new Date().toISOString(),
      issues: sent.map(issue => {
        const counts = tally.get(issue.id)
        return {
          ...issue,
          ...counts,
          open_rate: share(counts.opened, counts.sent),
          click_rate: share(counts.clicked, counts.sent),
          bounce_rate: share(counts.bounced, counts.sent),
        }
      }),
    },
  }
}

/**
 * A driver fault, with the driver's own words kept out of the answer.
 *
 * Postgres names tables, columns and constraints in a message, and a person
 * looking at a mailing list cannot act on any of them. Its words go to the
 * log, where they are what we need to find the cause; the console gets the
 * sentence for whichever thing did not happen.
 */
function faulted(error, said) {
  console.error('audience-admin: %s', error?.message || error)
  return said
}

/** What is said when the list itself will not come back. */
const LIST_UNREAD = 'The audience could not be read. Try again in a moment.'

/** What is said when taking somebody off the list does not go through. */
const REMOVE_FAILED = 'That person could not be removed. Try again in a moment.'

/** The addresses out of this set that are suppressed, looked up a batch at a time. */
async function suppressed(db, emails) {
  const held = new Set()
  for (let start = 0; start < emails.length; start += LOOKUP_BATCH) {
    const batch = emails.slice(start, start + LOOKUP_BATCH)
    const { data, error } = await db.from('suppression').select('email').in('email', batch)
    if (error) throw new Error(error.message)
    for (const row of data) held.add(row.email.toLowerCase())
  }
  return held
}

/** One person, added by hand, with the consent behind them affirmed. */
async function add(db, body) {
  const email = address(body.email)
  if (!email)
    return { status: 400, body: { error: 'Enter an address in the form name@example.com.' } }
  if (body.consent !== true) {
    return {
      status: 400,
      body: { error: 'Confirm this person agreed to hear from you before adding them.' },
    }
  }

  const held = await suppressed(db, [email])
  if (held.has(email)) {
    return {
      status: 409,
      body: { error: `${email} was removed from the list and cannot go back on it.` },
    }
  }

  const insert = await db.from('subscribers').insert({
    email,
    name: field(body.name, 200),
    segment: field(body.segment, 120),
    status: 'subscribed',
    source: 'console',
    consent_at: new Date().toISOString(),
  })
  if (insert.error) {
    if (insert.error.code === '23505') {
      return { status: 409, body: { error: `${email} is already on the list.` } }
    }
    const said = faulted(insert.error, 'That person could not be added. Try again in a moment.')
    return { status: 500, body: { error: said } }
  }
  return { status: 200, body: { ok: true, added: 1 } }
}

/** One person, taken off and held off. */
async function remove(db, body) {
  const id = uuid(body.id)
  if (!id) return { status: 400, body: { error: 'Pick the person to remove.' } }

  const found = await db.from('subscribers').select('email').eq('id', id).maybeSingle()
  if (found.error) return { status: 500, body: { error: faulted(found.error, REMOVE_FAILED) } }
  if (!found.data) return { status: 404, body: { error: 'That person is no longer on the list.' } }

  // Suppression is written first. A failure between the two steps leaves an
  // address held off a list it is still on, which is recoverable; the other
  // order leaves it deleted and free to be imported again, which is not.
  const suppress = await db
    .from('suppression')
    .upsert(
      { email: found.data.email, reason: 'manual', note: field(body.note, 500) },
      { onConflict: 'email', ignoreDuplicates: true }
    )
  if (suppress.error) {
    return { status: 500, body: { error: faulted(suppress.error, REMOVE_FAILED) } }
  }

  // Outreach holds the same address separately, and a removal that stops at
  // the mailing list leaves it queued there as a prospect nobody has written
  // to yet. Logged rather than returned: suppression already holds the mail.
  const prospect = await db
    .from('outreach_prospects')
    .update({ stage: 'unsubscribed', skip_reason: 'removed from the mailing list' })
    .eq('email', found.data.email)
    .neq('stage', 'unsubscribed')
  if (prospect.error) console.error('audience remove outreach stage:', prospect.error.message)

  const deleted = await db.from('subscribers').delete().eq('id', id)
  if (deleted.error) return { status: 500, body: { error: faulted(deleted.error, REMOVE_FAILED) } }
  return { status: 200, body: { ok: true, removed: found.data.email } }
}

/** A file's worth of addresses, in one request, counted as it lands. */
async function bulkImport(db, body) {
  const rows = Array.isArray(body.rows) ? body.rows : null
  if (!rows) {
    return { status: 400, body: { error: 'Send rows of email and optional name to import.' } }
  }
  if (!rows.length) {
    return {
      status: 400,
      body: { error: 'That CSV held no addresses. Give it one address per line.' },
    }
  }
  if (rows.length > IMPORT_LIMIT) {
    return {
      status: 400,
      body: {
        error: `Import up to ${IMPORT_LIMIT} rows at a time. This one carried ${rows.length}, so split the file and import the rest after.`,
      },
    }
  }

  const segment = field(body.segment, 120)
  const wanted = new Map()
  const refused = []
  for (const row of rows) {
    const email = address(row?.email)
    if (!email) {
      refused.push({
        line: Number.isFinite(row?.line) ? row.line : null,
        value: String(row?.email ?? '').slice(0, 120),
        reason: 'not an address',
      })
      continue
    }
    // The first copy of an address in the file is the one that counts; a later
    // duplicate is the same person, not a second one.
    if (!wanted.has(email)) {
      wanted.set(email, {
        email,
        name: field(row?.name, 200),
        segment,
        status: 'subscribed',
        source: 'import',
      })
    }
  }

  const held = await suppressed(db, [...wanted.keys()])
  const payload = [...wanted.values()].filter(row => !held.has(row.email))
  if (!payload.length) {
    return {
      status: 200,
      body: { ok: true, added: 0, already: 0, suppressed: wanted.size, refused },
    }
  }

  // Somebody already on the list keeps the status, name and segment they have:
  // an import adds people, it does not rewrite them.
  const inserted = await db
    .from('subscribers')
    .upsert(payload, { onConflict: 'email', ignoreDuplicates: true })
    .select('email')
  if (inserted.error) {
    const said = faulted(
      inserted.error,
      'Those addresses could not be imported. Try again in a moment.'
    )
    return { status: 500, body: { error: said } }
  }

  return {
    status: 200,
    body: {
      ok: true,
      added: inserted.data.length,
      already: payload.length - inserted.data.length,
      suppressed: wanted.size - payload.length,
      refused,
    },
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'GET or POST only' })
    return
  }

  const connected = connect()
  if (!connected) {
    response.status(500).json({
      error:
        'The audience endpoint has no database keys. Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY on the deployment.',
    })
    return
  }

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const caller = await authorizeAdmin(connected, authorization)
    if (caller.error) {
      response.status(caller.status).json({ error: caller.error })
      return
    }

    if (request.method === 'GET') {
      const query = request.query ?? {}
      const answer =
        query.view === 'issues' ? await issues(connected.db) : await list(connected.db, query)
      response.status(answer.status).json(answer.body)
      return
    }

    const body = request.body ?? {}
    const action = String(body.action ?? '')
    let answer
    if (action === 'add') answer = await add(connected.db, body)
    else if (action === 'remove') answer = await remove(connected.db, body)
    else if (action === 'import') answer = await bulkImport(connected.db, body)
    else answer = { status: 400, body: { error: 'Unknown action.' } }

    response.status(answer.status).json(answer.body)
  } catch {
    response.status(502).json({ error: 'The audience endpoint did not answer.' })
  }
}
