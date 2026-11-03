/**
 * Everybody who has written to the studio, whichever door they came through,
 * what was said each way, and the way to answer them. The console's Inbox is
 * drawn from this and nothing else.
 *
 * It reads the spine, where every door writes: a reply to a cold letter, a
 * new-business letter or a preview letter (the inbox watcher files all three
 * as 'outreach-reply', matched through the prospect each letter went to), and
 * an enquiry from the site or the ads. Automated replies - out-of-office
 * notes, "we received your email" receipts, help-desk tickets - are read again
 * here with today's reader and left out, so the list is the people and what
 * they wrote, and nothing else. Calls are the Call List's, not the Inbox's.
 *
 * Three reads. The list is the rows, newest first, with the first line of the
 * latest reply beside each one a cold letter produced, and the saved replies
 * the reply box starts from. One lead's conversation is everything they wrote
 * and everything sent to them: the letters and replies the outreach mailbox
 * holds under their prospect, the new-business letter where they had one, and
 * every message sent to them from here.
 *
 * Two writes. The mark records what the studio has done about a lead -
 * answered it, or ruled it out - and the send answers one lead by mail and
 * records the message under them.
 *
 * A send is one lead at a time, always. There is no verb here that takes a
 * list, because a hundred addresses beside one button is a mistake waiting
 * for a slow afternoon; the console reaches this with a single id, from
 * inside that lead's own record, with the whole message on screen.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { readBody } from '../lib/http/body.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { tableMissing } from '../lib/db/rows.js'
import { uuid } from '../lib/db/fields.js'
import { SOURCES, SPINE } from '../lib/leads/spine.js'
import { deliverable, suppressed, usableEmail } from '../lib/leads/record.js'
import { TEMPLATE_LIMITS, unfilled } from '../lib/leads/templates.js'
import { leadLetter } from '../lib/leads/letter.js'
import { newText } from '../lib/outreach/sending/replies.js'
import { isAutomated } from '../lib/outreach/daily-report.js'
import { INBOX, sendNotice } from '../lib/mail/notice.js'
import { BIO_NAME } from '../lib/mail/bio.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

// What one answer carries. Newest first, so the cap takes the leads nobody
// has heard from in longest rather than the ones somebody opened the Inbox to
// read.
const LIST_ROWS = 500

/** The messages one conversation carries, each way. */
const THREAD_ROWS = 100

/** Prospects asked about in one request, so the address stays a sane length. */
const PROSPECT_BATCH = 100

/** How much of a reply the list carries beside its row. */
const SAID_LIMIT = 1200

/** The line a phone's mail app adds under whatever was typed. */
const SIGN_OFF =
  /^(?:get outlook for (?:ios|android)|sent from my (?:iphone|ipad|android|phone|galaxy))\b.*$/i

/** Where the saved replies and the record of sends live. */
const TEMPLATES = 'lead_templates'
const MESSAGES = 'lead_messages'

// The columns the Inbox draws. Named rather than starred so a column added to
// the table later is a decision to show it rather than a thing that appears.
// `trade` is here for the saved replies, which can carry it as a blank.
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
  'first_seen',
  'last_seen',
  'contacted_at',
  'replied_at',
  'unsubscribed_at',
  'dismissed_at',
].join(', ')

/** The marks a reader can put on a lead, and the column each is written in. */
const MARKS = {
  contacted: 'contacted_at',
  dismissed: 'dismissed_at',
}

/** The prospect a lead's reply was filed under, where it came from one. */
function prospectOf(lead) {
  return lead?.source === SOURCES.outreachReply ? uuid(lead.source_ref) : null
}

/** What somebody typed, out of a reply with its quoted copy and sign-off cut. */
export function ownWords(body) {
  const text = newText(body)
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => !SIGN_OFF.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text ? text.slice(0, SAID_LIMIT) : null
}

/**
 * Whether a message is somebody writing rather than a machine answering. The
 * watcher's own verdict is read first, then the message is read again with
 * today's reader, since a reply filed before the reader learned a pattern
 * still carries the verdict it was filed under. An opt-out is a person and
 * stays in, because it is what they said.
 */
function written(row) {
  if (row.direction !== 'inbound') return true
  return !isAutomated({ intent: row.intent, subject: row.subject, body: row.body_text })
}

/**
 * The latest thing each prospect wrote, by prospect, for the list's rows, and
 * which prospects the mailbox holds any reply from at all.
 *
 * The spine keeps a short excerpt of the first reply with its whitespace
 * folded, which is the quoted letter as often as it is the answer. The row
 * wants the answer: the newest reply a person wrote, cut where the quoted copy
 * begins. A prospect heard from with no entry in `said` only ever had a
 * machine answer for it.
 */
