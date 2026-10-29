/**
 * triggers — puts businesses on the chains that fire on something that just
 * happened.
 *
 * What it does: takes a batch of businesses that are ready to be written to
 * and on no chain of their own, offers them to each trigger in turn, and
 * writes the first match onto the row. From there the send job treats them
 * like any other business: the chain they were put on decides which letters
 * they hear and on which days.
 *
 * The judging is not here. chainwork's adapters decide what counts as a broken
 * site, an empty listing, an outgrown builder, a business growing or one worth
 * asking again, and lib/outreach/triggers.js decides which businesses are
 * offered and what a match writes. This reads, sweeps, writes and reports.
 *
 * What it reads: `outreach_prospects`, the columns in `TRIGGER_COLUMNS`, and
 * the public home pages of the sites those rows name. No credentials.
 *
 * What it writes: the same rows - `chain`, `fault`, `fault_says`, `fault_at`,
 * `fault_checked_at` and `fault_payload`. Nothing else, and nothing at all to
 * a business already in a conversation: `movable` is what keeps a trigger from
 * interrupting one.
 *
 * What stops it: sourcing being switched off, since a trigger is sourcing by
 * another name - it decides who is written to next - and a studio that has
 * stopped looking for businesses has stopped looking for these too.
 *
 * Every run leaves a note saying how many businesses each trigger matched, so
 * a trigger that has quietly stopped matching anything is visible rather than
 * being a chain that simply never sends.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { runJob } from '../../lib/outreach/runtime.js'
import { readAll } from '../../lib/db/rows.js'
import {
  TRIGGER_BATCH,
  TRIGGER_COLUMNS,
  firstMatches,
  movable,
  patchFor,
  triggersFor,
} from '../../lib/outreach/triggers.js'

export const config = { maxDuration: 300 }

/** How long the whole sweep may take, which leaves the writes their own room. */
const SWEEP_BUDGET_MS = 230_000

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({
    request,
    response,
    job: 'triggers',
    work: async ({ db, settings, counts }) => {
      if (!settings.sourcing_enabled) {
        return { note: 'sourcing is switched off, so no business was put on a chain' }
      }

      const { rows } = await readAll(
        () =>
          db
            .from('outreach_prospects')
            .select(TRIGGER_COLUMNS)
            .is('chain', null)
            .is('contacted_at', null)
            .in('stage', ['enriched', 'audited', 'queued'])
            .order('updated_at', { ascending: true }),
        { max: TRIGGER_BATCH }
      )

      // Read again here rather than trusted from the query, because two of the
      // rules are about absence and a query that expressed all of them would
      // be a condition nobody could check against the sentence that explains it.
      const offered = rows.filter(movable)
      counts.examined = offered.length
      if (!offered.length) {
        return { note: 'no business was ready to be put on a chain' }
      }

      const began = Date.now()
      const swept = []
      const notes = []
      for (const trigger of triggersFor(async () => offered)) {
        if (Date.now() - began > SWEEP_BUDGET_MS) {
          notes.push(`${trigger.chain} was not reached before the run ran out of time`)
          continue
        }
        try {
          const found = await trigger.source.find({ now: new Date() })
          swept.push({ chain: trigger.chain, found })
          notes.push(`${trigger.chain} matched ${found.length}`)
        } catch (cause) {
          // One trigger failing says nothing about the others, the way one
          // refused search says nothing about the rest of the map.
          swept.push({ chain: trigger.chain, found: [] })
          notes.push(`${trigger.chain} failed: ${String(cause?.message ?? cause).slice(0, 120)}`)
        }
      }

      const matched = firstMatches(swept)
      const now = new Date()
      let written = 0
      for (const [id, { chain, payload }] of matched) {
        const { error } = await db
          .from('outreach_prospects')
          .update(patchFor(chain, payload, now))
          .eq('id', id)
          // Named again on the write, so a run that read the row before another
          // put it on a chain does not take the first one's answer back.
          .is('chain', null)
          .is('contacted_at', null)
        if (error) throw new Error(error.message)
        written += 1
      }
      counts.changed = written

      return { note: `${written} put on a chain · ${notes.join(' · ')}`.slice(0, 500) }
    },
  })
}
