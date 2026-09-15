/**
 * Proves the team board counts the desk the way the desk actually worked, and
 * that setting somebody's shift is a decision only a manager may take.
 *
 *   npm run check:call-team
 *
 * Every fault this guards against is a wrong number rather than a broken page,
 * which is the kind that gets believed. A board is opened to decide how a week
 * went and to see whose morning is going badly, and a figure that is quietly
 * out by a day or by a person reads exactly like a figure that is right.
 *
 * The day boundary is the first of them. The calls table stamps in UTC and the
 * desk works Central hours, so every call placed after six in the evening falls
 * under tomorrow to anything that reads the stamp as a date. A window built
 * that way ends on a day that has not happened yet and drops the evening that
 * has, and on a September evening in Texas the fault is live for six hours a
 * day and invisible for the other eighteen - which is why the cases here are
 * run at an instant where UTC has already rolled over and Central has not.
 *
 * The second is the arithmetic itself. Three readings of one set travel in one
 * payload - a person's own figures, the totals across the desk, and the chart's
 * day by day - and nothing on the screen can tell whether they were counted
 * from the same calls. So they are asserted against each other here: what the
 * people add up to is what the totals say, and what the days add up to is what
 * the span says.
 *
 * The third is the door. A representative is counted on this board and may read
 * it; deciding what a day should come to is the job of whoever asked them to
 * work it. That refusal is run rather than read, against a database stood in
 * for at the query, so a role check written the wrong way round fails here and
 * not in somebody's stored figures.
 */

import {
  DEFAULT_RANGE,
  TEAM_RANGES,
  daysOf,
  orderPeople,
  presenceOf,
  rangeOf,
  reachRate,
  saidRate,
  teamCounts,
  windowDays,
  windowStart,
} from '../../../lib/outreach/prospects/callTeam.js'
import { DEFAULT_GOALS, countsOf, callsToday } from '../../../lib/outreach/prospects/callShift.js'
import { PRESENCE_TTL_MS } from '../../../lib/outreach/prospects/callPresence.js'
import { dayIn, instantOf } from '../../../lib/time/zone.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'
import { read } from '../../harness/files.js'
import { setShift } from '../../../api/calls-team.js'

/**
 * The instant every case is run at.
 *
 * Half past eight in the evening Central on 15 September, which is half past
 * one in the morning UTC on the sixteenth. Every day key here is therefore a
 * key the naive reading would get wrong.
 */
const NOW = new Date('2026-09-16T01:30:00Z')
const TODAY = '2026-09-15'
const YESTERDAY = '2026-09-14'

const YOU = '11111111-1111-4111-8111-111111111111'
const THEM = '22222222-2222-4222-8222-222222222222'
const QUIET = '33333333-3333-4333-8333-333333333333'
const STRANGER = '44444444-4444-4444-8444-444444444444'

const DESK = [
  { id: THEM, name: 'Dylan Jordan', role: 'admin' },
  { id: YOU, name: 'Trenton Taylor', role: 'admin' },
  { id: QUIET, name: 'Pedro Miranda', role: 'staff' },
]

/** A call, at a Central clock reading on a Central day. */
const call = (userId, day, time, outcome = 'no_answer') => ({
  id: `${userId}-${day}-${time}`,
  called_by: userId,
  called_at: instantOf(day, time).toISOString(),
  outcome,
})

/**
 * A day's calls across the desk, written the way the evening actually went.
 *
 * The late ones matter: a call at nine in the evening Central is the next day
 * in UTC, and it is the row that decides whether the window, the day map and
 * the person's own figures were all built on the same reading of a day.
 */
const CALLS = [
  call(YOU, YESTERDAY, '10:00:00', 'spoke'),
  call(YOU, YESTERDAY, '11:00:00'),
  call(THEM, YESTERDAY, '14:00:00', 'booked'),
  call(YOU, TODAY, '09:15:00'),
  call(YOU, TODAY, '09:45:00', 'gatekeeper'),
  call(YOU, TODAY, '13:20:00', 'spoke'),
  call(YOU, TODAY, '20:10:00', 'booked'),
  call(THEM, TODAY, '16:00:00', 'not_interested'),
  call(THEM, TODAY, '20:30:00', 'wrong_number'),
  // Nobody on the desk placed this one, so nothing may count it.
  call(STRANGER, TODAY, '11:11:00', 'spoke'),
]

