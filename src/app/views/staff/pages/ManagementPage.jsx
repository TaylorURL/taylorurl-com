import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCallDesk } from '@hooks/console/useCallDesk'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import { callerName, saidSince } from '@lib/outreach/prospects/callPresence.js'
import {
  DEFAULT_GOALS,
  SHIFT_GOALS,
  callsLeft,
  finishAt,
  shiftOf,
  shiftShare,
} from '@lib/outreach/prospects/callShift.js'
import StaffScreen from '../StaffScreen'
import { useStaff } from '../lib/context'
import { callMoment } from '../lib/call'

// The counts and the board only. This screen never draws a business, so it asks
// for the smallest page the list will give it and reads the figures off the top
// of the answer.
const FILTERS = Object.freeze({ view: 'list', take: 25 })

/**
 * What the day has come to, and who else is working it.
 *
 * It reads and it does not act, which is the line between this screen and the
 * one next door: a representative controls the call screen and nothing else, so
 * the three figures here are a reading rather than a set of controls. The goals
 * behind them are set in the console by whoever set the shift.
 *
 * The desk is on it because a representative who cannot see the colleague beside
 * them rings the business that colleague is on the phone with. The call screen
 * already refuses to hand them one that is held; this is where that becomes
 * something they can see rather than something that silently happens to them.
 */
export default function ManagementPage() {
  const { token, userId, name } = useStaff()
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
    <StaffScreen title="Management Center" back={{ to: '/staff', label: 'Portal' }}>
      <div className="staff-greet">
        <h2>{name ? name.split(' ')[0] : 'Your day'}</h2>
        <p className="staff-mute">
          {feed.loading
            ? 'Reading the day.'
            : left
              ? `${left} ${left === 1 ? 'call' : 'calls'} to go.`
              : 'Every figure met.'}
        </p>
      </div>

      {/* The three figures, each with its own reading under it. The bar is in the
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
                // figures alone do not: the dialling happened and the
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
          <h3>The Rest of the Day</h3>
          <dl className="staff-pairs">
            <div>
              <dt>Started</dt>
              <dd>{shift.first ? callMoment(shift.first) : 'Not yet'}</dd>
            </div>
            <div>
              <dt>Goal Met By</dt>
              <dd>
                {finish
                  ? callMoment(finish.toISOString())
                  : shift.met.calls
                    ? 'Met'
                    : 'Too early to say'}
              </dd>
            </div>
            <div>
              <dt>Ready to Call</dt>
              <dd>{totals ? totals.call : 'Reading'}</dd>
            </div>
            <div>
              <dt>Soonest Back</dt>
              <dd>{nextBack ? callMoment(nextBack) : 'None waiting'}</dd>
            </div>
          </dl>
          <p className="staff-read">
            The figures above are yours alone. Whoever set your shift sets them in the console, not
            here, so ask them if one of them looks wrong.
          </p>
        </div>

        <div className="staff-part">
          <h3>At the Desk</h3>
          {desk.loading ? (
            <p className="staff-read">Reading the desk.</p>
          ) : board.length ? (
            board.map(row => (
              <div className="staff-person" key={row.user_id}>
                <div className="staff-person-top">
                  <b>{row.user_id === userId ? 'You' : callerName(row)}</b>
                  <span className="staff-badge" data-tone={row.business ? 'accent' : 'plain'}>
                    {row.business ? 'On a Call' : 'At the Desk'}
                  </span>
                </div>
                <p className="staff-read">
                  {row.business
                    ? `${row.business.name}${row.business.town ? `, ${row.business.town}` : ''}${
                        row.on_phone_since ? ` (${saidSince(row.on_phone_since)})` : ''
                      }`
                    : 'Nothing held.'}
                </p>
              </div>
            ))
          ) : (
            <p className="staff-read">Nobody else has the list open.</p>
          )}
        </div>
      </div>

      <div className="staff-part">
        <Link className="staff-btn" to="/staff/calls">
          Back to Calling
        </Link>
      </div>
    </StaffScreen>
  )
}
