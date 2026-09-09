import { useState } from 'react'
import { Link } from 'react-router-dom'
import Mesh from '@components/mesh/Mesh'
import PriceFigures from '@components/conversion/PriceFigures'
import { GROUNDS } from '@constants/grounds'
import {
  BUILD_PRICE,
  MONTHLY_COVERS,
  MONTHLY_PRICE,
  PRICE_BASIS,
  QUOTED_SEPARATELY,
} from '@data/checkout/pricing'

const PAPER = GROUNDS.paper

// What the two figures do not stretch to. Each one is work somebody has to pay
// for, so it is named here rather than raised after a plan is agreed.
const NOT_INCLUDED = [
  {
    title: 'Logo Design and Photography',
    body: 'Both come from you. If neither exists yet, we can point you at the people who do that work.',
  },
  {
    title: 'Paid Ads (Google and Facebook)',
    body: 'No ad budget is spent here, and buying and running the campaigns is separate work with its own price. The tracking those campaigns run on is part of the build, and the search work in the monthly is organic.',
  },
  {
    title: 'Mailbox Fees',
    body: 'Business email is set up and moved across here. Google or Microsoft bills you for each mailbox at their own rate.',
  },
  {
    title: 'Your Other Software',
    body: 'The point of sale, the accounting, and the phone system stay yours to pay for. The site talks to them; it does not replace them.',
  },
]

// How money actually changes hands, in the order it happens.
const HOW_PAYING_WORKS = [
  {
    title: 'A Plan First',
    body: 'What is being built, what it includes, and what it costs, all in writing before any work starts.',
  },
  {
    title: 'Paid Up Front',
    body: `The ${BUILD_PRICE} is paid once, before the work begins. That is what books the time.`,
  },
  {
    title: 'Stripe Takes the Card',
    body: 'Checkout runs on Stripe. No card number is typed into this site, and none is kept here.',
  },
  {
    title: 'Month to Month',
    body: `The ${MONTHLY_PRICE} starts the day the build is paid for and goes on the same card each month. It stops when you say so.`,
  },
]

// The three things somebody reads after the figures, in the order they ask
// them: what the second number buys, what neither number covers, and how the
// money actually moves.
const LEAVES = [
  {
    key: 'covers',
    label: 'What the Monthly Covers',
    items: MONTHLY_COVERS,
    foot: QUOTED_SEPARATELY,
  },
  { key: 'excluded', label: 'Not Included', items: NOT_INCLUDED, foot: null },
  { key: 'paying', label: 'How Paying Works', items: HOW_PAYING_WORKS, foot: null },
]

// Four to a row at the top breakpoint, which divides all three leaves exactly.
const COLUMNS = { base: 1, sm: 2, lg: 4 }

/**
 * The figures, and the three things a reader asks straight after them.
 *
 * It is at the foot of the page because the sheet above it is the argument and
 * this is the conclusion, and it is one object rather than three sections
 * because a reader who has arrived here has already decided to look and does
 * not need three more headings to scroll past.
 *
 * The three leaves are all in the document. A leaf that is not open is marked
 * `hidden`, which takes it out of the reading order without taking it out of
 * what a crawler and an assistant read - and what is not covered is exactly the
 * half of a price page people arrive looking for.
 *
 * It closes on the two ways forward. The band at the foot of the page carries
 * them too, but a reader who has just read the price and decided has a whole
 * section of questions between them and it, and a decision that has to be
 * carried down a page is a decision that gets put off.
 */
export default function QuoteSheet() {
  const [open, setOpen] = useState(LEAVES[0].key)

  return (
    <div className="flex flex-col gap-10">
      <PriceFigures ground="paper" />
      <p className={`-mt-2 max-w-2xl text-[15px] leading-relaxed ${PAPER.body}`}>{PRICE_BASIS}</p>

      <div>
        <div
          role="tablist"
          aria-label="What else the figures cover"
          className={`mb-6 flex flex-wrap gap-2.5 border-b pb-6 ${PAPER.rule}`}
        >
          {LEAVES.map(leaf => {
            const active = leaf.key === open
            return (
              <button
                key={leaf.key}
                type="button"
                id={`leaf-tab-${leaf.key}`}
                role="tab"
                aria-selected={active}
                aria-controls={`leaf-panel-${leaf.key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setOpen(leaf.key)}
                className={`inline-flex min-h-[44px] items-center rounded-[var(--r-control)] px-4 text-[14px] font-semibold tracking-tight transition-colors duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] active:scale-[0.98] ${
                  active
                    ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)]'
                    : `${PAPER.body} ${PAPER.wash} shadow-[0_0_0_1px_var(--paper-hairline-strong)]`
                }`}
              >
                {leaf.label}
              </button>
            )
          })}
        </div>

        {LEAVES.map(leaf => (
          <div
            key={leaf.key}
            id={`leaf-panel-${leaf.key}`}
            role="tabpanel"
            aria-labelledby={`leaf-tab-${leaf.key}`}
            hidden={leaf.key !== open}
            className="animate-fade-in-up"
          >
            <Mesh items={leaf.items} ground="paper" columns={COLUMNS} as="ul">
              {(item, index, cell) => (
                <li
                  key={item.title}
                  className={`flex flex-col gap-3 p-6 sm:p-7 ${PAPER.surface} ${cell}`}
                >
                  <h3 className={`text-[16px] font-semibold tracking-tight ${PAPER.title}`}>
                    {item.title}
                  </h3>
                  <p className={`text-[14px] leading-relaxed ${PAPER.body}`}>{item.body}</p>
                </li>
              )}
            </Mesh>
            {leaf.foot && (
              <p className={`mt-5 max-w-2xl text-[15px] leading-relaxed ${PAPER.body}`}>
                {leaf.foot}
              </p>
            )}
          </div>
        ))}
      </div>

      <div
        className={`flex flex-col gap-4 border-t pt-9 sm:flex-row sm:items-center ${PAPER.rule}`}
      >
        <Link to="/start" className="btn btn-primary">
          Start a Project
        </Link>
        <Link to="/contact" className="btn btn-secondary">
          Ask a Question First
        </Link>
        <p className={`text-[14px] leading-relaxed sm:ml-4 ${PAPER.body}`}>
          The plan and the price come first. Nothing is paid until you have both in writing.
        </p>
      </div>
    </div>
  )
}
