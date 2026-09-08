import { useCallback, useEffect, useMemo, useState } from 'react'
import { m } from 'framer-motion'
import { BookOpen, ChevronLeft, ChevronRight, Phone, RotateCw } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { useSession } from '@hooks/session/useSession'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import { formatInstant } from '@lib/time/zone.js'
import { platformName, hostOf } from '@lib/outreach/prospects/platforms.js'
import {
  CALL_OUTCOMES,
  dialHref,
  outcomeNeedsCallback,
  outcomeOf,
  placeOf,
  SCORE_PEAK,
  SCORE_WEIGHTS,
  tellingTerms,
  TRACKS,
  waitAfter,
  whyListed,
} from '@lib/outreach/prospects/calls.js'
import {
  Area,
  Badge,
  ConsoleError,
  ConsolePage,
  ConsoleSplit,
  EmptyRow,
  Metric,
  Panel,
  PanelBody,
  PanelFoot,
  SectionNotice,
  ShareBar,
  SidePanel,
  SkeletonRows,
  StatCard,
  ViewNav,
} from '../../ui'
import {
  BUTTON,
  CELL_TIGHT as CELL,
  FIELD,
  MONO_LABEL,
  QUIET,
  ROW_HEIGHT,
  SELECT,
  TH_TIGHT as TH,
} from '../../lib/tokens'
import { useView } from '../../lib/views'
import { fullCount } from '../../../analytics/lib/format'
import CallHandbook from './CallHandbook'

/**
 * The businesses to ring, in the order to ring them, and what happened when
 * they were rung.
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
 * Three things this page has to do that a table of names does not.
 *
 * SAY WHY EACH BUSINESS IS HERE. The answer has been in the payload since the
 * first version and was never drawn: `skip_reason` is the enrichment job's own
 * words for why it gave up. Every row carries that sentence now, and the card
 * in Call Mode leads with it, because it is also the first thing to say on the
 * call.
 *
 * SAY WHY THEY SORT. The score is an integer out of a hundred and the
 * decomposition is the score function's own return value, so the chips in the
 * row, the scorecard in the panel and the checks all read one object and
 * cannot drift into three arithmetics. The largest term is how the listing
 * reads against the middle listing in its own trade, because review counts are
 * not comparable across trades: a restaurant collects reviews from every table
 * it turns and a machine shop from the two customers a year who think to leave
 * one, so ranking the raw figure puts sixty restaurants on the first page and
 * buries a welding shop that has quietly outperformed every welding shop in
 * the county.
 *
 * TAKE A BUSINESS OFF THE LIST ONCE IT IS RUNG. This is the change the section
 * could not work without. A business rung this morning used to still be on the
 * first page this afternoon, merely lower down; now every outcome buys a wait,
 * the row leaves the working list for the length of it, and it waits in a
 * counted Resting view where the number stays live and the record form still
 * opens. Suppression decides what the list OFFERS and never what a caller MAY
 * do.
 *
 * `quiet` is not a weak lead and the page must not read as though it were. A
 * business that has traded for years and collected a tenth of what its
 * neighbours collected is a business nobody can find, which is the entire
 * thing being sold. It scores below `busy` because a busy business has money
 * in the till this month, not because a quiet one is a bad call.
 *
 * Nothing here sends anything. There is no message, no letter and no queue -
 * the one action on the page is recording what a person heard when they picked
 * up a phone, and the note is theirs rather than anything composed for them.
 */

/** The four views, the first carrying no parameter so /console/calls is the front. */
const CALL_VIEWS = [
  { key: 'list', label: 'The List' },
  { key: 'calling', label: 'Call Mode' },
  { key: 'resting', label: 'Resting' },
  { key: 'finished', label: 'Finished' },
]

/** How the columns give way as the page narrows. The number never leaves. */
const HIDE_SM = 'hidden sm:table-cell'
const HIDE_MD = 'hidden md:table-cell'
const HIDE_LG = 'hidden lg:table-cell'
const HIDE_XL = 'hidden xl:table-cell'

/** What each reading of a trade says under the badge. */
const PULL_LABEL = {
  busy: 'Busy',
  steady: 'Steady',
  quiet: 'Quiet',
  unread: 'Unread',
}

/** Only `busy` carries a tone: a page where three of four bands are coloured has no emphasis in it. */
const PULL_TONE = { busy: 'good', steady: 'plain', quiet: 'plain', unread: 'plain' }

const STATE_OPTIONS = [
  { id: 'all', label: 'Any State' },
  { id: 'due', label: 'Due Back' },
  { id: 'fresh', label: 'Never Called' },
  { id: 'rung', label: 'Rung And Ready' },
]

const PULL_OPTIONS = [
  { id: 'all', label: 'Every Reading' },
  { id: 'busy', label: 'Busy For Its Trade' },
  { id: 'steady', label: 'Middling For Its Trade' },
  { id: 'quiet', label: 'Findable By Nobody' },
  { id: 'unread', label: 'Trade Unread' },
]

