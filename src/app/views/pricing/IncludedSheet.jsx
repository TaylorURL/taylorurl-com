import { Check } from 'lucide-react'
import { GROUNDS } from '@constants/grounds'
import { INCLUDED_COUNT, INCLUDED_GROUPS } from '@data/checkout/pricing'

const PAPER = GROUNDS.paper

// The lines run two across where there is room and one across where there is
// not. Six divides both, so no group ends on a short row.
const LINES = 'grid gap-x-8 gap-y-0.5 sm:grid-cols-2'

/*
 * The three zones a group is set in: the number hung in the margin, what the
 * group is, and what is in it.
 *
 * Set beside each other rather than stacked. Stacked, each group ran the height
 * of a heading plus a line of prose plus its own lines, and six of those was
 * two and a half screens for a list whose whole point is being taken in at
 * once. Beside each other, the prose and the lines occupy the same band and a
 * group is as tall as the taller of the two - which is how a schedule is set on
 * paper, and why a schedule on paper fits.
 */
const ZONES = 'lg:grid lg:grid-cols-[3.5rem_17rem_minmax(0,1fr)] lg:gap-x-10'

/**
 * Where each group leaves the reader in the run, so a group can print how far
 * through the schedule it takes them. Counted rather than typed: the totals are
 * the argument, and an argument written by hand beside the list it counts goes
 * wrong the first time the list changes.
 */
const RUNNING = INCLUDED_GROUPS.reduce((totals, group) => {
  totals.push((totals[totals.length - 1] || 0) + group.items.length)
  return totals
}, [])

/**
 * Everything the two figures cover, set out as a schedule of work.
 *
 * All thirty-six lines are on the page at once, and that is the whole design.
 * The argument this section makes is the length of the list, so an arrangement
 * that shows six lines and keeps thirty behind a control is an arrangement
 * working against the thing it is there to say - a reader who has to operate
 * something before they can count what they are buying does not count it.
 *
 * They are names and nothing else, for the same reason. Thirty-six sentences
 * is a page of prose, and a page of prose is read by nobody who is comparing
 * quotes: they are scanning for words they already have on the other quotes in
 * front of them, and every explanatory clause between those words is one more
 * thing in the way of finding them. Six short lines carry the context, one per
 * group, and the service pages carry the detail.
 *
 * It is a document rather than a panel. No card holds it, no column of names
 * stands beside it, and nothing in it is selected: a group is a numbered
 * heading hung in the margin, its lines are set under it, and the rules do the
 * work a border around the whole thing was doing badly. The running total in
 * each group's corner counts the schedule off as it is read - six of
 * thirty-six, twelve of thirty-six - so the argument accumulates on the way
 * down instead of waiting for a figure at the end.
 */
export default function IncludedSheet() {
  return (
    <div className={`border-t ${PAPER.ruleStrong}`}>
      {INCLUDED_GROUPS.map((group, index) => {
        const number = String(index + 1).padStart(2, '0')

        return (
          <section
            key={group.key}
            aria-labelledby={`group-${group.key}`}
            className={`${ZONES} border-b py-7 ${PAPER.rule}`}
          >
            <p
              aria-hidden="true"
              className={`mb-3 font-mono text-[24px] leading-none tracking-tight lg:mb-0 lg:pt-0.5 lg:text-[26px] ${PAPER.meta}`}
            >
              {number}
            </p>

            <div className="mb-5 lg:mb-0">
              <h3
                id={`group-${group.key}`}
                className={`text-[17px] font-semibold leading-snug tracking-tight ${PAPER.title}`}
              >
                {group.title}
              </h3>
              <p className={`mt-1.5 text-[13px] leading-relaxed ${PAPER.body}`}>{group.note}</p>
              <p
                className={`mt-2.5 font-mono text-[11px] tabular-nums tracking-tight ${PAPER.meta}`}
              >
                {`${RUNNING[index]} of ${INCLUDED_COUNT}`}
              </p>
            </div>

            <ul className={LINES}>
              {group.items.map(item => (
                <li key={item} className="flex items-baseline gap-2.5 py-[5px]">
                  <Check
                    aria-hidden="true"
                    className="h-[13px] w-[13px] shrink-0 translate-y-[2px] text-accent"
                    strokeWidth={2.5}
                  />
                  <span className={`text-[15px] leading-snug tracking-tight ${PAPER.title}`}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
