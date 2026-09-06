/**
 * What every outreach job does either side of its own work.
 *
 * The five endpoints under api/outreach share a door and a ledger. The door
 * takes either the secret Vercel signs a cron invocation with or an admin's
 * console session, and refuses everything else; the session half is the pair
 * of steps api/audience-admin.js takes, made here because these functions are
 * the far end and there is nothing further along to hand the question to.
 *
 * The ledger is `outreach_runs`. A row is opened before the work starts and
 * completed after it, counts and all, so a job that dies partway leaves a row
 * with no finish time rather than no trace. Counts live in an object the work
 * increments as it goes, which is what lets a run that failed halfway still
 * record the half it did.
 *
 * The service role reads and writes every outreach table and never leaves the
 * function. The project's public key is here only to verify a session.
 *
 * This module sits outside api/ because everything inside that directory is a
 * route, and a shared file has no business being one.
 */

import { ownsSchedules } from '../site/current.js'
import { authorizeAdmin, connect } from '../db/clients.js'
import { bearerOr401, methodsOr405 } from '../http/guard.js'
import { isScheduler } from '../http/scheduler.js'
import { loadHeldDomains } from './exclusions.js'

/** Room for a reason in the run's error column, and no room for a novel. */
const ERROR_MAX = 2000
// Room for a run to say what it did. It is read on a panel a couple of lines
// wide, so anything past this is a paragraph nobody sees the end of.
const NOTE_MAX = 500

/**
 * The caller, or the refusal to answer with.
 *
 * A job answers to two callers and only one of them holds a session. The
 * schedule is checked first, since an unset scheduler secret leaves an
 * invocation no way to prove it is the schedule at all, and the console session
 * then becomes the only door rather than a second one.
 */
async function authorize(clients, authorization) {
  if (isScheduler(authorization)) return { caller: 'cron' }
  const account = await authorizeAdmin(clients, authorization)
  if (account.status) return account
  return { caller: 'admin' }
}

/** The single settings row every job reads its switches out of. */
async function readSettings(db) {
  const { data, error } = await db.from('outreach_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    throw new Error('outreach_settings holds no row 1; apply the outreach migration')
  }
  return data
}

async function openRun(db, job) {
  const { data, error } = await db
    .from('outreach_runs')
    .insert({ job })
    .select('id, started_at')
    .single()
  if (error) throw new Error(error.message)
  return data
}

async function closeRun(db, run, counts, message, note) {
  const { error } = await db
    .from('outreach_runs')
    .update({
      finished_at: new Date().toISOString(),
      examined: counts.examined,
      changed: counts.changed,
      error: message ? String(message).slice(0, ERROR_MAX) : null,
      note: note ? String(note).slice(0, NOTE_MAX) : null,
    })
    .eq('id', run.id)
  if (error) console.error('outreach: run %s left open: %s', run.id, error.message)
}

/** A pause between two pieces of work, in milliseconds. */
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Runs `handle` over every item, no more than `limit` of them at once, and
 * answers with the results in the order the items arrived. A batch of page
 * fetches finishes in the time the slowest few take rather than the sum.
 */
export async function mapWithLimit(items, limit, handle) {
  const results = new Array(items.length)
  let next = 0
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await handle(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Runs one job inside the door and the ledger.
 *
 * `work` is handed the service-role client, the settings row, the run it is
 * being recorded under, and a counts object to raise as it goes. Whatever it
 * answers with is added to the response; an `error` on that answer is written
 * into the run's error column without the job being treated as broken, which
 * is how a job reports a condition it cannot do anything about.
 *
 * A `note` on that answer is written into the run's own column, which is where
 * a job says what it did in a sentence. The counts say how much and the error
 * says what broke; neither has room for a run that worked and decided to do
 * nothing, and that is the ordinary outcome for a job that watches a figure.
 *
 * A throw is caught, written into the error column and answered as a 502. The
 * schedule is not something to hand a stack trace to, so the reason stays in
 * the run row and the log.
 */
export async function runJob({ request, response, job, work }) {
  // First, before the bearer check and before openRun. A wrong-site invocation
  // that got this far would open an outreach_runs row and spend PageSpeed and
  // Places quota against it, and asking here also closes the admin-session door
  // below rather than only the cron one.
  if (!ownsSchedules()) return response.status(204).end()

  const authorization = bearerOr401(request, response)
  if (!authorization) return
  if (!methodsOr405(request, response, ['GET', 'POST'])) return

  const connected = connect()
  if (!connected) {
    response.status(503).json({
      error:
        'The outreach jobs have no database keys. Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY on the deployment.',
    })
    return
  }

  response.setHeader('Cache-Control', 'private, no-store')

  const caller = await authorize(connected, authorization)
  if (caller.error) {
    response.status(caller.status).json({ error: caller.error })
    return
  }

  const db = connected.db

  // Who has asked the studio to stop writing to them, read before the run does
  // any work. The rules refuse to judge a domain at all until this is in hand,
  // so a run that cannot read it stops here rather than sourcing, enriching or
  // sending against a list it does not have.
  if (!(await loadHeldDomains(db))) {
    response.status(503).json({ error: `the ${job} job could not read the held-domain list` })
    return
  }

  let run = null
  try {
    run = await openRun(db, job)
  } catch (cause) {
    console.error('outreach %s: %s', job, cause.message)
    response.status(502).json({ error: `the ${job} job could not open a run` })
    return
  }

  const counts = { examined: 0, changed: 0 }
  try {
    const settings = await readSettings(db)
    const detail = (await work({ db, settings, run, counts })) ?? {}
    await closeRun(db, run, counts, detail.error, detail.note)
    response.status(200).json({ job, run: run.id, ...counts, ...detail })
  } catch (cause) {
    const message = cause?.message || String(cause)
    console.error('outreach %s: %s', job, message)
    await closeRun(db, run, counts, message)
    response
      .status(502)
      .json({ job, run: run.id, ...counts, error: `the ${job} job did not complete` })
  }
}
