const ORDER_ROWS = [
  { k: 'Scope', v: 'Design, build, hosting, and getting found on Google' },
  { k: 'Service Area', v: 'Baytown and Houston, TX. Remote anywhere.' },
  { k: 'Point of Contact', v: 'Trenton Taylor, the same person who builds it' },
  { k: 'Quote', v: 'A plan and a price before any work starts' },
  { k: 'Turnaround', v: 'Most sites, two to four weeks' },
  {
    k: 'After Launch',
    v: 'Hosting, backups, monitoring, and small changes. From $99 a month, ongoing.',
  },
]

/**
 * The hero's figure: the terms of a job, set as the order form they would be
 * written on. It states what the arrangement is rather than describing it, so
 * the reader can read the deal off the page instead of taking it on trust.
 *
 * A term is set as a label beside its value wherever the card is wide enough to
 * carry both, and stacked wherever it is not. It is not, at two widths: on a
 * phone, where the card is as narrow as the screen; and between the large and
 * extra-large breakpoints, where it shares a row with the column of type and
 * comes out near 360px, which leaves a fixed label column barely a hundred
 * pixels for the value and runs a six-term order to twice the height of the
 * stage. On a phone the stacked terms are also set closer together and a step
 * smaller, so the order stands no taller than the opener does.
 */
export default function WorkOrderCard() {
  return (
    <div className="panel-static relative bg-[color:var(--paper-field)]">
      <p className="border-hair-paper section-label-sm border-b px-6 py-1.5 text-accent sm:px-8 sm:py-4">
        Work Order
      </p>

      <dl className="divide-y divide-[color:var(--paper-hairline)]">
        {ORDER_ROWS.map(row => (
          <div
            key={row.k}
            className="grid grid-cols-1 gap-0.5 px-6 py-1.5 sm:grid-cols-[10rem_1fr] sm:gap-6 sm:px-8 sm:py-4 md:py-5 lg:grid-cols-1 lg:gap-1 xl:grid-cols-[10rem_1fr] xl:gap-6"
          >
            <dt className="section-label-sm text-paper-faint sm:pt-1 lg:pt-0 xl:pt-1">{row.k}</dt>
            <dd className="text-[13px] leading-snug text-ink-paper sm:text-[15px] sm:leading-relaxed">
              {row.v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
