/**
 * Walks a day of send runs and checks the schedule delivers the whole cap.
 *
 * The send job is the one part of the outreach pipeline whose correctness is a
 * property of time rather than of a request, and the way it fails is quiet: a
 * slot placed too near closing time has no run left behind it, so the day ends
 * one message short and nothing reports an error. That is a full day of
 * capacity lost to arithmetic, found only by counting.
 *
 * So the day is simulated at the cadence the cron actually fires, on both sides
 * of the daylight saving change. A run sends the difference between what is due
 * and what has gone, bounded by what one invocation can finish, which is
 * exactly what `api/outreach/send.js` computes.
 *
 * That bound is why the walk is the gate on the day's ceiling. Nothing caps the
 * cap - a person sets it in the console at whatever figure they want - so the
 * day's real limit is the one this counts: the runs inside the window times
 * what a run carries, less the one run's worth the tail holds back. Above that
 * the schedule lays out slots the runs never reach, and the day ends short with
 * nothing reporting an error. So the walk asserts both halves: every cap up to
 * that figure lands in full, and every cap above it stops there rather than
 * running away.
 *
 *   npm run check:send-schedule
 */
import {
  DELIVERS_A_DAY,
  dueBy,
  reachesMore,
  sendsOn,
} from '../../../lib/outreach/sending/schedule.js'
import { SEND_PER_RUN_MAX } from '../../../lib/outreach/sending/limits.js'
import { sendWindow } from '../../../lib/outreach/sending/queue.js'

// The largest cap a day finishes in full. The tail holds slots out of the last
// stretch of the window, which costs the day the run that would have drained
// them, so this sits one run's worth under what the runs could carry between
// them. Derived rather than written down, so moving the window or the run's
// ceiling moves it too.
const FILLS = DELIVERS_A_DAY - SEND_PER_RUN_MAX

// The cron fires at this cadence (every ten minutes), so a slot is only reached by a run at or
// after it. Matching it here is what makes the walk a test of the real thing.
const TICK_MINUTES = 10

// One date on each side of the daylight saving change. The window is read in
// local time and the cron in UTC, so the two disagree by an hour for half the
// year and a schedule that only works in summer looks correct all summer.
//
// A Saturday and a Sunday sit alongside them because the two days are answered
// differently: Saturday delivers a full cap and Sunday delivers none. The slot
// arithmetic reads neither, so the pair is really a test of the gate the walk
// asks before every tick.
const DAYS = [
  { label: 'CDT', date: [2026, 8, 28] },
  { label: 'CST', date: [2026, 12, 15] },
  { label: 'CDT Sat', date: [2026, 8, 29] },
  { label: 'CST Sun', date: [2026, 12, 13] },
]

/**
 * How many messages a whole day of runs would actually deliver.
 *
 * A run takes what is due and has not gone, up to what it can finish. Anything
 * over that stays owed and the next run reaches for it again, so a walk that
 * ends short is a day whose slots were placed closer together than the runs
 * behind them could drain.
 */
function walk(cap, [year, month, day]) {
  let sent = 0
  for (let minute = 0; minute < 24 * 60; minute += TICK_MINUTES) {
    const now = new Date(Date.UTC(year, month - 1, day, Math.floor(minute / 60), minute % 60))
    if (!sendWindow(now).open) continue
    const owed = Math.max(Math.min(cap, dueBy(cap, now)) - sent, 0)
    sent += Math.min(owed, SEND_PER_RUN_MAX)
  }
  return sent
}

let failed = 0
for (const { label, date } of DAYS) {
  // A closed day owes nothing, so what it should deliver is nothing. Asserting
  // the zero rather than skipping the day is what makes a Sunday that starts
  // sending again a failure here instead of a Sunday morning somebody notices.
  const open = sendsOn(new Date(Date.UTC(date[0], date[1] - 1, date[2], 18)))
  for (let cap = 1; cap <= FILLS; cap += 1) {
    const sent = walk(cap, date)
    const wanted = open ? cap : 0
    if (sent !== wanted) {
      failed += 1
      console.error(`${label} cap ${cap}: delivered ${sent}, wanted ${wanted}`)
    }
  }

  // Above that a day ends short, and what matters is that it ends short at the
  // ceiling rather than anywhere else. A cap set past what the runs can carry
  // is a person asking for more mail than the window holds, and the answer is a
  // full day rather than an error - but a full day, not a burst past it.
  if (!open) continue
  for (const cap of [FILLS + 1, FILLS * 2, FILLS * 10]) {
    const sent = walk(cap, date)
    if (sent > DELIVERS_A_DAY) {
      failed += 1
      console.error(
        `${label} cap ${cap}: delivered ${sent}, past the ${DELIVERS_A_DAY} a day holds`
      )
    }
    if (sent < FILLS) {
      failed += 1
      console.error(`${label} cap ${cap}: delivered ${sent}, under the ${FILLS} a full day lands`)
    }
  }
}

