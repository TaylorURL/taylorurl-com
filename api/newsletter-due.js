/**
 * Sends the issues whose date has come, on Vercel's schedule rather than anyone's.
 *
 * `api/newsletter-send.js` is the far end of a button: it verifies a person's
 * session, reads their role from `profiles`, and mails the one issue they
 * named. A schedule holds none of that. So `scheduled_for` — the date the
 * composer writes when an issue is marked ready — is a column nothing reads
 * unless something else is watching it, and a date that passed unhonoured reads
 * exactly like a date that was met.
 *
 * This is the other door onto the same run. Vercel signs a cron invocation with
 * CRON_SECRET and nothing else carries it, so that secret is the only caller
 * accepted here. There is no session half: a person naming an issue already has
 * an endpoint, and this one takes no argument at all.
 *
 * Nothing here holds a lock over an issue, and that is the point. Every
 * recipient is claimed by inserting their `newsletter_sends` row before the
 * message is composed, and the `(issue_id, subscriber_id)` unique constraint is
 * what refuses the second claim, so two invocations that overlap divide the
 * list between them rather than mailing it twice. Whichever of them finds
 * nobody left writes the `sent` that closes the issue, and `sendRefusal` turns
 * every later run away from it. A lock on top of that would be a second answer
 * to a question the database has already settled, and the two would drift.
 */

import { ownsSchedules } from '../lib/site/current.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { isScheduler } from '../lib/http/scheduler.js'
import { READY } from '../lib/mail/issues.js'
import { run, serviceClient } from './newsletter-send.js'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

// A ceiling on the read. The newsletter goes out monthly, so more issues than
// this being due at once is a backlog rather than a busy morning, and a bounded
// read keeps the answer something a person can still take in.
const DUE_MAX = 25

/**
 * How long the platform gives this run, and how much of it may pass before the
 * run stops taking on another issue.
 *
 * The duration is declared rather than inherited because the budget below is
 * chosen against it, and a default that moves underneath a figure measured
 * against it is a bound that quietly stops being one.
 *
 * One issue can spend most of an invocation on its own: its run mails up to 500
 * recipients in batches of twenty-five with a second between them. So the
 * budget governs whether another issue is begun, never whether one already
 * begun is allowed to finish — cutting a run off partway would leave an issue
 * half claimed, which is the one state this endpoint exists to avoid.
 */
export const config = { maxDuration: 60 }
const START_BUDGET_MS = 20_000

/**
 * The ready issues whose date has passed, oldest first.
 *
 * The null test is redundant against the comparison beside it and is written
 * anyway: it is half of `newsletter_issues_due_idx`'s predicate, and the
 * planner reaches for a partial index on the strength of the predicate rather
 * than of what the rows happen to hold. Dropping it turns a lookup into a scan
 * of every issue ever written.
 *
 * @param {object} db A service-role Supabase client.
 * @returns {Promise<Array<{id: string, slug: string, scheduled_for: string}>>}
 */
async function dueIssues(db) {
  const { data, error } = await db
    .from('newsletter_issues')
    .select('id, slug, scheduled_for')
    .eq('status', READY)
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(DUE_MAX)
  if (error) throw new Error(error.message)
  return data || []
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  // Both projects register all nine crons, because vercel.json is read before
  // any build runs. This is what decides which deployment acts on them. A 204
  // rather than an error: the schedule fired correctly, there was simply
  // nothing here to do.
  if (!ownsSchedules()) return response.status(204).end()

  if (!isScheduler(request.headers.authorization)) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'GET or POST only' })
    return
  }
  if (!SERVICE_KEY || !RESEND_API_KEY) {
    response.status(503).json({ error: 'newsletter sending not configured' })
    return
  }

  response.setHeader('Cache-Control', 'private, no-store')

  const db = serviceClient()
  let issues
  try {
    issues = await dueIssues(db)
  } catch (cause) {
    console.error('newsletter-due: %s', cause.message)
    response.status(502).json({ error: 'the due issues could not be read' })
    return
  }

  const ran = []
  const refused = []
  const startedAt = Date.now()
  let begun = 0

  for (const issue of issues) {
    if (begun > 0 && Date.now() - startedAt > START_BUDGET_MS) break
    begun += 1
    try {
      const answer = await run(db, { issueId: issue.id })
      if (answer.status === 200) ran.push(answer.body)
      else refused.push({ issue: issue.slug, error: answer.body.error })
    } catch (cause) {
      // One issue that could not finish leaves the rest of the run alone. The
      // recipients it claimed keep their rows, so the next invocation reaches
      // the ones it did not.
      console.error('newsletter-due: %s did not complete: %s', issue.slug, cause.message)
      refused.push({ issue: issue.slug, error: 'send did not complete' })
    }
  }

  const unreached = issues.length - begun
  response.status(200).json({
    due: issues.length,
    ran,
    refused,
    unreached,
    // A monthly job that mails nobody and a monthly job that could not are the
    // same quiet 200 otherwise, and the second one is a month of silence before
    // anybody looks.
    needsAttention: refused.length > 0 || unreached > 0 || ran.some(answer => answer.failed > 0),
  })
}
