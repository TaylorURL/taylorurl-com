import { CheckList } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'

/**
 * What a check reads, standing where the reading will land until a run starts
 * and `CheckProgress` takes its place.
 *
 * A ticked list under a small heading, with what the check leaves out said once
 * under it, so nobody reads a speed score as a ranking. A `ground` prop from a
 * caller written for the old ruled sections is accepted and ignored.
 *
 * @param {object} props
 * @param {string} props.title The list's heading.
 * @param {string[]} props.items One line for each thing the check reads.
 * @param {string} [props.note] What the check leaves out.
 */
export default function CheckScope({ title, items, note }) {
  return (
    // The heading stands to the left of the list on a wide screen and the
    // list runs in two columns, so the scope fills the width the tool's card
    // above it does rather than leaving the right of the page empty.
    <div className="grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <h2 className={TYPE.h3}>{title}</h2>
      <div>
        <CheckList
          items={items}
          className="sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-3.5 sm:space-y-0"
        />
        {note && <p className={`${TYPE.small} mt-5`}>{note}</p>}
      </div>
    </div>
  )
}
