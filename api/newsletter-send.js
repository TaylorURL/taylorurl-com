/**
 * Sends one newsletter issue to the list.
 *
 * The caller's Supabase session is verified here and their role read from
 * `profiles`, because there is no endpoint further along to hand the question
 * to: this function is the far end. Everything it then reads and writes goes
 * through the service role, which is the only key that reaches
 * `newsletter_sends` at all.
 *
 * An issue has to be ready before any of this happens. A draft is unfinished
 * writing and is refused; an issue already sent is finished and is refused
 * again, so the second press of a button that has already run mails nobody.
 * Only `scheduled` — the status a person sets when the writing is done — opens
 * the run, and it is read before a single recipient is claimed.
 *
 * Within a ready issue a run is idempotent. The `(issue_id, subscriber_id)`
 * unique constraint is what enforces it: a recipient is claimed by inserting
 * their row before the message is handed to the provider, so a second run — or
 * a second run started while the first is still going — is refused by the
 * database rather than by a check this file has to remember to make. A claim
 * whose send then fails is released, so the recipient is picked up next time; a
 * claim whose process dies mid-flight is not, which loses one letter rather
 * than sending two.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { createClient } from '@supabase/supabase-js'
import { SENT, contentRefusal, sendRefusal } from '../lib/mail/issues.js'
import { audienceOf, selectRecipients } from '../lib/mail/audience.js'
import { readAll } from '../lib/db/rows.js'
import { wait } from '../lib/time/wait.js'
import { renderIssueEmail, unsubscribeUrl } from '../lib/mail/emailTemplate.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gujgtjqqurildqurpffh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

const FROM = process.env.NEWSLETTER_FROM || 'TaylorURL <notes@taylorurl.com>'
// The From address is a sending identity rather than a mailbox anybody opens.
// A reader who answers an issue is answering a person, so the reply is aimed
// at the inbox the enquiry form delivers into instead.
const REPLY_TO = process.env.CONTACT_INBOX || 'trenton@taylorurl.com'
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'
// Two targets for one act. A reader clicking the footer link lands on the site,
// which posts the token and renders the outcome; a mail client honouring RFC
// 8058 posts straight to the function, which has no page to render and none to
// give it. Both carry the same token and reach the same row.
const UNSUBSCRIBE_URL =
  process.env.NEWSLETTER_UNSUBSCRIBE_URL || `${SUPABASE_URL}/functions/v1/unsubscribe`
const UNSUBSCRIBE_PAGE = `${SITE_URL}/unsubscribe`

// Recipients per batch, and the wait between batches. The pause is what keeps
// a large list inside the provider's rate limit; the batch is how many go out
// concurrently before the next one waits.
const BATCH_SIZE = 25
const PAUSE_MS = 1000
// A ceiling on one invocation's work, so a list longer than the function's
// execution window finishes across several runs instead of being cut off
// mid-batch. What is left is reported and picked up by the next run.
const MAX_PER_RUN = 500
const SEND_TIMEOUT_MS = 10000

// The Postgres code for a unique violation, which is a recipient another run
// already claimed rather than a fault.
const UNIQUE_VIOLATION = '23505'

export const config = { maxDuration: 60 }

/**
 * The client every read and write of a send goes through.
 *
 * It carries the service role, which is the only key that reaches
 * `newsletter_sends` at all, and it is exported so the scheduled door opens the
 * project the same way this one does rather than repeating the URL its default
 * holds.
 */
export function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** The signed-in account, or null when the token names nobody. */
async function callerId(db, jwt) {
  const { data, error } = await db.auth.getUser(jwt)
  if (error || !data?.user) return null
  return data.user.id
}