async function lastWords(db, leads) {
  const prospects = [...new Set(leads.map(prospectOf).filter(Boolean))]
  const said = new Map()
  const heard = new Set()
  for (let at = 0; at < prospects.length; at += PROSPECT_BATCH) {
    const { data, error } = await db
      .from('outreach_messages')
      .select('prospect_id, direction, intent, subject, body_text, sent_at, created_at')
      .eq('direction', 'inbound')
      .eq('status', 'received')
      .in('prospect_id', prospects.slice(at, at + PROSPECT_BATCH))
      .order('created_at', { ascending: false })
    if (error) {
      if (tableMissing(error)) return { said, heard }
      throw error
    }
    for (const row of data || []) {
      heard.add(row.prospect_id)
      if (said.has(row.prospect_id) || !written(row)) continue
      said.set(row.prospect_id, {
        at: row.sent_at || row.created_at,
        text: ownWords(row.body_text),
      })
    }
  }
  return { said, heard }
}

/**
 * Whether a lead belongs in the Inbox: somebody who wrote to the studio, in
 * their own words.
 *
 * A reply whose mail the record holds is in when a person wrote any of it, and
 * out when every message was a machine's. A reply filed before the mailbox kept
 * its copy is judged on the excerpt on the row, which is all there is. Calls
 * are logged by whoever made them and live on the Call List.
 */
export function inInbox(lead, { said, heard }) {
  if (lead.source === SOURCES.call) return false
  if (lead.source !== SOURCES.outreachReply) return true
  const prospect = prospectOf(lead)
  if (said.has(prospect)) return true
  if (heard.has(prospect)) return false
  return Boolean(lead.note) && !isAutomated({ intent: null, subject: null, body: lead.note })
}

/**
 * The saved replies the reply box offers, oldest first so the list holds its
 * order.
 *
 * A deployment reading ahead of the table's own migration answers with none
 * rather than failing the whole Inbox: the people are still the point.
 */
async function readTemplates(db) {
  const { data, error } = await db
    .from(TEMPLATES)
    .select('id, name, subject, body')
    .order('created_at', { ascending: true })
  if (error) {
    if (tableMissing(error)) return []
    throw error
  }
  return data || []
}

/** An empty record, for a deployment reading ahead of its own migration. */
const NOTHING = { leads: [], complete: true, templates: [] }

/** Reads the Inbox: the rows, each with what they last said, and the saved replies. */
async function read(db, response) {
  const { data, error } = await db
    .from(SPINE)
    .select(COLUMNS)
    .order('last_seen', { ascending: false, nullsFirst: false })
    .limit(LIST_ROWS)

  if (error) {
    // A table its migration has not created yet answers as an empty record
    // rather than as a failure, so the console draws the Inbox rather than a
    // refusal nobody can act on.
    if (tableMissing(error)) return response.status(200).json(NOTHING)
    throw error
  }

  const rows = data || []
  const [words, templates] = await Promise.all([lastWords(db, rows), readTemplates(db)])
  const leads = rows.filter(lead => inInbox(lead, words))

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({
    leads: leads.map(lead => ({ ...lead, said: words.said.get(prospectOf(lead)) ?? null })),
    complete: rows.length < LIST_ROWS,
    templates,
  })
}

/** One message sent from here, as a line in the conversation. */
function sentEntry(row) {
  return {
    id: `sent-${row.id}`,
    from: 'us',
    kind: 'sent',
    at: row.sent_at,
    subject: row.subject,
    body: row.body,
    by: row.sent_by || null,
  }
}

/**
 * What the outreach mailbox holds under one prospect: every letter that went
 * to them and every reply a person wrote back, the reply cut to what they
 * typed. A letter that never left - drafted, refused - is not a letter they
 * read, and a bounce is a mail server talking.
 */
async function outreachThread(db, prospectId) {
  const { data, error } = await db
    .from('outreach_messages')
    .select('id, direction, intent, subject, body_text, sent_at, created_at')
    .eq('prospect_id', prospectId)
    .in('status', ['sent', 'received'])
    .order('created_at', { ascending: true })
    .limit(THREAD_ROWS)
  if (error) {
    if (tableMissing(error)) return []
    throw error
  }
  return (data || []).filter(written).map(row => {
    const theirs = row.direction === 'inbound'
    return {
      id: `mail-${row.id}`,
      from: theirs ? 'them' : 'us',
      kind: 'mail',
      at: row.sent_at || row.created_at,
      subject: row.subject,
      body: theirs ? ownWords(row.body_text) || '' : row.body_text || '',
    }
  })
}

/**
 * The new-business letter, where the prospect is a new company's mirror row.
 * That pipeline records its own letters in its own table and only the replies
 * land in the outreach mailbox's, so without this the conversation would open
 * on an answer to a letter it never showed.
 */
async function newBusinessLetters(db, prospectId) {
  const { data: companies, error } = await db
    .from('new_business_leads')
    .select('id')
    .eq('prospect_id', prospectId)
    .limit(5)
  if (error) {
    if (tableMissing(error)) return []
    throw error
  }
  if (!companies?.length) return []

  const { data, error: letterFault } = await db
    .from('new_business_messages')
    .select('id, subject, body_text, sent_at')
    .in(
      'lead_id',
      companies.map(row => row.id)
    )
    .eq('status', 'sent')
    .order('sent_at', { ascending: true })
    .limit(THREAD_ROWS)
  if (letterFault) {
    if (tableMissing(letterFault)) return []
    throw letterFault
  }
  return (data || []).map(row => ({
    id: `new-business-${row.id}`,
    from: 'us',
    kind: 'mail',
    at: row.sent_at,
    subject: row.subject,
    body: row.body_text || '',
  }))
}

