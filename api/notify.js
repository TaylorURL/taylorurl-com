/**
 * The one door a client project's own deployment knocks on to reach a person.
 *
 * Every product the studio runs eventually has something to say that cannot
 * wait for somebody to open a tab. A browser notification only fires while a
 * tab is open, a webhook only reaches whatever is listening, and a page can
 * only tell somebody who is already looking at it. Email is the one channel
 * that reaches a phone in a truck with the site closed, and standing up a
 * sender per client would mean a domain to warm, a frame to keep in step and a
 * deliverability reputation to earn, per client, forever.
 *
 * So this is the studio's mail stack with a door on it. A project posts what
 * happened; the message is composed on the studio's sheet in the project's own
 * name, colour and mark, and handed to the studio's transport. Nothing about it
 * is specific to any one client: a project becomes able to send when a row
 * appears in `notify_projects`, and this file names none of them.
 *
 * Four things decide whether this is safe to leave open.
 *
 * The credential resolves the project. The row is found BY the digest of the
 * presented secret rather than by a slug in the request, so there is no field a
 * caller can set that names a project other than the one their credential
 * belongs to. `X-Notify-Project` is checked against the row that came back, and
 * a mismatch is a 401 rather than a silent send, because a deployment holding
 * the wrong secret should find out on its first call rather than on the day
 * somebody notices the wrong logo.
 *
 * The ledger row is written before anything reaches the transport, the way
 * `api/newsletter-send.js` claims a recipient. That is what makes a retry of a
 * post whose answer was lost send nothing a second time, which matters because
 * the callers are crons: a sweep that cannot tell whether its notification
 * landed will post it again, and it should.
 *
 * Nothing is ever silently not sent. A project whose whole list is paused or
 * suppressed answers 200 with a reason and a delivered count of zero, and the
 * contract tells the caller to log that as a failure - because a notification
 * that reports success and reaches nobody is the exact shape of the complaint
 * this endpoint was built to answer. The ledger row agrees with the answer: a
 * send that reached nobody is stamped failed, not sent, so the key stays
 * retakeable and the caller that posts it again is told the same true thing
 * rather than being told, from the second pass on, that it had already gone.
 * Only a delivery stamps a row sent, which is what lets `duplicate` mean the
 * single thing a caller may safely read it as.
 *
 * And each recipient is handed over on their own call. A shared `to` would tell
 * every person on a client's list who else is on it.
 */

import { createHash } from 'node:crypto'
import { connect } from '../lib/db/clients.js'
import { countOf, tableMissing } from '../lib/db/rows.js'
import { methodsOr405, servedHereOr404 } from '../lib/http/guard.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { isScheduler } from '../lib/http/scheduler.js'
import { sendNotice } from '../lib/mail/notice.js'
import {
  CAPS,
  DEFAULT_BURST,
  DEFAULT_DAILY,
  DELIVERIES,
  RECIPIENTS,
  clientNotice,
  envelopeFor,
  projectByDigest,
  projectBySlug,
  readNotification,
  recipientsFor,
} from '../lib/mail/notify.js'

// Recipients go in parallel and each handover is capped well inside this, so a
// healthy call answers long before the ceiling. It is here for the pathological
// case: a provider that accepts the connection and then says nothing.
export const config = { maxDuration: 15 }

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

// The Postgres code for a unique violation, which here means another run
// already holds this idempotency key rather than a fault.
const UNIQUE_VIOLATION = '23505'

// Each handover is given less than the caller's own eight seconds, so a slow
// provider is reported by this side rather than timing the caller out.
const SEND_TIMEOUT_MS = 6000

const DAY_MS = 24 * 60 * 60 * 1000

// How long a claim may sit neither sent nor failed before another run may take
// it. A send that is genuinely in flight is finished well inside the fifteen
// seconds above, so a row still holding after this is a run that died between
// writing its claim and stamping the row - and a claim nobody is left to finish
// is a notification every retry of it is told has already gone.
//
// Three quarters of a minute rather than the two the callers happen to run on.
// A horizon equal to a caller's own interval is decided by scheduling jitter: a
// dead claim reads as in flight or as abandoned depending on which side of the
// same instant the next post lands, so the same input produces a different
// outcome run to run and the losing one is silent. Well clear of a real send
// and well inside any caller's cadence is the only setting that is never
// marginal, and the shorter it is the less time a dead claim spends blocking
// its own retry.
const STALE_CLAIM_MS = 45 * 1000

