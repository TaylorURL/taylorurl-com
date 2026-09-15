import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCallDesk } from '@hooks/console/useCallDesk'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import { useCallsTeam } from '@hooks/console/useCallsTeam'
import { DEFAULT_GOALS, callsLeft, finishAt, shiftOf } from '@lib/outreach/prospects/callShift.js'
import { DEFAULT_RANGE, TEAM_RANGES, rangeOf } from '@lib/outreach/prospects/callTeam.js'
import { HourChart, OutcomeChart } from '../Charts'
import ShiftFigures from './ShiftFigures'
import TeamBoard, { TEAM_DAYS } from './TeamBoard'
import { useStaff } from '../lib/context'
import { usePortalNav } from '../lib/nav'
import { callMoment } from '../lib/call'

// The counts and the board only. This screen never draws a business, so it asks
// for the smallest page the list will give it and reads the figures off the top
// of the answer.
const FILTERS = Object.freeze({ view: 'list', take: 25 })

/**
 * What the day has come to, and what the desk has.
 *
 * Two readings on one screen, and the order between them is the argument. Your
 * own day comes first because it is the one you can still do something about
 * before five o'clock; the desk comes after because it is what makes your day
 * mean anything - forty calls is a good morning or a thin one depending
 * entirely on what the other two people did.
 *
 * The span belongs to the desk alone. Your own figures are today's, always:
 * they are the shift you are working right now, and a control that could swap
 * them for a month's would make the tracks above them meaningless. What the
 * range moves is the board underneath, where the question actually is whether
 * this week went better than last.
 *
 * It is held in the address rather than in state, for the reason the console
 * holds its views there: a reload lands on the span the reader was reading, and
 * a link to the board pasted to somebody else opens on the same one. The
 * console already spends `view` on which screen is open, so the span takes a key
 * of its own and the tab row drops it on the way out - a span chosen on this
 * screen is not a question the call screen was asked.
 *
 * @param {{Shell: React.ComponentType}} props
 */
export default function ShiftBoard({ Shell }) {
  const { token, userId, name } = useStaff()
  const nav = usePortalNav()
  const [params, setParams] = useSearchParams()
  const range = rangeOf(params.get('range'))

  const desk = useCallDesk({ token, userId, enabled: Boolean(token) })
  const feed = useCallsFeed({ token, enabled: Boolean(token), filters: FILTERS })
  const team = useCallsTeam({ token, enabled: Boolean(token), days: TEAM_DAYS[range.id] })

  // The figures the day is read against, taken from the board where they are
  // now set. An admin who moves their own goal on a row below would otherwise
  // watch the tracks up here keep drawing against the figure they replaced,
  // until the desk's own poll came round and quietly corrected them. The desk
  // row is still the fallback, because it is what answers before the board has.
  const mine = team.data?.people?.find(person => person.id === team.data.you)
  const goals = mine?.goals ?? desk.prefs?.goals ?? DEFAULT_GOALS

  const shift = useMemo(() => shiftOf(feed.data?.shift, goals), [feed.data?.shift, goals])
  const finish = useMemo(() => finishAt(shift), [shift])
  const left = callsLeft(shift)
  const callsSpent = shift.met.calls
  const totals = feed.data?.totals ?? null
  const nextBack = feed.data?.next_back ?? null

  // Who may set a shift is the endpoint's answer rather than the shell's, so an
  // admin reading the board is an admin whichever door they came through. The
  // shell's own mark stands beside it for the moment before the board lands.
  const sets = team.data?.role === 'admin' || nav.sets

  const pick = id => {
    setParams(current => {
      const next = new URLSearchParams(current)
      if (id === DEFAULT_RANGE) next.delete('range')
      else next.set('range', id)
      return next
    })
  }

  return (
    <Shell>
      <div className="staff-greet">
        <h2>{name ? name.split(' ')[0] : 'Today'}</h2>
        <p className="staff-mute">
          {feed.loading
            ? 'Loading'
            : left
              ? `${left} ${left === 1 ? 'call' : 'calls'} to go.`
              : 'All goals met.'}
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

      <div className="staff-part">
        <h3>Your Day</h3>
        <ShiftFigures shift={shift} spent={callsSpent} />
      </div>

      <div className="staff-cols staff-cols-even">
        <div className="staff-part">
          <h3>Calls by Hour</h3>
          <HourChart hours={shift.hours} />
        </div>
        <div className="staff-part">
          <h3>Outcomes</h3>
          <OutcomeChart outcomes={shift.outcomes} />
        </div>
      </div>

      <div className="staff-part">
        <h3>Today</h3>
        <dl className="staff-pairs">
          <div>
            <dt>Started</dt>
            <dd>{shift.first ? callMoment(shift.first) : 'Not yet'}</dd>
          </div>
          <div>
            <dt>On Pace For</dt>
            <dd>
              {finish ? callMoment(finish.toISOString()) : shift.met.calls ? 'Met' : 'Too early'}
            </dd>
          </div>
          <div>
            <dt>Leads Available</dt>
            <dd>{totals ? totals.call : 'Loading'}</dd>
          </div>
          <div>
            <dt>Next Callback</dt>
            <dd>{nextBack ? callMoment(nextBack) : 'None'}</dd>
          </div>
        </dl>
        {sets ? null : (
          <p className="staff-read">Whoever set your shift sets the goals on your account.</p>
        )}
      </div>

      {/* The desk, over whichever span the control above was left on. The
          figures a person is worked to are set on their own row down there
          rather than in a form of its own at the foot of this screen: that form
          answered for one account, so the person who sets everybody's day had
          no way to set anybody's but their own. */}
      <TeamBoard range={range} team={team} admin={sets} />
    </Shell>
  )
}