/** Every message written to one lead from here or through the reply relay. */
async function sentFromHere(db, leadId) {
  const { data, error } = await db
    .from(MESSAGES)
    .select('id, subject, body, sent_by, sent_at')
    .eq('lead_id', leadId)
    .order('sent_at', { ascending: true })
    .limit(THREAD_ROWS)
  if (error) {
    if (tableMissing(error)) return []
    throw error
  }
  return (data || []).map(sentEntry)
}

/**
 * What an enquiry said, as the door wrote it on the row: the note, or the
 * configurator's answers where it left a brief instead.
 */
function enquiryEntry(lead) {
  const brief = Array.isArray(lead.brief)
    ? lead.brief
        .filter(row => row?.label && row?.value)
        .map(row => `${row.label}: ${row.value}`)
        .join('\n')
    : ''
  const body = lead.note || brief
  if (!body) return []
  return [
    {
      id: `note-${lead.id}`,
      from: 'them',
      kind: 'note',
      at: lead.last_seen || lead.first_seen,
      subject: null,
      body,
    },
  ]
}

const at = entry => (entry.at ? new Date(entry.at).getTime() : 0)

/**
 * One lead's conversation, oldest first: what they wrote and what was sent
 * back, from every record that holds a part of it.
 */
async function readConversation(db, leadId, response) {
  const { data: lead, error } = await db
    .from(SPINE)
    .select('id, source, source_ref, note, brief, first_seen, last_seen')
    .eq('id', leadId)
    .maybeSingle()
  if (error) {
    if (tableMissing(error)) return response.status(200).json({ conversation: [] })
    throw error
  }
  if (!lead) return response.status(404).json({ error: 'That lead is not in the record.' })

  const prospectId = prospectOf(lead)
  const [mail, letters, sent] = await Promise.all([
    prospectId ? outreachThread(db, prospectId) : [],
    prospectId ? newBusinessLetters(db, prospectId) : [],
    sentFromHere(db, leadId),
  ])

  // A reply whose mail the record holds is read from the mail. Where it holds
  // none - a row written before the mailbox kept its copy - the excerpt on the
  // row is all there is, and it is better read than missing.
  const theirs = mail.some(entry => entry.from === 'them') ? [] : enquiryEntry(lead)

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({
    conversation: [...theirs, ...mail, ...letters, ...sent].sort((a, b) => at(a) - at(b)),
  })
}

/**
 * Marks a lead answered or ruled out, or takes either back.
 *
 * A mark is sent as the thing that happened and a flag saying whether it did,
 * so the same field both stamps and clears. Reading it as 'present means true'
 * would leave a reader no way to undo a misclick.
 */
async function mark(db, request, response) {
  const body = readBody(request)
  const id = uuid(body.id)
  if (!id) return response.status(400).json({ error: 'Which lead?' })

  const column = typeof body.mark === 'string' ? MARKS[body.mark] : null
  if (!column) return response.status(400).json({ error: 'That is not a mark.' })

  const now = new Date().toISOString()
  const patch = { [column]: body.on === false ? null : now, updated_at: now }
  if (column === 'dismissed_at' && body.on === false) patch.dismissed_reason = null

  const { data, error } = await db.from(SPINE).update(patch).eq('id', id).select(COLUMNS).single()
  if (error) {
    if (tableMissing(error))
      return response.status(503).json({ error: 'The leads are not here yet.' })
    throw error
  }

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({ lead: data })
}

/** A trimmed field for a message, or null where it is empty or over its room. */
function draftField(value, limit) {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\r\n/g, '\n').trim()
  if (!trimmed || trimmed.length > limit) return null
  return trimmed
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
 * not recorded costs a line in the conversation; a message recorded and never
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

  // The record, after the send. Losing it is a gap in the conversation rather
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
    .select('id, subject, body, sent_by, sent_at')
    .single()
  if (recordFault && !tableMissing(recordFault)) {
    console.error('leads-admin: the send was not recorded: %s', recordFault.message)
  }

  // A lead written to is a lead answered, as of now. The time moves with every
  // answer rather than keeping the first, because the Inbox reads a lead as
  // handled when the last answer is newer than the last thing they wrote.
  const answered = new Date().toISOString()
  const stamp = { contacted_at: answered, updated_at: answered }
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
  return response.status(200).json({
    lead: after || lead,
    message: message ? sentEntry(message) : null,
  })
}

/** The one door a write with a body comes through. */
async function act(db, account, request, response) {
  const body = readBody(request)
  if (body.action === 'send') return send(db, account, body, response)
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
    if (leadId) return await readConversation(wired.db, leadId, response)
    return await read(wired.db, response)
  } catch (cause) {
    console.error('leads-admin: %s', cause.message)
    return response.status(500).json({ error: 'The leads could not be read.' })
  }
}
