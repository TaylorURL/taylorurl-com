/**
 * The shift: what a caller agreed to before they picked up the phone, what
 * they have against it, and when the sitting finishes at the rate it is going.
 *
 * The list next door counts one thing, and it is the wrong thing. "Four
 * thousand matching" is true at nine in the morning and true again at five,
 * because the pipeline finds businesses faster than three people can ring
 * them. A caller cannot have a good morning against a figure like that, so
 * nothing on the screen has ever been able to say the morning was good. Every
 * count the list carries is a count of what is left.
 *
 * Three figures rather than one, and the order is the argument.
 *
 * CALLS PLACED is the only one wholly in the caller's hands. It is the figure
 * to chase when nothing is landing, because it is the one that always can be.
 *
 * OWNERS REACHED is the one worth chasing. Forty calls that never got past a
 * receptionist is a worse morning than twenty that did, and the difference is
 * when you ring rather than how fast - which is a thing a caller can act on by
 * lunchtime.
 *
 * PLANS BOOKED is last because it is the one somebody else decides. A figure a
 * caller cannot move by working harder is a figure that punishes them for the
 * day the phone was full of people who already had a nephew who does websites.
 * It is here because it is what the shift is for, and it is third because it is
 * not what the shift is judged on.
 *
 * PACE IS A CLOCK TIME. Nobody converts one-point-four calls a minute into
 * anything while a phone is against their ear. "You finish at 4:40" is held
 * against the time they meant to leave, which is the only comparison anybody
 * actually makes.
 *
 * The day is Central, not the browser's. Three people work this list from one
 * office, the calls table stamps in UTC, and a console open in another zone
 * drawing a different day's figures would be two people disagreeing about
 * whether the morning happened.
 *
 * Strings, numbers and pure functions. This is imported into the browser
 * bundle beside `calls.js` and read on the server beside it too, so a database
 * handle or a network call here would break both.
 */

import { clockIn, dayIn } from '../../time/zone.js'

/**
 * The shift a caller works to before they have set one of their own.
 *
 * Reasoned rather than measured, and the reasoning is the same as the attempt
 * ladder's: nobody has data on whether forty is the right number, and a figure
 * that is stored per account is one anybody who disagrees can move in two
 * presses. Forty calls is a full day at the rate the desk actually works;
 * eight owners is what forty calls reaches when the timing is right; two plans
 * is what eight conversations come to on a good day.
 */
export const DEFAULT_GOALS = Object.freeze({ calls: 40, reached: 8, booked: 2 })

/**
 * The three figures, in the order they are drawn.
 *
 * `of` is which count on a shift each one is measured against, so the ring, the
 * label and the arithmetic all read one row rather than three restatements of
 * it.
 */
export const SHIFT_GOALS = Object.freeze([
  { id: 'calls', of: 'placed', label: 'Calls Placed', one: 'call', many: 'calls' },
  { id: 'reached', of: 'reached', label: 'Owners Reached', one: 'owner', many: 'owners' },
  { id: 'booked', of: 'booked', label: 'Plans Booked', one: 'plan', many: 'plans' },
])

/**
 * What a goal may be set to.
 *
 * A floor of one rather than nought, because a goal of nought is a goal met
 * before the day starts and every figure on the screen would read as done. The
 * ceiling is well past anything a person does in a day and exists so a typo
 * cannot store a figure the rings cannot draw.
 */
export const GOAL_FLOOR = 1
export const GOAL_CEILING = 500

/**
 * The outcomes that mean the owner was actually on the line.
 *
 * `gatekeeper` is not one of them, and that is the distinction the whole
 * middle figure rests on: a receptionist saying he is out on a job is a live
 * number and a real piece of work, and it is not a conversation with the person
 * who buys a website. Counting it would make the figure a second calls count
 * wearing a different label.
 *
 * `not_interested` is one of them. The owner heard it and said no, which is a
 * conversation that happened - the lead list next door already reads it that
 * way, and a shift that only counted the yeses would tell a caller their best
 * morning was the one where nobody picked up.
 *
 * `wrong_number` reaches nobody by definition.
 */
const REACHED_OUTCOMES = Object.freeze(['spoke', 'callback', 'booked', 'not_interested'])

/** Whether an outcome means somebody who could buy a website was on the line. */
function callReachedOwner(outcome) {
  return REACHED_OUTCOMES.includes(outcome)
}

/** A stored figure as one the rings can draw, or the studio's own. */
function goal(value, fallback) {
  const figure = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(figure)) return fallback
  return Math.min(GOAL_CEILING, Math.max(GOAL_FLOOR, figure))
}

/**
 * A stored row as the shift the console draws from, with all three figures
 * present whether or not the account has ever chosen any of them.
 */
export function normalizeGoals(stored) {
  const raw = stored && typeof stored === 'object' ? stored : {}
  return {
    calls: goal(raw.calls, DEFAULT_GOALS.calls),
    reached: goal(raw.reached, DEFAULT_GOALS.reached),
    booked: goal(raw.booked, DEFAULT_GOALS.booked),
  }
}

/**
 * What a change to the shift writes.
 *
 * Whole rather than by field, unlike its neighbours in `callPrefs.js`. The
 * three figures are set together in one dialog and they are read together by
 * everything that draws them, so a patch carrying one of them would leave the
 * row holding two figures somebody chose and one they did not.
 */