const counted = days => teamCounts(CALLS, DESK, { now: NOW, days })

/** One person's row out of an answer. */
const rowFor = (answer, userId) => answer.people.find(person => person.id === userId)

/* ── The window ─────────────────────────────────────────────────────────── */

check('the window ends on the Central day, not the day UTC has already reached', () => {
  const window = windowDays(30, NOW)
  same(window[window.length - 1], TODAY, 'the last day')
  same(window.length, 30, 'thirty days')
  same(window[0], '2026-08-17', 'the first day')
})

check('a window of one day is the day somebody is standing in', () => {
  same(windowDays(1, NOW).join(','), TODAY, 'today alone')
})

check('the window starts at midnight Central rather than midnight UTC', () => {
  // Central is five hours behind in September, so the first instant of the
  // window is five in the morning UTC on its first day.
  same(windowStart(7, NOW), '2026-09-09T05:00:00.000Z', 'the first instant')
  same(dayIn(windowStart(7, NOW)), '2026-09-09', 'which reads as its own day')
})

check('a window crossing the clocks going back has one entry per calendar day', () => {
  // The first Sunday in November is twenty-five hours long in Central. A window
  // stepped by exactly a day off midnight lands on the wrong side of it and
  // repeats a date; this one reads a day per day.
  const window = windowDays(7, new Date('2026-11-03T18:00:00Z'))
  same(
    window.join(','),
    '2026-10-28,2026-10-29,2026-10-30,2026-10-31,2026-11-01,2026-11-02,2026-11-03',
    'the week around the change'
  )
  same(new Set(window).size, 7, 'no day twice')
})

check('a window crossing the clocks going forward has one entry per calendar day', () => {
  const window = windowDays(7, new Date('2026-03-10T18:00:00Z'))
  same(
    window.join(','),
    '2026-03-04,2026-03-05,2026-03-06,2026-03-07,2026-03-08,2026-03-09,2026-03-10',
    'the week around the change'
  )
  same(new Set(window).size, 7, 'no day twice')
})

/* ── The spans a reader may ask for ─────────────────────────────────────── */

check('the three spans are the three the board can answer', () => {
  same(TEAM_RANGES.map(range => range.id).join(','), 'today,week,month', 'the ids')
  same(TEAM_RANGES.map(range => range.days).join(','), '1,7,30', 'the days behind them')
  same(rangeOf(DEFAULT_RANGE).days, 1, 'the section opens on today')
})

check('a span nothing offers reads as one that is offered', () => {
  same(rangeOf('fortnight').id, DEFAULT_RANGE, 'the fallback range')
  same(daysOf('7'), 7, 'a span asked for')
  same(daysOf(1), 1, 'and one asked for as a number')
  same(daysOf('90'), 30, 'a span nothing offers reads as the widest')
  same(daysOf(undefined), 30, 'and so does no span at all')
})

/* ── What the desk came to ──────────────────────────────────────────────── */

check("a person's own day is counted exactly as the call list counts it", () => {
  const answer = counted(30)
  const mine = rowFor(answer, YOU)
  // The same two functions `calls-admin.js` builds its `shift` from, so the
  // figure on the call screen and the figure on the board are one reading.
  const shift = countsOf(callsToday(CALLS, YOU, NOW))
  same(mine.today.placed, shift.placed, 'placed')
  same(mine.today.reached, shift.reached, 'reached')
  same(mine.today.booked, shift.booked, 'booked')
  same(mine.today.first, shift.first, 'when the day started')
  same(JSON.stringify(mine.today.hours), JSON.stringify(shift.hours), 'the hours')
  same(JSON.stringify(mine.today.outcomes), JSON.stringify(shift.outcomes), 'the outcomes')
})

check('a call placed in the Central evening belongs to the Central day', () => {
  const mine = rowFor(counted(30), YOU)
  // Four today, and the last of them is the one at ten past eight in the
  // evening, which UTC has already filed under tomorrow.
  same(mine.today.placed, 4, 'placed today')
  same(mine.today.last, instantOf(TODAY, '20:10:00').toISOString(), 'the last of them')
  same(mine.today.hours[20].calls, 1, 'counted in the eight o’clock hour')
})

check('a gatekeeper is a call placed and an owner not reached', () => {
  const mine = rowFor(counted(30), YOU)
  same(mine.today.reached, 2, 'the two who were actually on the line')
  same(mine.today.booked, 1, 'and the one who said yes')
})

