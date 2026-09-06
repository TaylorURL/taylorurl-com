import { useMemo, useState } from 'react'
import { m } from 'framer-motion'
import { ChevronDown, RotateCw } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { useSession } from '@hooks/useSession'
import { useLeadsFeed } from '@hooks/useLeadsFeed'
import { formatInstant } from '@lib/time/zone.js'
import { fromPaymentPage } from '@lib/leads/paths.js'
import {
  Area,
  Badge,
  ConsoleError,
  ConsolePage,
  EmptyRow,
  Panel,
  PanelBody,
  PanelFoot,
  SectionNotice,
  SkeletonRows,
  StatCard,
} from '../ui'
import { CELL_TIGHT, MONO_LABEL, QUIET, TH_TIGHT } from '../lib/tokens'

/**
 * Everyone who started a build and left an address.
 *
 * The configurator asks for an address on its first step and opens the rest
 * once it has one, so every visitor who sees the second screen has said who
 * they are. The console could report the two who finished - an enquiry, a
 * payment - and nothing at all about the far larger number who answered four
 * screens and closed the tab. Those are the leads, and this is where they are.
 *
 * The row is a story rather than a state, which is why the stage is worked out
 * from the times rather than read off a column. Somebody can enquire and then
 * buy, or buy having never enquired, and a single word in the table would have
 * had to forget one of those. What the badge shows is the furthest thing that
 * happened.
 *
 * The brief under a row is everything they told the site, recorded as they
 * typed it rather than only when they paid: the answers they picked off the
 * screens, and the business name, phone number and website they typed into the
 * payment form. A step number says how far somebody got and nothing about what
 * they wanted or how to reach them, and the whole use of a lead who left is
 * being able to write back about the thing they were after.
 *
 * The short checkout at `/payment` is here as well as the configurator. It asks
 * three questions and is handed to somebody who has already agreed to the
 * build, so the ones who stop on it are the most expensive leads the site can
 * lose - and until they were recorded they were the only visitors who left no
 * row at all. They are told apart by the page rather than by the step, because
 * a person on that page is at the payment whichever route brought them there.
 *
 * Nothing on this page writes to anybody. There is no control here that sends
 * a message, because a hundred addresses beside a button is a mistake waiting
 * for a slow afternoon; the one follow-up any of these people ever gets is
 * sent by the scheduled job, once, on its own terms.
 */

/**
 * How the columns give way as the page narrows.
 *
 * The address never leaves, because it is the whole reason to open the page.
 * Where they came from goes first, being the reading that belongs to a
 * campaign rather than to a person, and the two times go next.
 */
const HIDE_SM = 'hidden sm:table-cell'
const HIDE_LG = 'hidden lg:table-cell'

/** The steps the configurator runs, so a number reads as a place. */
const STEPS = ['Business type', 'The work', 'The look', 'What it costs', 'Payment']

