import BlockHead from './BlockHead'
import Mesh from '@components/mesh/Mesh'
import PriceFigures from '@components/conversion/PriceFigures'
import { GROUND } from '../lib/ground'
import {
  MONTHLY_COVERS,
  MONTHLY_PRICE,
  PRICE_BASIS,
  QUOTED_SEPARATELY,
} from '@data/checkout/pricing'

// The four things the monthly pays for sit two to a row and then four, and
// four divides both exactly.
const COLUMNS = { base: 1, sm: 2, lg: 4 }

/**
 * The price step: the whole cost, in two numbers, and what the monthly buys.
 *
 * The step is reached only once a trade and a design are chosen, so the figures
 * always sit behind the work they pay for. Both figures and the four things the
 * monthly covers come from the shared price data the pricing page and the
 * service pages read, so a number cannot move on one surface and stay put here.
 */
export default function PriceSection() {
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-5">
        <PriceFigures ground="paper" />
        <p className={`text-[15px] leading-relaxed ${GROUND.body}`}>{PRICE_BASIS}</p>
      </div>

      <div>
        <BlockHead label="What the Monthly Covers" meta={MONTHLY_PRICE} />
        <Mesh items={MONTHLY_COVERS} ground="paper" columns={COLUMNS} as="ul">
          {(item, index, cell) => (
            <li key={item.title} className={`flex flex-col gap-3 p-6 ${GROUND.surface} ${cell}`}>
              <h4 className="text-[16px] font-semibold tracking-tight text-ink-paper">
                {item.title}
              </h4>
              <p className={`text-[14px] leading-relaxed ${GROUND.body}`}>{item.body}</p>
            </li>
          )}
        </Mesh>
        <p className={`mt-5 text-[15px] leading-relaxed ${GROUND.body}`}>{QUOTED_SEPARATELY}</p>
      </div>

      <p className={`text-[15px] leading-relaxed ${GROUND.body}`}>
        The build is paid for at the next step, before any work begins, and the monthly starts the
        same day.
      </p>
    </div>
  )
}
