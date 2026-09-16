import { Fragment, useState } from 'react'
import { callerName, saidSince } from '@lib/outreach/prospects/callPresence.js'
import { SHIFT_GOALS, shiftOf, shiftShare } from '@lib/outreach/prospects/callShift.js'
import { orderPeople, reachRate, saidRate } from '@lib/outreach/prospects/callTeam.js'
import GoalFields from './GoalFields'
import { useDesk } from '../lib/surface'
import { callMoment } from '../lib/call'

/**
 * The desk, person by person, over one span.
 *
 * The screen this sits on is the whole desk rather than one seat at it. A
 * representative whose reach rate fell all week and a Tuesday that was quiet
 * across the whole desk look identical from inside one seat, and they call for
 * opposite responses; so the screen reads everybody, and this is the part of it
 * that says who.
 *
 * The totals and the chart the same payload feeds are drawn by the screen
 * above, as rows of its own, because the screen is laid out to the window and
 * decides which row gets the room that is left. What is here is the list, and
 * the list is also where a shift is set, for whoever may set one: the figures a
 * person is read against belong beside the figures they made.
 */

/**
 * How wide a window each span asks the endpoint for.
 *
 * `today` asks for a week rather than a day, and that is not a mistake. The
 * figures it draws come from the payload's own `today` tally, which is counted
 * whatever the window is; what the window decides is the chart, and one bar is
 * not a chart. A week behind today is what makes today readable.
 */
export const TEAM_DAYS = Object.freeze({ today: 7, week: 7, month: 30 })

/**
 * Which of a person's three tallies each span is read from.
 *
 * `month` reads `range`, which is the window the payload was actually taken
 * for; the other two are counted on every read whatever was asked for. The
 * library sorts the list by the same mapping, so the figures on a row and the
 * figure it was placed by are the same figure.
 */
const SPAN_FOR = Object.freeze({ today: 'today', week: 'week', month: 'range' })

/** The three figures, headed the way a column of them has room for. */
const SHORT = Object.freeze({ calls: 'Calls', reached: 'Reached', booked: 'Booked' })

/** What an account is, said once for the badge beside the name. */
function roleBadge(role) {
  return role === 'admin' ? { tone: 'accent', label: 'Admin' } : { tone: 'plain', label: 'Staff' }
}

/**
 * What somebody is doing this minute.
 *
 * Three states rather than the two the old presence list had, because that list
 * was the live rows and nothing else: everybody on it was by definition online.
 * This one is every account on the desk, so most of it is people who are not
 * here, and a board that cannot say so is a board that reads as a full desk at
 * eight in the evening.
 */
function statusOf(presence) {
  if (presence?.on_phone) return { tone: 'accent', label: 'On a Call' }
  if (presence?.live) return { tone: 'good', label: 'Available' }
  return { tone: 'plain', label: 'Offline' }
}

/** The same fact in a sentence: who they are with, or when they were last here. */
function statusLine(presence) {
  if (!presence) return 'Never signed in'
  if (presence.on_phone) {
    const held = presence.business
    // A claim whose business has since come off the list still says somebody is
    // on a call, because that is the fact the board exists to carry.
    const where = held ? [held.name, held.town].filter(Boolean).join(', ') : 'On a call'
    return presence.on_phone_since ? `${where} (${saidSince(presence.on_phone_since)})` : where
  }
  if (presence.live) return 'No lead open.'
  return presence.last_seen ? `Last seen ${callMoment(presence.last_seen)}` : 'Never signed in'
}

/** How the calls went, under the figures that say how many there were. */
function rateLine(shift, lastCall) {
  const when = lastCall ? `last call ${callMoment(lastCall)}` : 'no calls yet'
  return `Reach rate ${saidRate(reachRate(shift))}, ${when}`
}

/** The name on a row, and the reader's own row saying so. */
function PersonName({ person, you }) {
  const badge = roleBadge(person.role)
  return (
    <span className="staff-person-who">
      <b>{you ? 'You' : callerName(person)}</b>
      {you && <span className="staff-table-you">{callerName(person)}</span>}
      <span className="staff-badge" data-tone={badge.tone}>
        {badge.label}
      </span>
    </span>
  )
}

/**
 * The three figures somebody's day is set to, opened under their own row.
 *
 * The helper line names them, because on a board of four people an editor with
 * no name on it is three figures somebody is about to set for whoever they
 * think they pressed.
 */