/**
 * The same walk, with the cap moved partway through the day.
 *
 * A cap lands the moment it is saved, in either direction, so `raiseAt` is both
 * the minute the console writes the figure at and the minute it starts
 * governing. The walk is here to put a number on what that costs a day already
 * underway rather than to assert the rule against itself.
 */
function walkMoved(from, to, [year, month, day], movedAt) {
  let sent = 0
  let cap = from
  for (let minute = 0; minute < 24 * 60; minute += TICK_MINUTES) {
    const now = new Date(Date.UTC(year, month - 1, day, Math.floor(minute / 60), minute % 60))
    if (minute === movedAt) cap = to
    if (!sendWindow(now).open) continue
    const owed = Math.max(Math.min(cap, dueBy(cap, now)) - sent, 0)
    sent += Math.min(owed, SEND_PER_RUN_MAX)
  }
  return sent
}

// The afternoon the move lands in, in UTC minutes, which is 15:00 in Texas on
// a summer day. Late enough that a denser grid puts most of its extra slots
// behind the clock, which is where the catch-up comes from.
const MOVED_AT = 20 * 60
const MOVE_DAY = [2026, 8, 31]

// A raise mid-afternoon sends more today than the morning was laid out for. The
// slots above the old cap are already behind the clock by the time they appear,
// so they come out at the speed of a run rather than at the speed of the
// schedule, and the day still stops at the new cap.
const raised = walkMoved(20, 40, MOVE_DAY, MOVED_AT)
if (raised <= 20 || raised > 40) {
  failed += 1
  console.error(
    `cap raised 20 to 40 mid-afternoon: delivered ${raised}, wanted more than 20 and no more\n` +
      '  than 40 - check the walk still models the send job'
  )
}

// The catch-up is bounded by what a run carries, so the burst is a rate rather
// than a dump: no run sends more than SEND_PER_RUN_MAX however far behind the
// grid the clock has left it. Raising to a figure the day cannot reach at all
// is the case that proves it.
const far = walkMoved(20, FILLS * 4, MOVE_DAY, MOVED_AT)
if (far > DELIVERS_A_DAY) {
  failed += 1
  console.error(
    `cap raised 20 to ${FILLS * 4} mid-afternoon: delivered ${far}, past what a day holds`
  )
}

// Lowering mid-afternoon is the direction somebody reaches for to slow sending
// down, and a day that had already passed the new figure stops where it is
// rather than unsending anything.
const lowered = walkMoved(40, 12, MOVE_DAY, MOVED_AT)
if (lowered < 12) {
  failed += 1
  console.error(`cap lowered 40 to 12 mid-afternoon: delivered ${lowered}, under the 12 asked for`)
}

// The reach has to end before the window does, or the console offers a time no
// run is left to keep. Walking the window minute by minute is what catches a
// reach defined off the wrong end of it.
for (let minute = 13 * 60; minute <= 22 * 60; minute += 1) {
  const now = new Date(Date.UTC(MOVE_DAY[0], MOVE_DAY[1] - 1, MOVE_DAY[2], 0, minute))
  if (!reachesMore(now)) continue
  // A run at or after this moment, still inside the window, is what makes the
  // reach true. The cron fires on the quarter hour, so that is where to look.
  const next = Math.ceil(minute / TICK_MINUTES) * TICK_MINUTES
  const run = new Date(Date.UTC(MOVE_DAY[0], MOVE_DAY[1] - 1, MOVE_DAY[2], 0, next))
  if (!sendWindow(run).open) {
    failed += 1
    console.error(`reachesMore is true at ${minute} UTC minutes with no run left inside the window`)
    break
  }
}

// A Sunday reaches nothing, whatever the hour says.
const sunday = new Date(Date.UTC(2026, 11, 13, 18))
if (reachesMore(sunday)) {
  failed += 1
  console.error('reachesMore is true on a Sunday, when the day delivers nothing at all')
}

if (failed) {
  console.error(`\n${failed} check(s) do not match what the day owes`)
  process.exit(1)
}
console.log(
  `every cap from 1 to ${FILLS} delivers in full at ${SEND_PER_RUN_MAX} a run, on both sides\n` +
    '  of the clock change and on a Saturday, and a Sunday delivers nothing at all; a cap\n' +
    `  above it ends the day at ${FILLS} rather than running past ${DELIVERS_A_DAY}; a cap\n` +
    '  moved mid-afternoon lands on the same day in either direction without a run carrying\n' +
    `  more than ${SEND_PER_RUN_MAX}, and the reach ends inside the window`
)
