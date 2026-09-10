import { useMemo, useState } from 'react'
import { useSession } from '@hooks/session/useSession'
import { usePaymentsFeed } from '@hooks/console/usePaymentsFeed'
import { formatInstant } from '@lib/time/zone.js'
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
  ViewNav,
} from '../../ui'
import { Figures } from '../../Figures'
import { useView } from '../../lib/views'
import { CELL_TIGHT, MONO_LABEL, QUIET, TH_TIGHT } from '../../lib/tokens'

/**
 * Who pays, what they pay, and everything they have paid.
 *
 * The console could say what a build was waiting on and what a site's traffic
 * came to, and nowhere could it say who was paying for any of it. That reading
 * lived in the Stripe dashboard, which holds the money for more than one trade
 * and sorts none of it.
 *
 * Two views, because there are two questions and they are asked at different
 * times. Subscribers is the standing arrangement - what each client is on, and
 * what is wrong with it. Payments is the record of money actually received,
 * newest first, which is the reading for a month's takings or for finding the
 * one invoice somebody is asking about.
 *
 * No two clients are on the same terms and the table is built for that rather
 * than around it. The monthly is a figure per client rather than a plan they
 * belong to, the up-front fee is its own column because a third of them paid a
 * different one and two paid none, and the interval sits beside the amount
 * because a year at three hundred and a month at twenty-five are the same
 * column and not the same thing.
 *
 * Nothing on this page changes anything. There is no control here that could
 * void, refund, cancel or charge, and the endpoint underneath holds no verb
 * that could either, so the section can be opened and read without any risk of
 * a keystroke costing somebody money. What it does instead is say plainly when
 * an arrangement is not what it should be, and leave the fixing to Stripe.
 */

/** The two readings the section keeps, one view each. */
const VIEWS = [
  { key: 'subscribers', label: 'Subscribers' },
  { key: 'payments', label: 'Payments' },
]

/**
 * How the columns give way as the page narrows.
 *
 * The address goes first: it names the client twice over, since the business
 * is already in the first column. What was paid in total goes next, being the
 * one figure that is a history rather than a state. What a client pays and
 * what is wrong with it never leave, because they are the whole reason to
 * open the page.
 */
const HIDE_SM = 'hidden sm:table-cell'
const HIDE_LG = 'hidden lg:table-cell'

/** Cents as dollars, in the one place the page writes a figure. */
function money(cents, { cents: showCents = true } = {}) {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '—'
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  })}`
}

/**
 * An epoch second as the day it fell on, in the studio's own zone.
 *
 * Read as an instant rather than as a calendar date, because that is what it
 * is: Stripe stamps the second the money moved, and a payment taken at half
 * past ten on a Sunday night in Texas belongs to that Sunday rather than to the
 * Monday it already was in UTC.
 */
function day(seconds) {
  if (!seconds) return '—'
  return formatInstant(new Date(seconds * 1000), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** What a client pays, written as one phrase. */
function fee(arrangement) {
  if (!arrangement) return 'Nothing recurring'
  if (!arrangement.cents) return 'Amount unknown'
  const every = arrangement.every > 1 ? `${arrangement.every} ` : ''
  return `${money(arrangement.cents)} / ${every}${arrangement.interval}`
}

/**
 * The state of an arrangement, said in a word.
 *
 * A subscription billed by hand is called out as such rather than shown as
 * active, because the two are not the same promise: one renews itself and the
 * other renews when somebody remembers.
 */
function standing(arrangement) {
  if (!arrangement) return { label: 'None', tone: 'plain' }
  if (arrangement.status === 'hand') return { label: 'By Hand', tone: 'warn' }
  if (arrangement.status === 'canceled') return { label: 'Cancelled', tone: 'bad' }
  if (arrangement.status === 'past_due' || arrangement.status === 'unpaid')
    return { label: 'Past Due', tone: 'bad' }
  if (arrangement.status === 'trialing') return { label: 'Trial', tone: 'accent' }
  if (arrangement.status === 'active') return { label: 'Active', tone: 'good' }
  return { label: arrangement.status, tone: 'plain' }
}

/** What an invoice was for, in the word the payments table groups on. */
const KIND_LABEL = {
  setup: 'Up Front',
  monthly: 'Monthly',
  yearly: 'Yearly',
  other: 'Other',
}

/**
 * One client, and what is wrong with their billing underneath them.
 *
 * The troubles are a second line inside the row rather than a column of their
 * own, because there can be two of them and each is a sentence. A column would
 * have to be wide enough for the longest one on every row that has none.
 */
function ClientRow({ client }) {
  const state = standing(client.arrangement)
  return (
    <>
      <tr className="border-hair-paper border-t align-top">
        <td className={CELL_TIGHT}>
          <span className="block truncate font-medium">
            {client.business || client.name || client.email}
          </span>
          {client.name && client.business && client.name !== client.business && (
            <span className="text-paper-faint block truncate text-[12px]">{client.name}</span>
          )}
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_SM}`}>
          <span className="block truncate text-[13px] text-paper-soft">{client.email}</span>
        </td>
        <td className={`${CELL_TIGHT} tabular-nums`}>{fee(client.arrangement)}</td>
        <td className={CELL_TIGHT}>
          <Badge tone={state.tone}>{state.label}</Badge>
        </td>
        <td className={`${CELL_TIGHT} tabular-nums`}>{money(client.setup?.cents ?? null)}</td>
        <td className={`${CELL_TIGHT} ${HIDE_LG} tabular-nums`}>
          {day(client.arrangement?.nextAt)}
        </td>
        <td className={`${CELL_TIGHT} ${HIDE_LG} tabular-nums`}>{money(client.paidCents)}</td>
      </tr>
      {client.troubles.map(trouble => (
        <tr key={trouble.code} className="align-top">
          <td className="px-3 pb-3" colSpan={7}>
            <p className="console-trouble">
              <span aria-hidden="true" className="console-trouble-mark" />
              {trouble.note}
            </p>
          </td>
        </tr>
      ))}
    </>
  )
}