async function isAdmin(db, userId) {
  const { data } = await db.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

/**
 * Hands one message to Resend and keeps the id it answers with.
 *
 * That id is the whole of what makes a delivery, an open, a click, a bounce or
 * a complaint reconcilable later: the events arrive on a webhook minutes or
 * days after the run has ended, carrying the id and nothing else that names a
 * recipient. Discarding it leaves every one of them unattributable.
 *
 * The tag rides along so an event can also be read per issue without a join.
 *
 * The two `List-Unsubscribe` headers are RFC 8058's one-click contract: the URL
 * accepts a POST, and the `Post` header is what tells the mailbox provider it
 * may send one without asking the reader to visit a page. A bulk sender carries
 * both, so a message with no link to put in them is refused here rather than
 * sent without a way off the list.
 *
 * @returns {Promise<string|null>} Resend's id for the message.
 * @throws {Error} When no unsubscribe link was given.
 */
export async function sendOne({ to, subject, html, text, unsubscribe, tag }) {
  if (!unsubscribe) {
    throw new Error('a message carries a one-click unsubscribe link; none was given')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const upstream = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: REPLY_TO,
        subject,
        html,
        text,
        ...(tag ? { tags: [{ name: 'issue', value: tag }] } : {}),
        headers: {
          'List-Unsubscribe': `<${unsubscribe}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    })
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      throw new Error(`resend answered ${upstream.status}${detail ? `: ${detail}` : ''}`)
    }
    const answer = await upstream.json().catch(() => null)
    return typeof answer?.id === 'string' ? answer.id : null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Claim a recipient by writing their send row. A unique violation means
 * another run holds the claim, and this one leaves them alone.
 */
async function claim(db, issueId, subscriberId) {
  const { error } = await db
    .from('newsletter_sends')
    .insert({ issue_id: issueId, subscriber_id: subscriberId })
  if (!error) return true
  if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message)

  // A row carrying a failure is a recipient this issue still owes rather than
  // one it has finished with, so the claim is taken back and the failure
  // cleared. A row already sent, and one another run is holding right now, are
  // both left where they are.
  const retaken = await db
    .from('newsletter_sends')
    .update({ failed_at: null, error: null })
    .eq('issue_id', issueId)
    .eq('subscriber_id', subscriberId)
    .is('sent_at', null)
    .not('failed_at', 'is', null)
    .select('id')
  if (retaken.error) throw new Error(retaken.error.message)
  return (retaken.data?.length ?? 0) > 0
}

/**
 * One subscriber's copy, composed and handed to the provider.
 *
 * Composing happens inside the try, alongside the send, because a message that
 * cannot be built lawfully and a message the provider refuses are the same
 * outcome for the row: nothing left, and the reason is worth keeping. A
 * recipient with no `unsub_token` has no way off the list in either the footer
 * or the RFC 8058 headers, so their copy is refused rather than sent without
 * one.
 */
export async function deliver(db, issue, subscriber) {
  const claimed = await claim(db, issue.id, subscriber.id)
  if (!claimed) return 'skipped'

  let providerId = null
  try {
    const { subject, html, text } = renderIssueEmail({
      issue,
      subscriber,
      unsubscribeEndpoint: UNSUBSCRIBE_PAGE,
      siteUrl: SITE_URL,
    })
    providerId = await sendOne({
      to: subscriber.email,
      subject,
      html,
      text,
      unsubscribe: unsubscribeUrl(UNSUBSCRIBE_URL, subscriber.unsub_token),
      tag: issue.slug,
    })
  } catch (cause) {
    // The claim stays and carries the failure. Deleting it loses the one
    // record that an address was tried and did not take, which is the same
    // shape of silence a bounce leaves - and a list that cannot see either
    // keeps mailing an address that will never accept.
    await db
      .from('newsletter_sends')
      .update({ failed_at: new Date().toISOString(), error: String(cause.message).slice(0, 1000) })
      .eq('issue_id', issue.id)
      .eq('subscriber_id', subscriber.id)
    console.error('newsletter-send: %s failed: %s', subscriber.email, cause.message)
    return 'failed'
  }

  await db
    .from('newsletter_sends')
    .update({
      sent_at: new Date().toISOString(),
      provider_id: providerId,
      failed_at: null,
      error: null,
    })
    .eq('issue_id', issue.id)
    .eq('subscriber_id', subscriber.id)
  return 'sent'
}

/**
 * One run over one issue: what it may reach, who is still owed a copy, and
 * what happened to each of them.
 *
 * It answers rather than writes to a response, so the same run can be driven
 * by the console's send button, by a scheduled firing, and by the cases,
 * without any of them holding a session or a socket.
 *
 * @param {object} db A service-role Supabase client.
 * @param {{slug?: string, issueId?: string}} named Which issue.
 * @returns {Promise<{status: number, body: object}>}
 */
export async function run(db, { slug, issueId }) {
  const issueQuery = db.from('newsletter_issues').select('*')
  const { data: issue, error: issueError } = await (
    slug ? issueQuery.eq('slug', slug) : issueQuery.eq('id', issueId)
  ).maybeSingle()
  if (issueError) throw new Error(issueError.message)
  if (!issue) return { status: 404, body: { error: 'That issue is no longer here.' } }

  // Answered before a single recipient is claimed: a run that wrote send rows
  // and then stopped leaves an issue reading as half delivered when nothing
  // ever reached the provider.
  const refusal = sendRefusal(issue)
  if (refusal) return { status: refusal.status, body: { error: refusal.error } }

  // Who the issue may reach, decided in the one module the composer counts
  // through as well. Neither status nor a consent stamp answers it alone: the
  // cold outreach sender writes both for every business it mails, and none of
  // them asked to hear from anybody.
  const recipients = await readAll(() => selectRecipients(db))
  const suppression = await readAll(() => db.from('suppression').select('email'))
  const sends = await readAll(() =>
    db.from('newsletter_sends').select('subscriber_id, sent_at, failed_at').eq('issue_id', issue.id)
  )

  // Three reads that have to be whole. A recipient list stopped by the row
  // ceiling sends the issue to a prefix of the audience and records the run as
  // finished; a short suppression or sends list mails somebody who asked not to
  // be mailed, or mails them twice. None of those is recoverable once the
  // messages are out, so a truncated read stops the run instead.
  if (!recipients.complete || !suppression.complete || !sends.complete) {
    // Where the ceiling is set is a fact about this codebase rather than about
    // the issue, so it goes to the log. What the console needs is that nothing
    // has gone out and that sending again will not help until somebody raises
    // it, which is the difference between waiting and acting.
    console.error('newsletter-send: the audience is past the row ceiling in lib/db/rows.js')
    return {
      status: 503,
      body: {
        error:
          'The audience is too large for one run to read, so nothing was sent. Sending again ' +
          'will not help until somebody looks at it.',
      },
    }
  }

  const subscribers = recipients.rows
  const suppressed = new Set(suppression.rows.map(row => String(row.email).toLowerCase()))
  // A row that was sent, or that is claimed and carries no failure, is settled
  // for this issue. One that failed is still owed, so it comes back into the
  // run and `claim` takes the row back rather than inserting a second.
  const settled = new Set(
    sends.rows.filter(row => row.sent_at || !row.failed_at).map(row => row.subscriber_id)
  )

  const pending = subscribers.filter(
    subscriber =>
      !settled.has(subscriber.id) && !suppressed.has(String(subscriber.email).toLowerCase())
  )
  // Whether the issue has anything to say to each side it is about to reach,
  // answered here for the same reason the status is: a run that mailed the side
  // with copy and then found the other side empty has already spent the half it
  // cannot take back. It is asked of the sides this run holds recipients for,
  // so an issue written for one of them still goes out when nobody is owed the
  // other.
  const sides = [...new Set(pending.map(audienceOf))]
  const empty = contentRefusal(issue, sides)
  if (empty) return { status: empty.status, body: { error: empty.error } }

  const batch = pending.slice(0, MAX_PER_RUN)

  const counts = { sent: 0, skipped: 0, failed: 0 }
  for (let start = 0; start < batch.length; start += BATCH_SIZE) {
    const slice = batch.slice(start, start + BATCH_SIZE)
    const results = await Promise.all(slice.map(subscriber => deliver(db, issue, subscriber)))
    for (const result of results) counts[result] += 1
    if (start + BATCH_SIZE < batch.length) await wait(PAUSE_MS)
  }

  // The issue is marked sent once nobody is left waiting for it, and given a
  // publish time if it has none, which is what opens the web version to
  // readers under the table's select policy. That write is also what closes
  // the issue: `sendRefusal` turns every later run away from it, and the
  // table's own trigger turns away anything that tries to open it again.
  const remaining = pending.length - batch.length
  const done = remaining === 0 && counts.failed === 0
  if (done) {
    const now = new Date().toISOString()
    await db
      .from('newsletter_issues')
      .update({ status: SENT, sent_at: now, published_at: issue.published_at || now })
      .eq('id', issue.id)
  }

  return {
    status: 200,
    body: {
      issue: issue.slug,
      recipients: pending.length,
      remaining,
      status: done ? SENT : issue.status,
      ...counts,
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
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'POST only' })
    return
  }
  if (!SERVICE_KEY || !RESEND_API_KEY) {
    response.status(503).json({ error: 'Newsletter sending is not set up, so nothing can go out.' })
    return
  }
  const db = serviceClient()
  const userId = await callerId(db, authorization.slice('Bearer '.length))
  if (!userId) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (!(await isAdmin(db, userId))) {
    response.status(403).json({ error: 'forbidden' })
    return
  }

  const { slug, issueId } = request.body ?? {}
  if (!slug && !issueId) {
    response.status(400).json({ error: 'Name the issue to send.' })
    return
  }

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const answer = await run(db, { slug, issueId })
    response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('newsletter-send: %s', cause.message)
    // A run that stopped part way has already claimed and sent whoever it
    // reached, and the next run reads those rows back and skips them - so the
    // answer says the thing that decides what to do next, which is that
    // sending again is safe rather than a way to mail somebody twice.
    response.status(502).json({
      error: 'That send did not finish. Anybody already sent to is skipped, so run it again.',
    })
  }
}
