import { m } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { INCLUDED_COUNT } from '@data/checkout/pricing'

const PAPER = GROUNDS.paper

// The three bands under it, in the order they are drawn. The figures are last
// on the page and first in most readers' heads, so the way straight to them is
// on the strip rather than at the end of a scroll.
const SHEETS = [
  { to: '#included', title: 'What You Get', meta: `${INCLUDED_COUNT} things included` },
  { to: '#tally', title: 'Compared to an Agency', meta: 'what they charge for this' },
  { to: '#figures', title: 'The Price', meta: 'both figures in full' },
]

/**
 * The sheet index: what is on the page, and the way straight to any of it.
 *
 * The hero has already stated both figures, so nothing here is being kept back
 * and this does not restate them. What it does is refuse to make the order
 * compulsory. A reader who wants the price in full can take the third row and
 * skip the argument entirely; a reader who wants the argument reads down. A
 * page that only allows one of those reads as a page withholding the other.
 */
export default function PriceRail() {
  return (
    <m.nav {...fadeInUp} aria-label="On this page" className={`border-b bg-paper ${PAPER.rule}`}>
      <ul className="container-rail grid gap-px sm:grid-cols-3">
        {SHEETS.map((sheet, index) => (
          <li key={sheet.to} className={`border-t sm:border-l sm:border-t-0 ${PAPER.rule}`}>
            <a
              href={sheet.to}
              className={`group flex min-h-[44px] items-center gap-4 py-5 transition-colors duration-200 ease-out-soft sm:px-6 ${PAPER.wash}`}
            >
              <span className={`font-mono text-[11px] tabular-nums tracking-tight ${PAPER.meta}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex flex-1 flex-wrap items-baseline gap-x-2.5">
                <span
                  className={`text-[15px] font-semibold tracking-tight transition-colors duration-200 group-hover:text-accent ${PAPER.title}`}
                >
                  {sheet.title}
                </span>
                <span className={`text-[13px] ${PAPER.meta}`}>{sheet.meta}</span>
              </span>
              <ArrowDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-y-0.5 ${PAPER.meta}`}
              />
            </a>
          </li>
        ))}
      </ul>
    </m.nav>
  )
}
