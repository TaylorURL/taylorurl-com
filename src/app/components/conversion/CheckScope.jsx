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
    <div>
      <h2 className={TYPE.h3}>{title}</h2>
      <CheckList items={items} className="mt-5" />
      {note && <p className={`${TYPE.small} mt-5 max-w-[40rem]`}>{note}</p>}
    </div>
  )
}