export function goalsPatch(sent) {
  return sent && typeof sent === 'object' ? normalizeGoals(sent) : null
}

/**
 * The calls one person placed on one day, newest first.
 *
 * `called_at` is the instant the call was recorded rather than the instant it
 * was placed, and those are the same to within the time it takes to press a
 * button. Nothing here needs them to be closer than that.
 */
export function callsToday(calls, userId, now = new Date()) {
  if (!Array.isArray(calls) || !userId) return []
  const today = dayIn(now)
  return calls
    .filter(call => call?.called_by === userId && dayIn(call.called_at) === today)
    .sort((one, two) => String(two.called_at ?? '').localeCompare(String(one.called_at ?? '')))
}

/**
 * What one caller's day comes to, before anybody says what it should have
 * come to.
 *
 * Split from the figures it is measured against because the two are known in
 * different places. The list endpoint already holds every call on file to rank
 * the list, so counting a day out of it is free - and it does not hold the
 * account's setup, which is the desk endpoint's row and is already on its way
 * to the same console. Reading the prefs row on every list poll would be a
 * query three times a minute to fetch three integers that change about once a
 * quarter.
 *
 * `first` is the instant the caller's day started rather than a clock time
 * somebody agreed to, because a shift that began when somebody said it would
 * is a shift that is behind before the first call.
 *
 * `hours` and `outcomes` are the same day read two more ways, off the same
 * pass: how many calls landed in each hour of the Central day, and how many
 * came to each outcome. They are what the management screen charts, and they
 * are counted here rather than there because the screen never sees the calls -
 * only the counts travel.
 *
 * @param {Array<object>} today The calls this caller placed today.
 * @returns {{placed: number, reached: number, booked: number, first: string|null,
 *   hours: {hour: number, calls: number}[], outcomes: Record<string, number>}}
 */
export function countsOf(today) {
  const rows = Array.isArray(today) ? today : []
  const stamps = rows.map(call => call?.called_at).filter(Boolean)
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, calls: 0 }))
  const outcomes = {}
  for (const call of rows) {
    const clock = clockIn(call?.called_at)
    if (clock) hours[clock.hour].calls += 1
    const came = String(call?.outcome ?? '')
    if (came) outcomes[came] = (outcomes[came] ?? 0) + 1
  }
  return {
    placed: rows.length,
    reached: rows.filter(call => callReachedOwner(call?.outcome)).length,
    booked: rows.filter(call => call?.outcome === 'booked').length,
    // Oldest last, because `callsToday` hands them back newest first.
    first: stamps.length ? stamps[stamps.length - 1] : null,
    hours,
    outcomes,
  }
}

/**
 * Those counts against the three figures this account set, which is the shift
 * as the rings draw it.
 *
 * @param {object} counts What `countsOf` returned.
 * @param {object} [goals] The figures they are working to.
 * @returns {{placed: number, reached: number, booked: number, first: string|null,
 *   hours: {hour: number, calls: number}[], outcomes: Record<string, number>,
 *   goals: object, met: {calls: boolean, reached: boolean, booked: boolean}}}
 */
export function shiftOf(counts, goals = DEFAULT_GOALS) {
  const had = counts && typeof counts === 'object' ? counts : {}
  const set = normalizeGoals(goals)
  return {
    placed: had.placed ?? 0,
    reached: had.reached ?? 0,
    booked: had.booked ?? 0,
    first: had.first ?? null,
    hours: Array.isArray(had.hours) ? had.hours : [],
    outcomes: had.outcomes && typeof had.outcomes === 'object' ? had.outcomes : {},
    goals: set,
    met: {
      calls: (had.placed ?? 0) >= set.calls,
      reached: (had.reached ?? 0) >= set.reached,
      booked: (had.booked ?? 0) >= set.booked,
    },
  }
}

/**
 * How far through one of the three a caller is, as a share of its goal.
 *
 * Capped at one, so a ring that is past its figure is a full ring rather than
 * an arc drawn twice round.
 */
export function shiftShare(shift, id) {
  const row = SHIFT_GOALS.find(one => one.id === id)
  if (!row || !shift) return 0
  const target = shift.goals?.[id] ?? 0
  if (!target) return 0
  return Math.min(1, Math.max(0, (shift[row.of] ?? 0) / target))
}

/** How many of the calls goal are still to place. */
export function callsLeft(shift) {
  return Math.max(0, (shift?.goals?.calls ?? 0) - (shift?.placed ?? 0))
}

/**
 * When the calls goal is met at the rate the day has actually gone, or null.
 *
 * Null in the three cases where a finish time would be a fiction: the goal is
 * already met, nothing has been placed yet, and only one call has - one call
 * establishes no rate at all, and dividing by the minute it took to place it
 * would put the finish somewhere in the next fortnight.
 *
 * @param {object} shift The sitting so far.
 * @param {Date} [now] The instant being asked about.
 * @returns {Date|null}
 */
export function finishAt(shift, now = new Date()) {
  const left = callsLeft(shift)
  if (!left || !shift?.first || (shift.placed ?? 0) < 2) return null
  const began = new Date(shift.first).getTime()
  const elapsed = now.getTime() - began
  if (!Number.isFinite(began) || elapsed <= 0) return null
  const each = elapsed / shift.placed
  return new Date(now.getTime() + left * each)
}