/** The standing arrangements, one row each. */
function Subscribers({ clients, loading, area }) {
  return (
    <Panel
      title="Subscribers"
      area={area}
      aside={
        <span className={`${MONO_LABEL} text-paper-faint`}>
          {loading ? '' : `${clients.length} in the record`}
        </span>
      }
    >
      <PanelBody>
        <table className="console-table">
          <thead>
            <tr>
              <th className={TH_TIGHT}>Client</th>
              <th className={`${TH_TIGHT} ${HIDE_SM}`}>Address</th>
              <th className={TH_TIGHT}>Pays</th>
              <th className={TH_TIGHT}>Standing</th>
              <th className={TH_TIGHT}>Up Front</th>
              <th className={`${TH_TIGHT} ${HIDE_LG}`}>Next Charge</th>
              <th className={`${TH_TIGHT} ${HIDE_LG}`}>Paid To Date</th>
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
                  'px-3',
                  `px-3 ${HIDE_LG}`,
                  `px-3 ${HIDE_LG}`,
                ]}
                rows={6}
              />
            ) : clients.length ? (
              clients.map(client => <ClientRow key={client.key} client={client} />)
            ) : (
              <EmptyRow cols={7}>Nobody is paying for anything yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        A client billed by hand has no subscription behind them. Nothing renews it, so the month it
        is not sent is the month it is not paid.
      </PanelFoot>
    </Panel>
  )
}

