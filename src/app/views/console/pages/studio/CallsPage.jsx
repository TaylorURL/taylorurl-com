import { useCallback, useMemo, useState } from 'react'
import { m } from 'framer-motion'
import { ChevronLeft, ChevronRight, Phone, RotateCw } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { useSession } from '@hooks/session/useSession'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import { formatInstant } from '@lib/time/zone.js'
import { hostOf, platformName } from '@lib/outreach/prospects/platforms.js'
import {
  CALL_OUTCOMES,
  dialHref,
  outcomeNeedsCallback,
  outcomeOf,
} from '@lib/outreach/prospects/calls.js'
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
  SidePanel,
  SkeletonRows,
  StatCard,
} from '../../ui'
import {
  BUTTON,
  CELL_TIGHT as CELL,
  FIELD,
  MONO_LABEL,
  QUIET,
  SELECT,
  TH_TIGHT as TH,
} from '../../lib/tokens'
import { fullCount } from '../../../analytics/lib/format'

/**
 * The businesses to ring, and what happened when they were rung.
 *
 * The cold email engine next door ends at an address, and about a fifth of
 * what the map sweep finds has none: the listing names no website at all, or
 * names a Facebook page, an Instagram profile, a Linktree or a Square booking
 * page whose only published address belongs to the platform. Those rows stop
 * at 'unreachable' and the pipeline is done with them - and they are the
 * strongest leads on the table, because the thing being sold is the thing they
 * visibly do not have. Every one of them carries the phone number the same
 * search returned. This is the section that dials them.
 *
 * The order is the whole of the page's argument, and it is not the review
 * count. Counts are not comparable across trades: a restaurant collects
 * reviews from every table it turns and a machine shop collects them from the
 * two customers a year who think to leave one, so ranking the raw figure puts
 * sixty restaurants on the first page and buries a welding shop that has
 * quietly outperformed every welding shop in the county. What ranks instead is
 * the count against the middle count for its own trade, which is comparable,
 * and the badge says which of the three readings a business came to.
 *
 * Above that sits the working day. A callback that has come due leads
 * everything, because somebody named that time themselves. Then the numbers
 * nobody has tried. Then the ones tried and not reached, oldest first, so a
 * number rung this morning is not rung again this afternoon.
 *
 * `quiet` is not a weak lead and the page must not read as though it were. A
 * business that has traded for years and collected a tenth of what its
 * neighbours collected is a business nobody can find, which is the entire
 * thing being sold. It sorts below `busy` because a busy business has money in
 * the till this month, not because a quiet one is a bad call.
 *
 * Nothing here sends anything. There is no message, no letter and no queue -
 * the one action on the page is recording what a person heard when they picked
 * up a phone, and the note is theirs rather than anything composed for them.
 */

/** How the columns give way as the page narrows. The number never leaves. */
const HIDE_SM = 'hidden sm:table-cell'
const HIDE_LG = 'hidden lg:table-cell'

/**
 * What each reading of a trade says, and how it is coloured.
 *
 * `busy` is the only one that carries a tone. A page where three of the four
 * bands are coloured is a page with no emphasis in it, and the reading worth
 * finding at a glance is the business turning over more than anyone else in
 * its trade with nothing on the web to show for it.
 */
const PULL = {
  busy: { label: 'Busy', tone: 'good', caption: 'well ahead of its trade' },
  steady: { label: 'Steady', tone: 'plain', caption: 'about the middle of its trade' },
  quiet: {
    label: 'Quiet',
    tone: 'plain',
    caption: 'well behind its trade, and findable by nobody',
  },
  unread: { label: 'Unread', tone: 'plain', caption: 'too few in the trade to measure against' },
}

/** The filters the list can be narrowed by, in the order they are offered. */
const NARROWINGS = [
  { id: 'all', label: 'Everyone On The List' },
  { id: 'due', label: 'Callbacks Due' },
  { id: 'fresh', label: 'Never Called' },
  { id: 'busy', label: 'Busy For Their Trade' },
  { id: 'quiet', label: 'Quiet For Their Trade' },
]

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

/**
 * What the business has on the web instead of a site of its own.
 *
 * The platform is named where the listing points at one, because that is the
 * first thing to say on the call: a business with a Facebook page has already
 * decided it needs somewhere to be found and has settled for a page it does
 * not own, which is a shorter conversation than one that starts from nothing.
 */
