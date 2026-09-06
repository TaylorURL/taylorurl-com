/**
 * One rewrite of something a client typed into their own brief.
 *
 * The writing help runs on the Pi the chat widget's assistant runs on, for the
 * same reason: a serverless function cannot hold a model, and the machine that
 * can is already paid for and already idle. This endpoint is what stands
 * between it and the console. It asks who is asking, counts what the build has
 * spent, reads the text for the kind of message worth catching, forwards the
 * rest, and hands back what comes out.
 *
 * A rewrite is a whole request rather than a step in anything. The words
 * arrive in the body, the answer is those words rewritten, and nothing carries
 * to the next call: no session, no transcript, no row. That is what keeps it
 * cheap, and it is also what stops it becoming the chat by another name, since
 * a caller cannot assemble a conversation out of it one message at a time.
 * Nothing a client types reaches a table through this door - their answers
 * belong to the brief and are written there by the endpoint beside this one.
 *
 * The one property everything below serves: an assist never destroys what was
 * in the box, and never fails in a way that stops somebody writing. Every
 * refusal, outage and fault answers with the caller's own text back, byte for
 * byte, so a press that failed is visually a press that did nothing. The
 * person is mid-sentence in a form they have to finish, and an error thrown at
 * them there costs them their place; the place is worth more than the rewrite.
 * The framing tools beside the buttons - the starters, the worked example, the
 * checklist, the length reading, the plain-English readout - are all computed
 * in the browser, so a dead Pi costs the page four buttons and nothing else.
 *
 * It is answered for a signed-in account rather than for the open internet,
 * which is the whole difference between this and the chat. The chat answers
 * strangers and pays for it with a rate limiter; this answers somebody who has
 * paid for a build, and pays for it with a session check, which is both
 * cheaper and stricter. An admin passes without a build on purpose: the client
 * preview is the only way the studio sees what a client sees, and a preview
 * whose writing help is dead is a preview of a different product.
 *
 * The reachability probe knocks on the rewrite door rather than on the health
 * route beside it, and for a reason the chat's probe does not have: a Pi still
 * running the service from before this route existed answers its health check
 * perfectly and 404s every rewrite. Health says the service is alive; only the
 * door says the door is there.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAccount, connect } from '../lib/db/clients.js'
import { field } from '../lib/db/fields.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { notice, sendNotice } from '../lib/mail/notice.js'
import { screen } from '../lib/live-chat/screen.js'

export const config = { maxDuration: 30 }

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

const AGENT_URL = process.env.LIVE_AGENT_URL || ''
const AGENT_SECRET = process.env.LIVE_AGENT_SECRET || ''

// The upstream holds its own 25s ceiling on a rewrite. This one sits just
// outside it, so a slow turn is reported by the side that knows why it was
// slow, and both sit inside this function's own allowance.
const ASSIST_TIMEOUT_MS = 28000

// Nothing is generated behind the probe, so it holds a ceiling a console mount
// can afford rather than the one a rewrite gets.
const REACH_TIMEOUT_MS = 3000

// How long one probe answer stands in front of the rest. The answer is per
// account and cannot be shared-cached, so it is held in the instance instead:
// a console mounting for twenty clients costs one knock a minute rather than
// twenty.
const REACH_FRESH_MS = 60000

// What the upstream takes, matching its own cap so the refusal for a long
// paste is written here rather than discovered there.
const MAX_ASSIST_CHARS = 6000

// The question's own label and the client's trade. They are labels the console
// wrote rather than prose somebody typed, so they are trimmed silently at the
// length a label stops being one.
const LABEL_LIMIT = 120

/** What the writing help may be asked to do. Anything else is a bug, not a request. */
const ACTIONS = new Set(['expand', 'tighten', 'plain', 'start'])

// The cheap refusal, in front of the counted one. Twenty in five minutes is
// four or five presses on each of four fields, which is more rewrites than a
// person makes at one sitting and fewer than a script makes in a second.
const BURST = callerWindow({ limit: 20, windowMs: 5 * 60 * 1000 })

