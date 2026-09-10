import { useMemo, useState } from 'react'
import { m } from 'framer-motion'
import { Check, ChevronDown, RotateCw, X } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { useSession } from '@hooks/session/useSession'
import { useLeadsFeed } from '@hooks/console/useLeadsFeed'
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
} from '../../ui'
import { CELL_TIGHT, MONO_LABEL, QUIET, QUIET_ROW, TH_TIGHT } from '../../lib/tokens'

/**
 * Everybody who has raised a hand at this business, whichever door they came
 * through.
 *
 * The section used to draw one table and therefore one door: the configurator.
 * Everything else the studio takes leads through - the contact form, the tools
 * enquiry, the speed check, the paid ads, the phone, a reply to cold outreach -
 * kept its own record or none, and was worked out of an inbox. That is not a
 * tidiness problem. A consultant holding an expired payment link, a shop owner
 * asking for terms and four people who filled in an ad form all sat for days
 * while this page, the one built to show exactly that, showed nothing.
 *
 * So the table is the spine now, and the first column is the door. A reader
 * scanning it should be able to say where the week's leads came from without
 * opening anything, because that is the question that decides where the next
 * hour goes.
 *
 * The row is a story rather than a state, which is why the stage is worked out
 * from the times rather than read off a column. Somebody can enquire and then
 * buy, or buy having never enquired, or reply to a cold email having never
 * asked for anything. What the badge shows is the furthest thing that happened.
 *
 * What is new beside the old page is that a lead can be marked. Answered, ruled
 * out, or owed something by a date. A list nobody can mark is a list that gets
 * read once and then read around, and the whole reason the leads were sitting
 * in an inbox is that the inbox let somebody archive a line and this did not.
 *
 * Still nothing here writes to a lead. There is no control on this page that
 * sends anybody a message, because a hundred addresses beside a button is a
 * mistake waiting for a slow afternoon.
 */

/**
 * How the columns give way as the page narrows.
 *
 * Who they are never leaves, because it is the whole reason to open the page.
 * The door goes last of the ones that go, being the reading that decides what
 * a reader does next.
 */
const HIDE_SM = 'hidden sm:table-cell'
const HIDE_LG = 'hidden lg:table-cell'

/** The doors, in the words a person uses for them rather than the column's. */
const DOORS = {
  configurator: 'Configurator',
  payment: 'Payment Page',
  contact: 'Contact Form',
  tools: 'Tools Enquiry',
  'speed-check': 'Speed Check',
  ad: 'Paid Ad',
  'outreach-reply': 'Outreach Reply',
  call: 'Phone Call',
}

/**
 * The same doors as a list, which is what the filter runs off and what proves
 * the table above has a name for every one of them.
 *
 * Written out rather than derived from the object's keys, because the check
 * that reads this file has to see each door named as the database spells it -
 * and an object key spells `speed-check` one way and `configurator` another.
 */
const DOOR_NAMES = [
  'configurator',
  'payment',
  'contact',
  'tools',
  'speed-check',
  'ad',
  'outreach-reply',
  'call',
]

/**
 * The steps the configurator runs, so a number reads as a place.
 *
 * Only two of the eight doors have steps at all, and for those two how far
 * somebody got is the most useful thing about them: a lead who read the price
 * and closed the tab is a different conversation from one who answered the
 * first question. The other six doors have nothing to say here, so the reading
 * appears against a lead only where there is one to take.
 */
const STEPS = ['Business type', 'The work', 'The look', 'What it costs', 'Payment']

/** How far somebody reached, written as the screen they were on. */
function reached(lead) {
  if (fromPaymentPage(lead.path)) return 'Payment page'
  const name = STEPS[lead.step]
  return name ? `${lead.step + 1}. ${name}` : null
}

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

/** A date alone, for a thing that is owed on a day rather than at a minute. */
function onDay(value) {
  if (!value) return '—'
  return formatInstant(new Date(value), { month: 'short', day: 'numeric' })
}

