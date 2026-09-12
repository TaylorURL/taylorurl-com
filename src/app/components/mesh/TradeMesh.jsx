import { Link } from 'react-router-dom'
import Mesh from '@components/mesh/Mesh'
import { GROUNDS } from '@constants/grounds'

// The ring is the base one; only its side is stated. The mesh sits in a
// clipping shell, so a ring standing off an edge cell would be cut in half by
// it and is turned inward instead.
const CELL =
  'flex h-full w-full flex-col p-5 transition duration-200 ease-out-soft focus-visible:-outline-offset-2'

// The cell's own contents, which are what the press moves. The link draws the
// rules either side of it and has to hold them still, so the column inside it
// is a layer of its own rather than the link's own box.
const CONTENT = 'cell-press flex flex-1 flex-col justify-between gap-8'

/**
 * Trades on a ruled mesh, one cell per trade, each opening that trade's page.
 *
 * The columns follow the number of trades, so a set of six runs three across
 * and then six, and a set of five runs five. A cell carrying a summary needs
 * the room a card does, so the summary is what decides which of the two
 * densities the mesh takes.
 *
 * The mark is set in the cell's own ink rather than the accent, because a mark
 * and the name beside it are one object and a second colour on something this
 * small reads as two. The hover is the ground's wash and nothing else, which is
 * what the service cells on the same page do, so the two link meshes answer a
 * pointer the same way.
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
            <span className={CONTENT}>
              <Mark className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              <span className="flex flex-col gap-2">
                <span className="text-[13px] font-medium leading-snug">{trade.name}</span>
                {withSummary && (
                  <span className={`text-[12px] leading-snug ${tone.body}`}>{trade.needs[0]}</span>
                )}
              </span>
            </span>
          </Link>
        )
      }}
    </Mesh>
  )
}