/**
 * How many rewrites one build gets, over the whole of its brief.
 *
 * A written brief is four or five boxes. Somebody who presses every button on
 * every box, changes their mind twice and comes back the next day is nowhere
 * near this. Anything past it is a script or somebody entertaining themselves,
 * and both are answered by being told the tools underneath still work.
 */
const ASSISTS_PER_PROJECT = 400

// An outage mails once and then stays quiet. The alternative is a mailbox with
// four hundred copies of the same sentence in it, which is the same as no
// alert at all.
const OUTAGE_QUIET_MS = 60 * 60 * 1000
let outageToldAt = 0

// One notice per account per hour for a screened request. The person has a
// name here, unlike a chat connection, so the quiet is kept per account rather
// than per instance: a client who trips the screening twice in a morning is
// one message, and a script running one account into it is still one message.
const REFUSAL_QUIET_MS = 60 * 60 * 1000
const refusalToldAt = new Map()

/** What the client reads when the help cannot be reached. */
const OFFLINE = 'The writing help is not answering right now. Everything else here still works.'

/** What the client reads when their own words came back unchanged. */
const UNCHANGED =
  'That came back the way you wrote it. Try the starters underneath, or say it the way you ' +
  'would say it out loud.'

/** What the client reads when the Pi is already running every turn it holds. */
const BUSY = 'The writing help is busy. Give it a moment and press again.'

/** What the client reads when they have pressed a great many times in a row. */
const TOO_MANY = 'That is a lot of rewrites at once. Give it a moment.'

/** What the client reads when the build has spent every rewrite it has. */
const SPENT =
  'That is as much rewriting as this build gets. The starters, the examples and the checklist ' +
  'are all still there, and Trenton reads anything you send.'

/** What the client reads when the box holds more than the help takes. */
const TOO_LONG = 'That is longer than the writing help takes. Trim it and try again.'

/** What the client reads when they pressed a button on an empty box. */
const NOTHING = 'Nothing to work on yet.'

/**
 * Phrases lifted from the writing assistant's own instructions.
 *
 * One of these coming back means the instructions are being recited rather
 * than followed, and the reply is dropped rather than pasted into somebody's
 * answer about their shop. The chat's own markers read the chat's instructions
 * and would catch none of these, which is why there is a second list rather
 * than a shared one.
 */
const LEAK_MARKERS = [
  'never state a fact about the business that the owner did not state',
  'the rewritten text and nothing else',
  'return the text exactly as it arrived',
  'you are not a general-purpose model',
]

/**
 * Whether a status from the rewrite door means a request sent to it would be
 * carried rather than turned away.
 *
 * A refused credential and a missing route are the two quiet failures: both
 * answer, so anything watching the host alone reads them as working. The rest
 * mean the request was understood, which is all a probe carrying no task can
 * ask for - the upstream checks the credential and then its own table of
 * tasks, both before it spends anything, so an empty body proves the door and
 * costs nothing behind it.
 *
 * @param {number} status
 * @returns {boolean}
 */
export function assistAnswering(status) {
  if (status === 401 || status === 403 || status === 404) return false
  return status < 500
}

