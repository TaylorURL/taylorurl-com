/**
 * The desk as a whole rather than one seat at it: what everybody on the phones
 * has placed, reached and booked, over today, over the week, and over whatever
 * span somebody asked for.
 *
 * The shift next door answers for one person and one day, which is the right
 * answer for the person holding the phone and the wrong one for the person who
 * has to decide anything. Nobody schedules a morning off a single caller's
 * single day: a representative whose reach rate fell all week and a Tuesday
 * that was quiet across the whole desk look identical from inside one seat,
 * and they call for opposite responses. So the same three figures are counted
 * per person and per day, and the day is the unit both readings are built from.
 *
 * Central days, for the reason `callShift.js` is Central: the calls table
 * stamps in UTC, the desk works one set of office hours, and a bucket built on
 * UTC dates puts every call after six in the evening under tomorrow. That is
 * not a rounding error on a board that is read at the end of a shift - it is
 * the last two hours of the day missing from the day they happened in.
 *
 * The window is built by stepping back from noon rather than from midnight,
 * because two days a year are twenty-three and twenty-five hours long and a
 * step of exactly one day off midnight lands the wrong side of one of them:
 * the same date twice, or a date missing, in a list that has to have one entry
 * per day.
 *
 * Strings, numbers and pure functions. The endpoint assembles its answer out of
 * these and the management screen orders and renders that answer through the
 * same ones, so what the board draws and what the database was asked cannot
 * come apart.
 */

import { dayIn, instantOf } from '../../time/zone.js'
import { callsToday, countsOf, reachedOwner } from './callShift.js'
import { onPhone, presenceLive } from './callPresence.js'

/** A day, for stepping back through the window. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The spans the Team section offers, in the order the control draws them.
 *
 * Three rather than a date picker, because the questions a desk this size
 * actually asks are "how is today going", "how has the week gone" and "who has
 * been doing the work" - and a picker answers all three worse while asking for
 * two more decisions first.
 */
export const TEAM_RANGES = Object.freeze([
  Object.freeze({ id: 'today', days: 1, label: 'Today' }),
  Object.freeze({ id: 'week', days: 7, label: 'This Week' }),
  Object.freeze({ id: 'month', days: 30, label: '30 Days' }),
])

/** What the section opens on: the day somebody is standing in. */
export const DEFAULT_RANGE = 'today'

/** One of the three spans by its id, or the one the section opens on. */
export function rangeOf(id) {
  return (
    TEAM_RANGES.find(range => range.id === id) ??
    TEAM_RANGES.find(range => range.id === DEFAULT_RANGE)
  )
}

/**
 * A `days` asked for, as one of the three the answer is built for.
 *
 * Anything else reads as the widest rather than the narrowest, because a
 * request that arrived without a readable span is a request from something
 * that is not the console, and handing it one day of a thirty day board is a
 * quiet wrong answer where handing it the whole board is a slow right one.
 */
export function daysOf(value) {
  const asked = Number.parseInt(String(value ?? ''), 10)
  return TEAM_RANGES.some(range => range.days === asked) ? asked : 30
}

/** A span as a count of days, which is at least one of them. */
function spanOf(days) {
  const asked = Math.trunc(Number(days))
  return Number.isFinite(asked) && asked > 0 ? asked : 1
}

/**
 * The Central calendar days a span covers, oldest first, ending on today.
 *
 * @param {number} days How many days the span runs to, including today.
 * @param {Date|string|number} [now] The instant the span is being asked at.
 * @returns {string[]} `YYYY-MM-DD` keys, oldest first.
 */
export function windowDays(days, now = new Date()) {
  const span = spanOf(days)
  const noon = instantOf(dayIn(now), '12:00:00').getTime()
  const window = []
  for (let back = span - 1; back >= 0; back -= 1) {
    window.push(dayIn(new Date(noon - back * DAY_MS)))
  }
  return window
}

/**
 * The instant a span begins: midnight Central on its first day.
 *
 * This is what a read of the calls table is bounded by, and it is built from
 * the day key rather than by subtracting milliseconds from now, so the first
 * day of the window is whole rather than starting at whatever time of day the
 * request happened to arrive.
 *
 * @param {number} days
 * @param {Date|string|number} [now]
 * @returns {string} An ISO instant.
 */
