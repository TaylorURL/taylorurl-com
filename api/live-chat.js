/**
 * One turn of the chat widget.
 *
 * The assistant itself runs on the Pi, because a serverless function cannot
 * hold a thread across turns and the machine that can is already paid for and
 * already idle. This endpoint is what stands between it and the open internet:
 * it counts what a connection has spent, reads what was typed for the two kinds
 * of message worth catching, forwards the rest, writes down what happened, and
 * tells the owner when something is worth his attention. It also answers, to
 * anyone who asks, whether there is an assistant behind it at all.
 *
 * The Pi is a computer in a house and it will be unreachable one day. When that
 * happens the widget is never drawn, because a box inviting a stranger to type
 * a question is a promise, and the page carries the address and the number
 * whether or not the promise can be kept. A thread already open when it goes is
 * a different case and still answers, still takes an address, and still mails
 * it on: a lead lost to an outage is the one failure this endpoint exists to
 * prevent.
 *
 * The reply is a whole answer rather than a stream. The upstream turn returns
 * complete after a few seconds, so a stream would carry stage lines and no
 * text, which buys a visitor nothing over an honest typing indicator.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { countOf } from '../lib/db/rows.js'
import { notice, sendNotice } from '../lib/mail/notice.js'
import { LIMITS, overCeiling, retryAfter } from '../lib/live-chat/limits.js'
import { contactIn, leaked, REFUSAL, screen } from '../lib/live-chat/screen.js'

export const config = { maxDuration: 60 }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gujgtjqqurildqurpffh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

const AGENT_URL = process.env.LIVE_AGENT_URL || ''
const AGENT_SECRET = process.env.LIVE_AGENT_SECRET || ''

// The upstream holds its own 45s ceiling. This one sits just outside it so a
// slow turn is reported by the side that knows why it was slow.
const AGENT_TIMEOUT_MS = 50000

// Nothing is generated behind the reachability probe, so it holds a ceiling a
// page load can afford rather than the one a turn gets.
const REACH_TIMEOUT_MS = 3000

// How long one reachability answer stands in front of the rest. A minute is
// short enough that a visitor arriving after the assistant comes back is
// handed it, and long enough that a busy hour costs one probe rather than one
// per page.
const REACH_FRESH_S = 60

const MAX_MESSAGE_CHARS = 2000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// The cheap refusal in front of the counted one. It costs no query and holds
// for the length of one instance, which is enough that a script hammering one
// connection never reaches the database.
const BURST = callerWindow({ limit: 12, windowMs: 5 * 60 * 1000 })

// An outage mails once and then stays quiet. The alternative is a mailbox with
// four hundred copies of the same sentence in it, which is the same as no alert
// at all.
const OUTAGE_QUIET_MS = 60 * 60 * 1000
let outageToldAt = 0

// Addresses already mailed on from a turn the database did not record. The
// table normally carries that flag; while it cannot, the instance does, which
// is enough to stop one visitor repeating an address into five notices.
const MAILED = new Set()

/** What a visitor is told when the assistant cannot be reached. */
const OFFLINE =
  'The assistant is not answering right now, which is on this end and not on yours. ' +
  'Trenton reads everything that reaches trenton@taylorurl.com, and he is on (281) 862-8687. ' +
  'Leave an address here and it goes straight to him either way.'