/** Whether a reply is reciting the instructions instead of following them. */
export function assistLeaked(text) {
  const flat = String(text).replace(/\s+/g, ' ').trim().toLowerCase()
  return LEAK_MARKERS.some(marker => flat.includes(marker))
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

/**
 * Whether this account may spend a turn, and what it is spending against.
 *
 * A signed-in account is not the same thing as a client. Anybody can make an
 * account; a project with `paid_at` on it is what says money changed hands,
 * and a rewrite costs money on a machine in a house.
 *
 * Both halves are read in one round trip, because this runs before every press
 * of every button and a second trip would be felt on the one thing here that
 * has to be quick.
 */
async function standing({ db }, profileId) {
  const [profile, paid] = await Promise.all([
    db.from('profiles').select('role').eq('id', profileId).maybeSingle(),
    db
      .from('projects')
      .select('id, onboarding_assists')
      .eq('profile_id', profileId)
      .not('paid_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (profile.error || paid.error) return { fault: true }
  return {
    admin: (profile.data?.role ?? 'client') === 'admin',
    project: paid.data || null,
  }
}

/**
 * Spends one turn upstream.
 *
 * The task is a key rather than a sentence, and the upstream looks it up in a
 * table it owns, so nothing a browser writes reaches the model as a directive.
 * The label and the trade travel as labels for the same reason: the owner's
 * own text is fenced off on the other side, and everything outside that fence
 * was chosen there rather than here.
 *
 * @returns {Promise<{text: string, cost: number}>}
 */
async function ask({ action, label, trade, text }) {
  if (!AGENT_URL) throw new Error('no agent url')
  if (!AGENT_SECRET) throw new Error('no agent secret')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ASSIST_TIMEOUT_MS)
  try {
    const upstream = await fetch(`${AGENT_URL}/assist`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${AGENT_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task: action, field: label || '', trade: trade || '', text }),
    })

    if (!upstream.ok) {
      const said = await upstream.text().catch(() => '')
      const detail = said.replaceAll(AGENT_SECRET, '[redacted]').slice(0, 200)
      const fault = new Error(`agent returned ${upstream.status} ${detail}`.trim())
      // Carried so a busy Pi can be told apart from a broken one. Three turns
      // already running is the semaphore working, and mailing about it would
      // be mailing about the thing that stops the machine falling over.
      fault.status = upstream.status
      throw fault
    }

    const payload = await upstream.json()
    if (typeof payload.text !== 'string' || !payload.text.trim()) {
      throw new Error('agent returned no text')
    }
    return payload
  } finally {
    clearTimeout(timer)
  }
}

let reachedAt = 0
let reached = false

/** Whether the writing help would answer a request sent now. */
async function answeringNow() {
  if (!AGENT_URL || !AGENT_SECRET) return false
  if (reachedAt && Date.now() - reachedAt < REACH_FRESH_MS) return reached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REACH_TIMEOUT_MS)
  try {
    const upstream = await fetch(`${AGENT_URL}/assist`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${AGENT_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    reached = assistAnswering(upstream.status)
  } catch (cause) {
    console.error('onboarding-assist: probing: %s', cause.message)
    reached = false
  } finally {
    clearTimeout(timer)
    reachedAt = Date.now()
  }
  return reached
}

/** Tells the owner, and never lets the telling break the answer. */
async function tell(said) {
  if (!RESEND_API_KEY) return
  try {
    await sendNotice(said, RESEND_API_KEY)
  } catch (cause) {
    console.error('onboarding-assist: notifying: %s', cause.message)
  }
}

/** Whether this account has already been reported inside the quiet hour. */
function toldAlready(account, now = Date.now()) {
  for (const [key, at] of refusalToldAt) {
    if (now - at > REFUSAL_QUIET_MS) refusalToldAt.delete(key)
  }
  if (refusalToldAt.has(account)) return true
  refusalToldAt.set(account, now)
  return false
}

/** The notice for a request that tried something on the writing help. */
export function screenedNotice({ labels, email, project, action, text }) {
  const rows = [
    ['Caught', labels.join(', ')],
    ['Account', email || 'not known'],
    ['Build', project || 'none'],
    ['Asked for', action],
  ]
  return notice({
    label: 'Writing help',
    subject: `Writing help: ${labels.join(', ')} attempt`,
    rows,
    body: text,
  })
}

/** The notice for a reply reciting the instructions rather than following them. */
export function leakNotice({ email, project, text }) {
  const rows = [
    ['Caught', 'leak'],
    ['Account', email || 'not known'],
    ['Build', project || 'none'],
  ]
  return notice({
    label: 'Writing help',
    subject: 'Writing help returned its own instructions',
    rows,
    body: text,
  })
}

/** The notice for a writing help that stopped answering. */
export function outageNotice(said) {
  const rows = [
    ['Service', 'the writing help in the console'],
    ['Reached', AGENT_URL || '(no host configured)'],
  ]
  const body = [
    'Clients answering their brief are being told the writing help is not answering. Every box ' +
      'still takes what they type and the starters, the example, the checklist and the readouts ' +
      'are all still working.',
    '',
    said,
  ].join('\n')
  return notice({
    label: 'Service',
    subject: 'Writing help is not answering',
    rows,
    body,
  })
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return

  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'GET or POST only' })
  }

  // Every answer here is one account's own, so none of it is cacheable by
  // anything in front. Set once rather than at each way out, because the one
  // way out that forgot would be the one a proxy held on to.
  response.setHeader('Cache-Control', 'private, no-store')

  const posted = request.method === 'POST'
  const body = posted ? readBody(request) : {}

  // Held before anything can go wrong, because every refusal below answers
  // with it. What the client typed is the one thing this endpoint must not
  // lose, and the way to be sure of that is to have it in hand from the start.
  const original = typeof body.text === 'string' ? body.text : ''
  const written = original.trim()

  /**
   * The one shape a rewrite request answers in, whatever happened to it.
   *
   * The text is the caller's own unless something explicitly replaces it, so a
   * path that forgets to think about the box still hands the box back. A
   * refusal carries its sentence twice: `note` is what the control draws, and
   * `error` is what every other endpoint on this API answers a 4xx with, so a
   * caller reading either key reads the same words rather than two people
   * keeping two sentences in step.
   */
  const answer = (code, extra) => {
    const said = {
      text: original,
      assisted: false,
      refused: false,
      offline: false,
      note: null,
      ...extra,
    }
    return response.status(code).json(code === 200 ? said : { ...said, error: said.note })
  }

  /** A refusal that reaches whichever method asked, in the shape it expects. */
  const turnedAway = (code, said) =>
    posted
      ? answer(code, { offline: true, note: said })
      : response.status(code).json({ up: false, error: said })

  const wired = connect()
  if (!wired) return turnedAway(503, OFFLINE)

  // One door for both methods. The probe answers per account, so it cannot be
  // shared-cached and there is nothing to gain by letting a stranger ask it.
  const account = await authorizeAccount(
    wired,
    request.headers.authorization,
    'Sign in to use the writing help.'
  )
  // An expired session is the door answering rather than the door being gone,
  // so it is not called offline: a client who signs back in finds the buttons
  // where they left them.
  if (account.error) {
    return posted
      ? answer(account.status, { note: account.error })
      : response.status(account.status).json({ up: false, error: account.error })
  }

  // What the control asks before it draws four buttons. A row of buttons that
  // cannot do anything is worse than a row that is plainly disabled with a
  // sentence beside it saying so.
  if (!posted) return response.status(200).json({ up: await answeringNow() })

  const address = callerAddress(request)
  if (!BURST.allows(address)) {
    response.setHeader('Retry-After', String(BURST.windowMs / 1000))
    return answer(429, { note: TOO_MANY })
  }

  const action = String(body.action || '')
  if (!ACTIONS.has(action)) {
    // A console asking for something nobody listed is a bug rather than a
    // condition, so it is logged and the person reads the ordinary sentence.
    console.error('onboarding-assist: unknown action %s', action.slice(0, 40))
    return answer(400, { offline: true, note: OFFLINE })
  }

  if (written.length > MAX_ASSIST_CHARS) return answer(400, { note: TOO_LONG })
  // An empty box is the moment `start` is worth the most, and the only request
  // that is allowed to arrive carrying nothing.
  if (!written && action !== 'start') return answer(400, { note: NOTHING })

  const held = await standing(wired, account.userId)
  if (held.fault) return answer(503, { offline: true, note: OFFLINE })
  if (!held.admin && !held.project) {
    return answer(403, { note: 'The writing help comes with a build.' })
  }

  // An admin previewing holds no build and so has no durable counter. The
  // burst window is the whole of their ceiling, which is right: the role is
  // not something a stranger holds, and a preview that ran out would be a
  // preview of something that does not happen.
  const spent = Number(held.project?.onboarding_assists || 0)
  if (held.project && spent >= ASSISTS_PER_PROJECT) {
    response.setHeader('Retry-After', '86400')
    return answer(429, { note: SPENT })
  }

  // The chat's own screening, unforked. Its patterns are narrow by design and
  // every one of them is aimed at somebody addressing the model rather than
  // describing a shop, which is exactly the distinction this needs.
  //
  // `contactIn` from that same module is deliberately not called. Every second
  // box in a brief holds the client's own phone number and their own email, and
  // the chat's lead-capture reflex would mail the owner a lead notice for a
  // client he already has.
  const read = screen(written)

  // A refusal is answered from here and spends nothing upstream, which is the
  // whole point of screening in front. The person reads the same sentence the
  // model's own refusal produces, because the two are the same event from
  // where they are sitting and telling them apart would only teach somebody
  // probing this which wall they had hit.
  if (read.verdict === 'refuse') {
    if (!toldAlready(account.userId)) {
      await tell(
        screenedNotice({
          labels: read.labels,
          email: account.email,
          project: held.project?.id,
          action,
          text: written,
        })
      )
    }
    return answer(200, { refused: true, note: UNCHANGED })
  }

  const label = field(body.field, LABEL_LIMIT)
  const trade = field(body.trade, LABEL_LIMIT)

  let given = null
  let fault = null
  let status = 0
  try {
    given = await ask({ action, label, trade, text: written })
  } catch (cause) {
    fault = cause.message
    status = cause.status || 0
    console.error('onboarding-assist: upstream: %s', fault)
  }

  if (fault) {
    // A busy Pi is the semaphore holding rather than an outage, so it is the
    // one fault that is not worth a message and not worth calling offline: the
    // buttons stay live and the person presses again in a moment.
    if (status === 503) return answer(200, { note: BUSY })
    if (Date.now() - outageToldAt > OUTAGE_QUIET_MS) {
      outageToldAt = Date.now()
      await tell(outageNotice(fault))
    }
    return answer(200, { offline: true, note: OFFLINE })
  }

  // The turn landed, so the build wears it. Counted here rather than after the
  // two checks below, because both of them drop a reply that has already been
  // generated and paid for: a ceiling that only counted the answers worth
  // showing would be a ceiling somebody could walk past by producing bad ones.
  //
  // A count that cannot be written is not a reason to withhold an answer the
  // client already paid for. The burst window in front holds, and the Pi holds
  // its own semaphore.
  if (held.project) {
    const { error } = await wired.db.rpc('project_onboarding_assist', { p_actor: account.userId })
    if (error) console.error('onboarding-assist: counting: %s', error.message)
  }

  const rewrite = given.text

  // A reply reciting the instructions is dropped rather than pasted into
  // somebody's description of their own business, and is worth knowing about
  // immediately rather than on the hour.
  if (assistLeaked(rewrite)) {
    await tell(leakNotice({ email: account.email, project: held.project?.id, text: rewrite }))
    return answer(200, { offline: true, note: OFFLINE })
  }

  // Dropped rather than cut. A rewrite ending mid-sentence is worse than no
  // rewrite, and the box already holds something the client wrote.
  if (rewrite.length > MAX_ASSIST_CHARS) {
    console.error('onboarding-assist: reply ran to %d characters', rewrite.length)
    return answer(200, { offline: true, note: OFFLINE })
  }

  if (read.verdict === 'watch') {
    await tell(
      screenedNotice({
        labels: read.labels,
        email: account.email,
        project: held.project?.id,
        action,
        text: written,
      })
    )
  }

  // Text that came back the way it went in is the model's own refusal, which
  // it makes by handing the words back rather than by writing a sentence into
  // somebody's answer box. No flag is needed for it from the other end.
  if (written && rewrite.trim() === written) {
    return answer(200, { refused: true, note: UNCHANGED })
  }

  return response.status(200).json({
    text: rewrite,
    assisted: true,
    refused: false,
    offline: false,
    note: null,
  })
}

export { BUSY, NOTHING, OFFLINE, SPENT, TOO_LONG, TOO_MANY, UNCHANGED }
