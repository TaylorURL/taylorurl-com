import { Link } from 'react-router-dom'
import Mesh from '@components/mesh/Mesh'
import { GROUNDS } from '@constants/grounds'

// The ring is the base one; only its side is stated. The mesh sits in a
// clipping shell, so a ring standing off an edge cell would be cut in half by
// it and is turned inward instead.
const CELL =
  'flex h-full w-full flex-col justify-between gap-8 p-5 transition duration-200 ease-out-soft focus-visible:-outline-offset-2'

/**
 * Trades on a ruled mesh, one cell per trade, each opening that trade's page.
 *
 * The columns follow the number of trades, so a set of six runs three across
 * and then six, and a set of five runs five. A cell carrying a summary needs
 * the room a card does, so the summary is what decides which of the two
 * densities the mesh takes.
 *
 * @param {object} props
 * @param {Array<object>} props.trades - Entries from `@data/towns-and-trades/trades`.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the mesh sits on.
 * @param {boolean} [props.withSummary] - Carries the first thing the site has
 *   to do into the cell, which is what makes the index read as a page rather
 *   than a list of names.
 */
export default function TradeMesh({ trades, ground = 'paper', withSummary = false }) {
  const tone = GROUNDS[ground]

  return (
    <Mesh items={trades} ground={ground} scale={withSummary ? 'card' : 'compact'}>
      {(trade, index, cell) => {
        const Mark = trade.mark
        return (
          <Link
            key={trade.id}
            to={`/industries/${trade.id}`}
            className={`${CELL} ${cell} ${tone.surface} ${tone.title} ${tone.wash}`}
          >
            <span className="flex items-center justify-between">
              <Mark className="h-5 w-5 text-accent" strokeWidth={1.5} aria-hidden="true" />
              <span aria-hidden="true" className={`section-label-sm ${tone.meta}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
            </span>
            <span className="flex flex-col gap-2">
              <span className="text-[13px] font-medium leading-snug">{trade.name}</span>
              {withSummary && (
                <span className={`text-[12px] leading-snug ${tone.body}`}>{trade.needs[0]}</span>
              )}
            </span>
          </Link>
        )
      }}
    </Mesh>
  )
}
