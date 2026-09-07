import { useRef, useState } from 'react'
import { m, useInView } from 'framer-motion'
import { EASE } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { MARKET } from '@data/checkout/pricing'

const BAND = GROUNDS.band

/** The runs the comparison is drawn over, in years. */
const TERMS = [1, 2, 3, 5]

/** Where it starts, which is long enough for the monthly to matter. */
const OPENING_TERM = 3

/** How many ticks the scale is divided into, the last one being the far end. */
const TICKS = 4

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const money = amount => MONEY.format(amount)

/**
 * The hatch on the far half of the elsewhere bar.
 *
 * A quote that lands anywhere between two figures is one bar with a firm end
 * and a soft one, and hatching is how a drawing says the extent past this point
 * is indicative. It is mixed from the ground's own ink so it reads at the same
 * weight on either setting, and it is written here rather than as a utility
 * because it is one gradient used in one place.
 */
const HATCH = {
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in srgb, var(--ink) 34%, transparent) 0 1.5px, transparent 1.5px 7px)',
}

/**
 * One bar on the scale, drawn to its share of the widest figure on the sheet.
 *
 * It has no width at all until the scale has been scrolled to, and then it
 * draws out from the left the way a dimension is struck on a drawing. After
 * that it answers the term buttons, so changing the run redraws the two bars
 * against each other rather than reloading the picture.
 */
function Bar({ share, drawn, className, style, delay = 0 }) {
  return (
    <m.span
      aria-hidden="true"
      style={style}
      className={className}
      initial={{ width: '0%' }}
      animate={{ width: drawn ? `${share * 100}%` : '0%' }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    />
  )
}

/**
 * What the same work costs elsewhere, set against what it costs here, over a
 * run of years the reader picks.
 *
 * One figure against another proves nothing on its own: a build quoted at five
 * thousand against a build quoted at one is a comparison anybody can dismiss as
 * two different things. A run of years is what makes it arithmetic instead -
 * both sides carry a monthly, both monthlies multiply out, and the gap is the
 * gap whichever end of either range the reader believes.
 *
 * The elsewhere side is drawn as a range with a hatched far end, because that
 * is what it is. Nothing here is anybody's price list, and the note under the
 * drawing says so rather than leaving the bar to imply a precision it does not
 * have.
 */
export default function MarketTally() {
  const [years, setYears] = useState(OPENING_TERM)
  const ref = useRef(null)
  const drawn = useInView(ref, { once: true, margin: '0px 0px 15% 0px' })

  const months = years * 12
  const low = MARKET.buildLow + MARKET.monthlyLow * months
  const high = MARKET.buildHigh + MARKET.monthlyHigh * months
  const here = MARKET.build + MARKET.monthly * months

  // Every bar is a share of the far end of the elsewhere range, so the widest
  // thing on the sheet fills it and the scale under them all is one scale.
  const share = amount => amount / high

  return (
    <div ref={ref} className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className={`section-label-sm ${BAND.meta}`}>Over</p>
        {TERMS.map(term => (
          <button
            key={term}
            type="button"
            aria-pressed={term === years}
            onClick={() => setYears(term)}
            className="chip tabular-nums"
          >
            {term} {term === 1 ? 'year' : 'years'}
          </button>
        ))}
      </div>

      <div className={`${BAND.shell} p-7 sm:p-10`}>
        <dl className="flex flex-col gap-9">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <dt className={`text-[15px] font-semibold tracking-tight ${BAND.title}`}>
                Quoted elsewhere
              </dt>
              <dd
                className={`display-6 font-semibold tabular-nums tracking-tightest ${BAND.title}`}
              >
                {money(low)} <span className={`text-[0.55em] font-medium ${BAND.meta}`}>to</span>{' '}
                {money(high)}
              </dd>
            </div>
            <div className="flex h-9 w-full items-stretch">
              <Bar
                drawn={drawn}
                share={share(low)}
                className="h-full shrink-0 rounded-l-[var(--r-control)] bg-[color:var(--ink-ghost)]"
              />
              <Bar
                drawn={drawn}
                share={1 - share(low)}
                delay={0.1}
                style={HATCH}
                className="h-full shrink-0 rounded-r-[var(--r-control)]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <dt className="text-[15px] font-semibold tracking-tight text-accent">Here</dt>
              <dd
                className={`display-6 font-semibold tabular-nums tracking-tightest ${BAND.title}`}
              >
                {money(here)}
              </dd>
            </div>
            <div className="flex h-9 w-full items-stretch">
              <Bar
                drawn={drawn}
                share={share(here)}
                delay={0.18}
                className="h-full shrink-0 rounded-[var(--r-control)] bg-accent"
              />
            </div>
          </div>
        </dl>

        {/* The scale both bars are struck against. Each division carries its
            own far edge, so a tick and the figure beside it name the same point
            on the rule rather than sitting a division apart. */}
        <div className={`mt-8 flex border-t pt-2.5 ${BAND.rule}`} aria-hidden="true">
          {Array.from({ length: TICKS }, (_, index) => (
            <span
              key={index}
              className={`flex-1 border-r pr-2 text-right font-mono text-[10px] tabular-nums tracking-tight ${BAND.rule} ${BAND.meta}`}
            >
              {money((high * (index + 1)) / TICKS)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-12">
        <p className={`max-w-2xl text-[15px] leading-relaxed ${BAND.body}`}>{MARKET.basis}</p>
        <p
          className={`shrink-0 text-[15px] leading-relaxed ${BAND.title} sm:max-w-[16rem] sm:text-right`}
        >
          <span className="font-semibold tabular-nums">
            {money(low - here)} to {money(high - here)}
          </span>{' '}
          <span className={BAND.body}>
            stays in the business over {years === 1 ? 'a year' : `${years} years`}.
          </span>
        </p>
      </div>
    </div>
  )
}
