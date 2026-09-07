/**
 * When the day's messages go out, across the window rather than in a burst.
 *
 * The day's cap is spread over the hours the window is open, so a business
 * hearing from the studio at 09:12 and another at 14:40 are two people who
 * were written to, rather than two rows of one list processed in a minute.
 * Five messages leaving in the same second share a timestamp, and a shared
 * timestamp is the thing a filter reads first.
 *
 * Slots sit at the middle of equal divisions of the window, so the padding at
 * the start and the end matches and the last message never lands against
 * closing time. Each is then moved by an amount decided by the date and its own
 * position, which varies the gaps without changing what they average and
 * without moving once the day has started: the schedule has to be the same
 * answer at 08:05 and at 16:55, because every run of the job recomputes it.
 *
 * Nothing here reads a clock of its own. The caller passes the moment, which is
 * what lets a whole day be walked through in a test.
 */

import { instantOf, ZONE } from '../../time/zone.js'

// Carried through so a caller reading the window takes the zone from the same
// module it read the window from.
export { ZONE }

// The window, in minutes from midnight, in the zone the whole schedule is read
// in. The send job holds the same two hours as the gate that refuses a message
// outside them; these are what divide the space between.
const OPENS = 8 * 60
const CLOSES = 17 * 60

// The one day of the week no message leaves on, spelled the way `Intl` spells
// it. Saturday is a sending day: the trades this writes to are owner-run, and
// an owner reads mail on a Saturday morning as readily as on a Tuesday. Sunday
// is nobody's working day.
const CLOSED_DAY = 'Sun'

// How far a slot may be moved from its even position, as a share of the gap
// between slots. A third leaves any two slots at least a third of a gap apart,
// so the order never changes and no two can land together.
const DRIFT = 0.33

// How often the send job fires, which is what decides whether a slot in the
// past still has a run behind it. The cron in vercel.json is the real cadence;
// this is the same figure written where the schedule can reason about it.
const RUNS_EVERY = 10

// Minutes held back from the end of the window that no slot is placed in.
//
// A slot is only sent by a run that happens after it, so one placed in the last
// few minutes has no run left to catch it and is lost for the day. The reserve
// is wider than the gap between runs, which is what guarantees every slot has a
// run behind it while the window is still open.
const TAIL = 40

/** Minutes since midnight in `ZONE`, and the calendar date there. */
export function localDay(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const at = type => parts.find(part => part.type === type)?.value ?? '0'
  return {
    date: `${at('year')}-${at('month')}-${at('day')}`,
    minutes: (Number(at('hour')) % 24) * 60 + Number(at('minute')),
  }
}

/**
 * Whether the day an instant falls on is one messages leave at all.
 *
 * The window answers for a moment, which is the wrong question to put to a job
 * that runs before it opens: asked at seven whether it may send now, every day
 * of the week says no. This asks about the day instead, so the gate and the
 * ramp can read the same answer at different hours.
 *
 * @param {Date} [now]
 * @returns {boolean}
 */
export function sendsOn(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    weekday: 'short',
  }).format(now)
  return weekday !== CLOSED_DAY
}

/**
 * Whether the day has already begun putting messages out.
 *
 * Every slot in the day is a division of the window by the cap, so a cap that
 * moves moves all of them at once. Before the window opens that costs nothing:
 * no message has gone, and the new grid is simply the day's plan. Once it has
 * opened the grid is a record as much as a plan, because the hours behind it
 * were spent at the old spacing whatever the new one says they held. A denser
 * grid laid over a morning that has already happened reads as a queue of
 * messages that are late, and the job would answer that by sending them at
 * once, which is the burst the spreading exists to prevent.
 *
 * So this is the question the console asks before letting a cap rise: has
 * today already committed to a shape.
 *
 * @param {Date} [now]
 * @returns {boolean}
 */
export function beganSending(now = new Date()) {
  return sendsOn(now) && localDay(now).minutes >= OPENS
}

