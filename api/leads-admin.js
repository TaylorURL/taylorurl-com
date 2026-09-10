/**
 * Everybody who has raised a hand at this business, whichever door they came
 * through, what is owed to each of them, and the way to answer them.
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
 * The writes are three. The mark records what the studio has done about a
 * lead - who is carrying it, when it is next owed something, whether somebody
 * has answered it or ruled it out. The send answers one lead by mail, from a
 * draft the console keeps, and records the message under them. The drafts
 * themselves are the third: the section's own Settings view edits them here.
 *
 * A send is one lead at a time, always. There is no verb here that takes a
 * list, because a hundred addresses beside one button is a mistake waiting
 * for a slow afternoon; the console reaches this with a single id, from
 * inside that lead's own record, with the whole message on screen.
 *
 * The figures are counted rather than measured off the rows. A console
 * answering in a couple of seconds cannot carry every lead once there are
 * thousands, so the list is capped and says so, while each total is an exact
 * count that never travels through the cap.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { countOf, tableMissing } from '../lib/db/rows.js'
import { uuid } from '../lib/db/fields.js'
import { SPINE } from '../lib/leads/spine.js'
import { deliverable, suppressed, usableEmail } from '../lib/leads/record.js'
import { TEMPLATE_LIMITS, unfilled } from '../lib/leads/templates.js'
import { leadLetter } from '../lib/leads/letter.js'
import { INBOX, sendNotice } from '../lib/mail/notice.js'
import { BIO_NAME } from '../lib/mail/bio.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

// What one answer carries. Newest first, so the cap takes the oldest leads
// rather than the ones somebody opened the section to read.
const LIST_ROWS = 500

/** The messages one lead's record carries, newest first. */
const MESSAGE_ROWS = 50

/** Where the drafts and the record of sends live. */
const TEMPLATES = 'lead_templates'
const MESSAGES = 'lead_messages'

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

/**
 * The drafts the composer offers, oldest first so the list holds its order
 * as drafts are edited.
 *
 * A deployment reading ahead of the table's own migration answers with none
 * rather than failing the whole section: the leads are still the point.
 */
async function readTemplates(db) {
  const { data, error } = await db
    .from(TEMPLATES)
    .select('id, name, subject, body, updated_at')
    .order('created_at', { ascending: true })
  if (error) {
    if (tableMissing(error)) return []
    throw error
  }
  return data || []
}

/**
 * Who a lead can be handed to: every account holding the admin role, by name.
 *
 * The owner column keeps the account id, so the console needs the names once
 * per read rather than a join on every row.
 */
async function readTeam(db) {
  const { data, error } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'admin')
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data || []).map(row => ({ id: row.id, name: row.full_name || 'Unnamed' }))
}

/** An empty record, for a deployment reading ahead of its own migration. */
const NOTHING = {
  leads: [],
  totals: { all: 0, untouched: 0, overdue: 0, waiting: 0, enquired: 0, bought: 0, dismissed: 0 },
  complete: true,
  templates: [],
  team: [],
}

/** Reads the whole section: the rows, the figures, the drafts, the team. */
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

  const [counted, templates, team] = await Promise.all([
    totals(db),
    readTemplates(db),
    readTeam(db),
  ])

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({
    leads: data || [],
    totals: counted,
    complete: (data || []).length < LIST_ROWS,
    cap: LIST_ROWS,
    templates,
    team,
  })
}

/**
 * What has been written to one lead from here, newest first.
 *
 * Read on its own rather than joined onto the list, because the list carries
 * five hundred rows and the messages belong to the one being read.
 */
