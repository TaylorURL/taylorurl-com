import { useState } from 'react'
import { GOAL_CEILING, GOAL_FLOOR, SHIFT_GOALS } from '@lib/outreach/prospects/callShift.js'

/**
 * The three figures a shift is worked to, as a row of fields.
 *
 * They sit apart from the screen that draws them because they are set in more
 * than one place now: the row of the person being edited on the team board, and
 * whatever sets a shift next. Three fields copied into a second screen is three
 * fields that can come to round a typed number two different ways the first time
 * either copy is edited.
 */

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
function GoalField({ goal, had, onSet, disabled }) {
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
        disabled={disabled}
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
 * All three, in the order a shift is read in.
 *
 * The change carries the whole set rather than the one figure that moved, for
 * the reason `goalsPatch` takes the whole set: the three are chosen together and
 * read together, and a write carrying one of them leaves the row holding two
 * figures somebody chose and one they did not.
 *
 * @param {{goals: {calls: number, reached: number, booked: number},
 *   onSet: (goals: {calls: number, reached: number, booked: number}) => void,
 *   disabled?: boolean}} props
 */
export default function GoalFields({ goals, onSet, disabled = false }) {
  return (
    <div className="staff-picks">
      {SHIFT_GOALS.map(goal => (
        <GoalField
          key={goal.id}
          goal={goal}
          had={goals?.[goal.id]}
          disabled={disabled}
          onSet={figure => onSet({ ...goals, [goal.id]: figure })}
        />
      ))}
    </div>
  )
}