/**
 * The furthest thing that happened to a lead, in a word.
 *
 * Read newest-fact-first, so somebody who enquired and then paid reads as a
 * customer rather than as an enquiry still waiting for an answer.
 */
function stage(lead) {
  if (lead.dismissed_at) return { label: 'Ruled Out', tone: 'plain' }
  if (lead.unsubscribed_at) return { label: 'Unsubscribed', tone: 'bad' }
  if (lead.bought_at) return { label: 'Bought', tone: 'good' }
  if (lead.checkout_at) return { label: 'Reached Checkout', tone: 'accent' }
  if (lead.replied_at) return { label: 'Replied', tone: 'accent' }
  if (lead.enquired_at) return { label: 'Enquired', tone: 'accent' }
  if (lead.contacted_at) return { label: 'Answered', tone: 'plain' }
  return { label: 'Waiting', tone: 'warn' }
}

/**
 * Whether a lead is owed something right now.
 *
 * Two ways to be owed, and they are genuinely different: nobody has answered
 * them at all, or somebody set a date and the date has passed. A lead that is
 * bought, unsubscribed or ruled out is owed nothing by either reading.
 */
function waiting(lead) {
  if (lead.dismissed_at || lead.bought_at || lead.unsubscribed_at) return false
  if (!lead.contacted_at) return true
  return Boolean(lead.due_at && new Date(lead.due_at) <= new Date())
}

/** How to reach them, in the order somebody actually would. */
function reach(lead) {
  return [lead.email, lead.phone].filter(Boolean).join(' · ') || 'No address or number'
}

/** Who they are, falling back through what the door managed to collect. */
function who(lead) {
  return lead.name || lead.business || lead.email || lead.phone || 'Unnamed'
}

/** The rows a lead's brief carries, or nothing where it never had one. */
function briefRows(lead) {
  return Array.isArray(lead.brief) ? lead.brief.filter(row => row?.label && row?.value) : []
}

/** The campaign tags, as a line, or nothing where the visit carried none. */
function arrival(lead) {
  const tags = lead.campaign
  if (!tags || typeof tags !== 'object') return null
  const parts = [tags.utm_source, tags.utm_medium, tags.utm_campaign].filter(Boolean)
  return parts.length ? parts.join(' / ') : null
}

/**
 * One lead, everything they told us, and the two marks a reader can put on it.
 *
 * The detail opens on the name, which is what somebody is already pointing at
 * when they decide they want to know more. It carries the note in whatever
 * words the lead used - a message off the contact form, what the caller wrote
 * down, the site they asked to have measured - because the whole use of a lead
 * is being able to write back about the thing they were actually after.
 */
