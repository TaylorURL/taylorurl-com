import { SERVICE_LINES } from '@data/services'
import { EXTRA_SERVICES } from '@data/serviceDetail'
import { BUILD_PRICE, MONTHLY_PRICE } from '@data/pricing'
import { BLOCK_LABEL, GROUND } from './lib/ground'

/**
 * Every service the studio sells, in the order the services page sets them
 * out. Read from the two lists the menu and the service pages are built from,
 * so a service added, renamed or dropped there reaches the configurator with
 * them rather than being restated here and left behind.
 */
const SERVICES = [...SERVICE_LINES, ...EXTRA_SERVICES]

/**
 * What the configurator is for, before the first question.
 *
 * The route opens straight onto step one, which asks a visitor what type of
 * business they have without having said what the answer buys. Somebody who
 * arrived from an ad, a card or a search result then has to work through four
 * screens to find out whether this page sells the thing they came for.
 *
 * So the services are named at the top, in the words the menu and the service
 * pages already use. The point of naming all six rather than describing one is
 * that they are not six purchases: the build, the tools inside it, the hosting
 * and the search work are one project at one price, and the list is what makes
 * that legible at a glance.
 *
 * This holds the page's h1, which the first step used to hold. A heading that
 * changes as the frame moves is a page whose title depends on how far through
 * it somebody is, and the thing that does not change is what the page is for.
 */
export default function Preamble() {
  return (
    <div
      className={`mb-12 flex flex-col gap-8 border-b pb-8 lg:flex-row lg:items-start lg:justify-between lg:gap-16 lg:pb-10 ${GROUND.rule}`}
    >
      <div className="max-w-[42ch]">
        <h1
          className={`display-3 font-semibold leading-[1.05] tracking-tightest [text-wrap:balance] ${GROUND.title}`}
        >
          Everything I do, built into one website.
        </h1>
        <p className={`mt-6 text-[17px] leading-relaxed ${GROUND.body}`}>
          One project at one price: from {BUILD_PRICE} paid once for the build, then {MONTHLY_PRICE}{' '}
          a month that covers everything the site needs after it.
        </p>
      </div>

      <div className="lg:w-[32ch] lg:shrink-0">
        <p className={`${BLOCK_LABEL} mb-5`}>What It Covers</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {SERVICES.map(service => (
            <li key={service.name} className="flex gap-3">
              <span aria-hidden="true" className="mt-[11px] h-px w-3 shrink-0 bg-accent" />
              <span className={`text-[15px] leading-relaxed ${GROUND.title}`}>{service.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