function presence(row) {
  if (row.site_kind === 'none') return 'Nothing'
  return platformName(hostOf(row.website)) || 'A platform page'
}

/** Where the business stands with the phone, in a word. */
function state(row, now) {
  if (row.callback_at && new Date(row.callback_at) <= now) {
    return { label: 'Due Back', tone: 'accent' }
  }
  if (row.callback_at) return { label: 'Booked Back', tone: 'plain' }
  if (!row.last_call) return { label: 'Not Called', tone: 'warn' }
  const outcome = outcomeOf(row.last_call.outcome)
  return { label: outcome?.label ?? 'Called', tone: outcome?.tone ?? 'plain' }
}

/** The reviews behind a listing, written so the pair reads as one figure. */
function reviews(row) {
  if (typeof row.rating_count !== 'number') return '—'
  const rating = row.rating === null || row.rating === undefined ? null : Number(row.rating)
  const count = fullCount(row.rating_count)
  return rating === null ? count : `${count} at ${rating.toFixed(1)}`
}

/** One business on the list. */
function CallRow({ row, now, onOpen }) {
  const badge = state(row, now)
  const pull = PULL[row.pull] ?? PULL.unread
  const href = dialHref(row.phone)

  return (
    <tr>
      <td className={CELL}>
        <button
          type="button"
          className="text-left text-ink-paper hover:text-accent"
          onClick={() => onOpen(row.id)}
          aria-haspopup="dialog"
        >
          {row.name || 'Unnamed business'}
        </button>
        <span className={`${MONO_LABEL} text-paper-faint block sm:hidden`}>{row.town}</span>
      </td>
      <td className={CELL}>
        {href ? (
          <a href={href} className="whitespace-nowrap text-accent">
            {row.phone}
          </a>
        ) : (
          '—'
        )}
      </td>
      <td className={`${CELL} ${HIDE_SM}`}>{row.town || '—'}</td>
      <td className={`${CELL} ${HIDE_LG}`}>{row.trade || '—'}</td>
      <td className={`${CELL} ${HIDE_SM} whitespace-nowrap`}>{reviews(row)}</td>
      <td className={CELL}>
        <Badge tone={pull.tone} title={pull.caption}>
          {pull.label}
        </Badge>
      </td>
      <td className={`${CELL} ${HIDE_LG}`}>{presence(row)}</td>
      <td className={CELL}>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </td>
    </tr>
  )
}

/**
 * One business in full, and the form that records a call to it.
 *
 * The form is inside the panel rather than in the row, because a call is
 * recorded after it has happened and what gets typed is a sentence about a
 * conversation. A control in a table row would be a button pressed while the
 * phone is still ringing.
 */
