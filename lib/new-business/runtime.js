/**
 * The door every new-business job comes in through, and the ledger it writes.
 *
 * The same door outreach's jobs use - the deployment has to own the schedules,
 * the caller has to be the scheduler or a signed-in admin, and the held-domain
 * list has to be in hand before any address is judged - with the runs written
 * to `new_business_runs` rather than `outreach_runs`, so outreach's own run
 * history reads exactly as it did.
 */

import { authorizeAdmin, connect } from '../db/clients.js'
import { bearerOr401, methodsOr405 } from '../http/guard.js'
import { isScheduler } from '../http/scheduler.js'
import { ownsSchedules } from '../site/current.js'
import { loadHeldDomains } from '../outreach/prospects/exclusions.js'

const ERROR_MAX = 2000
const NOTE_MAX = 500

/** The single settings row the new-business jobs read their switches from. */
export async function readSettings(db) {
  const { data, error } = await db
    .from('new_business_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('new_business_settings holds no row 1')
  return data
}

/**
 * Runs one job: opens its ledger row, hands `work` the database and the
 * settings, and closes the row with what came back.
 *
 * @param {{request: object, response: object, job: 'source'|'check'|'send', work: Function}} options
 */
export async function runNewBusinessJob({ request, response, job, work }) {
  if (!ownsSchedules()) return response.status(204).end()

  const authorization = bearerOr401(request, response)
  if (!authorization) return
  if (!methodsOr405(request, response, ['GET', 'POST'])) return

  const connected = connect()
  if (!connected) {
    response.status(503).json({ error: 'The new-business jobs have no database keys.' })
    return
  }
  response.setHeader('Cache-Control', 'private, no-store')

  if (!isScheduler(authorization)) {
    const account = await authorizeAdmin(connected, authorization)
    if (account.status) {
      response.status(account.status).json({ error: account.error })
      return
    }
  }

  const db = connected.db
  if (!(await loadHeldDomains(db))) {
    response.status(503).json({ error: `the ${job} job could not read the held-domain list` })
    return
  }

  const opened = await db.from('new_business_runs').insert({ job }).select('id').single()
  if (opened.error) {
    console.error('new business %s: %s', job, opened.error.message)
    response.status(502).json({ error: `the ${job} job could not open a run` })
    return
  }
  const run = opened.data

  const counts = { examined: 0, changed: 0 }
  const close = async (message, note) => {
    const { error } = await db
      .from('new_business_runs')
      .update({
        finished_at: new Date().toISOString(),
        examined: counts.examined,
        changed: counts.changed,
        error: message ? String(message).slice(0, ERROR_MAX) : null,
        note: note ? String(note).slice(0, NOTE_MAX) : null,
      })
      .eq('id', run.id)
    if (error) console.error('new business: run %s left open: %s', run.id, error.message)
  }

  try {
    const settings = await readSettings(db)
    const detail = (await work({ db, settings, counts })) ?? {}
    await close(detail.error, detail.note)
    response.status(200).json({ job, run: run.id, ...counts, ...detail })
  } catch (cause) {
    const message = cause?.message || String(cause)
    console.error('new business %s: %s', job, message)
    await close(message)
    response
      .status(502)
      .json({ job, run: run.id, ...counts, error: `the ${job} job did not complete` })
  }
}