/**
 * Whether a cap just set can govern today, or has to wait for the morning.
 *
 * Lowering always lands: fewer slots is a day that runs into its ceiling
 * sooner, never one that owes messages it has not sent, and it is what somebody
 * reaches for when they want sending to slow down. Raising lands only on a day
 * that has not started, because on one that has, the extra slots are laid
 * across hours already behind the clock and come due the moment they appear.
 *
 * @param {number} inForce The cap the day is being spaced by.
 * @param {number} wanted The cap just set.
 * @param {Date} [now]
 * @returns {boolean}
 */
export function capAppliesNow(inForce, wanted, now = new Date()) {
  return wanted <= inForce || !beganSending(now)
}

/**
 * Whether a message can still leave today.
 *
 * A slot in the past is ordinarily the next run's to pick up, which is what
 * lets a missed run cost nothing rather than a message. After the last run of
 * the day has fired there is no next run, and that same past slot is a message
 * going nowhere until tomorrow. Nothing in the slot itself tells the two apart,
 * so the clock is asked instead.
 *
 * The last run that can deliver is the last one inside the window, which is why
 * the reach ends a run short of closing rather than at it.
 *
 * @param {Date} [now]
 * @returns {boolean}
 */
export function reachesMore(now = new Date()) {
  return sendsOn(now) && localDay(now).minutes <= CLOSES - RUNS_EVERY
}

/**
 * A number in [0, 1) decided entirely by what it is given.
 *
 * The drift has to survive being recomputed by every run of the job through
 * the day, so it cannot come from a random source. Seeding on the date and the
 * slot gives one answer per slot per day, and a different set tomorrow.
 */
function seeded(seed) {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 100000) / 100000
}

/**
 * The minutes past midnight each of the day's messages is due at.
 *
 * @param {number} cap How many go out today.
 * @param {string} date The local date, which the drift is seeded on.
 * @returns {number[]} One time per message, ascending.
 */
export function slotsFor(cap, date) {
  if (!Number.isFinite(cap) || cap <= 0) return []
  const step = (CLOSES - TAIL - OPENS) / cap
  return Array.from({ length: cap }, (_, index) => {
    const even = OPENS + step * (index + 0.5)
    const drift = (seeded(`${date}:${index}`) - 0.5) * 2 * DRIFT * step
    return Math.round(even + drift)
  })
}

/**
 * Midnight in `ZONE`, as the instant it happens at.
 *
 * The day's cap is counted from here and the slots are measured from here, so
 * the boundary is written once rather than derived again by each of them.
 *
 * @param {Date} [now] The moment whose day is wanted.
 * @returns {string} An ISO timestamp.
 */
export function dayStartsAt(now = new Date()) {
  return instantOf(localDay(now).date).toISOString()
}

/**
 * The day's slots as instants rather than as minutes past midnight.
 *
 * `slotsFor` answers in the wall clock the schedule is written in, which is
 * what the drift is seeded against. A reader is being told when a message
 * arrives, and that is a moment rather than a reading on a clock in Texas.
 *
 * @param {number} cap How many go out today.
 * @param {Date} [now] The moment whose day is wanted.
 * @returns {string[]} One ISO timestamp per message, ascending.
 */
export function slotsAt(cap, now = new Date()) {
  const { date } = localDay(now)
  const midnight = new Date(dayStartsAt(now)).getTime()
  return slotsFor(cap, date).map(minutes => new Date(midnight + minutes * 60000).toISOString())
}

/**
 * How many of the day's messages should have gone by now.
 *
 * The job sends the difference between this and what it has already sent, so a
 * run that was missed catches up on the next one rather than losing the slot,
 * and a run that fires twice in a minute sends nothing the second time.
 *
 * @param {number} cap The day's cap.
 * @param {Date} now The moment being asked about.
 * @returns {number} A count between 0 and the cap.
 */
export function dueBy(cap, now) {
  const { date, minutes } = localDay(now)
  return slotsFor(cap, date).filter(slot => slot <= minutes).length
}