/** An instant as the day and time it happened, in the studio's own zone. */
function when(value) {
  if (!value) return '—'
  return formatInstant(new Date(value), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** How far somebody reached, written as the screen they were on. */
function reached(lead) {
  if (fromPaymentPage(lead.path)) return 'Payment page'
  const name = STEPS[lead.step]
  return name ? `${lead.step + 1}. ${name}` : `Step ${(lead.step ?? 0) + 1}`
}

/**
 * The furthest thing that happened to a lead, in a word.
 *
 * Read newest-fact-first, so somebody who enquired and then paid reads as a
 * customer rather than as an enquiry that is still waiting for an answer.
 */
function stage(lead) {
  if (lead.unsubscribed_at) return { label: 'Unsubscribed', tone: 'bad' }
  if (lead.bought_at) return { label: 'Bought', tone: 'good' }
  if (lead.checkout_at) return { label: 'Reached Checkout', tone: 'accent' }
  if (lead.enquired_at) return { label: 'Enquired', tone: 'accent' }
  if (lead.followed_up_at) return { label: 'Followed Up', tone: 'plain' }
  return { label: 'Open', tone: 'warn' }
}

/** Where the visit came in from, as the tags on it said. */
function arrival(lead) {
  if (!lead.utm_source) return 'Direct'
  return [lead.utm_source, lead.utm_medium].filter(Boolean).join(' / ')
}

/** The rows a lead's brief carries, or nothing where it never had one. */
function briefRows(lead) {
  return Array.isArray(lead.brief) ? lead.brief.filter(row => row?.label && row?.value) : []
}

/**
 * One lead, and everything they told the site before they stopped.
 *
 * The brief is a second row rather than a cell, because it is a dozen short
 * answers and a table column wide enough to hold them is a table nothing else
 * fits in. It opens on the address, which is the thing somebody is already
 * pointing at when they decide they want to know more about a lead.
 *
 * A lead recorded before the brief was kept has none, and then the address is
 * plain text rather than a control that opens onto nothing.
 */
function LeadRow({ lead }) {
  const state = stage(lead)
  const [open, setOpen] = useState(false)
  const rows = briefRows(lead)
  const briefId = `lead-brief-${lead.id}`

  return (
    <>
      <tr className="align-top">
        <td className={CELL_TIGHT}>
          {rows.length ? (
            <button
              type="button"
              onClick={() => setOpen(current => !current)}
              aria-expanded={open}
              aria-controls={briefId}
              className="flex w-full items-center gap-1.5 text-left font-medium text-ink-paper transition-colors duration-200 hover:text-accent"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${
                  open ? '' : '-rotate-90'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">{lead.email}</span>
            </button>
          ) : (
            <span className="block truncate pl-5 font-medium text-ink-paper">{lead.email}</span>
          )}
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_SM}`}>
          <span className="block truncate text-[13px] text-paper-soft">{lead.trade || '—'}</span>
        </td>
        <td className={`${CELL_TIGHT} tabular-nums`}>{reached(lead)}</td>
        <td className={CELL_TIGHT}>
          <Badge tone={state.tone}>{state.label}</Badge>
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_LG}`}>
          <span className="block truncate text-[13px] text-paper-soft">{arrival(lead)}</span>
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_SM} tabular-nums`}>{when(lead.created_at)}</td>
        <td className={`${CELL_TIGHT} ${HIDE_LG} tabular-nums`}>{when(lead.updated_at)}</td>
      </tr>
      {open && rows.length > 0 && (
        <tr id={briefId}>
          <td colSpan={7} className="px-3 pb-4 pt-0">
            <dl className="grid gap-x-8 gap-y-3 pl-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(row => (
                <div key={row.label}>
                  <dt className={`${MONO_LABEL} text-paper-faint`}>{row.label}</dt>
                  <dd className="mt-0.5 break-words text-[13px] leading-snug text-ink-paper">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}

/** The leads themselves, newest first. */
function Leads({ leads, loading, area, capped }) {
  return (
    <Panel
      title="Leads"
      area={area}
      aside={
        <span className={`${MONO_LABEL} text-paper-faint`}>
          {loading ? '' : `${leads.length} shown`}
        </span>
      }
    >
      <PanelBody>
        <table className="console-table">
          <thead>
            <tr>
              <th className={TH_TIGHT}>Address</th>
              <th className={`${TH_TIGHT} ${HIDE_SM}`}>Trade</th>
              <th className={TH_TIGHT}>Reached</th>
              <th className={TH_TIGHT}>Stage</th>
              <th className={`${TH_TIGHT} ${HIDE_LG}`}>Came From</th>
              <th className={`${TH_TIGHT} ${HIDE_SM}`}>First Seen</th>
              <th className={`${TH_TIGHT} ${HIDE_LG}`}>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows
                cols={[
                  'px-3',
                  `px-3 ${HIDE_SM}`,
                  'px-3',
                  'px-3',
                  `px-3 ${HIDE_LG}`,
                  `px-3 ${HIDE_SM}`,
                  `px-3 ${HIDE_LG}`,
                ]}
                rows={8}
              />
            ) : leads.length ? (
              leads.map(lead => <LeadRow key={lead.id} lead={lead} />)
            ) : (
              <EmptyRow cols={7}>Nobody has started a build yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        {capped
          ? 'The newest leads, up to the number one read carries. The figures above are counted over every row rather than over these.'
          : 'An address is recorded as it is typed, on the first step of the configurator and on the payment page alike, so somebody who left on the second screen is here as surely as somebody who paid. Open an address to read what they had answered when they stopped.'}
      </PanelFoot>
    </Panel>
  )
}

export default function LeadsPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const { data, error, loading, reading, refresh } = useLeadsFeed({
    token,
    enabled: Boolean(token),
  })
  const [openOnly, setOpenOnly] = useState(false)

  const leads = useMemo(() => data?.leads || [], [data])
  const totals = data?.totals || {}

  const shown = openOnly ? leads.filter(lead => !lead.bought_at) : leads

  // A refusal with nothing behind it is the whole answer, so it stands in
  // place of the table rather than above an empty one.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  return (
    <ConsolePage areas={['stats', 'views', 'work']} rows="auto auto minmax(0,1fr)">
      <Area area="stats">
        <ConsoleError>{error}</ConsoleError>

        <m.div {...fadeInUp} className="console-stats" aria-busy={loading}>
          <StatCard
            label="Leads"
            value={loading ? '' : String(totals.all ?? 0)}
            caption="addresses left on the way to a card"
            loading={loading}
          />
          <StatCard
            label="Enquired"
            value={loading ? '' : String(totals.enquired ?? 0)}
            caption="sent the configuration over"
            tone="accent"
            loading={loading}
          />
          <StatCard
            label="Reached Checkout"
            value={loading ? '' : String(totals.checkout ?? 0)}
            caption="reached Stripe's own page"
            loading={loading}
          />
          <StatCard
            label="Bought"
            value={loading ? '' : String(totals.bought ?? 0)}
            caption="paid for a build"
            tone="good"
            loading={loading}
          />
          <StatCard
            label="Followed Up"
            value={loading ? '' : String(totals.followed ?? 0)}
            caption="written to an hour after they left"
            loading={loading}
          />
        </m.div>
      </Area>

      <Area area="views">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className={QUIET}
            aria-pressed={openOnly}
            onClick={() => setOpenOnly(one => !one)}
          >
            {openOnly ? 'Show Everyone' : 'Only Who Has Not Bought'}
          </button>
          <button type="button" className={QUIET} disabled={reading} onClick={refresh}>
            <RotateCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            {reading ? 'Reading' : 'Re-read'}
          </button>
        </div>
      </Area>

      <Leads area="work" leads={shown} loading={loading} capped={data ? !data.complete : false} />
    </ConsolePage>
  )
}