export function windowStart(days, now = new Date()) {
  return instantOf(windowDays(days, now)[0], '00:00:00').toISOString()
}

/** A span's three figures before anything has been counted into them. */
function blank() {
  return { placed: 0, reached: 0, booked: 0 }
}

/** One call counted into a span. */
function count(span, reached, booked) {
  span.placed += 1
  if (reached) span.reached += 1
  if (booked) span.booked += 1
}

/** One call counted into a day's map for whoever placed it. */
function bump(under, userId) {
  under[userId] = (under[userId] ?? 0) + 1
}

/**
 * The order the board lists people in when nothing else decides it.
 *
 * A profile with no name sorts last rather than first, because a row reading
 * as an email address at the top of a board of colleagues is an account
 * somebody has not finished setting up, and the top of the board is the one
 * place it does not belong. Two of those are then settled by id, so the order
 * is the same on every read rather than whatever the driver happened to return.
 */
function byName(one, two) {
  const first = typeof one?.name === 'string' ? one.name.trim() : ''
  const second = typeof two?.name === 'string' ? two.name.trim() : ''
  if (first && second) return first.localeCompare(second)
  if (first) return -1
  if (second) return 1
  return String(one?.id ?? '').localeCompare(String(two?.id ?? ''))
}

/** Which of a person's three tallies a range id is read from. */
const SPAN_KEYS = Object.freeze({ today: 'today', week: 'week', month: 'range' })

/**
 * What the desk comes to, per person, over the whole set, and day by day.
 *
 * One pass over the calls rather than one pass per person per span. Three
 * people against a month of calls is nothing, but the same arithmetic is what
 * a board of a dozen over a year would run, and a scan per figure is the shape
 * that stops working without ever announcing that it has.
 *
 * `week` is the last seven Central days whatever the span is, because the
 * board answers it in every range: a manager looking at today still wants the
 * week behind it, and recomputing that from a second request would let the two
 * figures disagree for as long as the request took.
 *
 * `by_day` carries an entry for every day in the window including the ones
 * nothing happened on, so a chart drawn from it has a bar per day rather than
 * a bar per day that had calls - which is the difference between a quiet
 * Thursday being visible and being absent. The maps inside it leave out the
 * people who placed nothing, because a map of zeros is one entry per person
 * per day of the window and none of them draws anything.
 *
 * @param {Array<object>} calls Every call in the window, as the table holds them.
 * @param {Array<{id: string, name: string|null, role: string}>} people The desk.
 * @param {{now?: Date, days?: number}} [span]
 * @returns {{people: object[], totals: object, by_day: object[]}}
 */
export function teamCounts(calls, people, { now = new Date(), days = 30 } = {}) {
  const at = now instanceof Date ? now : new Date(now)
  const rows = Array.isArray(calls) ? calls : []
  const roster = (Array.isArray(people) ? people : []).filter(person => person?.id).sort(byName)

  const window = windowDays(days, at)
  const inWindow = new Set(window)
  const inWeek = new Set(windowDays(7, at))

  const tallies = new Map(
    roster.map(person => [person.id, { week: blank(), range: blank(), last_call_at: null }])
  )
  const byDay = new Map(window.map(day => [day, { day, placed: {}, reached: {}, booked: {} }]))

  for (const call of rows) {
    const who = call?.called_by
    const held = tallies.get(who)
    if (!held) continue
    const day = dayIn(call?.called_at)
    if (!day) continue
    const reached = reachedOwner(call?.outcome)
    const booked = call?.outcome === 'booked'
    if (inWeek.has(day)) count(held.week, reached, booked)
    if (!inWindow.has(day)) continue
    count(held.range, reached, booked)
    const entry = byDay.get(day)
    bump(entry.placed, who)
    if (reached) bump(entry.reached, who)
    if (booked) bump(entry.booked, who)
    // The last call in the span the figures are for, rather than the last one
    // on file. A row saying somebody rang at four o'clock on a board where
    // nothing they did is counted is a row that contradicts itself.
    const when = String(call?.called_at ?? '')
    if (when && when > String(held.last_call_at ?? '')) held.last_call_at = call.called_at
  }

  const answered = roster.map(person => {
    const held = tallies.get(person.id)
    // The caller's own day, counted exactly the way the call list counts it, so
    // the figures on the management screen and the figures on the call screen
    // are one reading rather than two that usually agree.
    const day = callsToday(rows, person.id, at)
    const counts = countsOf(day)
    return {
      id: person.id,
      name: person.name ?? null,
      role: person.role ?? null,
      today: {
        placed: counts.placed,
        reached: counts.reached,
        booked: counts.booked,
        first: counts.first,
        last: day[0]?.called_at ?? null,
        hours: counts.hours,
        outcomes: counts.outcomes,
      },
      week: held.week,
      range: held.range,
      last_call_at: held.last_call_at,
    }
  })

  return {
    people: answered,
    totals: {
      today: totalOf(answered.map(person => person.today)),
      week: totalOf(answered.map(person => person.week)),
      range: totalOf(answered.map(person => person.range)),
    },
    by_day: window.map(day => byDay.get(day)),
  }
}