const SCORE_OPTIONS = [
  { id: 'all', label: 'Any Score' },
  { id: '40', label: 'Score 40 And Up' },
  { id: '55', label: 'Score 55 And Up' },
  { id: '70', label: 'Score 70 And Up' },
]

const SORT_OPTIONS = [
  { id: 'best', label: 'Best First' },
  { id: 'waited', label: 'Longest Since Rung' },
  { id: 'reviews', label: 'Most Reviews' },
  { id: 'newest', label: 'Newest On The List' },
]

/** The batch sizes Call Mode works in. */
const BATCHES = [25, 50, 100]

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

/** A day and time said the short way, for a return that is days rather than months out. */
function shortWhen(value) {
  if (!value) return '—'
  return formatInstant(new Date(value), {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** A run of hours said the way a person says it. */
function saidHours(hours) {
  if (hours === null || hours === undefined) return 'never'
  if (hours < 48) return 'a day'
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} days`
  if (days === 7) return 'a week'
  if (days === 14) return 'a fortnight'
  return `${Math.round(days / 7)} weeks`
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

/** The reviews behind a listing, written so the pair reads as one figure. */
function reviews(row) {
  if (typeof row.rating_count !== 'number') return '—'
  const rating = row.rating === null || row.rating === undefined ? null : Number(row.rating)
  const count = fullCount(row.rating_count)
  return rating === null ? count : `${count} at ${rating.toFixed(1)}`
}

/** How the listing reads against its trade, in a sentence rather than a tooltip. */
function pullSentence(row) {
  if (row.trade_median === null || row.trade_median === undefined) {
    return 'Too few in its trade to measure against.'
  }
  const ratio = row.pull_ratio === null ? null : row.pull_ratio.toFixed(1)
  const middle = fullCount(Math.round(row.trade_median))
  const count = typeof row.rating_count === 'number' ? fullCount(row.rating_count) : 'no'
  return `${count} reviews against a middle of ${middle} for ${row.trade ?? 'its trade'}${
    ratio ? `, which is ${ratio}× its trade` : ''
  }.`
}

/** What the history says, in a clause. */
function historyLine(row) {
  if (!row.last_call) return 'Nobody has rung this number.'
  const outcome = outcomeOf(row.last_call.outcome)?.label ?? row.last_call.outcome
  const nth = row.calls.length === 1 ? 'Rung once' : `Rung ${row.calls.length} times`
  return `${nth}, last ${when(row.last_call.called_at)} — ${outcome}.`
}

/** Where the business stands with the phone, and what that means in time. */
function placeNote(row) {
  if (row.place === 'due') return `promised ${shortWhen(row.callback_at)}`
  if (row.place === 'promised') return `ringing back ${shortWhen(row.ready_at)}`
  if (row.place === 'resting') return `back ${shortWhen(row.ready_at)}`
  if (row.place === 'ready') return 'waited out its gap'
  if (row.place === 'fresh') return ''
  return row.last_call ? when(row.last_call.called_at) : ''
}

/** The score, drawn against the fixed ceiling rather than the page maximum. */
function ScoreCell({ row }) {
  return (
    <div className="min-w-[3rem]">
      <span className="text-[15px] tabular-nums text-ink-paper">{row.score}</span>
      <ShareBar value={row.score} peak={SCORE_PEAK} />
    </div>
  )
}

/** The two strongest reasons and every penalty, each carrying its own points. */
function WhyChips({ terms }) {
  const telling = tellingTerms(terms)
  if (!telling.length) return <span className="text-paper-faint">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {telling.map(term => (
        <Badge key={term.id} tone={term.points < 0 ? 'bad' : term.points >= 25 ? 'good' : 'plain'}>
          {term.chip} {term.points > 0 ? `+${term.points}` : term.points}
        </Badge>
      ))}
    </span>
  )
}

/**
 * A full-width heading inside the table saying which band the rows under it
 * are in and why.
 *
 * Drawn only while the list is in its own order. A band label scattered
 * through a list sorted by review count is a statement about an order that is
 * not the one on screen.
 */
function BandHeading({ cols, title, count, note }) {
  return (
    <tr className="bg-[color:var(--wash-paper)]">
      <td colSpan={cols} className="px-3 py-2">
        <span className={`${MONO_LABEL} text-ink-paper`}>
          {title}
          {count === undefined ? '' : ` · ${fullCount(count)}`}
        </span>
        <span className={`${MONO_LABEL} text-paper-faint ml-2`}>{note}</span>
      </td>
    </tr>
  )
}

/** One business on the list. */
function CallRow({ row, onOpen, onCall }) {
  const place = placeOf(row.place)
  const href = dialHref(row.phone)
  const note = placeNote(row)

  return (
    <tr>
      <td className={CELL}>
        <button
          type="button"
          className="text-left text-ink-paper hover:text-accent"
          onClick={() => onOpen(row)}
          aria-haspopup="dialog"
        >
          {row.name || 'Unnamed business'}
        </button>
        <span className={`${MONO_LABEL} text-paper-faint block`}>
          {[row.trade, row.town].filter(Boolean).join(' · ')}
        </span>
      </td>
      <td className={CELL}>
        <ScoreCell row={row} />
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
      <td className={`${CELL} ${HIDE_SM}`}>
        <Badge tone={PULL_TONE[row.pull] ?? 'plain'}>{PULL_LABEL[row.pull] ?? 'Unread'}</Badge>
        <span className={`${MONO_LABEL} text-paper-faint mt-1 block`}>
          {row.trade_median === null
            ? 'trade unread'
            : `${fullCount(row.rating_count ?? 0)} reviews · middle ${fullCount(Math.round(row.trade_median))}`}
        </span>
      </td>
      <td className={`${CELL} ${HIDE_XL}`}>
        <WhyChips terms={row.terms} />
      </td>
      <td className={`${CELL} ${HIDE_LG}`}>{presence(row)}</td>
      <td className={`${CELL} ${HIDE_MD}`}>
        {row.last_call ? `${row.calls.length}×, ${when(row.last_call.called_at)}` : '—'}
      </td>
      <td className={CELL}>
        <Badge tone={place?.tone ?? 'plain'}>{place?.label ?? 'Ready'}</Badge>
        {note && <span className={`${MONO_LABEL} text-paper-faint mt-1 block`}>{note}</span>}
      </td>
      <td className={CELL}>
        <button
          type="button"
          className={QUIET}
          aria-label={`Call ${row.name || 'this business'}`}
          onClick={() => onCall(row)}
        >
          <Phone aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </td>
    </tr>
  )
}

/** The nine placeholder columns, matching the hide classes above. */
const LIST_COLS = [
  'px-3',
  'px-3',
  'px-3',
  `px-3 ${HIDE_SM}`,
  `px-3 ${HIDE_XL}`,
  `px-3 ${HIDE_LG}`,
  `px-3 ${HIDE_MD}`,
  'px-3',
  'px-3',
]

/**
 * The form that records one call, used in the side panel and in Call Mode
 * alike.
 *
 * The outcomes are grouped by track rather than offered as eight equal
 * buttons, because the caller has already decided which of the four things
 * happened before they look at the screen. The helper line under the control
 * reads the business rather than reciting a default: what a second no-answer
 * buys is not what a fourth buys, and the ladder is the one part of this the
 * page cannot expect anybody to remember.
 */
function RecordForm({ row, saving, onRecord, startOn }) {
  const [outcome, setOutcome] = useState(startOn ?? 'no_answer')
  const [note, setNote] = useState('')
  const [callback, setCallback] = useState('')
  const needsCallback = outcomeNeedsCallback(outcome)
  const ends = Boolean(outcomeOf(outcome)?.ends)
  const wait = waitAfter(row, outcome)

  const submit = async event => {
    event.preventDefault()
    const saved = await onRecord({
      id: row.id,
      outcome,
      note,
      callback_at: callback && !ends ? new Date(callback).toISOString() : null,
    })
    if (saved) {
      setNote('')
      setCallback('')
      setOutcome(startOn ?? 'no_answer')
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1.5">
        <span className={`${MONO_LABEL} text-paper-faint`}>What The Call Came To</span>
        <select
          className={SELECT}
          value={outcome}
          onChange={event => setOutcome(event.target.value)}
        >
          {TRACKS.map(track => (
            <optgroup key={track.id} label={track.label}>
              {CALL_OUTCOMES.filter(one => one.track === track.id).map(one => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className={`${MONO_LABEL} text-paper-faint`}>
          {ends
            ? 'Takes them off the list. They can still be opened and recorded against.'
            : needsCallback
              ? 'They come back at the time you name, ahead of everything else.'
              : `They rest ${saidHours(wait)}, then come back to the list.`}
        </span>
      </label>

      {!ends && (
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>
            {needsCallback ? 'Ring Them Back At' : 'Or Defer Them To'}
          </span>
          <input
            type="datetime-local"
            className={FIELD}
            value={callback}
            required={needsCallback}
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
  )
}

/** Everything known about one business, and the form that adds to it. */
function Sheet({ row, saving, recorded, onRecord, startOn, onHandbook }) {
  const href = dialHref(row.phone)

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

      {/* The way to what to say, on a screen with no room to show it alongside.
          Under the number rather than at the foot of the record, because the
          moment it is wanted is the moment the number has just been pressed. */}
      <button
        type="button"
        className={`${QUIET} justify-center min-[1180px]:hidden`}
        onClick={onHandbook}
      >
        <BookOpen aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
        What To Say
      </button>

      <div className="grid gap-1">
        <p className={`${MONO_LABEL} text-paper-faint`}>Why They Are Here</p>
        <p className="text-[13px] text-ink-paper">{whyListed(row)}</p>
        {row.skip_reason && (
          <p className={`${MONO_LABEL} text-paper-faint`}>
            The sender stopped at: {row.skip_reason}.
          </p>
        )}
      </div>

      <div className="grid gap-1">
        <p className={`${MONO_LABEL} text-paper-faint`}>
          Score {row.score}
          {row.raw_score !== row.score ? ` (the readings came to ${row.raw_score})` : ''}
        </p>
        <dl className="grid gap-1">
          {row.terms.map(term => (
            <div key={term.id} className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-ink-paper">{term.label}</dt>
              <dd className={`${MONO_LABEL} text-paper-faint whitespace-nowrap`}>
                {term.chip}{' '}
                <span className="tabular-nums text-ink-paper">
                  {term.points > 0 ? `+${term.points}` : term.points}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <p className={`${MONO_LABEL} text-paper-faint`}>{pullSentence(row)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Metric label="Reviews" value={reviews(row)} />
        <Metric
          label="Its Trade’s Middle"
          value={row.trade_median === null ? 'Too few' : fullCount(Math.round(row.trade_median))}
        />
        <Metric label="Instead Of A Site" value={presence(row)} />
        <Metric label="State" value={placeOf(row.place)?.label ?? 'Ready'} />
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

      {recorded ? (
        <p className="text-[13px] text-ink-paper">{recorded}</p>
      ) : (
        <RecordForm row={row} saving={saving} onRecord={onRecord} startOn={startOn} />
      )}

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

/**
 * One business at a time, off a batch held still.
 *
 * The batch is snapshotted when the view opens rather than re-read from the
 * feed, and a business that has been worked stays where it is with the outcome
 * it was given. A row disappearing shifts everything under it by one row
 * height at the exact moment the next name is being read, which is how a place
 * is lost.
 *
 * The eight outcomes are on eight number keys. A caller with a phone in one
 * hand has one hand for the keyboard, and a dropdown plus a submit is four
 * actions for the outcome that happens most: nobody picks up.
 */
function CallCard({ row, saving, recorded, onQuick, onOpen }) {
  const href = dialHref(row.phone)

  return (
    <div className="grid gap-4 px-5 py-4">
      <div className="grid gap-1">
        <h3 className="text-[20px] text-ink-paper">{row.name || 'Unnamed business'}</h3>
        <p className={`${MONO_LABEL} text-paper-faint`}>
          {[row.trade, row.town].filter(Boolean).join(' · ')}
        </p>
        <p className="text-paper-faint min-h-[18px] text-[13px]">{row.address || '—'}</p>
      </div>

      {href && (
        <a href={href} className={`${BUTTON} min-h-[56px] text-[18px]`}>
          <Phone aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
          {row.phone}
        </a>
      )}

      <div className="grid min-h-[64px] gap-1">
        <p className="text-[13px] text-ink-paper">{whyListed(row)}</p>
        <p className={`${MONO_LABEL} text-paper-faint`}>{pullSentence(row)}</p>
        <p className={`${MONO_LABEL} text-paper-faint`}>{historyLine(row)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Score" value={String(row.score)} />
        <Metric label="Reviews" value={reviews(row)} />
        <Metric
          label="Trade Middle"
          value={row.trade_median === null ? 'Too few' : fullCount(Math.round(row.trade_median))}
        />
        <Metric label="Instead Of A Site" value={presence(row)} />
      </dl>

      <div className="grid gap-2">
        <p className={`${MONO_LABEL} text-paper-faint`}>
          {recorded || 'What did the call come to?'}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CALL_OUTCOMES.map(outcome => (
            <button
              key={outcome.id}
              type="button"
              className={QUIET}
              disabled={saving}
              onClick={() => onQuick(outcome.id)}
            >
              <span className="border-hair-paper mr-1 rounded-[var(--r-tiny)] border px-1">
                {outcome.key}
              </span>
              {outcome.label}
            </button>
          ))}
        </div>
        <button type="button" className={QUIET} onClick={() => onOpen(row)}>
          Open The Record To Add A Note Or A Time
        </button>
      </div>
    </div>
  )
}

export default function CallsPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const [view, go] = useView(CALL_VIEWS)

  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [state, setState] = useState('all')
  const [pull, setPull] = useState('all')
  const [minScore, setMinScore] = useState('all')
  const [town, setTown] = useState('all')
  const [trade, setTrade] = useState('all')
  const [sort, setSort] = useState('best')
  const [take, setTake] = useState(50)
  const [page, setPage] = useState(1)

  const [openRow, setOpenRow] = useState(null)
  const [asked, setAsked] = useState(null)
  const [recorded, setRecorded] = useState(null)
  // Only read on a screen too narrow to carry the handbook beside the record.
  // Where there is room for both, the stylesheet shows it whatever this says.
  const [handbook, setHandbook] = useState(false)
  const [batch, setBatch] = useState([])
  const [worked, setWorked] = useState({})
  const [at, setAt] = useState(0)
  const [keyOpen, setKeyOpen] = useState(false)

  // A fetch per keystroke re-reads the whole callable set and the whole calls
  // table, so the typing and the question are two states with a pause between.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), 250)
    return () => clearTimeout(timer)
  }, [typed])

  const filters = useMemo(
    () => ({
      view,
      search,
      state,
      pull,
      min_score: minScore,
      town,
      trade,
      sort,
      take: view === 'calling' ? 100 : take,
      page,
    }),
    [view, search, state, pull, minScore, town, trade, sort, take, page]
  )

  const { data, retained, error, loading, saving, refresh, record } = useCallsFeed({
    token,
    enabled: Boolean(token),
    filters,
  })

  // A new filter selects different rows and a new order selects the same rows
  // in a different sequence, and page four of the last question is no part of
  // either.
  useEffect(() => {
    setPage(1)
  }, [view, search, state, pull, minScore, town, trade, sort, take])

  const rows = useMemo(() => data?.rows || [], [data])
  const totals = data?.totals || {}
  const matchedTotals = data?.matched_totals || {}

  // The lists the dropdowns offer and the pager's count of pages describe the
  // question rather than answer it, so they read the last payload that landed.
  // Deriving them from `data` empties a dropdown of the option just picked and
  // unmounts the pager the moment Next is pressed.
  const towns = retained?.towns || []
  const trades = retained?.trades || []
  const pages = retained?.pages || 1

  // The batch is held rather than re-read, so the order under the caller never
  // moves while they work it.
  const holdBatch = useCallback(() => {
    setBatch(rows)
    setWorked({})
    setAt(0)
  }, [rows])

  useEffect(() => {
    if (view !== 'calling') return
    setBatch(current => (current.length ? current : rows))
  }, [view, rows])

  const current = batch[at] ?? null

  const write = useCallback(
    async call => {
      const saved = await record(call)
      if (saved) {
        const label = outcomeOf(call.outcome)?.label ?? 'the call'
        const wait = waitAfter({ calls: [] }, call.outcome)
        setRecorded(
          outcomeOf(call.outcome)?.ends
            ? `Recorded ${label}. They are off the list.`
            : call.callback_at
              ? `Recorded ${label}. Back ${shortWhen(call.callback_at)}.`
              : `Recorded ${label}. Back in ${saidHours(wait)}.`
        )
      }
      return saved
    },
    [record]
  )

  const quick = useCallback(
    async outcome => {
      if (!current) return
      // A call back is the one outcome a key cannot finish, because it has a
      // time on it. The record opens already set to it rather than back at No
      // Answer, so the caller names the time rather than choosing again the
      // outcome they have just chosen.
      if (outcomeNeedsCallback(outcome)) {
        setOpenRow(current)
        setAsked(outcome)
        setRecorded(null)
        return
      }
      const saved = await write({ id: current.id, outcome, note: '', callback_at: null })
      if (saved) {
        setWorked(held => ({ ...held, [current.id]: outcome }))
        setAt(index => index + 1)
        setRecorded(null)
      }
    },
    [current, write]
  )

  // The eight outcomes on the eight number keys, ignored while a field has
  // focus so typing a note never records a call.
  useEffect(() => {
    if (view !== 'calling' || !current || openRow) return undefined
    const onKey = event => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const outcome = CALL_OUTCOMES.find(one => one.key === event.key)
      if (!outcome) return
      event.preventDefault()
      quick(outcome.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, current, openRow, quick])

  const openBusiness = useCallback(row => {
    setOpenRow(row)
    setAsked(null)
    setRecorded(null)
    setHandbook(false)
  }, [])

  const closeBusiness = useCallback(() => {
    setOpenRow(null)
    setAsked(null)
    setRecorded(null)
    setHandbook(false)
  }, [])

  // A call recorded through the record while Call Mode is open finishes the
  // business the caller was on, so the batch moves the way a key moves it.
  // Without this the caller names the time somebody gave them and then finds
  // the same business still in front of them.
  const writeFromSheet = useCallback(
    async call => {
      const saved = await write(call)
      if (saved && view === 'calling' && current && call.id === current.id) {
        setWorked(held => ({ ...held, [current.id]: call.outcome }))
        setAt(index => index + 1)
        setOpenRow(null)
        setAsked(null)
      }
      return saved
    },
    [write, view, current]
  )

  const callOne = useCallback(
    row => {
      setBatch([row])
      setWorked({})
      setAt(0)
      go('calling')
    },
    [go]
  )

  const narrowed =
    state !== 'all' || pull !== 'all' || minScore !== 'all' || town !== 'all' || trade !== 'all'

  const clearAll = () => {
    setState('all')
    setPull('all')
    setMinScore('all')
    setTown('all')
    setTrade('all')
  }

  // A refusal with nothing behind it is the whole answer, so it stands in
  // place of the table rather than above an empty one.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  const banded = data?.sort === 'best'
  const bands = data?.bands || {}

  const listRows = []
  let lastBand = null
  for (const row of rows) {
    const band = row.place === 'due' ? 'due' : 'call'
    if (banded && band !== lastBand) {
      listRows.push(
        <BandHeading
          key={`band-${band}`}
          cols={9}
          title={band === 'due' ? 'Promised Back, And Due Now' : 'To Call, Best First'}
          count={band === 'due' ? bands.due : bands.call}
          note={
            band === 'due'
              ? 'they named the time themselves, so these lead whatever the filters say'
              : 'ordered by score, highest first'
          }
        />
      )
      lastBand = band
    }
    listRows.push(<CallRow key={row.id} row={row} onOpen={openBusiness} onCall={callOne} />)
  }

  return (
    <ConsolePage areas={['stats', 'views', 'work']} rows="auto auto minmax(0,1fr)">
      <Area area="stats">
        <ConsoleError>{error}</ConsoleError>

        <m.div {...fadeInUp} className="console-stats" aria-busy={loading}>
          <StatCard
            label="To Call"
            value={loading ? '' : fullCount(totals.call ?? 0)}
            caption="ready to ring right now"
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
            label="Resting"
            value={loading ? '' : fullCount(totals.resting ?? 0)}
            caption="rung recently, waiting out their gap"
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
        <ViewNav
          views={CALL_VIEWS.map(one => ({
            ...one,
            count:
              one.key === 'resting'
                ? (totals.resting ?? 0)
                : one.key === 'finished'
                  ? (totals.booked ?? 0) + (totals.closed ?? 0)
                  : undefined,
          }))}
          current={view}
          onPick={go}
          label="Call List Views"
          loading={loading}
        />

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className={`${FIELD} max-w-[220px]`}
            placeholder="Name, town or number"
            value={typed}
            onChange={event => setTyped(event.target.value)}
            aria-label="Search The Call List"
          />
          {view !== 'resting' && view !== 'finished' && (
            <>
              <select
                className={SELECT}
                value={state}
                onChange={event => setState(event.target.value)}
                aria-label="State"
              >
                {STATE_OPTIONS.map(one => (
                  <option key={one.id} value={one.id}>
                    {one.label}
                  </option>
                ))}
              </select>
              <select
                className={SELECT}
                value={minScore}
                onChange={event => setMinScore(event.target.value)}
                aria-label="Least Score"
              >
                {SCORE_OPTIONS.map(one => (
                  <option key={one.id} value={one.id}>
                    {one.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <select
            className={SELECT}
            value={pull}
            onChange={event => setPull(event.target.value)}
            aria-label="For Its Trade"
          >
            {PULL_OPTIONS.map(one => (
              <option key={one.id} value={one.id}>
                {one.label}
              </option>
            ))}
          </select>
          <select
            className={SELECT}
            value={town}
            onChange={event => setTown(event.target.value)}
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
            onChange={event => setTrade(event.target.value)}
            aria-label="Trade"
          >
            <option value="all">Every Trade</option>
            {trades.map(one => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </select>
          {view === 'list' && (
            <select
              className={SELECT}
              value={sort}
              onChange={event => setSort(event.target.value)}
              aria-label="Sort Order"
            >
              {SORT_OPTIONS.map(one => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </select>
          )}
          {narrowed && (
            <button type="button" className={QUIET} onClick={clearAll}>
              Clear All
            </button>
          )}
          <button type="button" className={`${QUIET} ml-auto`} onClick={refresh}>
            <RotateCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            Re-read
          </button>
        </div>
      </Area>

      {view === 'calling' ? (
        <ConsoleSplit
          area="work"
          list={
            <Panel
              title="The Batch"
              loading={loading}
              aside={
                <span className={`${MONO_LABEL} text-paper-faint`}>
                  {loading
                    ? ''
                    : `${fullCount(Object.keys(worked).length)} of ${fullCount(batch.length)} worked`}
                </span>
              }
            >
              <PanelBody>
                <div className="flex flex-wrap gap-2 px-3 py-2">
                  {BATCHES.map(size => (
                    <button
                      key={size}
                      type="button"
                      className={QUIET}
                      aria-pressed={take === size}
                      onClick={() => {
                        setTake(size)
                        holdBatch()
                      }}
                    >
                      Take {size}
                    </button>
                  ))}
                  <button type="button" className={QUIET} onClick={holdBatch}>
                    Take A Fresh Batch
                  </button>
                </div>
                <ul className="grid">
                  {batch.map((one, index) => (
                    <li
                      key={one.id}
                      className={`border-hair-paper flex items-baseline justify-between gap-2 border-t px-3 py-2 ${
                        index === at ? 'bg-[color:var(--wash-accent)]' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="truncate text-left text-[13px] text-ink-paper hover:text-accent"
                        onClick={() => setAt(index)}
                      >
                        {one.name || 'Unnamed business'}
                        <span className={`${MONO_LABEL} text-paper-faint block`}>{one.town}</span>
                      </button>
                      {worked[one.id] ? (
                        <Badge tone={outcomeOf(worked[one.id])?.tone ?? 'plain'}>
                          {outcomeOf(worked[one.id])?.label}
                        </Badge>
                      ) : (
                        <span className={`${MONO_LABEL} text-paper-faint`}>{one.score}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          }
        >
          <Panel
            title="Calling"
            loading={loading}
            aside={
              <span className={`${MONO_LABEL} text-paper-faint`}>
                {loading ? '' : `${fullCount(Math.max(0, batch.length - at))} to go`}
              </span>
            }
          >
            <PanelBody>
              {current ? (
                <CallCard
                  row={current}
                  saving={saving}
                  recorded={recorded}
                  onQuick={quick}
                  onOpen={openBusiness}
                />
              ) : (
                <div className="grid gap-3 px-5 py-4">
                  <p className="text-[14px] text-ink-paper">
                    {batch.length
                      ? 'That is the batch worked through.'
                      : narrowed
                        ? 'Nothing matches those filters, so there is no batch to work.'
                        : 'Nothing is ready to ring right now.'}
                  </p>
                  <p className={`${MONO_LABEL} text-paper-faint`}>
                    {fullCount(totals.resting ?? 0)} are resting
                    {data?.next_back
                      ? `, and the first comes back ${shortWhen(data.next_back)}`
                      : ''}
                    .
                  </p>
                  <span className="flex flex-wrap gap-2">
                    <button type="button" className={BUTTON} onClick={holdBatch}>
                      Take Another Batch
                    </button>
                    {narrowed && (
                      <button type="button" className={QUIET} onClick={clearAll}>
                        Clear All
                      </button>
                    )}
                  </span>
                </div>
              )}
            </PanelBody>
          </Panel>
        </ConsoleSplit>
      ) : (
        <Panel
          title={view === 'resting' ? 'Resting' : view === 'finished' ? 'Finished' : 'Call List'}
          area="work"
          loading={loading}
          aside={
            <span className={`${MONO_LABEL} text-paper-faint`}>
              {loading ? '' : `${fullCount(data?.matched ?? 0)} matching`}
            </span>
          }
        >
          <PanelBody>
            {data?.complete === false && (
              <SectionNotice>
                The read stopped at its ceiling of {fullCount(data.cap)} businesses, so the figures
                above cover that many rather than the whole table.
              </SectionNotice>
            )}
            <table className="console-table">
              <thead>
                <tr>
                  <th className={TH}>Business</th>
                  <th className={TH}>Score</th>
                  <th className={TH}>Number</th>
                  <th className={`${TH} ${HIDE_SM}`}>For Its Trade</th>
                  <th className={`${TH} ${HIDE_XL}`}>Why This One</th>
                  <th className={`${TH} ${HIDE_LG}`}>Instead Of A Site</th>
                  <th className={`${TH} ${HIDE_MD}`}>Rung</th>
                  <th className={TH}>State</th>
                  <th className={TH}>Call</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={LIST_COLS} rows={10} height={ROW_HEIGHT.calls} />
                ) : rows.length ? (
                  listRows
                ) : (
                  <EmptyRow cols={9}>
                    {view === 'resting'
                      ? 'Nothing is resting. Every business either waits for a call or is finished with.'
                      : view === 'finished'
                        ? 'Nothing has come off the list yet.'
                        : narrowed || search
                          ? 'Nothing is ready to ring under these filters.'
                          : `Nothing is ready to ring. ${fullCount(matchedTotals.resting ?? totals.resting ?? 0)} are resting.`}
                  </EmptyRow>
                )}
              </tbody>
            </table>
          </PanelBody>
          <PanelFoot>
            <span className="flex flex-wrap items-center gap-2">
              <span className={`${MONO_LABEL} text-paper-faint`}>
                {view === 'resting'
                  ? 'Soonest back first. The number still dials and the record still opens.'
                  : view === 'finished'
                    ? 'Last call first. Recording another call puts a business back on the list.'
                    : banded
                      ? 'Ordered by score, best first.'
                      : 'Ordered as you asked, so the band headings are off.'}
              </span>
              <button type="button" className={QUIET} onClick={() => setKeyOpen(true)}>
                How It Is Ranked
              </button>
            </span>
            {pages > 1 && (
              <span className="inline-flex items-center gap-2">
                <span className={`${MONO_LABEL} text-paper-faint`}>
                  Page {fullCount(data?.page ?? page)} of {fullCount(pages)}
                </span>
                <button
                  type="button"
                  className={QUIET}
                  disabled={page <= 1}
                  onClick={() => setPage(one => Math.max(1, one - 1))}
                >
                  <ChevronLeft className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  Previous
                </button>
                <button
                  type="button"
                  className={QUIET}
                  disabled={page >= pages}
                  onClick={() => setPage(one => one + 1)}
                >
                  Next
                  <ChevronRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </span>
            )}
          </PanelFoot>
        </Panel>
      )}

      {/* One business over the list it was opened from: why it is here, what
          it scores and out of what, every call placed to it, and the form that
          adds to that record. Held in state rather than resolved out of the
          current page, because recording a call takes the business off the
          working list and the panel would go blank under whoever was reading
          it.

          Against the far edge, what to say to them: the opening written out
          with this business's own facts in it, the answer to whatever they ask,
          and the sentence for whatever they push back with. It arrives with the
          record and leaves with it, because a script is only ever read at
          somebody. */}
      <SidePanel
        open={Boolean(openRow)}
        title="Business"
        aside={openRow ? openRow.phone || undefined : undefined}
        onClose={closeBusiness}
        leadOpen={handbook}
        lead={
          openRow && (
            <CallHandbook
              key={openRow.id}
              row={openRow}
              caller={session?.user?.user_metadata?.full_name}
              onClose={() => setHandbook(false)}
            />
          )
        }
      >
        {openRow && (
          <Sheet
            key={openRow.id}
            row={openRow}
            saving={saving}
            recorded={recorded}
            onRecord={writeFromSheet}
            startOn={asked}
            onHandbook={() => setHandbook(true)}
          />
        )}
      </SidePanel>

      {/* What the score is made of, in one place, so a number on a row is
          never the only explanation of itself. */}
      <SidePanel open={keyOpen} title="How It Is Ranked" onClose={() => setKeyOpen(false)}>
        <div className="grid gap-4 px-5 py-4">
          <p className="text-[13px] text-ink-paper">
            Every business is scored out of {SCORE_PEAK} and the list is worked from the top. A
            business that promised a time and has reached it leads whatever it scores, because
            somebody named that time themselves.
          </p>
          <dl className="grid gap-2">
            <div>
              <dt className={`${MONO_LABEL} text-paper-faint`}>
                How its trade reads · up to {SCORE_WEIGHTS.trade.busy}
              </dt>
              <dd className="text-[13px] text-ink-paper">
                Its review count against the middle count for its own trade, not against every trade
                at once. A restaurant collects reviews from every table it turns and a machine shop
                from the two customers a year who think to leave one, so the raw figure would put
                sixty restaurants on the first page.
              </dd>
            </div>
            <div>
              <dt className={`${MONO_LABEL} text-paper-faint`}>
                Work of ours to name · up to {SCORE_WEIGHTS.proof.trade}
              </dt>
              <dd className="text-[13px] text-ink-paper">
                Whether the portfolio holds a site in their trade, or failing that in their town. It
                is the strongest opener there is and it is also a fact about us, so it is held to a
                fifth of the scale.
              </dd>
            </div>
            <div>
              <dt className={`${MONO_LABEL} text-paper-faint`}>
                What it has instead of a site · up to {SCORE_WEIGHTS.presence.booking}
              </dt>
              <dd className="text-[13px] text-ink-paper">
                A business already paying for a booking or ordering platform has the budget line and
                the need. A page it does not own is next. Nothing at all is the cleanest pitch and
                the longest conversation. A directory somebody else listed it in says nothing about
                the business either way.
              </dd>
            </div>
            <div>
              <dt className={`${MONO_LABEL} text-paper-faint`}>
                Somebody has heard it · up to {SCORE_WEIGHTS.reached.points}
              </dt>
              <dd className="text-[13px] text-ink-paper">
                A business whose owner or receptionist has taken the call and has not said no is
                warmer than one nobody has reached.
              </dd>
            </div>
            <div>
              <dt className={`${MONO_LABEL} text-paper-faint`}>
                What its customers say · {SCORE_WEIGHTS.reputation.under}
              </dt>
              <dd className="text-[13px] text-ink-paper">
                Only ever a subtraction, and only under {SCORE_WEIGHTS.reputation.floorRating} stars
                over {SCORE_WEIGHTS.reputation.floorCount} reviews. A good rating earns nothing: a
                third of the rated listings sit at five stars over a handful of reviews, so
                rewarding it would put a few hundred near-empty listings on top.
              </dd>
            </div>
            <div>
              <dt className={`${MONO_LABEL} text-paper-faint`}>
                Rings nobody picked up · {SCORE_WEIGHTS.attempts.each} each, floored at{' '}
                {SCORE_WEIGHTS.attempts.floor}
              </dt>
              <dd className="text-[13px] text-ink-paper">
                A gatekeeper answering is progress rather than a failed try, so only the rings that
                reached nobody count here.
              </dd>
            </div>
          </dl>
          <p className={`${MONO_LABEL} text-paper-faint`}>
            After a call the business rests and leaves this list until its gap is up: a day after no
            answer, three days after a voicemail, two after a gatekeeper, a week after speaking to
            somebody. The gap lengthens each time a number goes unanswered — a day, three days, a
            week, a fortnight, then a month. A time you name yourself always wins.
          </p>
        </div>
      </SidePanel>
    </ConsolePage>
  )
}
