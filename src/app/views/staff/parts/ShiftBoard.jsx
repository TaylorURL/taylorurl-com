import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCallsTeam } from '@hooks/console/useCallsTeam'
import { DEFAULT_GOALS, SHIFT_GOALS } from '@lib/outreach/prospects/callShift.js'
import { DEFAULT_RANGE, TEAM_RANGES, rangeOf } from '@lib/outreach/prospects/callTeam.js'
import { HourChart, TeamDayChart } from '../Charts'
import TeamBoard, { TEAM_DAYS, TeamTotals } from './TeamBoard'
import { useStaff } from '../lib/context'
import { usePortalNav } from '../lib/nav'

/**
 * The desk, read as a whole.
 *
 * Everybody's day rather than the reader's own. The reader's own is on the call
 * screen, in the badge at the head of it, and beside the handbook in the rail;
 * a third drawing of it here would put one seat's figures at the top of the
 * one screen that exists to read all of them, and the screen would answer for
 * whoever happened to be signed in rather than for the desk.
 *
 * Four rows, laid out to the window on a desk and stacked on a phone. What the
 * span came to; when it came, by day across the desk and by hour across today;
 * and who it came from, one row each, which is also where a shift is set. The
 * charts take the room the other three leave, so the whole board is on screen
 * at once with nothing to scroll to - it is read at a glance between calls
 * and at the end of the day, and neither is a time for scrolling.
 *
 * The span is held in the address rather than in state, for the reason the
 * console holds its views there: a reload lands on the span the reader was
 * reading, and a link to the board pasted to somebody else opens on the same
 * one. The console already spends `view` on which screen is open, so the span
 * takes a key of its own and the tab row drops it on the way out - a span
 * chosen on this screen is not a question the call screen was asked.
 *
 * @param {{Shell: React.ComponentType}} props
 */

/** Which of the payload's three tallies each span's totals are read from. */
const SPAN_FOR = Object.freeze({ today: 'today', week: 'week', month: 'range' })

/** The desk's goals for today: everybody's own, added up. */
function goalsOf(people) {
  const sum = { calls: 0, reached: 0, booked: 0 }
  for (const person of people) {
    const goals = person.goals ?? DEFAULT_GOALS
    for (const goal of SHIFT_GOALS) sum[goal.id] += goals[goal.id] ?? 0
  }
  return sum
}

/** Every call today, by hour of the Central day, across everybody. */
function hoursOf(people) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, calls: 0 }))
  for (const person of people) {
    for (const slot of person.today?.hours ?? []) {
      if (hours[slot.hour]) hours[slot.hour].calls += slot.calls ?? 0
    }
  }
  return hours
}

/**
 * The one line under the title: who is here this minute, and what is left of
 * the desk's day.
 *
 * Both are said in one sentence because they are read together. Two people
 * available with forty calls to go is a desk on pace; two people available
 * with a hundred and forty to go is a desk that needs a third.
 */
function liveLine(people, goals) {
  const onPhone = people.filter(person => person.presence?.on_phone).length
  const free = people.filter(person => person.presence?.live && !person.presence.on_phone).length
  const placed = people.reduce((sum, person) => sum + (person.today?.placed ?? 0), 0)
  const left = Math.max(0, goals.calls - placed)

  const here = []
  if (free) here.push(`${free} available`)
  if (onPhone) here.push(`${onPhone} on a call`)
  const who = here.length ? here.join(', ') : 'Nobody is signed in'
  const togo = left
    ? `${left} ${left === 1 ? 'call' : 'calls'} to go across the desk.`
    : 'Every goal met.'
  return `${who}. ${togo}`
}

export default function ShiftBoard({ Shell }) {
  const { token } = useStaff()
  const nav = usePortalNav()
  const [params, setParams] = useSearchParams()
  const range = rangeOf(params.get('range'))

  const team = useCallsTeam({ token, enabled: Boolean(token), days: TEAM_DAYS[range.id] })
  const data = team.data
  const people = useMemo(() => data?.people ?? [], [data])
  const today = range.id === 'today'

  const goals = useMemo(() => goalsOf(people), [people])
  const hours = useMemo(() => hoursOf(people), [people])
  const counts = data?.totals?.[SPAN_FOR[range.id]]

  // Who may set a shift is the endpoint's answer rather than the shell's, so an
  // admin reading the board is an admin whichever door they came through. The
  // shell's own mark stands beside it for the moment before the board lands.
  const sets = data?.role === 'admin' || nav.sets

  const pick = id => {
    setParams(current => {
      const next = new URLSearchParams(current)
      if (id === DEFAULT_RANGE) next.delete('range')
      else next.set('range', id)
      return next
    })
  }

  return (
    <Shell layout="board">
      <div className="staff-board-head">
        <div className="staff-greet">
          <h2>The Desk</h2>
          <p className="staff-mute">
            {team.loading ? 'Loading' : team.error ? team.error : liveLine(people, goals)}
          </p>
        </div>

        <div className="staff-segmented" role="group" aria-label="Team Range">
          {TEAM_RANGES.map(one => (
            <button
              key={one.id}
              type="button"
              className="staff-tag"
              aria-pressed={one.id === range.id}
              onClick={() => pick(one.id)}
            >
              {one.label}
            </button>
          ))}
        </div>
      </div>

      <TeamTotals counts={counts} goals={today ? goals : null} loading={team.loading} />

      <div className="staff-cols staff-cols-even staff-board-charts">
        <div className="staff-part">
          <h3>
            Calls by Day<span>{range.label}</span>
          </h3>
          {data ? (
            <TeamDayChart days={data.by_day} people={data.people} fill />
          ) : (
            <p className="staff-read">{team.error ?? 'Loading'}</p>
          )}
        </div>
        <div className="staff-part">
          <h3>
            Calls by Hour<span>Today</span>
          </h3>
          <HourChart hours={hours} fill />
        </div>
      </div>

      <TeamBoard range={range} team={team} admin={sets} />
    </Shell>
  )
}