check('everybody on the desk appears, whether or not they rang anybody', () => {
  const answer = counted(30)
  same(answer.people.length, 3, 'the whole desk')
  const quiet = rowFor(answer, QUIET)
  same(quiet.range.placed, 0, 'placed')
  same(quiet.last_call_at, null, 'and no last call')
})

check('a call from an account that is not on the desk is counted by nothing', () => {
  const answer = counted(30)
  ok(!rowFor(answer, STRANGER), 'no row for them')
  same(answer.totals.range.placed, 9, 'nine of the ten calls')
  const inDays = answer.by_day.reduce(
    (sum, day) => sum + Object.values(day.placed).reduce((a, b) => a + b, 0),
    0
  )
  same(inDays, 9, 'and nine across the days')
})

check('the people, the totals and the days are three readings of one set', () => {
  const answer = counted(30)
  for (const span of ['today', 'week', 'range']) {
    const added = answer.people.reduce((sum, person) => sum + person[span].placed, 0)
    same(answer.totals[span].placed, added, `${span} placed`)
    const reached = answer.people.reduce((sum, person) => sum + person[span].reached, 0)
    same(answer.totals[span].reached, reached, `${span} reached`)
    const booked = answer.people.reduce((sum, person) => sum + person[span].booked, 0)
    same(answer.totals[span].booked, booked, `${span} booked`)
  }
  const perDay = answer.by_day.reduce(
    (sum, day) => sum + Object.values(day.placed).reduce((a, b) => a + b, 0),
    0
  )
  same(perDay, answer.totals.range.placed, 'the days against the span')
})

check('the week is the last seven Central days whatever span was asked for', () => {
  const day = rowFor(counted(1), YOU)
  const month = rowFor(counted(30), YOU)
  same(day.week.placed, month.week.placed, 'one reading of the week')
  same(day.week.placed, 6, 'yesterday and today')
  same(day.range.placed, 4, 'while the span itself is today alone')
})

check('a span counts only the days inside it', () => {
  const answer = counted(1)
  same(answer.by_day.length, 1, 'one day')
  same(answer.by_day[0].day, TODAY, 'and it is today')
  same(answer.totals.range.placed, 6, 'the whole desk, today')
})

check('every day in the window is drawn, including the ones nothing happened on', () => {
  const answer = counted(30)
  same(answer.by_day.length, 30, 'a bar per day')
  same(answer.by_day[0].day, '2026-08-17', 'oldest first')
  same(answer.by_day[answer.by_day.length - 1].day, TODAY, 'ending today')
  const empty = answer.by_day.find(day => day.day === '2026-09-01')
  same(Object.keys(empty.placed).length, 0, 'a quiet day carries nobody')
})

check('a day map leaves out whoever placed nothing that day', () => {
  const answer = counted(30)
  const today = answer.by_day.find(day => day.day === TODAY)
  same(Object.keys(today.placed).sort().join(','), [THEM, YOU].sort().join(','), 'who rang')
  same(today.placed[YOU], 4, 'how many each')
  same(today.reached[THEM], 1, 'and how many reached an owner')
  ok(!(THEM in today.booked), 'nobody booked anything for them today')
  ok(!(QUIET in today.placed), 'and a quiet person is absent rather than nought')
})

check('the last call is the last one inside the span, never a later one', () => {
  same(rowFor(counted(1), THEM).last_call_at, instantOf(TODAY, '20:30:00').toISOString(), 'today')
  same(rowFor(counted(30), QUIET).last_call_at, null, 'and nothing where there were no calls')
})

check('the callers counted are the ones who placed something', () => {
  const answer = counted(30)
  same(answer.totals.today.callers, 2, 'two of the three worked today')
  same(answer.totals.range.callers, 2, 'and two over the span')
})

/* ── Reach rate ─────────────────────────────────────────────────────────── */

check('a reach rate is the share of calls that got an owner on the line', () => {
  same(reachRate({ placed: 4, reached: 1 }), 0.25, 'a quarter')
  same(saidRate(reachRate({ placed: 4, reached: 1 })), '25%', 'as it is printed')
  same(saidRate(reachRate({ placed: 3, reached: 1 })), '33%', 'rounded to whole points')
})