function CallSheet({ row, saving, onRecord }) {
  const [outcome, setOutcome] = useState('no_answer')
  const [note, setNote] = useState('')
  const [callback, setCallback] = useState('')
  const needsCallback = outcomeNeedsCallback(outcome)
  const href = dialHref(row.phone)

  const submit = async event => {
    event.preventDefault()
    const saved = await onRecord({
      id: row.id,
      outcome,
      note,
      callback_at: callback ? new Date(callback).toISOString() : null,
    })
    if (saved) {
      setNote('')
      setCallback('')
      setOutcome('no_answer')
    }
  }

  return (
    <div className="grid gap-5 px-5 py-4">
      <div className="grid gap-1">
        <h3 className="text-[18px] text-ink-paper">{row.name || 'Unnamed business'}</h3>
        <p className={`${MONO_LABEL} text-paper-faint`}>
          {[row.trade, row.town].filter(Boolean).join(' · ')}
        </p>
        {row.address && <p className="text-paper-faint text-[13px]">{row.address}</p>}
      </div>

      {href && (
        <a href={href} className={BUTTON}>
          <Phone aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
          {row.phone}
        </a>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className={`${MONO_LABEL} text-paper-faint`}>Reviews</dt>
          <dd className="text-[14px] text-ink-paper">{reviews(row)}</dd>
        </div>
        <div>
          <dt className={`${MONO_LABEL} text-paper-faint`}>Its Trade’s Middle</dt>
          <dd className="text-[14px] text-ink-paper">
            {row.trade_median === null ? 'Too few to say' : fullCount(Math.round(row.trade_median))}
          </dd>
        </div>
        <div>
          <dt className={`${MONO_LABEL} text-paper-faint`}>On The Web</dt>
          <dd className="text-[14px] text-ink-paper">{presence(row)}</dd>
        </div>
        <div>
          <dt className={`${MONO_LABEL} text-paper-faint`}>Why Email Could Not</dt>
          <dd className="text-[14px] text-ink-paper">
            {row.skip_reason || 'No address was found'}
          </dd>
        </div>
      </dl>

      {row.website && (
        <a
          href={row.website}
          target="_blank"
          rel="noreferrer noopener"
          className={`${MONO_LABEL} break-all text-accent`}
        >
          {row.website}
        </a>
      )}

      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>What The Call Came To</span>
          <select
            className={SELECT}
            value={outcome}
            onChange={event => setOutcome(event.target.value)}
          >
            {CALL_OUTCOMES.map(one => (
              <option key={one.id} value={one.id}>
                {one.label}
              </option>
            ))}
          </select>
        </label>

        {needsCallback && (
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Ring Them Back At</span>
            <input
              type="datetime-local"
              className={FIELD}
              value={callback}
              required
              onChange={event => setCallback(event.target.value)}
            />
          </label>
        )}

        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>What Was Said</span>
          <textarea
            className={`${FIELD} min-h-[88px]`}
            value={note}
            rows={3}
            onChange={event => setNote(event.target.value)}
          />
        </label>

        <button type="submit" className={BUTTON} disabled={saving}>
          {saving ? 'Recording' : 'Record The Call'}
        </button>
      </form>

      <div className="grid gap-2">
        <p className={`${MONO_LABEL} text-paper-faint`}>Every Call To This Business</p>
        {row.calls.length ? (
          <ul className="grid gap-2">
            {row.calls.map(call => (
              <li key={call.id} className="border-hair-paper grid gap-1 border-t pt-2">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={outcomeOf(call.outcome)?.tone ?? 'plain'}>
                    {outcomeOf(call.outcome)?.label ?? call.outcome}
                  </Badge>
                  <span className={`${MONO_LABEL} text-paper-faint`}>{when(call.called_at)}</span>
                </p>
                {call.callback_at && (
                  <p className={`${MONO_LABEL} text-paper-faint`}>
                    Ringing back {when(call.callback_at)}
                  </p>
                )}
                {call.note && <p className="text-[13px] text-ink-paper">{call.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-paper-faint text-[13px]">Nobody has rung this number yet.</p>
        )}
      </div>
    </div>
  )
}

export default function CallsPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null

  const [town, setTown] = useState('all')
  const [trade, setTrade] = useState('all')
  const [pull, setPull] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)

  const filters = useMemo(
    () => ({ town, trade, pull, search, page }),
    [town, trade, pull, search, page]
  )
  const { data, retained, error, loading, saving, refresh, record } = useCallsFeed({
    token,
    enabled: Boolean(token),
    filters,
  })

  // Read once per render rather than once per row, so every badge on the page
  // agrees about which callbacks have come due. Not held across renders: a
  // console left open all afternoon would go on measuring against the moment
  // it was opened, and the callback set for three o'clock would never turn.
  const now = new Date()

  const rows = data?.rows || []
  const totals = data?.totals || {}
  const open = rows.find(row => row.id === openId) ?? null

  // The lists the two dropdowns offer and the pager's count of pages describe
  // the question rather than answer it, so they read the last payload that
  // landed. Deriving them from `data` empties a dropdown of the option just
  // picked, and unmounts the pager the moment Next is pressed.
  const towns = retained?.towns || []
  const trades = retained?.trades || []
  const pages = retained?.pages || 1

  const narrow = useCallback(set => {
    setPage(1)
    set()
  }, [])

  // A refusal with nothing behind it is the whole answer, so it stands in
  // place of the table rather than above an empty one.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  return (
    <ConsolePage areas={['stats', 'views', 'work']} rows="auto auto minmax(0,1fr)">
      <Area area="stats">
        <ConsoleError>{error}</ConsoleError>

        <m.div {...fadeInUp} className="console-stats" aria-busy={loading}>
          <StatCard
            label="On The List"
            value={loading ? '' : fullCount(totals.open ?? 0)}
            caption="no site of their own, and a number to ring"
            loading={loading}
          />
          <StatCard
            label="Due Back"
            value={loading ? '' : fullCount(totals.due ?? 0)}
            caption="asked to be rung back by now"
            tone={totals.due ? 'accent' : 'plain'}
            loading={loading}
          />
          <StatCard
            label="Never Called"
            value={loading ? '' : fullCount(totals.fresh ?? 0)}
            caption="nobody has tried this number"
            loading={loading}
          />
          <StatCard
            label="Worked"
            value={loading ? '' : fullCount(totals.worked ?? 0)}
            caption="rung at least once and still open"
            loading={loading}
          />
          <StatCard
            label="Booked"
            value={loading ? '' : fullCount(totals.booked ?? 0)}
            caption="came off the list as work"
            tone="good"
            loading={loading}
          />
        </m.div>
      </Area>

      <Area area="views">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className={`${FIELD} max-w-[220px]`}
            placeholder="Name, town or number"
            value={search}
            onChange={event => narrow(() => setSearch(event.target.value))}
            aria-label="Search the call list"
          />
          <select
            className={SELECT}
            value={pull}
            onChange={event => narrow(() => setPull(event.target.value))}
            aria-label="Narrow the list"
          >
            {NARROWINGS.map(one => (
              <option key={one.id} value={one.id}>
                {one.label}
              </option>
            ))}
          </select>
          <select
            className={SELECT}
            value={town}
            onChange={event => narrow(() => setTown(event.target.value))}
            aria-label="Town"
          >
            <option value="all">Every Town</option>
            {towns.map(one => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </select>
          <select
            className={SELECT}
            value={trade}
            onChange={event => narrow(() => setTrade(event.target.value))}
            aria-label="Trade"
          >
            <option value="all">Every Trade</option>
            {trades.map(one => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </select>
          <button type="button" className={`${QUIET} ml-auto`} onClick={refresh}>
            <RotateCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            Re-read
          </button>
        </div>
      </Area>

      <Panel
        title="Call List"
        area="work"
        aside={
          <span className={`${MONO_LABEL} text-paper-faint`}>
            {loading ? '' : `${fullCount(data?.matched ?? 0)} matching`}
          </span>
        }
      >
        <PanelBody>
          <table className="console-table">
            <thead>
              <tr>
                <th className={TH}>Business</th>
                <th className={TH}>Number</th>
                <th className={`${TH} ${HIDE_SM}`}>Town</th>
                <th className={`${TH} ${HIDE_LG}`}>Trade</th>
                <th className={`${TH} ${HIDE_SM}`}>Reviews</th>
                <th className={TH}>For Its Trade</th>
                <th className={`${TH} ${HIDE_LG}`}>On The Web</th>
                <th className={TH}>State</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows
                  cols={[
                    'px-3',
                    'px-3',
                    `px-3 ${HIDE_SM}`,
                    `px-3 ${HIDE_LG}`,
                    `px-3 ${HIDE_SM}`,
                    'px-3',
                    `px-3 ${HIDE_LG}`,
                    'px-3',
                  ]}
                  rows={10}
                />
              ) : rows.length ? (
                rows.map(row => <CallRow key={row.id} row={row} now={now} onOpen={setOpenId} />)
              ) : (
                <EmptyRow cols={8}>No business on the list answers to that.</EmptyRow>
              )}
            </tbody>
          </table>
        </PanelBody>
        {pages > 1 ? (
          <PanelFoot>
            <p className={`${MONO_LABEL} text-paper-faint`}>
              Page {fullCount(data?.page ?? page)} of {fullCount(pages)}
            </p>
            <span className="inline-flex items-center gap-2">
              <button
                type="button"
                className={QUIET}
                disabled={page <= 1}
                onClick={() => setPage(current => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                className={QUIET}
                disabled={page >= pages}
                onClick={() => setPage(current => current + 1)}
              >
                Next
                <ChevronRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
          </PanelFoot>
        ) : (
          <PanelFoot>
            Every business the sender cannot write to, because it has no site of its own carrying an
            address. Ordered by the callbacks that have come due, then the numbers nobody has tried,
            busiest of their trade first.
          </PanelFoot>
        )}
      </Panel>

      {/* One business over the list it was opened from: the listing, why the
          sender could not reach it, the record of every call to it, and the
          form that adds to that record. */}
      <SidePanel
        open={Boolean(open)}
        title="Business"
        aside={open ? open.phone || undefined : undefined}
        onClose={() => setOpenId(null)}
      >
        {open && <CallSheet row={open} saving={saving} onRecord={record} />}
      </SidePanel>
    </ConsolePage>
  )
}
