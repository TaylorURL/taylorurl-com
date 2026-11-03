import { FIELD_LABEL } from '@constants/grounds'

// Written out in full, because the stylesheet is built by reading this file and
// a class put together at runtime is one it never sees.
const COLUMNS = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
}

/**
 * One setting out of a few, drawn as the choice tiles the Start page asks with.
 *
 * Each is a real radio: the input keeps the state, the focus and the arrow
 * keys, and the tile beside it is painted from that state, so a picked tile
 * takes the one blue ring the site allows and nothing else wears one.
 *
 * @param {object} props
 * @param {string} props.name - The group's name, and the legend over it.
 * @param {string} props.legend - What the group asks.
 * @param {Array<{ id: string, label: string }>} props.options - The choices, in
 *   the order they are laid out.
 * @param {string} props.current - The id of the one picked.
 * @param {(id: string) => void} props.onPick - Picks an option by its id.
 * @param {(option: object) => string} [props.describe] - The short fact under an
 *   option's name, where the name alone does not say what picking it does.
 * @param {1 | 2 | 3} [props.columns] - Columns from the small breakpoint up.
 */
export default function TilePicker({
  name,
  legend,
  options,
  current,
  onPick,
  describe,
  columns = 2,
}) {
  return (
    <fieldset>
      <legend className={FIELD_LABEL}>{legend}</legend>
      <div className={`grid gap-2.5 ${COLUMNS[columns] ?? COLUMNS[2]}`}>
        {options.map(option => (
          <label key={option.id} className="relative block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={option.id === current}
              onChange={() => onPick(option.id)}
              className="sr-only"
            />
            <span
              className={`choice-tile h-full ${describe ? 'flex-col !items-start gap-0.5 text-left' : ''}`}
            >
              <span>{option.label}</span>
              {describe && (
                <span className="text-[13px] font-normal leading-snug text-ink-mute">
                  {describe(option)}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