check('nothing placed is no rate at all rather than nought per cent', () => {
  same(reachRate({ placed: 0, reached: 0 }), null, 'no reading')
  same(saidRate(null), '--', 'and a dash where one would be printed')
  same(saidRate(reachRate(undefined)), '--', 'including for a row that carries nothing')
})

/* ── Presence ───────────────────────────────────────────────────────────── */

const seen = ago => new Date(NOW.getTime() - ago).toISOString()

check('an account that has never opened the call screen has no presence at all', () => {
  same(presenceOf(null, NOW), null, 'nothing rather than offline')
})

check('a row that has stopped beating is read as offline and still says when', () => {
  const row = {
    user_id: QUIET,
    prospect_id: null,
    on_phone_since: null,
    last_seen: seen(3 * 60_000),
  }
  const seat = presenceOf(row, NOW)
  same(seat.live, false, 'not here')
  same(seat.on_phone, false, 'and not on a call')
  same(seat.last_seen, row.last_seen, 'but last seen at a time worth printing')
})

check('a beating row holding a number reads as on a call', () => {
  const since = seen(4 * 60_000)
  const row = {
    user_id: YOU,
    prospect_id: '5f8a1c2e-5b47-4d18-9a02-7c51e8d3b940',
    on_phone_since: since,
    last_seen: seen(PRESENCE_TTL_MS / 2),
  }
  const seat = presenceOf(row, NOW)
  same(seat.live, true, 'here')
  same(seat.on_phone, true, 'and on a call')
  same(seat.on_phone_since, since, 'since the moment they picked it up')
  same(seat.business, null, 'the business is the endpoint’s to fill in')
})

/* ── The order the board lists people in ────────────────────────────────── */

check('your own row leads the list whatever your figures are', () => {
  const ordered = orderPeople(counted(30).people, QUIET, 'month')
  same(ordered[0].id, QUIET, 'the reader first, having placed nothing')
})

check('the rest are ranked by the span on screen, then by name', () => {
  const answer = counted(30)
  same(
    orderPeople(answer.people, YOU, 'today')
      .map(person => person.name)
      .join(','),
    'Trenton Taylor,Dylan Jordan,Pedro Miranda',
    'today'
  )
  // Over the week Dylan placed two and Trenton six, so the order behind the
  // reader is the same - and a reader who is not in it sees the ranking alone.
  same(
    orderPeople(answer.people, STRANGER, 'week')
      .map(person => person.name)
      .join(','),
    'Trenton Taylor,Dylan Jordan,Pedro Miranda',
    'this week'
  )
})

check('a profile with no name sorts last rather than at the top of the desk', () => {
  const answer = teamCounts(CALLS, [...DESK, { id: STRANGER, name: null, role: 'staff' }], {
    now: NOW,
    days: 30,
  })
  same(answer.people[answer.people.length - 1].id, STRANGER, 'the unnamed row')
  same(answer.people.map(person => person.name)[0], 'Dylan Jordan', 'and the rest by name')
})

/* ── The door ───────────────────────────────────────────────────────────── */

/**
 * The tables one case runs against, and what it wrote to them.
 *
 * The roster is answered at the query the endpoint actually makes, so a read
 * that narrowed to the wrong roles or forgot to narrow at all is a case that
 * fails here rather than a board that counts clients.
 */
function desk({ people = DESK } = {}) {
  const writes = []
  const asked = []
  const db = {
    from(table) {
      if (table === 'profiles') {
        return {
          select: columns => ({
            in(column, values) {
              asked.push({ columns, column, values })
              return {
                order: async () => ({
                  data: people.map(person => ({
                    id: person.id,
                    full_name: person.name,
                    role: person.role,
                  })),
                  error: null,
                }),
              }
            },
          }),
        }
      }
      if (table === 'outreach_call_prefs') {
        return {
          upsert: async row => {
            writes.push(row)
            return { error: null }
          },
        }
      }
      throw new Error(`these cases hold no table called ${table}`)
    },
  }
  return { db, writes, asked }
}

const ADMIN = { userId: YOU, email: 'trenton@taylorurl.com', role: 'admin' }
const STAFF = { userId: QUIET, email: 'pedro@taylorurl.com', role: 'staff' }

check('a representative is refused before anything is read', async () => {
  const stage = desk()
  const answer = await setShift(stage.db, STAFF, { user_id: QUIET, goals: DEFAULT_GOALS })
  same(answer.status, 403, 'refused')
  same(answer.body.error, 'Only an admin sets a shift.', 'the sentence')
  same(stage.writes.length, 0, 'nothing stored')
  same(stage.asked.length, 0, 'and nothing read to find that out')
})

