import { Check } from 'lucide-react'
import Mesh from '@components/mesh/Mesh'

// The jobs sit two to a row from the first breakpoint with room for the pair,
// and every trade names four of them.
const COLUMNS = { base: 1, sm: 2 }

/**
 * What a trade's own site has to do, on a ruled mesh on paper, one ticked cell
 * per job.
 *
 * @param {{ needs: string[] }} props - The trade's `needs`, from
 *   `@data/towns-and-trades/trades`.
 */
export default function NeedMesh({ needs }) {
  return (
    <Mesh items={needs} ground="paper" columns={COLUMNS} as="ul">
      {(need, index, cell) => (
        <li
          key={need}
          className={`flex items-start gap-4 p-6 text-[15px] leading-snug text-ink-paper ${cell}`}
        >
          <Check
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
            strokeWidth={2}
            aria-hidden="true"
          />
          {need}
        </li>
      )}
    </Mesh>
  )
}
