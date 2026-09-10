/**
 * Everybody who has raised a hand at this business, whichever door they came
 * through, and what is owed to each of them.
 *
 * This used to read one table and show one door's worth. The configurator
 * wrote `start_leads` and the section drew it, and the other seven doors -
 * the contact form, the tools enquiry, the speed check, the paid ads, the
 * calls, the outreach replies, the payment page - each kept their own record
 * or none, so the console could account for the smallest part of the pipeline
 * and the rest was worked out of an inbox. What that cost is not theoretical:
 * a consultant with a payment link, an owner asking for terms and four people
 * who answered an ad all sat for days while the section built to show them
 * showed nothing.
 *
 * So it reads the spine, where every door writes. `start_leads` still holds
 * what the configurator knows about its own leads and is still the record the
 * follow-up job works from; this is the person and the state of them.
 *
 * The read is still the larger half and still says nothing that could be sent.
 * There is no verb here that writes a message to a lead, because a hundred
 * addresses beside a button is a mistake waiting for a slow afternoon. What
 * the write does hold is the follow-up itself: who is carrying a lead, when it
 * is next owed something, and whether somebody has looked at it and ruled it
 * out. A list nobody can mark is a list that gets read once.
 *
 * The figures are counted rather than measured off the rows. A console
 * answering in a couple of seconds cannot carry every lead once there are
 * thousands, so the list is capped and says so, while each total is an exact
 * count that never travels through the cap.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { countOf, tableMissing } from '../lib/db/rows.js'
import { SPINE } from '../lib/leads/spine.js'

// What one answer carries. Newest first, so the cap takes the oldest leads
// rather than the ones somebody opened the section to read.
const LIST_ROWS = 500

// The columns the console draws. Named rather than starred so a column added
// to the table later is a decision to show it rather than a thing that appears.
const COLUMNS = [
  'id',
  'source',
  'source_ref',
  'email',
  'name',
  'phone',
  'business',
  'trade',
  'website',
  'town',
  'note',
  'brief',
  'campaign',
  'path',
  'step',
  'first_seen',
  'last_seen',
  'contacted_at',
  'replied_at',
  'enquired_at',
  'checkout_at',
  'bought_at',
  'unsubscribed_at',
  'dismissed_at',
  'dismissed_reason',
  'owner',
  'due_at',
].join(', ')

/** The marks a reader can put on a lead, and the column each is written in. */
const MARKS = {
  contacted: 'contacted_at',
  replied: 'replied_at',
  dismissed: 'dismissed_at',
}

/**
 * The counts the strip across the top reads.
 *
 * Each is its own head request, which costs one round trip and carries no
 * rows. They run together because they answer for the same instant, and asking
 * them in turn would make the strip six readings of six moments.
 *
 * `waiting` is the figure the section exists for: a lead nobody has answered
 * and nobody has ruled out. It is asked as two counts rather than one because
 * a lead is waiting either because nothing has been sent to it or because the
 * date somebody set on it has passed, and PostgREST cannot say that in a
 * single filter without an `or` that reads worse than the two counts do.
 */
async function totals(db) {
  const of = filter => countOf(filter(db.from(SPINE).select('id', { count: 'exact', head: true })))
  const open = query =>
    query.is('dismissed_at', null).is('bought_at', null).is('unsubscribed_at', null)

  const [all, untouched, overdue, enquired, bought, dismissed] = await Promise.all([
    of(query => query),
    of(query => open(query).is('contacted_at', null)),
    of(query => open(query).not('due_at', 'is', null).lte('due_at', new Date().toISOString())),
    of(query => query.not('enquired_at', 'is', null)),
    of(query => query.not('bought_at', 'is', null)),
    of(query => query.not('dismissed_at', 'is', null)),
  ])

  return { all, untouched, overdue, waiting: untouched + overdue, enquired, bought, dismissed }
}

/** An empty record, for a deployment reading ahead of its own migration. */
const NOTHING = {
  leads: [],
  totals: { all: 0, untouched: 0, overdue: 0, waiting: 0, enquired: 0, bought: 0, dismissed: 0 },
  complete: true,
}

/** Reads the whole section: the rows, and the figures over them. */
async function read(db, response) {
  const { data, error } = await db
    .from(SPINE)
    .select(COLUMNS)
    .order('first_seen', { ascending: false })
    .limit(LIST_ROWS)

  if (error) {
    // A section reaching a table its migration has not created yet answers as
    // an empty record rather than as a failure, so the console draws the
    // section rather than a refusal nobody can act on.
    if (tableMissing(error)) return response.status(200).json(NOTHING)
    throw error
  }

  const counted = await totals(db)

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({
    leads: data || [],
    totals: counted,
    complete: (data || []).length < LIST_ROWS,
    cap: LIST_ROWS,
  })
}

/** The posted JSON, however the platform hands the body over. */
function readBody(request) {
  const body = request.body
  if (!body) return {}
  if (typeof body !== 'string') return body
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}

/**
 * A date somebody typed, or null where they cleared it.
 *
 * `undefined` and `null` are deliberately different answers here: a body that
 * does not mention the date leaves it alone, and one that sends null clears
 * it. A single 'falsy means clear' reading would have every save that only
 * changed the owner quietly wipe the date beside it.
 */
function dateFrom(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const when = new Date(value)
  return Number.isNaN(when.getTime()) ? undefined : when.toISOString()
}

/**
 * Marks a lead: who is carrying it, when it is next owed something, and
 * whether somebody has answered it or ruled it out.
 *
 * The one write this endpoint holds, and deliberately the only one. Nothing
 * here reaches the lead; it records what the studio has done about them, which
 * is the half that was missing when every door kept its own record and none of
 * them kept a state.
 */
async function mark(db, request, response) {
  const body = readBody(request)
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return response.status(400).json({ error: 'Which lead?' })

  const patch = { updated_at: new Date().toISOString() }

  if ('owner' in body) {
    patch.owner = typeof body.owner === 'string' && body.owner.trim() ? body.owner.trim() : null
  }

  const due = dateFrom(body.due_at)
  if (due !== undefined) patch.due_at = due

  // A mark is sent as the thing that happened and a flag saying whether it did,
  // so the same field both stamps and clears. Reading it as 'present means
  // true' would leave a reader no way to undo a misclick.
  if (typeof body.mark === 'string') {
    const column = MARKS[body.mark]
    if (!column) return response.status(400).json({ error: 'That is not a mark.' })
    patch[column] = body.on === false ? null : new Date().toISOString()
    if (column === 'dismissed_at') {
      patch.dismissed_reason =
        body.on === false || typeof body.reason !== 'string'
          ? null
          : body.reason.trim().slice(0, 200)
    }
  }

  if (Object.keys(patch).length === 1) {
    return response.status(400).json({ error: 'Nothing to change.' })
  }

  const { data, error } = await db.from(SPINE).update(patch).eq('id', id).select(COLUMNS).single()
  if (error) {
    if (tableMissing(error))
      return response.status(503).json({ error: 'The leads are not here yet.' })
    throw error
  }

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({ lead: data })
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    response.setHeader('Allow', 'GET, PATCH')
    return response.status(405).json({ error: 'GET or PATCH only' })
  }

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  const account = await authorizeAdmin(wired, request.headers.authorization)
  if (account.status) return response.status(account.status).json({ error: account.error })

  try {
    if (request.method === 'PATCH') return await mark(wired.db, request, response)
    return await read(wired.db, response)
  } catch (cause) {
    console.error('leads-admin: %s', cause.message)
    return response.status(500).json({ error: 'The leads could not be read.' })
  }
}