check('an admin sets a shift, and only the three figures are written', async () => {
  const stage = desk()
  const answer = await setShift(stage.db, ADMIN, {
    user_id: QUIET,
    goals: { calls: 25, reached: 6, booked: 1 },
  })
  same(answer.status, 200, 'accepted')
  same(answer.body.ok, true, 'and says so')
  same(answer.body.user_id, QUIET, 'for the account it was set on')
  same(JSON.stringify(answer.body.goals), '{"calls":25,"reached":6,"booked":1}', 'the figures')
  same(stage.writes.length, 1, 'one row written')
  same(
    Object.keys(stage.writes[0]).sort().join(','),
    'goals,updated_at,user_id',
    'and nothing of how they have the list set up'
  )
})

check('an admin sets their own shift here too', async () => {
  const stage = desk()
  const answer = await setShift(stage.db, ADMIN, { user_id: YOU, goals: DEFAULT_GOALS })
  same(answer.status, 200, 'accepted')
  same(stage.writes[0].user_id, YOU, 'on their own account')
})

check('the roster a shift is held against is both roles and no others', async () => {
  const stage = desk()
  await setShift(stage.db, ADMIN, { user_id: YOU, goals: DEFAULT_GOALS })
  same(stage.asked[0].column, 'role', 'narrowed on the role')
  same(stage.asked[0].values.sort().join(','), 'admin,staff', 'to the two that work the list')
})

check('an account that is not on the desk is refused', async () => {
  const stage = desk()
  const answer = await setShift(stage.db, ADMIN, { user_id: STRANGER, goals: DEFAULT_GOALS })
  same(answer.status, 404, 'refused')
  same(answer.body.error, 'That account is not on the desk.', 'the sentence')
  same(stage.writes.length, 0, 'nothing stored')
})

check('an id that is not an id is refused the same way', async () => {
  const stage = desk()
  same((await setShift(stage.db, ADMIN, { user_id: 'nobody' })).status, 404, 'refused')
  same((await setShift(stage.db, ADMIN, {})).status, 404, 'and so is no id at all')
  same(stage.writes.length, 0, 'nothing stored')
})

check('a body that does not read as three figures is refused', async () => {
  const stage = desk()
  const answer = await setShift(stage.db, ADMIN, { user_id: YOU, goals: 'forty' })
  same(answer.status, 400, 'refused')
  same(answer.body.error, 'Set three figures for the shift.', 'the sentence')
  same(stage.writes.length, 0, 'nothing stored')
})

/* ── What the source has to say ─────────────────────────────────────────── */

const DOOR = read('api/calls-team.js')

check('the endpoint asks whether this site serves it before it does anything', () => {
  // The api gate check sweeps every handler for this, and it is asserted here
  // as well because the answer is specific to this file: a board that answered
  // on the subsidiary would read the studio's whole calls table from a
  // deployment that has no business holding it.
  const entry = DOOR.match(/export default (?:async )?function handler\(\w+, \w+\) \{\n([^\n]*)\n/)
  ok(entry, 'the handler entry reads as one')
  ok(entry[1].includes('servedHereOr404'), `the first line reads: "${entry[1].trim()}"`)
})

check('the board is never cached, because every figure on it is a figure as it stands', () => {
  ok(DOOR.includes("'Cache-Control', 'private, no-store'"), 'the header is set')
})

check('the calls read is totally ordered, because it pages', () => {
  ok(/\.order\('called_at'\)\s*\n\s*\.order\('id'\)/.test(DOOR), 'called_at then id')
})

check('the call list names a representative as well as an admin', () => {
  // The names on a call record and the owner of a business are read from one
  // list, and a representative left out of it is a call they placed drawn as
  // belonging to nobody. It is asserted from here because this board and that
  // list have to count the same desk.
  const list = read('api/calls-admin.js')
  ok(
    /\.in\('role', \['admin', 'staff'\]\)/.test(list),
    'callers() in calls-admin.js reads both roles'
  )
})

const passed = await finish({
  hint: 'The board is read to decide a week; a figure out by a day reads exactly like one that is right.',
})
console.log(`\ncall team: ${passed}/${cases.length} passed`)
