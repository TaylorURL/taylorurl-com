import Mesh from '@components/mesh/Mesh'
import { TRADES } from '@data/towns-and-trades/trades'

const CELL =
  'flex h-full w-full flex-col justify-between gap-8 p-5 transition duration-200 ease-out-soft'

const FOCUS =
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2'

/**
 * The columns the opening control runs at. The trades are a fixed register
 * rather than a set that can be divided, so the density is chosen for the cell
 * and the last cell takes whatever the final row is short.
 */
const COLUMNS = { base: 2, sm: 3, lg: 4, xl: 6 }

/**
 * The opening control: one radio per trade, laid out as a ruled mesh.
 *
 * The controls are real radios inside a fieldset named by the step's heading,
 * so the group carries one accessible name, arrow keys move through it, and
 * the checked trade survives a page the browser restores. The input itself is
 * taken out of the flow and the cell beside it takes the checked and focused
 * treatment, which keeps the hit area the whole cell.
 *
 * @param {{ selected: string | null, labelledBy: string,
 *   onSelect: (id: string) => void }} props
 */
export default function TradeGrid({ selected, labelledBy, onSelect }) {
  return (
    <fieldset aria-labelledby={labelledBy} className="m-0 border-0 p-0">
      <Mesh items={TRADES} ground="paper" columns={COLUMNS}>
        {(trade, index, cell) => {
          const Mark = trade.mark
          const checked = trade.id === selected
          return (
            <label key={trade.id} className={`relative flex cursor-pointer ${cell}`}>
              <input
                type="radio"
                name="trade"
                value={trade.id}
                checked={checked}
                onChange={() => onSelect(trade.id)}
                className="peer sr-only"
              />
              <span
                className={`${CELL} ${FOCUS} ${
                  checked
                    ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)] peer-focus-visible:outline-[color:var(--on-accent)]'
                    : 'bg-paper text-ink-paper hover:bg-[color:var(--wash-paper)] peer-focus-visible:outline-accent'
                }`}
              >
                <span className="flex items-center justify-between">
                  <Mark
                    className={`h-5 w-5 ${checked ? '' : 'text-accent'}`}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span
                    aria-hidden="true"
                    className={`font-mono text-[9px] tabular-nums tracking-tight ${
                      checked ? 'opacity-70' : 'text-paper-faint'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </span>
                <span className="text-[13px] font-medium leading-snug">{trade.name}</span>
              </span>
            </label>
          )
        }}
      </Mesh>
    </fieldset>
  )
}