// One sentence for a missing header, an unrecognised secret and a slug that
// does not belong to it. Three different sentences would let anybody with an
// HTTP client discover which project slugs exist.
//
// It is written here rather than taken from `bearerOr401`, which every other
// door uses. That helper answers a browser holding a session that has gone,
// and its sentence says to sign in again — true there, meaningless here, where
// the caller is somebody else's server posting with a project secret and has
// no session to renew. More to the point, a fourth wording is a fourth
// wording: the moment one of these four paths answers differently from the
// other three, the door tells a stranger which of its guesses was the near
// miss, and that is the whole thing this constant exists to prevent.
const UNAUTHORIZED = 'That secret does not open this door.'

// Why a notification with a full recipient list still reached nobody. It is
// both the `reason` the caller reads and the `error` the ledger keeps, so the
// row and the answer cannot drift into telling two different stories about the
// same send.
const NOBODY = 'no recipient takes a notification at this level'

/**
 * The burst window each project holds, built at that project's own limit.
 *
 * It lives in the function instance's memory, so a scaled-out deployment holds
 * one per instance and it is not a guarantee. It is the cheap refusal in front
 * of the day's ceiling, which is counted in the table and does hold - the
 * division `lib/http/rate.js` describes for itself.
 */
const windows = new Map()

/**
 * What one address may ask of this door, whoever it says it is.
 *
 * The window below it counts a project, which means it is only reached once a
 * credential has resolved to one - and resolving a credential is a query. This
 * is the ceiling in front of that: it is what stops an address with no
 * credential at all from turning an open endpoint into an unmetered read of the
 * projects table, and what puts a rate on guessing a secret rather than resting
 * that entirely on how long the secret is.
 *
 * It is set far above anything a caller doing its job reaches, because it is
 * not the ceiling a real notification is refused by. A project's own burst is,
 * and that one answers in words a caller can act on.
 */
const DOOR = callerWindow({ limit: 600, windowMs: 10 * 60 * 1000 })

/**
 * Who the platform says is knocking, rather than who the request says it is.
 *
 * `X-Forwarded-For` is a list a caller may write the front of: the proxy
 * appends, it does not replace. Keying a window on the first entry hands every
 * unauthenticated caller a fresh allowance per value they invent, which is the
 * whole of what the window above is there to prevent. The platform's own header
 * carries the address it observed and a caller cannot forge it, so it is read
 * first and the shared reader stands in only where it is absent - locally, and
 * in the cases, where there is no proxy in front and nothing to spoof.
 */
function knocker(request) {
  const attested = request.headers['x-vercel-forwarded-for']
  if (typeof attested === 'string' && attested.trim()) return attested.split(',')[0].trim()
  return callerAddress(request)
}

function burstFor(project) {
  const limit = project.burst_limit ?? DEFAULT_BURST.limit
  const held = windows.get(project.slug)
  if (held && held.limit === limit) return held.window
  const window = callerWindow({ limit, windowMs: DEFAULT_BURST.windowMs })
  windows.set(project.slug, { limit, window })
  return window
}

