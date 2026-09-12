import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCallDesk } from '@hooks/console/useCallDesk'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import { callerName, saidSince } from '@lib/outreach/prospects/callPresence.js'
import {
  DEFAULT_GOALS,
  GOAL_CEILING,
  GOAL_FLOOR,
  SHIFT_GOALS,
  callsLeft,
  finishAt,
  shiftOf,
  shiftShare,
} from '@lib/outreach/prospects/callShift.js'
import { HourChart, OutcomeChart } from '../Charts'
import { useStaff } from '../lib/context'
import { usePortalNav } from '../lib/nav'
import { callMoment } from '../lib/call'

// The counts and the board only. This screen never draws a business, so it asks
// for the smallest page the list will give it and reads the figures off the top
// of the answer.
const FILTERS = Object.freeze({ view: 'list', take: 25 })

/**
 * One of the three figures a shift is worked to.
 *
 * The only control on this screen that is typed rather than read, and typing is
 * why it holds its own draft. Everything else here is written on the change and
 * redrawn from what came back, which is right for a press and wrong for a
 * number: clearing forty to type sixty passes through an empty field, an empty
 * field is not a figure, and the figure that is not a figure is the studio's
 * own - so the field would snap to forty under the cursor.
 *
 * So the draft is what is on screen while the field is being typed in, and the
 * figure is written when the field is left. A number outside the two bounds is
 * pulled back to them on the way out rather than refused, because somebody who
 * typed 1000 meant a big number and not a refusal.
 */
function GoalField({ goal, had, onSet }) {
  const [draft, setDraft] = useState(null)
  const leave = () => {
    setDraft(null)
    const figure = Number.parseInt(String(draft ?? ''), 10)
    if (!Number.isFinite(figure)) return
    const held = Math.min(GOAL_CEILING, Math.max(GOAL_FLOOR, figure))
    if (held !== had) onSet(held)
  }
  return (
    <label className="staff-pick">
      <span className="staff-label">{goal.label}</span>
      <input
        type="number"
        inputMode="numeric"
        className="staff-input"
        min={GOAL_FLOOR}
        max={GOAL_CEILING}
        value={draft ?? had ?? ''}
        onChange={event => setDraft(event.target.value)}
        onBlur={leave}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}

/**
 * What the day has come to, and who else is working it.
 *
 * It reads and it does not act, which is the line between this screen and the
 * one next door: a representative controls the call screen and nothing else, so
 * the figures here are a reading rather than a set of controls. The goals
 * behind them are set on the account by whoever set the shift.
 *
 * The desk is on it because a representative who cannot see the colleague beside
 * them calls the business that colleague is on the phone with. The call screen
 * already refuses to hand them one that is held; this is where that becomes
 * something they can see rather than something that silently happens to them.
 *
 * @param {{Shell: React.ComponentType}} props
 */
export default function ShiftBoard({ Shell }) {
  const { token, userId, name } = useStaff()
  const nav = usePortalNav()
  const desk = useCallDesk({ token, userId, enabled: Boolean(token) })
  const feed = useCallsFeed({ token, enabled: Boolean(token), filters: FILTERS })

  const goals = desk.prefs?.goals ?? DEFAULT_GOALS
  const shift = useMemo(() => shiftOf(feed.data?.shift, goals), [feed.data?.shift, goals])
  const finish = useMemo(() => finishAt(shift), [shift])
  const left = callsLeft(shift)
  const callsSpent = shift.met.calls
  const totals = feed.data?.totals ?? null
  const nextBack = feed.data?.next_back ?? null

  // Everybody at the desk, this caller first. Reading your own row against the
  // others is the whole reason the board is here, and hunting for it in a list
  // sorted by who beat most recently is a board read twice.
  const board = useMemo(() => {
    const rows = desk.presence ?? []
    const mine = rows.filter(row => row.user_id === userId)
    return [...mine, ...rows.filter(row => row.user_id !== userId)]
  }, [desk.presence, userId])

  return (
    <Shell title="Management Center" back={{ to: nav.hrefFor('portal'), label: 'Portal' }}>
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

      {/* The three figures, each with its own bar under it. The bar is in the
          tile rather than in a section of its own: a bar and a figure saying one
          thing twice is two thirds of this screen spent on three numbers. */}
      <dl className="staff-figures">
        {SHIFT_GOALS.map(goal => (
          <div className="staff-figure" key={goal.id}>
            <dd>
              {shift[goal.of]}
              <span>of {shift.goals[goal.id]}</span>
            </dd>
            <dt>{goal.label}</dt>
            <div className="staff-track">
              <span
                // Amber where the calls are spent and this figure is not met,
                // which is the one thing a day's figures can say that the
                // figures alone do not: the dialing happened and the
                // conversations did not.
                data-behind={callsSpent && !shift.met[goal.id]}
                style={{ width: `${Math.round(shiftShare(shift, goal.id) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </dl>

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

      <div className="staff-cols staff-cols-even">
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
          {nav.sets ? null : (
            <p className="staff-read">Whoever set your shift sets the goals on your account.</p>
          )}
        </div>

        <div className="staff-part">
          <h3>Team</h3>
          {desk.loading ? (
            <p className="staff-read">Loading</p>
          ) : board.length ? (
            board.map(row => (
              <div className="staff-person" key={row.user_id}>
                <div className="staff-person-top">
                  <b>{row.user_id === userId ? 'You' : callerName(row)}</b>
                  <span className="staff-badge" data-tone={row.business ? 'accent' : 'plain'}>
                    {row.business ? 'On a Call' : 'Available'}
                  </span>
                </div>
                <p className="staff-read">
                  {row.business
                    ? `${row.business.name}${row.business.town ? `, ${row.business.town}` : ''}${
                        row.on_phone_since ? ` (${saidSince(row.on_phone_since)})` : ''
                      }`
                    : 'No lead open.'}
                </p>
              </div>
            ))
          ) : (
            <p className="staff-read">No one else is online.</p>
          )}
        </div>
      </div>

      {/* The three figures a day is read against, set where they are read. They
          are a fact about the person working the list rather than about the
          list, and they are kept on the account, so they are the same on
          whichever machine that account signs in from.

          Only on the portal the shift is set from. A representative reads the
          figures and never moves them: a target somebody can lower at four in
          the afternoon is not a target. */}
      {nav.sets && (
        <div className="staff-part">
          <h3>Shift Goals</h3>
          <div className="staff-picks">
            {SHIFT_GOALS.map(goal => (
              <GoalField
                key={goal.id}
                goal={goal}
                had={goals[goal.id]}
                onSet={figure => desk.savePrefs({ goals: { ...goals, [goal.id]: figure } })}
              />
            ))}
          </div>
          <p className="staff-read">
            What a day on the phone comes to. The Call Center counts your calls against the first of
            them as you go, and the figures above draw all three.
          </p>
        </div>
      )}

      <div className="staff-part">
        <Link className="staff-btn" to={nav.hrefFor('calls')}>
          Back to Calls
        </Link>
      </div>
    </Shell>
  )
}