async function readMessages(db, leadId, response) {
  const { data, error } = await db
    .from(MESSAGES)
    .select('id, template_id, sent_to, subject, body, sent_by, sent_at')
    .eq('lead_id', leadId)
    .order('sent_at', { ascending: false })
    .limit(MESSAGE_ROWS)
  if (error) {
    if (tableMissing(error)) {
      return response.status(200).json({ messages: [] })
    }
    throw error
  }
  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({ messages: data || [] })
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
 * It records what the studio has done about them, which is the half that was
 * missing when every door kept its own record and none of them kept a state.
 */
async function mark(db, request, response) {
  const body = readBody(request)
  const id = uuid(body.id)
  if (!id) return response.status(400).json({ error: 'Which lead?' })

  const patch = { updated_at: new Date().toISOString() }

  // The owner is an account id or nobody. A value that is not a uuid clears
  // rather than reaching the column, which would refuse it as a log line.
  if ('owner' in body) {
    patch.owner = uuid(body.owner)
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

/** A trimmed field for a draft, or null where it is empty or over its room. */
function draftField(value, limit) {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\r\n/g, '\n').trim()
  if (!trimmed || trimmed.length > limit) return null
  return trimmed
}

/**
 * Keeps one draft: a new one, or the edit of one already held.
 *
 * The limits are answered here in a sentence rather than left to the check
 * constraints, because a constraint refusing is a log line and this is a
 * person typing.
 */
async function saveTemplate(db, body, response) {
  const held = body.template || {}
  const name = draftField(held.name, TEMPLATE_LIMITS.name)
  const subject = draftField(held.subject, TEMPLATE_LIMITS.subject)
  const draft = draftField(held.body, TEMPLATE_LIMITS.body)
  if (!name || !subject || !draft) {
    return response.status(400).json({
      error: 'A draft needs a name, a subject and a body, each within its room.',
    })
  }

  const id = uuid(held.id)
  const row = { name, subject, body: draft, updated_at: new Date().toISOString() }

  const query = id ? db.from(TEMPLATES).update(row).eq('id', id) : db.from(TEMPLATES).insert(row)
  const { data, error } = await query.select('id, name, subject, body, updated_at').single()
  if (error) {
    if (tableMissing(error))
      return response.status(503).json({ error: 'The drafts are not here yet.' })
    throw error
  }

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({ template: data })
}

/** Takes one draft out. The messages it produced keep their words. */
async function deleteTemplate(db, body, response) {
  const id = uuid(body.id)
  if (!id) return response.status(400).json({ error: 'Which draft?' })

  const { error } = await db.from(TEMPLATES).delete().eq('id', id)
  if (error) {
    if (tableMissing(error))
      return response.status(503).json({ error: 'The drafts are not here yet.' })
    throw error
  }

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({ gone: id })
}

/**
 * Answers one lead by mail, and records that it happened.
 *
 * The message goes exactly as composed - the endpoint fills nothing in, so
 * what was on screen is what arrives. What it does hold is the door: a lead
 * with no address that can take mail, one who has unsubscribed, and one on
 * the suppression list are each refused with the reason, because the same
 * list the newsletter and the outreach pipeline answer to has to hold here
 * or an unsubscribe means less than it says.
 *
 * The send happens before the record is written. A message that went and was
 * not recorded costs a line in the timeline; a message recorded and never
 * sent would cost a lead an answer they appear to have been given.
 */
async function send(db, account, body, response) {
  const id = uuid(body.id)
  if (!id) return response.status(400).json({ error: 'Which lead?' })

  const subject = draftField(body.subject, TEMPLATE_LIMITS.subject)
  const text = draftField(body.body, TEMPLATE_LIMITS.body)
  if (!subject || !text) {
    return response.status(400).json({ error: 'The message needs a subject and a body.' })
  }

  const standing = unfilled(`${subject}\n${text}`)
  if (standing.length) {
    return response.status(400).json({
      error: `Fill in ${standing.join(', ')} before it goes.`,
    })
  }

  if (!RESEND_API_KEY) {
    return response.status(503).json({ error: 'Mail is not configured here.' })
  }

  const { data: lead, error: whoFault } = await db
    .from(SPINE)
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (whoFault) {
    if (tableMissing(whoFault))
      return response.status(503).json({ error: 'The leads are not here yet.' })
    throw whoFault
  }
  if (!lead) return response.status(404).json({ error: 'That lead is not in the record.' })

  const address = usableEmail(lead.email)
  if (!address || !deliverable(address)) {
    return response.status(400).json({ error: 'This lead has no address that can take mail.' })
  }
  if (lead.unsubscribed_at) {
    return response.status(400).json({ error: 'They unsubscribed. Nothing goes to them.' })
  }
  if (await suppressed(db, address)) {
    return response.status(400).json({ error: 'That address is on the suppression list.' })
  }

  const letter = leadLetter({ subject, body: text })
  const providerId = await sendNotice(letter, RESEND_API_KEY, {
    from: `${BIO_NAME} <${INBOX}>`,
    to: [address],
    urgent: false,
  })

  // The record, after the send. Losing it is a gap in the timeline rather
  // than a refusal, because the mail is already on its way.
  const templateId = uuid(body.template_id)
  const { data: message, error: recordFault } = await db
    .from(MESSAGES)
    .insert({
      lead_id: id,
      template_id: templateId,
      sent_to: address,
      subject,
      body: text,
      sent_by: account.email || null,
      provider_id: providerId,
    })
    .select('id, template_id, sent_to, subject, body, sent_by, sent_at')
    .single()
  if (recordFault && !tableMissing(recordFault)) {
    console.error('leads-admin: the send was not recorded: %s', recordFault.message)
  }

  // A lead written to is a lead answered, unless somebody already said so.
  const stamp = { updated_at: new Date().toISOString() }
  if (!lead.contacted_at) stamp.contacted_at = stamp.updated_at
  const { data: after, error: stampFault } = await db
    .from(SPINE)
    .update(stamp)
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (stampFault) {
    console.error('leads-admin: the answer was not stamped: %s', stampFault.message)
  }

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({ lead: after || lead, message: message || null })
}

/** The one door the three writes with a body come through. */
async function act(db, account, request, response) {
  const body = readBody(request)
  const action = typeof body.action === 'string' ? body.action : ''
  if (action === 'send') return send(db, account, body, response)
  if (action === 'template-save') return saveTemplate(db, body, response)
  if (action === 'template-delete') return deleteTemplate(db, body, response)
  return response.status(400).json({ error: 'That is not a thing this can do.' })
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!['GET', 'PATCH', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, PATCH, POST')
    return response.status(405).json({ error: 'GET, PATCH or POST only' })
  }

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  const account = await authorizeAdmin(wired, request.headers.authorization)
  if (account.status) return response.status(account.status).json({ error: account.error })

  try {
    if (request.method === 'PATCH') return await mark(wired.db, request, response)
    if (request.method === 'POST') return await act(wired.db, account, request, response)
    const leadId = uuid(request.query?.lead)
    if (leadId) return await readMessages(wired.db, leadId, response)
    return await read(wired.db, response)
  } catch (cause) {
    console.error('leads-admin: %s', cause.message)
    return response.status(500).json({ error: 'The leads could not be read.' })
  }
}