function connect() {
  if (!SERVICE_KEY) return null
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * The caller's connection, as something that tells two callers apart and says
 * nothing else about either.
 *
 * A bare digest of an IPv4 address is a lookup table away from the address, so
 * it is peppered with a secret the deployment already holds. Without one there
 * is nothing safe to store and the row carries no connection at all.
 */
function callerHash(address) {
  const pepper =
    process.env.LIVE_CHAT_PEPPER || process.env.SPEED_CHECK_PEPPER || process.env.CRON_SECRET || ''
  if (!pepper) return null
  return createHash('sha256').update(`${pepper}:${address}`).digest('hex').slice(0, 32)
}

/** The JSON body, whether the platform parsed it or handed it over as text. */
function readBody(request) {
  const body = request.body
  if (body && typeof body === 'object') return body
  if (typeof body !== 'string' || !body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}

/** Visitor messages from one caller since a moment. */
function countSince(db, since, caller) {
  let query = db
    .from('live_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'visitor')
    .gte('created_at', new Date(since).toISOString())
  if (caller) query = query.eq('caller_hash', caller)
  return countOf(query)
}

/**
 * Spends one turn upstream.
 *
 * @returns {Promise<{reply: string, session: string, cost: number}>}
 */
async function ask({ message, session }) {
  if (!AGENT_URL) throw new Error('no agent url')
  if (!AGENT_SECRET) throw new Error('no agent secret')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)
  try {
    const upstream = await fetch(`${AGENT_URL}/reply`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${AGENT_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, session: session || null }),
    })

    if (!upstream.ok) {
      const said = await upstream.text().catch(() => '')
      const detail = said.replaceAll(AGENT_SECRET, '[redacted]').slice(0, 200)
      throw new Error(`agent returned ${upstream.status} ${detail}`.trim())
    }

    const payload = await upstream.json()
    if (!payload.reply || !payload.session) throw new Error('agent returned no reply')
    return payload
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Whether a status from the reply door means a turn sent to it would be
 * carried rather than turned away.
 *
 * The two failures worth catching are a host nothing reaches and a bearer
 * secret the host does not accept, and the second is the quiet one: the door
 * answers, so anything watching the host alone reads it as working. A refused
 * credential is the one 4xx that means down. The rest mean the request was
 * understood, which is all a probe carrying no message can ask for.
 *
 * @param {number} status
 * @returns {boolean}
 */
export function answering(status) {
  if (status === 401 || status === 403) return false
  return status < 500
}

/**
 * Whether the assistant would answer a visitor asking now.
 *
 * It knocks on the door a turn goes through rather than the health route
 * beside it, because the health route is answered by the web server in front
 * of the assistant and says nothing about the credential. The body carries no
 * message on purpose: the upstream checks the credential before it reads the
 * body, so the probe proves the door and spends nothing behind it.
 *
 * @returns {Promise<boolean>}
 */
async function reachable() {
  if (!SERVICE_KEY || !AGENT_URL || !AGENT_SECRET) return false

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REACH_TIMEOUT_MS)
  try {
    const upstream = await fetch(`${AGENT_URL}/reply`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${AGENT_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    return answering(upstream.status)
  } catch (cause) {
    console.error('live-chat: probing: %s', cause.message)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Tells the owner, and never lets the telling break the answer. */
async function tell(notice) {
  if (!RESEND_API_KEY) return
  try {
    await sendNotice(notice, RESEND_API_KEY)
  } catch (cause) {
    console.error('live-chat: notifying: %s', cause.message)
  }
}

/** The notice for a thread that left a way to answer it. */
export function leadNotice({ email, phone, entryPath, transcript, session }) {
  const rows = [
    ['Email', email || 'not given'],
    ['Phone', phone || 'not given'],
    ['Started on', entryPath || 'unknown'],
    ['Thread', session],
  ]
  return notice({
    label: 'Live chat lead',
    subject: `Live chat lead${email ? ` from ${email}` : ''}`,
    rows,
    body: transcript,
    ...(email ? { replyTo: email } : {}),
  })
}

/** The notice for a thread that tried something on the assistant. */
export function abuseNotice({ labels, entryPath, message, session, caller }) {
  const rows = [
    ['Caught', labels.join(', ')],
    ['Started on', entryPath || 'unknown'],
    ['Thread', session || 'none yet'],
    ['Connection', caller || 'not recorded'],
  ]
  return notice({
    label: 'Live chat',
    subject: `Live chat: ${labels.join(', ')} attempt`,
    rows,
    body: message,
  })
}

/** The notice for an assistant that stopped answering. */
export function outageNotice(said) {
  const rows = [
    ['Service', 'the live chat assistant'],
    ['Reached', AGENT_URL || '(no host configured)'],
  ]
  const body = [
    'The chat widget is answering visitors with the offline message and still taking addresses.',
    '',
    said,
  ].join('\n')
  return notice({
    label: 'Service',
    subject: 'Live chat assistant is not answering',
    rows,
    body,
  })
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  // What the widget asks before it draws itself. A box in the corner of a page
  // is an offer, and an offer nothing is behind costs more than the absence of
  // one: the visitor spends their question on it and reads an apology, when
  // the address and the number were on the page the whole time. So the answer
  // is public, cheap, and held in front of the function for a minute at a
  // time, because every visitor on the site asks it once.
  if (request.method === 'GET') {
    const up = await reachable()
    response.setHeader(
      'Cache-Control',
      `public, max-age=0, s-maxage=${REACH_FRESH_S}, stale-while-revalidate=${REACH_FRESH_S * 2}`
    )
    response.status(200).json({ up })
    return
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'GET or POST only' })
    return
  }

  const db = connect()
  if (!db) {
    response.status(503).json({ error: 'The assistant is not available right now.' })
    return
  }

  const address = callerAddress(request)
  if (!BURST.allows(address)) {
    response.setHeader('Retry-After', String(BURST.windowMs / 1000))
    response.status(429).json({ error: 'That is a lot of messages at once. Give it a moment.' })
    return
  }

  const body = readBody(request)

  const message = String(body.message || '').trim()
  if (!message) {
    response.status(400).json({ error: 'Nothing to send.' })
    return
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    response
      .status(400)
      .json({ error: 'That message is longer than the box takes. Trim it and send again.' })
    return
  }

  const asked = body.session ? String(body.session) : null
  if (asked && !UUID_SHAPE.test(asked)) {
    response.status(400).json({ error: 'That thread is not one I recognize.' })
    return
  }

  const entryPath = String(body.path || '').slice(0, 200) || null
  const caller = callerHash(address)

  try {
    const [callerHour, callerDay, day, sessionTurns] = await Promise.all([
      caller ? countSince(db, Date.now() - HOUR_MS, caller) : 0,
      caller ? countSince(db, Date.now() - DAY_MS, caller) : 0,
      countSince(db, Date.now() - DAY_MS, null),
      asked ? turnsOn(db, asked) : 0,
    ])

    const counts = { callerHour, callerDay, day, sessionTurns }
    const full = overCeiling(counts)
    if (full) {
      response.setHeader('Retry-After', String(retryAfter(counts)))
      response.status(429).json({ error: full })
      return
    }
  } catch (cause) {
    // A ceiling that cannot be counted is not a reason to refuse a visitor.
    // The burst window in front already holds, and the upstream holds its own.
    console.error('live-chat: counting: %s', cause.message)
  }

  const read = screen(message)

  // A refusal is answered from here. It spends nothing upstream, which is the
  // whole point: the cost of somebody probing the widget is one database write.
  if (read.verdict === 'refuse') {
    await Promise.all([
      record(db, {
        session: asked,
        caller,
        entryPath,
        message,
        reply: REFUSAL,
        read,
        cost: 0,
      }),
      tell(
        abuseNotice({
          labels: read.labels,
          entryPath,
          message,
          session: asked,
          caller,
        })
      ),
    ])
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).json({ reply: REFUSAL, session: asked })
    return
  }

  let answer = null
  let fault = null
  try {
    answer = await ask({ message, session: asked })
  } catch (cause) {
    fault = cause.message
    console.error('live-chat: upstream: %s', fault)
  }

  if (fault) {
    if (Date.now() - outageToldAt > OUTAGE_QUIET_MS) {
      outageToldAt = Date.now()
      await tell(outageNotice(fault))
    }
    // The thread cannot be written down without an id from upstream, so an
    // address left during an outage travels by mail rather than by row.
    const left = contactIn(message)
    const mark = left.email || left.phone
    if (mark && !MAILED.has(mark)) {
      MAILED.add(mark)
      await tell(
        leadNotice({
          email: left.email,
          phone: left.phone,
          entryPath,
          transcript: `Visitor: ${message}\n\nThe assistant was offline when this arrived.`,
          session: asked || 'none',
        })
      )
    }
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).json({ reply: OFFLINE, session: asked, offline: true })
    return
  }

  // A reply reciting the instructions instead of following them is dropped
  // rather than shown, and is worth knowing about immediately.
  let reply = answer.reply
  if (leaked(reply)) {
    reply = REFUSAL
    read.labels.push('leak')
    await tell(
      abuseNotice({
        labels: ['leak'],
        entryPath,
        message,
        session: answer.session,
        caller,
      })
    )
  }

  const stored = await record(db, {
    session: answer.session,
    caller,
    entryPath,
    message,
    reply,
    read,
    cost: answer.cost,
  })

  if (read.verdict === 'watch') {
    await tell(
      abuseNotice({
        labels: read.labels,
        entryPath,
        message,
        session: answer.session,
        caller,
      })
    )
  }

  if (stored?.lead) await tell(leadNotice(stored.lead))

  // A lead is the one thing here worth more than the record of it. When the
  // write failed there is no `notified` flag to check and no transcript to
  // attach, so the address travels on what this turn holds and the instance
  // remembers it rather than the table.
  if (!stored) {
    const left = contactIn(message)
    const mark = left.email || left.phone
    if (mark && !MAILED.has(mark)) {
      MAILED.add(mark)
      await tell(
        leadNotice({
          email: left.email,
          phone: left.phone,
          entryPath,
          transcript: `Visitor: ${message}\n\nAssistant: ${reply}\n\nThe exchange itself was not recorded.`,
          session: answer.session,
        })
      )
    }
  }

  response.setHeader('Cache-Control', 'private, no-store')
  response.status(200).json({ reply, session: answer.session })
}

/** Turns already spent on a thread. */
async function turnsOn(db, session) {
  const { data } = await db
    .from('live_chat_sessions')
    .select('turns')
    .eq('id', session)
    .maybeSingle()
  return data?.turns || 0
}

/**
 * Writes the exchange down, and says whether it produced a lead worth a notice.
 *
 * The session row is written before the messages that reference it, and a
 * refusal that never reached upstream has no session at all -- there is no id
 * to hang it on, so it is counted and dropped.
 */
async function record(db, { session, caller, entryPath, message, reply, read, cost }) {
  if (!session) return null

  try {
    const left = contactIn(message)

    const { data: existing } = await db
      .from('live_chat_sessions')
      .select('turns, cost_usd, flagged, flag_labels, lead_email, lead_phone, notified')
      .eq('id', session)
      .maybeSingle()

    const email = left.email || existing?.lead_email || null
    const phone = left.phone || existing?.lead_phone || null
    const labels = [...new Set([...(existing?.flag_labels || []), ...read.labels])]

    const { error } = await db.from('live_chat_sessions').upsert(
      {
        id: session,
        caller_hash: caller,
        entry_path: existing ? undefined : entryPath,
        last_at: new Date().toISOString(),
        turns: (existing?.turns || 0) + 1,
        cost_usd: Number(existing?.cost_usd || 0) + Number(cost || 0),
        flagged: Boolean(existing?.flagged) || read.verdict !== 'clear',
        flag_labels: labels,
        lead_email: email,
        lead_phone: phone,
        notified: Boolean(existing?.notified) || Boolean(email || phone),
      },
      { onConflict: 'id' }
    )
    if (error) throw error

    await db.from('live_chat_messages').insert([
      {
        session_id: session,
        role: 'visitor',
        body: message,
        verdict: read.verdict,
        labels: read.labels,
        caller_hash: caller,
      },
      { session_id: session, role: 'assistant', body: reply },
    ])

    // The notice goes out once, on the turn the address first appears.
    const fresh = (left.email || left.phone) && !existing?.notified
    if (!fresh) return { lead: null }

    const transcript = await threadOf(db, session)
    return {
      lead: { email, phone, entryPath: entryPath || existing?.entry_path, transcript, session },
    }
  } catch (cause) {
    console.error('live-chat: recording: %s', cause.message)
    return null
  }
}

/** The thread so far, as something readable in a mail client. */
async function threadOf(db, session) {
  const { data } = await db
    .from('live_chat_messages')
    .select('role, body')
    .eq('session_id', session)
    .order('created_at', { ascending: true })
    .limit(60)

  return (data || [])
    .map(row => `${row.role === 'visitor' ? 'Visitor' : 'Assistant'}: ${row.body}`)
    .join('\n\n')
}

export { LIMITS, OFFLINE }
