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
 * of the daylight saving change, for every cap the console allows. A run sends
 * the difference between what is due and what has gone, bounded by what one
 * invocation can finish, which is exactly what `api/outreach/send.js` computes.
 *
 * That bound is why the walk is the gate on the day's ceiling. The two figures
 * are independent — a day is spread over forty-one firings and a firing carries
 * a handful — and the arithmetic joining them is the schedule's. Raising either
 * past what the other can absorb ends the day short, and this is what counts
 * it.
 *
 *   npm run check:send-schedule
 */
import { capAppliesNow, dueBy, reachesMore, sendsOn } from '../lib/outreach/schedule.js'
import { DAILY_CAP_MAX, SEND_PER_RUN_MAX } from '../lib/outreach/limits.js'
import { sendWindow } from '../lib/outreach/queue.js'

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
  for (let cap = 1; cap <= DAILY_CAP_MAX; cap += 1) {
    const sent = walk(cap, date)
    const wanted = open ? cap : 0
    if (sent !== wanted) {
      failed += 1
      console.error(`${label} cap ${cap}: delivered ${sent}, wanted ${wanted}`)
    }
  }
}

/**
 * The same walk, with the cap moved partway through the day.
 *
 * `raiseAt` is the minute the console writes the larger figure at, and `defer`
 * is whether the write is held for tomorrow the way capAppliesNow says it
 * should be. Running the walk both ways is what puts a number on the difference
 * rather than asserting the rule against itself.
 */
function walkRaised(from, to, [year, month, day], raiseAt, defer) {
  let sent = 0
  let cap = from
  for (let minute = 0; minute < 24 * 60; minute += TICK_MINUTES) {
    const now = new Date(Date.UTC(year, month - 1, day, Math.floor(minute / 60), minute % 60))
    if (minute === raiseAt) cap = defer && !capAppliesNow(cap, to, now) ? cap : to
    if (!sendWindow(now).open) continue
    const owed = Math.max(Math.min(cap, dueBy(cap, now)) - sent, 0)
    sent += Math.min(owed, SEND_PER_RUN_MAX)
  }
  return sent
}

// The afternoon the raise lands in, in UTC minutes, which is 15:00 in Texas on
// a summer day. Late enough that the denser grid puts most of its extra slots
// behind the clock, which is the whole of the fault.
const RAISE_AT = 20 * 60
const RAISE_DAY = [2026, 8, 31]

// Held, the day delivers the cap it was laid out for and no more. This is the
// assertion the fix exists for.
const deferred = walkRaised(20, 40, RAISE_DAY, RAISE_AT, true)
if (deferred !== 20) {
  failed += 1
  console.error(`cap raised 20 to 40 mid-afternoon and held: delivered ${deferred}, wanted 20`)
}

// Applied at once, the same day runs past it. The number is not the point; that
// it is over the cap the morning was spaced by is, because every message above
// twenty went out in the hour after the write rather than in a slot of its own.
const applied = walkRaised(20, 40, RAISE_DAY, RAISE_AT, false)
if (applied <= 20) {
  failed += 1
  console.error(
    `cap raised 20 to 40 mid-afternoon and applied at once: delivered ${applied}, which is not\n` +
      '  the burst this is here to describe - check the walk still models the send job'
  )
}

// Lowering is the direction somebody reaches for to slow sending down, so it
// has to land on the day it is typed on.
for (const at of [0, 13 * 60, 20 * 60]) {
  const now = new Date(Date.UTC(RAISE_DAY[0], RAISE_DAY[1] - 1, RAISE_DAY[2], at / 60))
  if (!capAppliesNow(20, 12, now)) {
    failed += 1
    console.error(`a cap lowered from 20 to 12 at ${at / 60}:00 UTC was held; it should land now`)
  }
}

// Before the window opens nothing has been spent, so a raise is a plan for the
// day rather than a change to one and lands the same way.
const dawn = new Date(Date.UTC(RAISE_DAY[0], RAISE_DAY[1] - 1, RAISE_DAY[2], 12))
if (!capAppliesNow(20, 40, dawn)) {
  failed += 1
  console.error('a cap raised at 07:00 in Texas was held; nothing had gone out yet')
}

// The reach has to end before the window does, or the console offers a time no
// run is left to keep. Walking the window minute by minute is what catches a
// reach defined off the wrong end of it.
for (let minute = 13 * 60; minute <= 22 * 60; minute += 1) {
  const now = new Date(Date.UTC(RAISE_DAY[0], RAISE_DAY[1] - 1, RAISE_DAY[2], 0, minute))
  if (!reachesMore(now)) continue
  // A run at or after this moment, still inside the window, is what makes the
  // reach true. The cron fires on the quarter hour, so that is where to look.
  const next = Math.ceil(minute / TICK_MINUTES) * TICK_MINUTES
  const run = new Date(Date.UTC(RAISE_DAY[0], RAISE_DAY[1] - 1, RAISE_DAY[2], 0, next))
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
  `every cap from 1 to ${DAILY_CAP_MAX} delivers in full at ${SEND_PER_RUN_MAX} a run, on both\n` +
    '  sides of the clock change and on a Saturday, and a Sunday delivers nothing at all;\n' +
    '  a cap raised mid-afternoon is held to the next day and delivers no more than it was\n' +
    '  laid out for, a cap lowered lands at once, and the reach ends inside the window'
)