/** The posted JSON, however the platform hands the body over. */
function readBody(request) {
  const body = request.body
  if (body === undefined || body === null || body === '') return {}
  if (typeof body !== 'string') return body
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

/**
 * How large the request is, before it is read for anything.
 *
 * The platform has usually parsed the body by the time a handler runs, so the
 * stated length is what a ceiling can actually be applied to; the serialised
 * size stands in where a caller sent none.
 */
function rawSize(request) {
  const stated = Number(request.headers['content-length'])
  if (Number.isFinite(stated) && stated > 0) return stated
  const body = request.body
  if (typeof body === 'string') return Buffer.byteLength(body)
  if (body && typeof body === 'object') return Buffer.byteLength(JSON.stringify(body))
  return 0
}

/**
 * Claims this notification by writing its ledger row, before anything is handed
 * to the transport.
 *
 * A unique violation on `(project_id, idempotency_key)` means this key has been
 * posted before. A row carrying a failure is a notification still owed, so it
 * is taken back and this run owns it; a row already sent, and one another run
 * is holding right now, are both left alone and the caller is told it was a
 * duplicate. Nothing about that is decided by a check this file has to remember
 * to make - the database refuses the second claim.
 *
 * A claim that is neither sent nor failed and has stopped moving is taken back
 * too, and that case is the reason `claimed_at` is a column. A run that dies
 * between writing its claim and stamping the row leaves one behind that reads
 * exactly like a send in flight, and without a horizon on it every retry of
 * that key would be answered `duplicate` forever - which tells a caller its
 * notification went out when nothing ever left. The retake stamps `claimed_at`
 * as part of the same statement, so of two runs reaching a stale row at once
 * the second finds it fresh and stands down rather than sending it twice.
 *
 * Either way the row's id comes back, because a caller retrying a post it never
 * saw the answer to is owed the same id as the run that actually sent - that id
 * is what makes the two attempts one notification in a log rather than two.
 *
 * @returns {Promise<{id: string|null, claimed: boolean}>} `claimed` is false
 *   where the notification has already gone or is in flight.
 */
async function claim(db, project, notification, recipients) {
  const row = {
    project_id: project.id,
    idempotency_key: notification.key,
    severity: notification.severity,
    subject: notification.subject,
    recipients,
  }

  const written = await db.from(DELIVERIES).insert(row).select('id').maybeSingle()
  if (!written.error) return { id: written.data?.id ?? null, claimed: true }
  if (written.error.code !== UNIQUE_VIOLATION) throw written.error

  const stale = new Date(Date.now() - STALE_CLAIM_MS).toISOString()
  const retaken = await db
    .from(DELIVERIES)
    .update({ ...row, claimed_at: new Date().toISOString(), failed_at: null, error: null })
    .eq('project_id', project.id)
    .eq('idempotency_key', notification.key)
    .is('sent_at', null)
    .or(`failed_at.not.is.null,claimed_at.lt.${stale}`)
    .select('id')
  if (retaken.error) throw retaken.error
  if (retaken.data?.[0]) return { id: retaken.data[0].id, claimed: true }

  const held = await db
    .from(DELIVERIES)
    .select('id')
    .eq('project_id', project.id)
    .eq('idempotency_key', notification.key)
    .maybeSingle()
  if (held.error) throw held.error
  return { id: held.data?.id ?? null, claimed: false }
}

/**
 * Hands one message to every recipient, each on their own call.
 *
 * `allSettled` rather than `all`, because one refused address must not take the
 * rest of a client's team down with it: a partial delivery is reported as a
 * partial delivery, and the whole thing is only a failure when nobody was
 * reached.
 */
async function fanOut(project, notification, recipients) {
  const message = clientNotice(project, notification)
  const envelope = envelopeFor(project, notification.severity)

  const results = await Promise.allSettled(
    recipients.map(recipient =>
      sendNotice(message, RESEND_API_KEY, {
        ...envelope,
        to: [recipient.email],
        timeoutMs: SEND_TIMEOUT_MS,
      })
    )
  )

  const providerIds = []
  const faults = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value) providerIds.push(result.value)
      continue
    }
    faults.push(describe(result.reason))
  }

  return { delivered: results.length - faults.length, providerIds, faults }
}

/** Which stage failed, in the words a log line uses. */
function describe(cause) {
  if (cause && cause.name === 'AbortError') return 'the provider timed out'
  if (cause && cause.message) return String(cause.message)
  return 'the provider was unreachable'
}

/** How many notifications this project has posted in the last day. */
function sentToday(db, project) {
  const since = new Date(Date.now() - DAY_MS).toISOString()
  return countOf(
    db
      .from(DELIVERIES)
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .gte('created_at', since)
  )
}

