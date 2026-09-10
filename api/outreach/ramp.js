/**
 * The daily job that moves the sending cap.
 *
 * It runs before the sending window opens, reads the trailing hard-bounce
 * record, and writes daily_cap where lib/outreach/sending/ramp.js says it belongs. That
 * ordering is the whole design: a step taken at seven in the morning is a step
 * the entire day then runs at, so one step a day means every new level gets a
 * full day of its own before the next one is considered.
 *
 * The decision is not made here. This reads, calls, writes and reports; the
 * arithmetic is in lib/outreach/sending/ramp.js where it can be walked without a
 * database, and the figures behind it are in lib/outreach/sending/limits.js where the
 * console reads the same ones.
 *
 * Three states are written back and only when they change:
 *
 *   daily_cap          where the ramp put it
 *   ramp_floor         the highest cap a clean day has been read at
 *   ramp_halted_*      set by a rollback, cleared only in the console
 *
 * The last is what stops the climb resuming on its own. A rollback records the
 * moment and the reason, and every run after it holds against that record until
 * a person clears it.
 *
 * Every run leaves a note on its own row in outreach_runs whether or not the
 * cap moved, because a ramp that holds silently is as bad as one that stalls
 * silently. `examined` is the sends the decision was read over and `changed` is
 * one when the cap moved and zero when it did not.
 *
 * Nothing here sends mail or touches a prospect.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { bounceRecord } from '../../lib/outreach/sending/bounces.js'
import { decide } from '../../lib/outreach/sending/ramp.js'
import { runJob } from '../../lib/outreach/runtime.js'

// The deployment's own sending switch, which the console cannot reach. The send
// job stops at the transport while it is off, so days pass without adding to
// the record and there is nothing for the cap to climb on.
const ARMED = process.env.OUTREACH_SEND_ARMED === 'true'

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({
    request,
    response,
    job: 'ramp',
    work: async ({ db, settings, counts }) => {
      const record = await bounceRecord(db)

      const cap = settings.daily_cap ?? 0

      const verdict = decide({
        cap,
        floor: settings.ramp_floor ?? cap,
        steppedOn: settings.ramp_stepped_on ?? null,
        haltedAt: settings.ramp_halted_at ?? null,
        sending: Boolean(settings.sending_enabled) && ARMED,
        enabled: settings.ramp_enabled !== false,
        record,
      })

      counts.examined = verdict.reading.sent
      counts.changed = verdict.cap === cap ? 0 : 1

      if (verdict.action !== 'hold') {
        const patch = {
          daily_cap: verdict.cap,
          ramp_floor: verdict.floor,
          updated_at: new Date().toISOString(),
        }
        if (verdict.action === 'step') {
          // The local date the decision was taken on, taken from the decision
          // rather than from a clock here. The cap is counted in Texas time and
          // the function runs in UTC, so an evening run recording a UTC date
          // would stamp tomorrow and cost the ramp a day.
          patch.ramp_stepped_on = verdict.reading.today
        }
        if (verdict.halt) {
          patch.ramp_halted_at = new Date().toISOString()
          patch.ramp_halted_reason = verdict.note
        }

        const { error } = await db.from('outreach_settings').update(patch).eq('id', 1)
        // A cap that could not be written is the one condition this job has to
        // report as a fault: the note would otherwise say the cap moved while
        // the column still holds the old figure, and a rollback that did not
        // land is a domain left sending at the level that breached.
        if (error) throw new Error(`the cap could not be written: ${error.message}`)
      }

      return { action: verdict.action, note: verdict.note, ...verdict.reading, cap: verdict.cap }
    },
  })
}