function LeadRow({ lead, onMark, saving }) {
  const state = stage(lead)
  const [open, setOpen] = useState(false)
  const rows = briefRows(lead)
  const detailId = `lead-detail-${lead.id}`
  const owed = waiting(lead)
  const came = arrival(lead)

  return (
    <>
      <tr className="align-top">
        <td className={CELL_TIGHT}>
          <button
            type="button"
            onClick={() => setOpen(current => !current)}
            aria-expanded={open}
            aria-controls={detailId}
            className="flex w-full items-center gap-1.5 text-left font-medium text-ink-paper transition-colors duration-200 hover:text-accent"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${
                open ? '' : '-rotate-90'
              }`}
              aria-hidden="true"
            />
            <span className="truncate">{who(lead)}</span>
          </button>
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_SM}`}>
          <span className="block truncate text-[13px] text-paper-soft">
            {DOORS[lead.source] || lead.source}
          </span>
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_LG}`}>
          <span className="block truncate text-[13px] text-paper-soft">{reach(lead)}</span>
        </td>
        <td className={CELL_TIGHT}>
          <Badge tone={state.tone}>{state.label}</Badge>
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_SM} tabular-nums`}>
          {lead.due_at ? (
            <span className={owed && lead.contacted_at ? 'text-accent' : 'text-paper-soft'}>
              {onDay(lead.due_at)}
            </span>
          ) : (
            <span className="text-paper-faint">—</span>
          )}
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_SM} tabular-nums`}>{when(lead.first_seen)}</td>
      </tr>
      {open && (
        <tr id={detailId}>
          <td colSpan={6} className="px-3 pb-4 pt-0">
            <div className="grid gap-4 pl-5">
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {lead.email && <Fact label="Address" value={lead.email} />}
                {lead.phone && <Fact label="Phone" value={lead.phone} />}
                {lead.business && <Fact label="Business" value={lead.business} />}
                {lead.trade && <Fact label="Trade" value={lead.trade} />}
                {lead.town && <Fact label="Town" value={lead.town} />}
                {lead.website && <Fact label="Website" value={lead.website} />}
                {reached(lead) && <Fact label="Reached" value={reached(lead)} />}
                {came && <Fact label="Came From" value={came} />}
                {lead.contacted_at && <Fact label="Answered" value={when(lead.contacted_at)} />}
                {lead.dismissed_reason && (
                  <Fact label="Ruled Out Because" value={lead.dismissed_reason} />
                )}
                {rows.map(row => (
                  <Fact key={row.label} label={row.label} value={row.value} />
                ))}
              </dl>

              {lead.note && (
                <p className="max-w-prose whitespace-pre-line text-[13px] leading-relaxed text-ink-paper">
                  {lead.note}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={QUIET_ROW}
                  disabled={saving}
                  aria-pressed={Boolean(lead.contacted_at)}
                  onClick={() => onMark(lead.id, { mark: 'contacted', on: !lead.contacted_at })}
                >
                  <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {lead.contacted_at ? 'Not Answered Yet' : 'Mark Answered'}
                </button>
                <button
                  type="button"
                  className={QUIET_ROW}
                  disabled={saving}
                  aria-pressed={Boolean(lead.dismissed_at)}
                  onClick={() => onMark(lead.id, { mark: 'dismissed', on: !lead.dismissed_at })}
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {lead.dismissed_at ? 'Put Back' : 'Rule Out'}
                </button>
                <label className={`${MONO_LABEL} text-paper-faint flex items-center gap-1.5`}>
                  Next
                  <input
                    type="date"
                    className="border-hair-paper rounded-[var(--console-radius-sm)] border bg-[color:var(--paper-field)] px-2 py-1 text-[13px] text-ink-paper"
                    value={lead.due_at ? new Date(lead.due_at).toISOString().slice(0, 10) : ''}
                    disabled={saving}
                    onChange={event => onMark(lead.id, { due_at: event.target.value || null })}
                  />
                </label>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** One labelled thing a lead told us. */
function Fact({ label, value }) {
  return (
    <div>
      <dt className={`${MONO_LABEL} text-paper-faint`}>{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] leading-snug text-ink-paper">{value}</dd>
    </div>
  )
}

/** The leads themselves, newest first. */
function Leads({ leads, loading, area, capped, onMark, saving }) {
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
              <th className={TH_TIGHT}>Who</th>
              <th className={`${TH_TIGHT} ${HIDE_SM}`}>Came In By</th>
              <th className={`${TH_TIGHT} ${HIDE_LG}`}>Reach Them</th>
              <th className={TH_TIGHT}>Stage</th>
              <th className={`${TH_TIGHT} ${HIDE_SM}`}>Next</th>
              <th className={`${TH_TIGHT} ${HIDE_SM}`}>First Seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows
                cols={[
                  'px-3',
                  `px-3 ${HIDE_SM}`,
                  `px-3 ${HIDE_LG}`,
                  'px-3',
                  `px-3 ${HIDE_SM}`,
                  `px-3 ${HIDE_SM}`,
                ]}
                rows={8}
              />
            ) : leads.length ? (
              leads.map(lead => (
                <LeadRow key={lead.id} lead={lead} onMark={onMark} saving={saving === lead.id} />
              ))
            ) : (
              <EmptyRow cols={6}>Nobody is waiting.</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        {capped
          ? 'The newest leads, up to the number one read carries. The figures above are counted over every row rather than over these.'
          : 'Every door the studio takes a lead through writes here: the configurator and the payment page, the contact and tools forms, the speed check, the paid ads, a reply to cold outreach, and a phone call. Open a name to read what they said and to mark what you have done about them.'}
      </PanelFoot>
    </Panel>
  )
}

export default function LeadsPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const { data, error, loading, reading, saving, refresh, mark } = useLeadsFeed({
    token,
    enabled: Boolean(token),
  })
  const [waitingOnly, setWaitingOnly] = useState(false)
  const [door, setDoor] = useState('all')

  const leads = useMemo(() => data?.leads || [], [data])
  const totals = data?.totals || {}

  const shown = useMemo(
    () =>
      leads
        .filter(lead => (waitingOnly ? waiting(lead) : true))
        .filter(lead => (door === 'all' ? true : lead.source === door)),
    [leads, waitingOnly, door]
  )

  // Only the doors that have actually produced a lead. A filter offering eight
  // sources where six of them are empty is a filter that mostly answers with
  // nothing and teaches the reader not to touch it.
  //
  // Ordered as the pipeline runs rather than alphabetically, so the buttons do
  // not move about as doors come and go from the record.
  const doors = useMemo(() => {
    const seen = new Set(leads.map(lead => lead.source))
    return DOOR_NAMES.filter(name => seen.has(name))
  }, [leads])

  // A refusal with nothing behind it is the whole answer, so it stands in
  // place of the table rather than above an empty one.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  return (
    <ConsolePage areas={['stats', 'views', 'work']} rows="auto auto minmax(0,1fr)">
      <Area area="stats">
        <ConsoleError>{error}</ConsoleError>

        <m.div {...fadeInUp} className="console-stats" aria-busy={loading}>
          <StatCard
            label="Waiting"
            value={loading ? '' : String(totals.waiting ?? 0)}
            caption="nobody has answered, or the date has passed"
            tone="warn"
            loading={loading}
          />
          <StatCard
            label="Leads"
            value={loading ? '' : String(totals.all ?? 0)}
            caption="everybody who has ever raised a hand"
            loading={loading}
          />
          <StatCard
            label="Enquired"
            value={loading ? '' : String(totals.enquired ?? 0)}
            caption="asked for something in writing"
            tone="accent"
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
            label="Ruled Out"
            value={loading ? '' : String(totals.dismissed ?? 0)}
            caption="looked at and set aside"
            loading={loading}
          />
        </m.div>
      </Area>

      <Area area="views">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {doors.length > 1 && (
            <>
              <button
                type="button"
                className={QUIET}
                aria-pressed={door === 'all'}
                onClick={() => setDoor('all')}
              >
                Every Door
              </button>
              {doors.map(name => (
                <button
                  key={name}
                  type="button"
                  className={QUIET}
                  aria-pressed={door === name}
                  onClick={() => setDoor(current => (current === name ? 'all' : name))}
                >
                  {DOORS[name] || name}
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            className={QUIET}
            aria-pressed={waitingOnly}
            onClick={() => setWaitingOnly(one => !one)}
          >
            {waitingOnly ? 'Show Everyone' : 'Only Who Is Waiting'}
          </button>
          <button type="button" className={QUIET} disabled={reading} onClick={refresh}>
            <RotateCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            {reading ? 'Reading' : 'Re-read'}
          </button>
        </div>
      </Area>

      <Leads
        area="work"
        leads={shown}
        loading={loading}
        capped={data ? !data.complete : false}
        onMark={mark}
        saving={saving}
      />
    </ConsolePage>
  )
}
