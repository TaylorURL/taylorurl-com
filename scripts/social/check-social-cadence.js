/**
 * Walks the slot search and checks each channel publishes on the cadence it declares.
 *
 * Buffer exposes no mutation that writes a channel's posting schedule, so the
 * cadence in `lib/social/buffer.js` is the only thing deciding when a post
 * goes out. That makes it a property of arithmetic rather than of a request,
 * and the way it fails is quiet: a slot placed on the wrong day still schedules
 * cleanly, still reports a healthy runway, and is only wrong to somebody
 * reading the Page a week later.
 *
 * So the search is run against a queue that already holds days, on both sides
 * of the daylight saving change, and the answers are checked against the two
 * things a cadence promises — the spacing between posts, and the hour on the
 * clock in Baytown.
 *
 *   npm run check:social-cadence
 */
import {
  CADENCE,
  HORIZON_DAYS,
  SLOT_HOUR,
  cadenceInWords,
  coversDays,
  freeSlots,
} from '../../lib/social/buffer.js'
import { ZONE } from '../../lib/outreach/sending/schedule.js'
import { fail, finish } from '../harness/checks.js'
import { localReading } from './local-reading.js'

// One date on each side of the daylight saving change. The slot is written in
// local time and Buffer is told an instant, so the two disagree by an hour for
// half the year and a cadence that only holds in summer looks correct all
// summer.
const STARTS = [
  { label: 'CDT', at: '2026-08-29T18:00:00Z' },
  { label: 'CST', at: '2026-12-15T18:00:00Z' },
  { label: 'across the change', at: '2026-10-28T18:00:00Z' },
]

const DAY = 24 * 60 * 60 * 1000
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * The gaps, in days, that a cadence's own days allow between one slot and the
 * next.
 *
 * A cadence naming several days no longer has one spacing. Tuesday and Friday
 * is three days and then four, and a check holding it to a single figure would
 * refuse the second gap every week. What it promises instead is that no two
 * slots sit closer than the days it names ever sit, which is this set.
 */
function allowedGaps(cadence) {
  if (!cadence.weekdays) return new Set([1])
  const days = [...cadence.weekdays].sort((a, b) => a - b)
  return new Set(days.map((day, index) => (days[(index + 1) % days.length] - day + 7) % 7 || 7))
}

for (const [service, cadence] of Object.entries(CADENCE)) {
  for (const { label, at } of STARTS) {
    const now = new Date(at)
    const where = `${service} ${label}`
    // The horizon is a number of days, so a twice-weekly channel has under a
    // third of the slots a daily one has inside it. Asking for a fixed count
    // would fail the slower cadence for being slower.
    const want = Math.min(5, Math.floor(HORIZON_DAYS / coversDays(cadence)))
    const slots = freeSlots(cadence, [], want, now)

    if (slots.length !== want) {
      fail(`${where}: asked for ${want} slots inside the horizon, got ${slots.length}`)
      continue
    }

    const readings = slots.map(localReading)

    for (const reading of readings) {
      if (reading.hour !== SLOT_HOUR) {
        fail(`${where}: slot on ${reading.date} reads ${reading.hour}:00, not ${SLOT_HOUR}:00`)
      }
      const wanted = cadence.weekdays?.map(day => WEEKDAYS[day])
      if (wanted && !wanted.includes(reading.weekday)) {
        fail(
          `${where}: slot on ${reading.date} is a ${reading.weekday}, ` +
            `not one of ${wanted.join(', ')}`
        )
      }
    }

    const gaps = allowedGaps(cadence)
    for (let index = 1; index < slots.length; index += 1) {
      // Measured between the local midnights rather than between the instants,
      // which is what makes a 23-hour day and a 25-hour day both count as one.
      const gap =
        (new Date(`${readings[index].date}T00:00:00Z`).getTime() -
          new Date(`${readings[index - 1].date}T00:00:00Z`).getTime()) /
        DAY
      if (!gaps.has(gap)) {
        fail(
          `${where}: ${readings[index - 1].date} to ${readings[index].date} is ${gap} days, ` +
            `not one of ${[...gaps].join(', ')}`
        )
      }
    }

    // Over a whole cycle the channel publishes what its days say it does. A
    // gap set alone would pass a queue that took the short gap every time.
    const cycle = cadence.weekdays?.length ?? 0
    if (cycle > 1 && readings.length > cycle) {
      const span =
        (new Date(`${readings[cycle].date}T00:00:00Z`).getTime() -
          new Date(`${readings[0].date}T00:00:00Z`).getTime()) /
        DAY
      if (span !== 7) {
        fail(`${where}: ${cycle} gaps span ${span} days, so the week does not close`)
      }
    }

    if (new Date(slots[0]) <= now) {
      fail(`${where}: first slot ${slots[0]} is not ahead of ${at}`)
    }

    // A day the channel already holds is a day the search has to pass over, or
    // promoting a draft doubles up on a slot instead of extending the queue.
    const held = [{ dueAt: slots[0] }, { dueAt: slots[2] }]
    const after = freeSlots(cadence, held, want - held.length, now)
    for (const taken of held) {
      if (after.includes(taken.dueAt)) {
        fail(`${where}: ${taken.dueAt} is already scheduled and was offered again`)
      }
    }
    if (after.length !== want - held.length) {
      fail(
        `${where}: ${want - held.length} free slots were wanted around a held queue, ` +
          `got ${after.length}`
      )
    }
  }

  // The metadata a post carries decides how Buffer renders it, and a key that
  // does not match the service is rejected at the point the queue is promoted
  // rather than when it is written.
  const keys = Object.keys(cadence.metadata)
  if (keys.length !== 1) {
    fail(`${service}: carries ${keys.length} metadata keys, expected exactly one`)
  }
}

await finish()

const summary = Object.entries(CADENCE)
  .map(([service, cadence]) => `${service} ${cadenceInWords(cadence)}`)
  .join(', ')
console.log(`social cadence holds at ${SLOT_HOUR}:00 ${ZONE}: ${summary}`)