/**
 * One notification, from the day's ceiling through to the answer.
 *
 * It answers rather than writing to a response, so the same run can be driven
 * by the endpoint and by the cases without either holding a socket.
 *
 * @param {object} db A service-role Supabase client.
 * @param {object} project The row the credential resolved to.
 * @param {object} notification What `readNotification` returned.
 * @returns {Promise<{status: number, body: object, retryAfter?: number}>}
 */
export async function deliver(db, project, notification) {
  const daily = project.daily_limit ?? DEFAULT_DAILY
  const today = await sentToday(db, project)
  if (today >= daily) {
    return {
      status: 429,
      retryAfter: 86400,
      body: { error: 'That project has sent as much as it may in a day.' },
    }
  }

  const recipients = await recipientsFor(db, project, notification.severity)
  const { id, claimed } = await claim(db, project, notification, recipients.length)
  if (!claimed) {
    return {
      status: 200,
      body: { id, project: project.slug, delivered: 0, duplicate: true },
    }
  }

  const answer = {
    id,
    project: project.slug,
    severity: notification.severity,
    recipients: recipients.length,
    delivered: 0,
    failed: 0,
    duplicate: false,
  }

  // A project whose whole list is paused, suppressed, or standing above this
  // severity is the one case that looks like success and is not, and the row it
  // leaves behind decides what the caller believes on its next pass.
  //
  // The claim carries the failure rather than a send. Stamping it sent made it
  // unretakeable, and an unretakeable key is answered `duplicate` from then on
  // - which is the one answer a caller is entitled to read as delivered. So a
  // notification that reached nobody was reported honestly once and recorded as
  // told for the rest of its life, which is the silent success this endpoint
  // exists to eliminate, arrived at through the machinery built to prevent it.
  //
  // Carrying the failure keeps the key retakeable, and what makes that worth
  // something is that the recipient list is read fresh on every post: the very
  // thing that produced an empty list - a seat not yet added, paused, standing
  // above this severity, or sitting on the suppression list - is the thing that
  // changes underneath, and the next post after it changes is the one that goes.
  if (recipients.length === 0) {
    await db
      .from(DELIVERIES)
      .update({ failed_at: new Date().toISOString(), error: NOBODY })
      .eq('id', id)
    return { status: 200, body: { ...answer, reason: NOBODY } }
  }

  const { delivered, providerIds, faults } = await fanOut(project, notification, recipients)

  if (delivered === 0) {
    // The claim carries the failure rather than being deleted, which is what
    // lets the same key be posted again and picked up by `claim`.
    await db
      .from(DELIVERIES)
      .update({ failed_at: new Date().toISOString(), error: faults.join('; ').slice(0, 1000) })
      .eq('id', id)
    console.error('notify: %s reached nobody: %s', project.slug, faults.join('; '))
    return { status: 502, body: { error: 'The notification could not be delivered.' } }
  }

  await db
    .from(DELIVERIES)
    .update({
      sent_at: new Date().toISOString(),
      delivered,
      provider_ids: providerIds,
      failed_at: null,
      error: faults.length ? faults.join('; ').slice(0, 1000) : null,
    })
    .eq('id', id)

  if (faults.length) {
    console.error(
      'notify: %s reached %d of %d: %s',
      project.slug,
      delivered,
      recipients.length,
      faults.join('; ')
    )
  }

  return { status: 200, body: { ...answer, delivered, failed: faults.length } }
}

/**
 * Which project is asking, from the credential it presented.
 *
 * The lookup is by the digest of the secret rather than by the slug on the
 * request, which is the whole of why a project can only ever send as itself:
 * there is no field a caller controls that names a project their credential
 * does not resolve to. `X-Notify-Project` is then read against the row that
 * came back, so a deployment holding a secret that is not its own is refused on
 * its first call instead of quietly sending in somebody else's name.
 *
 * The studio's own scheduler is the one caller that may speak for any project,
 * and it is the only path on which the header selects one rather than
 * confirming one.
 *
 * All three refusals carry the same sentence. Three different ones would let
 * anybody with an HTTP client discover which project slugs exist.
 *
 * @param {object} db A service-role Supabase client.
 * @param {string} authorization The caller's `Bearer` header.
 * @param {string} named What `X-Notify-Project` said.
 * @returns {Promise<{project: object}|{status: number, error: string}>}
 */
