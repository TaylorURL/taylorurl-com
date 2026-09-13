import { GROUNDS } from '@constants/grounds'

/**
 * What a check reads, standing in the panel beside its form until a reading
 * starts and `CheckProgress` takes its place.
 *
 * @param {object} props
 * @param {string} props.title The panel's heading.
 * @param {string[]} props.items One line for each thing the check reads.
 * @param {string} props.note What the check leaves out.
 * @param {object} [props.ground] The ground the block is drawn on.
 */
export default function CheckScope({ title, items, note, ground = GROUNDS.paper }) {
  return (
    <div className={`p-8 ${ground.shell}`}>
      <p className="section-label-sm text-accent">{title}</p>
      <ul className={`mt-5 space-y-3 text-[15px] leading-relaxed ${ground.body}`}>
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className={`mt-6 text-[14px] leading-relaxed ${ground.meta}`}>{note}</p>
    </div>
  )
}