/**
 * What a span came to across the desk.
 *
 * `callers` counts the people who placed at least one call rather than the
 * people on the roster, because the figure it sits beside is a rate the desk
 * worked at and dividing it by everybody who has an account makes a full day
 * by two people read as a bad day by four.
 */
function totalOf(spans) {
  return spans.reduce(
    (sum, one) => ({
      placed: sum.placed + one.placed,
      reached: sum.reached + one.reached,
      booked: sum.booked + one.booked,
      callers: sum.callers + (one.placed > 0 ? 1 : 0),
    }),
    { placed: 0, reached: 0, booked: 0, callers: 0 }
  )
}

/**
 * The share of calls that reached an owner, or null where nothing was placed.
 *
 * Null rather than nought, because nought per cent is a reading and no calls
 * is the absence of one, and a row that has not started reading as the worst
 * row on the board is how a board gets ignored on a Monday morning.
 *
 * @param {{placed: number, reached: number}} counts
 * @returns {number|null} 0..1
 */
export function reachRate(counts) {
  const placed = counts?.placed ?? 0
  if (!placed) return null
  return (counts?.reached ?? 0) / placed
}

/** A rate as it is printed, and the dash that stands for not having one. */
export function saidRate(rate) {
  return typeof rate === 'number' && Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : '--'
}

/**
 * A presence row as the board reads it, or null for an account that has never
 * opened the call screen.
 *
 * Null is a different answer from offline and the board says so in different
 * words: an account with no row has never signed in, and an account with an
 * old row was last seen at a time worth printing.
 *
 * Whether the row is live and whether it is on a call are decided here rather
 * than in the browser, for the reason `calls-desk.js` decides them on the
 * server: three consoles with three clocks otherwise draw three boards. The
 * business is left to the caller, because it is a second table and this file
 * does no reading.
 *
 * @param {object|null} row
 * @param {Date} [now]
 * @returns {{live: boolean, on_phone: boolean, business: null,
 *   on_phone_since: string|null, last_seen: string|null}|null}
 */
export function presenceOf(row, now = new Date()) {
  if (!row) return null
  const phone = onPhone(row, now)
  return {
    live: presenceLive(row, now),
    on_phone: phone,
    business: null,
    // A claim whose call has run past its ceiling reads as merely present, the
    // same way every other reader of that row reads it.
    on_phone_since: phone ? (row.on_phone_since ?? null) : null,
    last_seen: row.last_seen ?? null,
  }
}

/**
 * The order the staff list draws people in: you, then whoever has placed the
 * most in the span on screen, then by name.
 *
 * Your own row leads whatever your figures are. The board is read by the
 * person it is counting, and a list that buries their row under three others
 * makes them find themselves before they can read anything - and a list that
 * ranks them by output would make that search a public one.
 *
 * @param {object[]} people Rows as `teamCounts` answered them.
 * @param {string} youId
 * @param {string} [rangeId] One of the three spans.
 * @returns {object[]}
 */
export function orderPeople(people, youId, rangeId = DEFAULT_RANGE) {
  const span = SPAN_KEYS[rangeOf(rangeId).id]
  const rows = Array.isArray(people) ? people : []
  const you = rows.filter(row => row?.id === youId)
  const rest = rows
    .filter(row => row?.id !== youId)
    .sort((one, two) => (two[span]?.placed ?? 0) - (one[span]?.placed ?? 0) || byName(one, two))
  return [...you, ...rest]
}
