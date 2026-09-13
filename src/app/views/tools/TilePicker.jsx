import Mesh from '@components/mesh/Mesh'
import { GROUND } from './lib/ground'

// A choice drawn as a mesh cell. The ring is inset because the cell sits inside
// the mesh's clipping shell, where a ring drawn outside the border is cut off on
// every edge the cell shares with it.
const TILE =
  'flex min-h-[44px] flex-col gap-1 p-4 text-left transition duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)]'

/**
 * One setting out of a few, drawn as a mesh of tiles that each name an option
 * and say what picking it does.
 *
 * @param {object} props
 * @param {Array<{ id: string, label: string }>} props.options - The choices, in
 *   the order they are laid out.
 * @param {string} props.current - The id of the one picked.
 * @param {(id: string) => void} props.onPick - Picks an option by its id.
 * @param {(option: object) => string} props.describe - The line under an
 *   option's name.
 * @param {Record<string, number>} props.columns - Columns per breakpoint.
 */
export default function TilePicker({ options, current, onPick, describe, columns }) {
  return (
    <Mesh items={options} columns={columns}>
      {(option, index, cell) => {
        const chosen = option.id === current
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onPick(option.id)}
            aria-pressed={chosen}
            className={`${TILE} ${cell} ${
              chosen
                ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)]'
                : `${GROUND.surface} ${GROUND.title} ${GROUND.wash}`
            }`}
          >
            <span className="text-[13px] font-medium leading-snug">{option.label}</span>
            <span className={`text-[12px] leading-snug ${chosen ? '' : GROUND.body}`}>
              {describe(option)}
            </span>
          </button>
        )
      }}
    </Mesh>
  )
}