function GoalEditor({ person, saving, onSet }) {
  return (
    <div className="staff-editor">
      <GoalFields goals={person.goals} disabled={saving} onSet={onSet} />
      <p className="staff-read">
        What a day on the phone comes to for {callerName(person).split(' ')[0]}.
      </p>
    </div>
  )
}

/** The control that opens one, which is the same control that shuts it. */
function GoalKey({ open, onToggle }) {
  return (
    <button type="button" className="staff-quiet" onClick={onToggle}>
      {open ? 'Done' : 'Edit Goals'}
    </button>
  )
}

/**
 * One person on a phone.
 *
 * A card rather than a ruled row, because it holds four different kinds of
 * statement - who they are, what they are doing, what they have done, and how
 * it went - and a hairline between people is not enough to keep those apart at
 * this width.
 */
function PersonCard({ person, you, span, today, admin, open, saving, onToggle, onSet }) {
  const shift = shiftOf(person[span], person.goals)
  const status = statusOf(person.presence)
  const spent = shift.met.calls

  return (
    <div className="staff-person-card">
      <div className="staff-person-top">
        <PersonName person={person} you={you} />
        <span className="staff-badge" data-tone={status.tone}>
          {status.label}
        </span>
      </div>
      <p className="staff-read">{statusLine(person.presence)}</p>
      <dl className="staff-mini">
        {SHIFT_GOALS.map(goal => (
          <div key={goal.id}>
            <dd>
              {shift[goal.of]}
              {/* The goal is a day's figure, so it only means anything beside a
                  day's count. Against a week it would read as a target somebody
                  missed by six hundred per cent. */}
              {today && <span>of {shift.goals[goal.id]}</span>}
            </dd>
            <dt>{SHORT[goal.id]}</dt>
            {today && (
              <div className="staff-track">
                <span
                  data-behind={spent && !shift.met[goal.id]}
                  style={{ width: `${Math.round(shiftShare(shift, goal.id) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </dl>
      <p className="staff-person-rate">{rateLine(shift, person.last_call_at)}</p>
      {admin && <GoalKey open={open} onToggle={onToggle} />}
      {admin && open && <GoalEditor person={person} saving={saving} onSet={onSet} />}
    </div>
  )
}

/**
 * The same person on a desk, as one row of a table.
 *
 * The whole reason for the second shape: three people's figures read against
 * each other down a column, which a stack of cards cannot do at any width.
 */
function PersonRow({ person, you, span, today, admin, open, saving, onToggle, onSet, columns }) {
  const shift = shiftOf(person[span], person.goals)
  const status = statusOf(person.presence)

  return (
    <Fragment>
      <tr>
        <td>
          <PersonName person={person} you={you} />
        </td>
        <td>
          <span className="staff-badge" data-tone={status.tone}>
            {status.label}
          </span>
          <p className="staff-person-rate">{statusLine(person.presence)}</p>
        </td>
        {SHIFT_GOALS.map(goal => (
          <td data-figure="true" key={goal.id}>
            {shift[goal.of]}
            {today && <span> / {shift.goals[goal.id]}</span>}
          </td>
        ))}
        <td data-figure="true" data-mono="true">
          {saidRate(reachRate(shift))}
        </td>
        <td data-mono="true">
          {person.last_call_at ? callMoment(person.last_call_at) : 'No calls yet'}
        </td>
        {admin && (
          <td>
            <GoalKey open={open} onToggle={onToggle} />
          </td>
        )}
      </tr>
      {admin && open && (
        <tr>
          <td colSpan={columns}>
            <GoalEditor person={person} saving={saving} onSet={onSet} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

/** The list at a desk, where there is room to line the figures up. */
function TeamTable({ people, you, span, today, admin, saving, editing, onToggle, onSet }) {
  // Name, Status, the three figures, the rate and the last call, and the goals
  // key where there is one. Counted from the set rather than written down, so
  // the editor's row still spans the table if a fourth figure is ever added.
  const columns = 4 + SHIFT_GOALS.length + (admin ? 1 : 0)
  return (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            {SHIFT_GOALS.map(goal => (
              <th data-figure="true" key={goal.id}>
                {SHORT[goal.id]}
              </th>
            ))}
            <th data-figure="true">Reach Rate</th>
            <th>Last Call</th>
            {admin && <th>Goals</th>}
          </tr>
        </thead>
        <tbody>
          {people.map(person => (
            <PersonRow
              key={person.id}
              person={person}
              you={person.id === you}
              span={span}
              today={today}
              admin={admin}
              saving={saving}
              columns={columns}
              open={editing === person.id}
              onToggle={() => onToggle(person.id)}
              onSet={goals => onSet(person.id, goals)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** And on a phone, one card each. */
function TeamCards({ people, you, span, today, admin, saving, editing, onToggle, onSet }) {
  return (
    <div className="staff-people">
      {people.map(person => (
        <PersonCard
          key={person.id}
          person={person}
          you={person.id === you}
          span={span}
          today={today}
          admin={admin}
          saving={saving}
          open={editing === person.id}
          onToggle={() => onToggle(person.id)}
          onSet={goals => onSet(person.id, goals)}
        />
      ))}
    </div>
  )
}

/**
 * What the desk came to over the span.
 *
 * Four figures rather than the day's three, and the fourth is the one that makes
 * the other three readable: two hundred calls is a good week by four people and
 * a remarkable one by two.
 *
 * On Today the three carry the desk's goal under them - every person's own,
 * added up - and a bar of how far along it is, because today is the one span
 * anybody can still do something about. A week is over; a target drawn against
 * it would read as one somebody missed by six hundred per cent.
 *
 * Nothing is stated until it has been read. A nought drawn while the request is
 * still out is a finding - nobody rang anybody - and it is replaced a second
 * later by the real one, which is the board appearing to change its mind.
 *
 * @param {{counts: object|null|undefined, goals: object|null, loading: boolean}} props
 *   `goals` is the desk's summed goals, handed in on Today and null otherwise.
 */
export function TeamTotals({ counts, goals, loading }) {
  const shift = goals ? shiftOf(counts, goals) : null
  const spent = Boolean(shift?.met.calls)
  const cards = [
    ...SHIFT_GOALS.map(goal => ({
      id: goal.id,
      label: goal.label,
      value: counts?.[goal.of],
      of: goals ? goals[goal.id] : null,
      share: shift ? shiftShare(shift, goal.id) : null,
      behind: spent && shift && !shift.met[goal.id],
    })),
    { id: 'callers', label: 'Callers Active', value: counts?.callers, of: null, share: null },
  ]
  return (
    <dl className="staff-figures" data-four="true">
      {cards.map(card => (
        <div className="staff-figure" key={card.id}>
          <dd>
            {loading ? <span className="staff-skeleton" aria-hidden="true" /> : (card.value ?? 0)}
            {card.of !== null && !loading && <span>of {card.of}</span>}
          </dd>
          <dt>{card.label}</dt>
          {card.share !== null && (
            <div className="staff-track">
              <span
                data-behind={card.behind || undefined}
                style={{ width: `${Math.round(card.share * 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </dl>
  )
}

/** The shape of the list before the list has landed, so the column holds still. */
function TeamWaiting() {
  return (
    <div className="staff-people">
      {[0, 1, 2].map(at => (
        <div className="staff-person-card" key={at} aria-hidden="true">
          <span className="staff-skeleton" data-wide="true" />
          <span className="staff-skeleton" />
          <span className="staff-skeleton" data-tall="true" />
        </div>
      ))}
    </div>
  )
}

/**
 * @param {{range: {id: string, label: string}, team: object, admin: boolean}} props
 *   `team` is the `useCallsTeam` reading, held by the screen above because the
 *   totals and the chart up there read the same answer.
 */
export default function TeamBoard({ range, team, admin }) {
  const [editing, setEditing] = useState(null)
  const desk = useDesk()

  const span = SPAN_FOR[range.id]
  const today = range.id === 'today'
  const data = team.data
  const people = data ? orderPeople(data.people, data.you, range.id) : []

  const toggle = id => setEditing(open => (open === id ? null : id))
  const set = (id, goals) => team.setGoals(id, goals)

  const list = { people, you: data?.you, span, today, admin, saving: team.saving, editing }

  return (
    <div className="staff-part staff-board-team">
      <h3>
        Team<span>{range.label}</span>
      </h3>

      {team.error ? (
        <p className="staff-read">{team.error}</p>
      ) : team.loading ? (
        <TeamWaiting />
      ) : desk ? (
        <TeamTable {...list} onToggle={toggle} onSet={set} />
      ) : (
        <TeamCards {...list} onToggle={toggle} onSet={set} />
      )}
    </div>
  )
}
