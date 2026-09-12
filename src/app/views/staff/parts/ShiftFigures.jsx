import { SHIFT_GOALS, shiftShare } from '@lib/outreach/prospects/callShift.js'

/**
 * The three figures a day is worked to, each with its own bar under it.
 *
 * Two screens read them. The Management Center draws them as the page, wide and
 * three across, because reading the day is what that screen is for; the
 * Resources Center draws them stacked in the rail beside the handbook, because
 * somebody reading a script mid-shift still wants to know where they stand.
 *
 * They are one component rather than two copies for the reason everything else
 * in this folder is: a figure drawn twice is a figure that can be drawn two
 * different ways the first time either one is edited.
 *
 * The bar is in the tile rather than in a section of its own. A bar and a
 * figure saying the same thing twice is two thirds of a screen spent on three
 * numbers.
 *
 * @param {{shift: object, spent?: boolean}} props `spent` is whether the calls
 *   goal is already used up, which is the one thing the figures alone cannot
 *   say: the dialing happened and the conversations did not.
 */
export default function ShiftFigures({ shift, spent = false }) {
  return (
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
              data-behind={spent && !shift.met[goal.id]}
              style={{ width: `${Math.round(shiftShare(shift, goal.id) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </dl>
  )
}