/** Every payment, newest first. */
function Payments({ payments, loading, area }) {
  return (
    <Panel
      title="Payments"
      area={area}
      aside={
        <span className={`${MONO_LABEL} text-paper-faint`}>
          {loading ? '' : `${payments.length} in the record`}
        </span>
      }
    >
      <PanelBody>
        <table className="console-table">
          <thead>
            <tr>
              <th className={TH_TIGHT}>Date</th>
              <th className={TH_TIGHT}>Client</th>
              <th className={TH_TIGHT}>For</th>
              <th className={`${TH_TIGHT} ${HIDE_LG}`}>Lines</th>
              <th className={TH_TIGHT}>Amount</th>
              <th className={`${TH_TIGHT} ${HIDE_SM}`}>State</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows
                cols={['px-3', 'px-3', 'px-3', `px-3 ${HIDE_LG}`, 'px-3', `px-3 ${HIDE_SM}`]}
                rows={10}
              />
            ) : payments.length ? (
              payments.map(payment => (
                <tr key={payment.id} className="border-hair-paper border-t">
                  <td className={`${CELL_TIGHT} whitespace-nowrap tabular-nums`}>
                    {day(payment.at)}
                  </td>
                  <td className={CELL_TIGHT}>
                    <span className="block truncate">
                      {payment.business || payment.name || payment.key}
                    </span>
                  </td>
                  <td className={CELL_TIGHT}>
                    <Badge tone={payment.kind === 'setup' ? 'accent' : 'plain'}>
                      {KIND_LABEL[payment.kind] || payment.kind}
                    </Badge>
                  </td>
                  <td className={`${CELL_TIGHT} ${HIDE_LG}`}>
                    <span className="block truncate text-[13px] text-paper-soft">
                      {payment.description}
                    </span>
                  </td>
                  <td className={`${CELL_TIGHT} tabular-nums`}>{money(payment.cents)}</td>
                  <td className={`${CELL_TIGHT} ${HIDE_SM}`}>
                    <Badge tone={payment.status === 'paid' ? 'good' : 'warn'}>
                      {payment.status === 'paid' ? 'Paid' : 'Outstanding'}
                    </Badge>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={6}>Nothing has been paid yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        An invoice raised and then cancelled is not money and is not here. What is here is what was
        billed and either paid or still owed.
      </PanelFoot>
    </Panel>
  )
}

export default function PaymentsPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const { data, error, loading } = usePaymentsFeed({
    token,
    enabled: Boolean(token),
  })
  const [view, go] = useView(VIEWS)
  const [troubledOnly, setTroubledOnly] = useState(false)

  const clients = useMemo(() => data?.clients || [], [data])
  const payments = useMemo(() => data?.payments || [], [data])
  const totals = useMemo(() => data?.totals || {}, [data])

  /**
   * The account, as records.
   *
   * What is collected has a history and draws it; the rest are shares of
   * something - clients of clients, money owed against money taken - and are
   * drawn against that instead. A figure with neither says so by leaving the
   * room empty rather than by inventing one.
   */
  const paymentFigures = useMemo(() => {
    const monthly = totals.monthlyCents ?? 0
    const paying = totals.paying ?? 0
    const held = totals.clients ?? 0
    const collected = totals.collectedCents ?? 0
    const open = totals.openCents ?? 0
    const troubled = totals.troubled ?? 0

    // Every month with money in it, newest last, so the run reads left to
    // right the way the rest of the console's charts do.
    const months = new Map()
    for (const one of payments) {
      if (one.status !== 'paid' || !one.at) continue
      const when = new Date(one.at * 1000)
      const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
      months.set(key, (months.get(key) || 0) + (one.cents || 0))
    }
    const run = [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, cents]) => ({
        // The key is a calendar month rather than an instant, so it is read and
        // written in the same fixed zone. Left to the machine's own, a builder
        // running in UTC renders local midnight as the evening before and the
        // bar comes out labelled with the previous month.
        at: new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', {
          timeZone: 'UTC',
          month: 'short',
        }),
        value: cents,
        text: money(cents, { cents: false }),
      }))

    const top = [...clients]
      .filter(one => one.monthlyCents > 0)
      .sort((a, b) => b.monthlyCents - a.monthlyCents)
    const lead = top.slice(0, 4)
    const tail = top.slice(4).reduce((sum, one) => sum + one.monthlyCents, 0)
    const owed = clients.filter(one => one.openCents > 0).length

    return [
      {
        key: 'monthly',
        label: 'Monthly Recurring',
        gloss: 'Every yearly fee counted as a twelfth of itself.',
        value: money(monthly, { cents: false }),
        caption: paying ? `${paying} on a live arrangement` : null,
        tone: 'good',
        loading,
        facts: [
          [String(paying), paying === 1 ? 'paying client' : 'paying clients'],
          paying
            ? [money(Math.round(monthly / paying), { cents: false }), 'each, on average']
            : null,
          [money(monthly * 12, { cents: false }), 'a year at this rate'],
        ].filter(Boolean),
        room: lead.length
          ? {
              kind: 'parts',
              parts: [
                ...lead.map(one => ({
                  label: one.business || one.name,
                  value: one.monthlyCents,
                  text: money(one.monthlyCents, { cents: false }),
                  tone: 'good',
                })),
                tail
                  ? {
                      label: `${top.length - lead.length} others`,
                      value: tail,
                      text: money(tail, { cents: false }),
                    }
                  : null,
              ].filter(Boolean),
            }
          : null,
      },
      {
        key: 'paying',
        label: 'Paying',
        gloss: 'Clients on a live arrangement, against every client on file.',
        value: loading ? '' : `${paying} / ${held}`,
        caption: held ? `${Math.max(0, held - paying)} with nothing recurring` : null,
        loading,
        room: held
          ? {
              kind: 'progress',
              at: paying,
              of: held,
              note: `${paying} of ${held} pay every month`,
            }
          : null,
      },
      {
        key: 'collected',
        label: 'Collected',
        gloss: 'Everything Stripe has received, all time.',
        value: money(collected, { cents: false }),
        caption: run.length ? `${run.length} months with money in them` : null,
        loading,
        facts: run.length
          ? [
              [run[run.length - 1].text, 'this month'],
              [money(Math.round(collected / run.length), { cents: false }), 'a month, on average'],
            ]
          : [],
        room: run.length > 1 ? { kind: 'series', points: run } : null,
      },
      {
        key: 'open',
        label: 'Outstanding',
        gloss: 'Billed and not yet paid.',
        value: money(open, { cents: false }),
        caption: owed ? `${owed} ${owed === 1 ? 'client owes' : 'clients owe'}` : 'nothing is owed',
        tone: open ? 'warn' : 'plain',
        loading,
        room:
          open || collected
            ? {
                kind: 'parts',
                parts: [
                  {
                    key: 'open',
                    label: 'Outstanding',
                    value: open,
                    text: money(open, { cents: false }),
                    tone: 'warn',
                  },
                  {
                    key: 'collected',
                    label: 'Collected',
                    value: collected,
                    text: money(collected, { cents: false }),
                    tone: 'good',
                  },
                ],
              }
            : null,
      },
      {
        key: 'troubled',
        label: 'Needs Attention',
        gloss: 'Arrangements with something wrong on them.',
        value: loading ? '' : String(troubled),
        caption: held ? `of ${held} arrangements` : null,
        tone: troubled ? 'warn' : 'good',
        urgent: troubled > 0,
        loading,
        room: held
          ? {
              kind: 'progress',
              at: troubled,
              of: held,
              note: troubled
                ? `${troubled} of ${held} arrangements want looking at`
                : `all ${held} arrangements are in order`,
            }
          : null,
      },
    ]
  }, [clients, loading, payments, totals])

  const shown = troubledOnly ? clients.filter(one => one.troubles.length) : clients

  // A refusal with nothing behind it is the whole answer, so it stands in place
  // of the tables rather than above two empty ones.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  return (
    <ConsolePage areas={['stats', 'views', 'work']} rows="auto auto minmax(0,1fr)">
      <Area area="stats">
        <ConsoleError>{error}</ConsoleError>

        {data && !data.complete && (
          <SectionNotice>
            Stripe holds more than was read in one pass, so these figures cover part of the account
            rather than all of it.
          </SectionNotice>
        )}

        <Figures figures={paymentFigures} pinned="monthly" busy={loading} />
      </Area>

      <Area area="views">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ViewNav
            views={[
              { key: 'subscribers', label: 'Subscribers', count: clients.length, loading },
              { key: 'payments', label: 'Payments', count: payments.length, loading },
            ]}
            current={view}
            onPick={go}
            label="Payments views"
          />
          {view === 'subscribers' && (
            <button
              type="button"
              className={QUIET}
              aria-pressed={troubledOnly}
              onClick={() => setTroubledOnly(one => !one)}
            >
              {troubledOnly ? 'Show Everyone' : 'Only What Needs Attention'}
            </button>
          )}
        </div>
      </Area>

      {view === 'subscribers' ? (
        <Subscribers area="work" clients={shown} loading={loading} />
      ) : (
        <Payments area="work" payments={payments} loading={loading} />
      )}
    </ConsolePage>
  )
}
