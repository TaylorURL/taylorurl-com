import Mesh from '@components/Mesh'
import { GROUNDS } from '@constants/grounds'
import { PRICE_FIGURES } from '@data/pricing'

// The two figures stand side by side from the first breakpoint that has room
// for a number this size, and the pair divides that width exactly.
const COLUMNS = { base: 1, sm: 2 }

/**
 * The two figures side by side: what the build starts at, and what the site
 * starts at to run after that. The configurator's price step and the pricing
 * page draw the same block, so the numbers are stated in one place and read the
 * same way wherever they appear.
 *
 * Each figure carries its prefix in the same line as the amount, at a smaller
 * size, so the floor reads as part of the number rather than as a footnote a
 * skimming reader can miss.
 *
 * @param {object} props
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the figures sit on.
 */
export default function PriceFigures({ ground = 'band' }) {
  const tone = GROUNDS[ground]

  return (
    <Mesh items={PRICE_FIGURES} ground={ground} columns={COLUMNS}>
      {(figure, index, cell) => (
        <div
          key={figure.term}
          className={`flex flex-col gap-5 p-8 sm:p-10 ${tone.surface} ${cell}`}
        >
          <p className="section-label-sm text-accent">{figure.term}</p>
          <p
            className={`display-1 flex items-baseline gap-2 font-semibold leading-none tracking-tightest ${tone.title}`}
          >
            {figure.prefix ? (
              <span className="text-[0.3em] font-medium tracking-tight opacity-70">
                {figure.prefix}
              </span>
            ) : null}
            {figure.amount}
          </p>
          <p className={`text-[15px] leading-relaxed ${tone.body}`}>{figure.note}</p>
        </div>
      )}
    </Mesh>
  )
}
