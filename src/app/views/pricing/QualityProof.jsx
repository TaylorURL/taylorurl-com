import Mesh from '@components/Mesh'
import CountUp from '@reactbits/CountUp/CountUp'
import { MAX_MS } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { CLIENT_PROJECTS, PORTFOLIO_AVERAGES } from '@data/portfolio'

const BAND = GROUNDS.band

// Three measured figures, all read off the portfolio rather than written here.
// A figure typed into a page about price is a figure nobody revisits when the
// thing it measures moves.
const PROOF = [
  { to: PORTFOLIO_AVERAGES.mobile, label: 'Average PageSpeed, Mobile' },
  { to: PORTFOLIO_AVERAGES.desktop, label: 'Average PageSpeed, Desktop' },
  { to: CLIENT_PROJECTS.length, label: 'Client Sites Live' },
]

const COLUMNS = { base: 1, sm: 3 }

/**
 * What the cheaper number actually buys, measured by somebody else.
 *
 * A page that sets its price against a figure five times larger raises the
 * question the figure raises: whether a fifth of the price is a fifth of the
 * site. Nothing in the comparison above answers that, and a comparison that
 * leaves it unanswered argues its own case badly - the reader is handed a
 * reason to believe the low number and no reason to believe the work.
 *
 * These are the answer, and none of them is this studio's opinion. Two are
 * Google's grade of the sites already live, re-measured every morning, and the
 * third is how many of them there are.
 */
export default function QualityProof() {
  return (
    <div className="mt-14 flex flex-col gap-6">
      <p className={`section-label ${BAND.title}`}>How These Sites Score on Google</p>
      <Mesh items={PROOF} ground="band" columns={COLUMNS}>
        {(figure, index, cell) => (
          <div key={figure.label} className={`flex flex-col gap-3 p-7 ${BAND.surface} ${cell}`}>
            <p className={`display-3 font-mono font-semibold leading-none ${BAND.title}`}>
              <CountUp to={figure.to} duration={MAX_MS} />
            </p>
            <p className={`section-label-sm ${BAND.meta}`}>{figure.label}</p>
          </div>
        )}
      </Mesh>
      <p className={`max-w-2xl text-[15px] leading-relaxed ${BAND.body}`}>
        Those are Google’s own grades of the client sites already live, re-run on every one of them
        each morning. They are published per site on the portfolio, and the same work sits behind
        every one of them.
      </p>
    </div>
  )
}
