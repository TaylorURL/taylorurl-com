import { m } from 'framer-motion'
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { fadeInUp } from '@constants/animations'
import { HOME } from '@data/homeTaylorwebsite'
import { Card, Plane } from './CapabilityCard'

/**
 * What this site sells, with the terms of each line on the card.
 *
 * The studio fills this band with proof it has: a client's site as it draws, a
 * score off Google's own report, the board that watches those sites. None of
 * that is true here, and the answer is not a weaker version of it - a card
 * describing a capability is a claim, and three claims are worth less than one
 * artefact.
 *
 * So each card carries the thing a company actually has to know before it can
 * decide: what the line costs, how long it runs, and the part of the job it
 * does not cover. The last of those is the one an agency leaves out, which is
 * why it is on the card rather than three pages in.
 *
 * Every row is read off the service line's own record, so a price agreed on the
 * service page cannot be quoted differently here.
 */

/** The three terms, set as a schedule on the card's lit plane. */
function Terms({ line }) {
  return (
    <Plane className="p-8 sm:p-10">
      <dl className="plane-inset divide-y divide-[color:var(--plane-hairline)]">
        {HOME.lines.rows.map(row => (
          <div key={row.label} className="flex flex-col gap-1.5 p-5 sm:p-6">
            <dt className="section-label-sm text-paper-faint">{row.label}</dt>
            <dd className="text-[14px] leading-relaxed text-[color:var(--plane-ink)]">
              {line[row.key]}
            </dd>
          </div>
        ))}
      </dl>
    </Plane>
  )
}

export default function ServiceLinesSection() {
  return (
    <section className="section-y-lg border-hair-paper relative overflow-hidden border-t bg-paper">
      <div
        className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.column}`}
        aria-hidden="true"
      />
      <div className="container-rail relative">
        <m.h2
          {...fadeInUp}
          className="display-3 max-w-[24ch] font-semibold leading-[1.06] tracking-tightest text-ink-paper [text-wrap:balance]"
        >
          {HOME.lines.heading} <span className="text-paper-soft">{HOME.lines.tail}</span>
        </m.h2>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {HOME.lines.cards.map((line, index) => (
            <Card
              key={line.slug}
              index={index}
              to={line.path}
              cta={HOME.lines.cta}
              title={line.name}
              blurb={line.blurb}
            >
              <Terms line={line} />
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