export async function resolve(db, authorization, named) {
  const token = String(authorization || '')
    .slice('Bearer '.length)
    .trim()
  if (!token) return { status: 401, error: UNAUTHORIZED }

  const digest = createHash('sha256').update(token).digest('hex')
  let project = await projectByDigest(db, digest)
  if (!project && isScheduler(authorization) && named) project = await projectBySlug(db, named)

  if (!project) return { status: 401, error: UNAUTHORIZED }
  if (!named || named !== project.slug) return { status: 401, error: UNAUTHORIZED }
  return { project }
}

/**
 * A project's own record of itself, so a deployment can prove its credential
 * without mailing anybody.
 *
 * It carries counts rather than addresses. These rows hold one client's contact
 * details and the credential that reads them belongs to that client's own
 * deployment, which is a machine rather than a person.
 */
async function record(db, project) {
  const [recipients, sent] = await Promise.all([
    countOf(
      db
        .from(RECIPIENTS)
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('active', true)
    ),
    sentToday(db, project),
  ])

  return {
    project: project.slug,
    name: project.name,
    active: project.active,
    from: `${project.from_name} <${project.from_address}>`,
    accent: project.accent,
    recipients,
    // What the day's ceiling is measured against, which is every notification
    // posted rather than only the ones that reached somebody.
    sent_24h: sent,
    burst_limit: project.burst_limit ?? DEFAULT_BURST.limit,
    daily_limit: project.daily_limit ?? DEFAULT_DAILY,
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  // Set before the first refusal rather than after them, so a 405 and a 413 are
  // as uncacheable as an answer carrying a client's own record.
  response.setHeader('Cache-Control', 'private, no-store')

  if (!methodsOr405(request, response, ['GET', 'POST'])) return

  if (rawSize(request) > CAPS.request) {
    response.status(413).json({ error: 'That notification is too large.' })
    return
  }

  // In front of the credential rather than behind it, so an address holding no
  // credential at all cannot drive a lookup per request.
  if (!DOOR.allows(knocker(request))) {
    response.setHeader('Retry-After', '600')
    response.status(429).json({ error: 'That is more than this door takes in ten minutes.' })
    return
  }

  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: UNAUTHORIZED })
    return
  }

  const clients = connect()
  if (!clients || !RESEND_API_KEY) {
    console.error('notify: the deployment holds no database keys or no RESEND_API_KEY')
    response.status(503).json({ error: 'Notifications are not available right now.' })
    return
  }
  const { db } = clients

  const named = String(request.headers['x-notify-project'] || '').trim()

  let project = null
  try {
    const asking = await resolve(db, authorization, named)
    if (asking.status) {
      response.status(asking.status).json({ error: asking.error })
      return
    }
    project = asking.project
    if (request.method === 'GET') {
      response.status(200).json(await record(db, project))
      return
    }

    if (!project.active) {
      response.status(403).json({ error: 'That project is not sending right now.' })
      return
    }

    const body = readBody(request)
    if (body === null) {
      response.status(400).json({ error: 'That body is not JSON.' })
      return
    }

    const read = readNotification(body, project)
    if (read.error) {
      response.status(400).json({ error: read.error })
      return
    }

    if (!burstFor(project).allows(project.slug)) {
      response.setHeader('Retry-After', '600')
      response
        .status(429)
        .json({ error: 'That project has sent as much as it may in ten minutes.' })
      return
    }

    const answer = await deliver(db, project, read.notification)
    if (answer.retryAfter) response.setHeader('Retry-After', String(answer.retryAfter))
    response.status(answer.status).json(answer.body)
  } catch (cause) {
    if (tableMissing(cause)) {
      console.error('notify: the notify tables are not in the schema yet')
      response.status(503).json({ error: 'Notifications are not set up on this deployment yet.' })
      return
    }
    console.error('notify: %s: %s', project ? project.slug : 'unresolved', cause.message)
    response.status(502).json({ error: 'The notification could not be delivered.' })
  }
}
