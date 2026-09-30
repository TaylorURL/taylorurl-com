/**
 * Looks for a site of their own on the new businesses that are due, and reads
 * whatever it finds for an email address and a phone number.
 *
 * A company is due when the week of its schedule comes round (1, 3, 6 and 10
 * weeks after it was formed) or when the daily domain lists have just matched
 * its name. Each check tries the matched domains first and then the guesses;
 * see lib/new-business/sites.js for what counts as proof.
 *
 * Where a check lands:
 *
 *   - An email address: 'emailable', and the send job writes to it.
 *   - A phone number and no address: 'phone_only', and the company is put on
 *     the call list through its row on outreach_prospects.
 *   - Neither: still 'waiting', due at its next week, or 'gave_up' after its
 *     last.
 *
 * It also reads back what the inbox watcher has learned about the companies
 * already written to - a reply, a bounce or an opt-out lands on the mirror row
 * - and carries the stage across, so the console reads one answer.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { mapWithLimit } from '../../lib/outreach/runtime.js'
import { mirror, mirroredStages, phoneOnlyRow } from '../../lib/new-business/mirror.js'
import { runNewBusinessJob } from '../../lib/new-business/runtime.js'
import { checkLead, nextCheckAt } from '../../lib/new-business/sites.js'

export const config = { maxDuration: 300 }

/** Companies one run checks. Most guesses fail at DNS in milliseconds. */
const BATCH = 300
const CONCURRENCY = 16

/** Stops starting checks with this much of the window left. */
const STOP_BEFORE_MS = 45_000

/** What the watcher's stage on a mirror row means on a lead. */
const FROM_WATCHER = {
  replied: 'replied',
  unsubscribed: 'unsubscribed',
  bounced: 'bounced',
  undeliverable: 'undeliverable',
}

async function followWatcher(db, counts) {
  const { data, error } = await db
    .from('new_business_leads')
    .select('id, prospect_id')
    .eq('stage', 'contacted')
    .not('prospect_id', 'is', null)
    .limit(1000)
  if (error) throw new Error(error.message)
  const stages = await mirroredStages(
    db,
    data.map(row => row.prospect_id)
  )
  let moved = 0
  for (const row of data) {
    const stage = FROM_WATCHER[stages.get(row.prospect_id)]
    if (!stage) continue
    const { error: written } = await db
      .from('new_business_leads')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (written) throw new Error(written.message)
    moved += 1
  }
  counts.changed += moved
  return moved
}

export async function work({ db, counts, now = new Date(), get = fetch, clock = Date.now }) {
  const began = clock()
  const followed = await followWatcher(db, counts)

  const { data: due, error } = await db
    .from('new_business_leads')
    .select('*')
    .eq('stage', 'waiting')
    .lte('next_check_at', now.toISOString())
    .order('next_check_at', { ascending: true })
    .limit(BATCH)
  if (error) throw new Error(error.message)

  const tally = { emailable: 0, phone_only: 0, waiting: 0, gave_up: 0 }
  await mapWithLimit(due, CONCURRENCY, async lead => {
    if (clock() - began > config.maxDuration * 1000 - STOP_BEFORE_MS) return
    counts.examined += 1
    const found = await checkLead(lead, get)
    const at = new Date().toISOString()
    const update = {
      checks: (lead.checks ?? 0) + 1,
      checked_at: at,
      updated_at: at,
      ...(found.website ? { website: found.website, site_found_by: found.found_by } : {}),
      ...(found.phone ? { phone: found.phone } : {}),
    }

    if (found.email) {
      Object.assign(update, {
        stage: 'emailable',
        email: found.email,
        email_source: found.email_source,
      })
    } else if (found.phone) {
      const prospectId = await mirror(db, phoneOnlyRow({ ...lead, ...update }))
      Object.assign(update, { stage: 'phone_only', prospect_id: prospectId })
    } else {
      const next = nextCheckAt(lead.formed_on, now)
      Object.assign(update, next ? { next_check_at: next } : { stage: 'gave_up' })
    }

    const { error: written } = await db.from('new_business_leads').update(update).eq('id', lead.id)
    if (written) throw new Error(written.message)
    counts.changed += 1
    tally[update.stage ?? 'waiting'] += 1
  })

  return {
    due: due.length,
    followed,
    ...tally,
    note: `Checked ${counts.examined} of ${due.length} due: ${tally.emailable} with an email, ${tally.phone_only} with a phone only, ${tally.gave_up} given up.`,
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runNewBusinessJob({ request, response, job: 'check', work })
}
