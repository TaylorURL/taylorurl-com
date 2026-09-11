import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Phone,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { EASE } from '@constants/animations'
import { useSession } from '@hooks/session/useSession'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import { useCallDesk } from '@hooks/console/useCallDesk'
import { formatInstant } from '@lib/time/zone.js'
import { platformName, hostOf } from '@lib/outreach/prospects/platforms.js'
import {
  ASSIGNED_MINE,
  ASSIGNED_NOBODY,
  CALL_OUTCOMES,
  defaultCallbackAt,
  dialHref,
  outcomeAsksInterest,
  outcomeOf,
  outcomeTakesCallback,
  ownerOf,
  placeOf,
  SCORE_PEAK,
  SCORE_WEIGHTS,
  tellingTerms,
  TRACKS,
  waitAfter,
  whyListed,
} from '@lib/outreach/prospects/calls.js'
import {
  CALL_PULLS,
  CALL_SCORES,
  CALL_SORTS,
  CALL_STATES,
  bandOf,
  columnOf,
  columnsAt,
  columnWidths,
  DEFAULT_PREFS,
  filterChips,
  filtersNarrow,
  NO_FILTERS,
  sameNarrowing,
  withoutFilter,
} from '@lib/outreach/prospects/callPrefs.js'
import { callerMark, callerName, heldByOther } from '@lib/outreach/prospects/callPresence.js'
import { shiftOf } from '@lib/outreach/prospects/callShift.js'
import {
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
  ViewNav,
} from '../../ui'
import {
  BUTTON,
  CELL_END,
  CELL_END_PACKED,
  CELL_PACKED,
  CELL_TIGHT as CELL,
  CHIP_BUTTON,
  CHIP_ON,
  FIELD,
  MONO_LABEL,
  QUIET,
  QUIET_ROW,
  ROW_HEIGHT,
  SELECT,
  SELECT_ON,
  TH_END,
  TH_TIGHT as TH,
} from '../../lib/tokens'
import { useView } from '../../lib/views'
import { recalledRows, rememberRows } from '../../lib/rowMemory'
import { fullCount } from '../../../analytics/lib/format'
import CallHandbook from './CallHandbook'
import CallBoard from './CallBoard'
import CallRecord from './CallRecord'
import CallRings from './CallRings'
import CallSetup from './CallSetup'

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
 * Six things this page has to do that a table of names does not.
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
 * SAY WHO IS ON A NUMBER RIGHT NOW. Suppression only ever works backwards: a
 * business is taken off the list once a call to it has been recorded, and the
 * whole of a double call happens in the four minutes before anybody records
 * anything. Two callers who open this page a minute apart are handed the same
 * page in the same order. So the list is live rather than a snapshot - it
 * re-reads itself while somebody is watching - and every console says which
 * number it is on, which is drawn on the row, on the board above it, and as a
 * lock on the one control that would place the second call.
 *
 * SAY WHETHER THEY WANTED IT. Which is a different question from what the call
 * came to, and only the person who made it can answer either. Spoke To Owner
 * covers the owner who asked what it would cost and the owner who said no
 * thanks and hung up, and the section next door reads that column to decide who
 * is a lead - so it filed both, and half of the first afternoon's leads had to
 * be ruled out by hand. The caller is asked outright now, on the two outcomes
 * that leave the question open, and the answer is one keystroke because it sits
 * between them and the next business.
 *
 * LET THE READER SET IT UP. Which columns, how tight the rows, what it is
 * narrowed to and which narrowings are worth keeping are all facts about the
 * person working the list rather than about the list, so none of them is a
 * default anybody has to be right about. They are stored on the account and
 * read back on whichever machine that account signs in from.
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

/**
 * Which of the stylesheet's widths the window is at.
 *
 * A column that gives way as the page narrows cannot simply be hidden by a
 * class here, because every column's width is a share of a hundred and a share
 * can only be taken over the columns that are actually drawn. So the page
 * knows the width it is at and draws the columns for it, and the shares add up
 * at every size.
 *
 * Only a crossing changes anything. React drops a set to the same value, so a
 * drag across the screen re-renders at four widths rather than at four hundred.
 */
function useBand() {
  const [band, setBand] = useState(() =>
    bandOf(typeof window === 'undefined' ? undefined : window.innerWidth)
  )
  useEffect(() => {
    const measure = () => setBand(bandOf(window.innerWidth))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return band
}

/** What each reading of a trade says under the badge. */
const PULL_LABEL = {
  busy: 'Busy',
  steady: 'Steady',
  quiet: 'Quiet',
  unread: 'Unread',
}

/** Only `busy` carries a tone: a page where three of four bands are coloured has no emphasis in it. */
const PULL_TONE = { busy: 'good', steady: 'plain', quiet: 'plain', unread: 'plain' }

/** Where a table's remembered row shape is filed, per density. */
const REMEMBERED = 'taylorurl_console_calls_rows'

/**
 * The block above the table, and how long it takes to fold away.
 *
 * The figures, the tabs, the board and the six filters are what the list is
 * read against, and on a laptop they are also two thirds of the window - which
 * leaves the table itself eight rows deep, and a caller working fifteen hundred
 * businesses scrolling a card rather than reading a list. So the whole block
 * folds, and the table takes the room it leaves.
 *
 * It is one fold rather than four collapsible strips, because a page a reader
 * has to reassemble is worse than either of the two states. The button says
 * which of the two is on and nothing else is a control.
 *
 * A third of a second: long enough to be followed from one state to the other,
 * short enough that a caller who folds it to read a row is not waiting on it.
 * A reader who has asked for less motion gets neither: the config around the
 * page carries that preference for anything that travels, and a box closing on
 * its own height is not one of the things it reaches, so the fold reads it.
 */
const CHROME = 'calls-chrome'
const FOLD = 0.32

/**
 * How tall the block is when it is open, measured rather than named.
 *
 * A fold has to travel between two numbers, and `auto` is not one: the whole
 * of what is in there wraps differently at every width, and gains a line the
 * moment a filter is set. So the content is measured where it stands and the
 * box around it is animated to that, which also means the box follows the
 * content while it is open - a chip row appearing eases the block down rather
 * than snapping it.
 */
function useFoldHeight() {
  const inner = useRef(null)
  const [tall, setTall] = useState(null)
  useEffect(() => {
    const el = inner.current
    if (!el) return undefined
    // Rounded up rather than down: half a pixel short of the content is half a
    // pixel of the last row clipped, and half a pixel over is nothing.
    const measure = () => setTall(Math.ceil(el.getBoundingClientRect().height))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return [inner, tall]
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
function ScoreCell({ row, tight }) {
  return (
    <div className="min-w-[3rem]">
      <span className="text-[15px] tabular-nums text-ink-paper">{row.score}</span>
      {!tight && <ShareBar value={row.score} peak={SCORE_PEAK} />}
    </div>
  )
}

/**
 * The two strongest reasons and every penalty, each carrying its own points.
 *
 * The tight setting keeps the best reason and every penalty and drops the
 * second reason, which is the one chip that costs a row its second line. What
 * it keeps is the half that changes a decision: the strongest thing about a
 * business is usually why it is on the page at all, and a penalty is the thing
 * a caller would otherwise not have known.
 */
function WhyChips({ terms, tight }) {
  const telling = tellingTerms(terms)
  const drawn = tight ? telling.filter((term, at) => at === 0 || term.points < 0) : telling
  if (!drawn.length) return <span className="text-paper-faint">—</span>
  return (
    <span className={tight ? 'flex gap-1 overflow-hidden' : 'flex flex-wrap gap-1'}>
      {drawn.map(term => (
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

/**
 * One cell of one row.
 *
 * Every column is drawn from here rather than from a fixed run of `<td>`s,
 * because which columns are on screen belongs to the account. The second line
 * under a figure is what the tight setting takes away: it is the difference
 * between a table that explains itself and one that fits twice as many
 * businesses on the screen, and neither of those is the right answer for
 * everybody.
 */
function RowCell({ id, row, tight, holder, you, onOpen, onCall }) {
  if (id === 'business') {
    // What it does and where it is goes under the name at the roomy setting.
    // At the tight one the town alone stands beside it: a caller scanning for
    // the next number reads the town nearly as often as the name, the trade is
    // in the column beside it either way, and the two do not fit on one line
    // without the name being the half that gets cut - which is the one thing
    // the cell is for.
    const where = [row.trade, row.town].filter(Boolean).join(' · ')
    return tight ? (
      <span className="flex max-w-full items-baseline gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-ink-paper hover:text-accent"
          onClick={() => onOpen(row)}
          aria-haspopup="dialog"
        >
          {row.name || 'Unnamed business'}
        </button>
        <span className={`${MONO_LABEL} text-paper-faint flex-shrink-0`}>{row.town}</span>
      </span>
    ) : (
      <>
        <button
          type="button"
          className="block max-w-full truncate text-left text-ink-paper hover:text-accent"
          onClick={() => onOpen(row)}
          aria-haspopup="dialog"
        >
          {row.name || 'Unnamed business'}
        </button>
        <span className={`${MONO_LABEL} text-paper-faint block truncate`}>{where}</span>
      </>
    )
  }

  if (id === 'score') return <ScoreCell row={row} tight={tight} />

  if (id === 'phone') {
    const href = dialHref(row.phone)
    return href ? (
      <a href={href} className="whitespace-nowrap text-accent">
        {row.phone}
      </a>
    ) : (
      '—'
    )
  }

  if (id === 'pull') {
    return (
      <>
        <Badge tone={PULL_TONE[row.pull] ?? 'plain'}>{PULL_LABEL[row.pull] ?? 'Unread'}</Badge>
        {!tight && (
          <span className={`${MONO_LABEL} text-paper-faint mt-1 block truncate`}>
            {row.trade_median === null
              ? 'trade unread'
              : `${fullCount(row.rating_count ?? 0)} reviews · middle ${fullCount(Math.round(row.trade_median))}`}
          </span>
        )}
      </>
    )
  }

  if (id === 'reviews') return <span className="tabular-nums">{reviews(row)}</span>
  if (id === 'why') return <WhyChips terms={row.terms} tight={tight} />
  if (id === 'site') return <span className="block truncate">{presence(row)}</span>
  if (id === 'address') {
    return <span className="block truncate text-paper-soft">{row.address || '—'}</span>
  }

  if (id === 'rung') {
    const last = row.last_call
    return (
      <>
        <span className="block truncate">
          {last ? `${row.calls.length}×, ${when(last.called_at)}` : '—'}
        </span>
        {/* Who made the last one. At the tight setting it goes, like every
            other second line: the column is there to say how worked a business
            is, and whose call it was is one cell over in Assigned To. */}
        {!tight && last && (
          <span className={`${MONO_LABEL} text-paper-faint mt-1 block truncate`}>
            {last.called_by === you ? 'you' : callerName({ name: last.called_by_name })}
          </span>
        )}
      </>
    )
  }

  if (id === 'assigned') {
    const owner = ownerOf(row)
    if (!owner) return <span className="text-paper-faint">Nobody yet</span>
    // A caller's own book is the work in front of them and everybody else's is
    // a name to ask. Drawn as the difference it is: theirs in the accent, the
    // rest plain.
    return (
      <span className={`block truncate ${owner === you ? 'text-accent' : ''}`}>
        {owner === you ? 'You' : callerName({ name: row.assigned_name })}
      </span>
    )
  }

  if (id === 'state') {
    const place = placeOf(row.place)
    const note = placeNote(row)
    return (
      <>
        <Badge tone={place?.tone ?? 'plain'}>{place?.label ?? 'Ready'}</Badge>
        {!tight && note && (
          <span className={`${MONO_LABEL} text-paper-faint mt-1 block truncate`}>{note}</span>
        )}
      </>
    )
  }

  // The one control that would place a second call to a business somebody is
  // already on. It says whose call it is rather than going quiet, because the
  // reader's next move is to ask that person how it went.
  if (holder) {
    return (
      <Badge tone="accent" title={`${callerName(holder)} is on this call`}>
        {callerMark(holder)}
      </Badge>
    )
  }
  return (
    <button
      type="button"
      className={tight ? QUIET_ROW : QUIET}
      aria-label={`Call ${row.name || 'this business'}`}
      onClick={() => onCall(row)}
    >
      <Phone aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  )
}

/** One business on the list, in whichever columns this account draws. */
const CallRow = memo(function CallRow({ row, columns, tight, holder, yours, you, onOpen, onCall }) {
  return (
    <tr className={yours ? 'bg-[color:var(--wash-accent)]' : undefined}>
      {columns.map(id => (
        <td key={id} className={cellClass(id, tight)}>
          <RowCell
            id={id}
            row={row}
            tight={tight}
            holder={holder}
            you={you}
            onOpen={onOpen}
            onCall={onCall}
          />
        </td>
      ))}
    </tr>
  )
}, unchanged)

/**
 * Whether a row would draw itself exactly as it already has.
 *
 * The list re-reads every thirty seconds and hands back a fresh object for
 * every business whether or not anything about it moved, so without this the
 * whole table - fifty rows of up to eleven cells - is rebuilt twice a minute to
 * put back what was already there.
 *
 * The comparison is over what the cells actually draw rather than over the
 * whole row, because the row carries a good deal this table never shows: the
 * scoring breakdown behind the chips, every call ever placed, the audit
 * readings. A field this list starts drawing has to be added here, and that is
 * the cost of the check - it is worth paying once for the one table in the
 * console that redraws on a timer.
 */
function unchanged(before, after) {
  if (before.tight !== after.tight || before.yours !== after.yours) return false
  if (before.you !== after.you || before.columns !== after.columns) return false
  if ((before.holder?.user_id ?? null) !== (after.holder?.user_id ?? null)) return false
  return drawnAs(before.row) === drawnAs(after.row)
}

/** Everything about a business that a row on this table puts on screen. */
function drawnAs(row) {
  return [
    row.id,
    row.name,
    row.town,
    row.trade,
    row.phone,
    row.address,
    row.score,
    row.pull,
    row.pull_ratio,
    row.trade_median,
    row.rating,
    row.rating_count,
    row.site_kind,
    row.website,
    row.place,
    row.assigned_to,
    row.assigned_name,
    row.callback_at,
    row.ready_at,
    row.calls?.length ?? 0,
    row.last_call?.called_at ?? '',
    row.last_call?.called_by ?? '',
    row.terms?.map(term => `${term.id}:${term.points}`).join('|') ?? '',
  ].join('\u0000')
}

/** What a column's cells wear: their measure, and which edge they set against. */
function cellClass(id, tight) {
  if (columnOf(id)?.align === 'end') return tight ? CELL_END_PACKED : CELL_END
  return tight ? CELL_PACKED : CELL
}

/** And what its heading wears, so the two are set against the same edge. */
function headClass(id) {
  return columnOf(id)?.align === 'end' ? TH_END : TH
}

/**
 * The time a recorded call rings back at: the one the caller typed, the
 * default where the outcome expects a time and nobody typed one, and none at
 * all where the outcome takes the business off the list.
 *
 * The default is here rather than on the endpoint alone, because the line the
 * caller reads back names the time that was filed. Left to the endpoint the
 * console would have nothing to name, and a call back would be the one outcome
 * that records without saying when the business is next in front of anybody.
 */
function ringBackFor(outcome, chosen = '') {
  if (outcomeOf(outcome)?.ends) return null
  if (chosen) return new Date(chosen).toISOString()
  return outcomeTakesCallback(outcome) ? defaultCallbackAt().toISOString() : null
}

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
 *
 * The second control is the one that keeps a business out of the lead list.
 * Spoke To Owner covers the owner who asked what it would cost and the owner
 * who said no thanks and hung up, and nothing else on this form can tell them
 * apart - so the caller is asked outright, and only where the outcome leaves
 * the question open. It starts unanswered and saves unanswered, because a
 * default here is the page guessing at the one thing only the person on the
 * call knows, and a question the call never got to is not a refusal.
 */
function RecordForm({ row, saving, onRecord }) {
  const [outcome, setOutcome] = useState('no_answer')
  const [note, setNote] = useState('')
  const [callback, setCallback] = useState('')
  const [interest, setInterest] = useState('')
  const takesCallback = outcomeTakesCallback(outcome)
  const asksInterest = outcomeAsksInterest(outcome)
  const ends = Boolean(outcomeOf(outcome)?.ends)
  const wait = waitAfter(row, outcome)

  const pick = value => {
    setOutcome(value)
    // The answer belongs to the outcome it was given against. Left standing, a
    // caller who picks Spoke To Owner, answers it, then corrects the outcome to
    // Gatekeeper files the first call's answer against the second.
    setInterest('')
  }

  const submit = async event => {
    event.preventDefault()
    const saved = await onRecord({
      id: row.id,
      outcome,
      note,
      interested: asksInterest && interest ? interest === 'yes' : null,
      callback_at: ringBackFor(outcome, callback),
    })
    if (saved) {
      setNote('')
      setCallback('')
      setInterest('')
      setOutcome('no_answer')
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1.5">
        <span className={`${MONO_LABEL} text-paper-faint`}>What the Call Came To</span>
        <select className={SELECT} value={outcome} onChange={event => pick(event.target.value)}>
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
            : takesCallback
              ? 'They come back at the time you name, ahead of everything else.'
              : `They rest ${saidHours(wait)}, then come back to the list.`}
        </span>
      </label>

      {asksInterest && (
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Were They Interested</span>
          <select
            className={interest ? SELECT_ON : SELECT}
            value={interest}
            onChange={event => setInterest(event.target.value)}
          >
            <option value="">They Did Not Say</option>
            <option value="yes">Interested</option>
            <option value="no">Not Interested</option>
          </select>
          <span className={`${MONO_LABEL} text-paper-faint`}>
            Not interested leaves them on the call list and off the lead list. Anything else puts
            them in the lead list.
          </span>
        </label>
      )}

      {!ends && (
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>
            {takesCallback ? 'Ring Them Back At' : 'Or Defer Them To'}
          </span>
          <input
            type="datetime-local"
            className={FIELD}
            value={callback}
            onChange={event => setCallback(event.target.value)}
          />
          {takesCallback && (
            <span className={`${MONO_LABEL} text-paper-faint`}>
              Leave it blank and they come back tomorrow.
            </span>
          )}
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
        {saving ? 'Recording' : 'Record the Call'}
      </button>
    </form>
  )
}

/**
 * Who the business belongs to, and the way to hand it to somebody else.
 *
 * A business goes into the name of whoever first rings it and stays there, so
 * the second call is made by the person who remembers the first - what was
 * said, what was promised, who they asked for. None of that is in the note,
 * and none of it survives the business being worked by whoever happens to
 * reach the top of the list that morning.
 *
 * The hand-over is a select rather than a button per person, because there are
 * three people today and a list of buttons is a control that stops fitting the
 * moment there are six. Nobody is an option on it: a caller who leaves, or a
 * business claimed by a wrong number, has to have a way back to the pool.
 */
function Owner({ row, people, you, saving, onHand }) {
  const owner = ownerOf(row)
  const held = people.find(one => one.id === owner) ?? null

  return (
    <div className="grid gap-1.5">
      <p className={`${MONO_LABEL} text-paper-faint`}>Assigned To</p>
      <p className="text-[13px] text-ink-paper">
        {owner ? (
          <>
            <span className={owner === you ? 'text-accent' : undefined}>
              {owner === you ? 'You' : callerName({ name: held?.name ?? row.assigned_name })}
            </span>
            {row.assigned_at ? `, since ${when(row.assigned_at)}` : ''}
          </>
        ) : (
          'Nobody yet. Recording a call puts them in your name.'
        )}
      </p>
      <select
        className={SELECT}
        value={owner ?? ''}
        disabled={saving}
        aria-label="Hand This Business To"
        onChange={event => onHand(row.id, event.target.value || null)}
      >
        <option value="">Nobody</option>
        {people.map(one => (
          <option key={one.id} value={one.id}>
            {one.id === you ? `${one.name || 'You'} (you)` : one.name || 'One Person'}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Everything known about one business, and the form that adds to it. */
function Sheet({ row, saving, recorded, onRecord, onHandbook, holder, people, you, onHand }) {
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

      <Owner row={row} people={people} you={you} saving={saving} onHand={onHand} />

      {/* Somebody else has this number up to their ear right now. It is said
          over the button rather than instead of it: the record is still worth
          reading and the note is still worth adding, and the one thing not to
          do is press the number. */}
      {holder && (
        <p className={`${MONO_LABEL} flex items-center gap-2 text-accent`}>
          <Badge tone="accent">{callerMark(holder)}</Badge>
          {callerName(holder)} is on this call.
        </p>
      )}

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
        What to Say
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
              <dt className="min-w-0 text-[13px] text-ink-paper">{term.label}</dt>
              <dd className={`${MONO_LABEL} text-paper-faint flex-shrink-0 whitespace-nowrap`}>
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
          label="Its Trade's Middle"
          value={row.trade_median === null ? 'Too few' : fullCount(Math.round(row.trade_median))}
        />
        <Metric label="Instead of a Site" value={presence(row)} />
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
        <RecordForm row={row} saving={saving} onRecord={onRecord} />
      )}

      <div className="grid gap-2">
        <p className={`${MONO_LABEL} text-paper-faint`}>Every Call to This Business</p>
        {row.calls.length ? (
          <ul className="grid gap-2">
            {row.calls.map(call => (
              <li key={call.id} className="border-hair-paper grid gap-1 border-t pt-2">
                {/* Who made it, beside what it came to. A note is somebody's
                    own sentence about a conversation they had, and whoever
                    reads it next needs to know which of them to ask about the
                    half that is not written down. */}
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone={outcomeOf(call.outcome)?.tone ?? 'plain'}>
                    {outcomeOf(call.outcome)?.label ?? call.outcome}
                  </Badge>
                  {/* What the caller heard about wanting it, which is the fact
                      that decided whether this business is in the lead list.
                      Only against the two outcomes that leave the question
                      open: Booked beside Interested is one badge saying what
                      the other already said, and a call from before this was
                      asked has no answer to draw rather than a no. */}
                  {outcomeAsksInterest(call.outcome) && typeof call.interested === 'boolean' && (
                    <Badge tone={call.interested ? 'good' : 'plain'}>
                      {call.interested ? 'Interested' : 'Not Interested'}
                    </Badge>
                  )}
                  <span className={`${MONO_LABEL} text-paper-faint`}>{when(call.called_at)}</span>
                  <span className={`${MONO_LABEL} text-paper-faint`}>·</span>
                  <span
                    className={`${MONO_LABEL} ${call.called_by === you ? 'text-accent' : 'text-paper-soft'}`}
                  >
                    {call.called_by === you ? 'You' : callerName({ name: call.called_by_name })}
                  </span>
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
  const [view, go] = useView(CALL_VIEWS)

  const desk = useCallDesk({ token, userId: session?.user?.id ?? null, enabled: Boolean(token) })
  // The list cannot be read until the filters are known, and the filters belong
  // to the account - so the read used to sit and wait for a round trip before
  // asking for a single business. The desk hands over the setup this browser
  // saw last time straight away and replaces it when the account answers, so
  // the two reads go out together and the disagreement, when there is one, is
  // settled below rather than paid for up front.
  const prefs = desk.prefs ?? DEFAULT_PREFS
  const settled = Boolean(desk.prefs) || Boolean(desk.error)

  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(NO_FILTERS)
  const [sort, setSort] = useState(DEFAULT_PREFS.sort)
  const [page, setPage] = useState(1)

  const [openRow, setOpenRow] = useState(null)
  const [recorded, setRecorded] = useState(null)
  // Only read on a screen too narrow to carry the handbook beside the record.
  // Where there is room for both, the stylesheet shows it whatever this says.
  const [handbook, setHandbook] = useState(false)
  const [batch, setBatch] = useState([])
  const [worked, setWorked] = useState({})
  const [at, setAt] = useState(0)
  // The outcome a caller has pressed in Call Mode that is waiting on whether
  // they were interested. Held rather than recorded, because the answer belongs
  // to the call that was just made and the page has no way to guess it - but a
  // key gets past it unanswered, so the question never holds up the next number.
  const [asking, setAsking] = useState(null)
  const [keyOpen, setKeyOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  // Whether the list has the page to itself. Held for the sitting rather than
  // saved to the account: it is the answer to what the caller is doing this
  // minute - reading the figures, or working the rows - rather than a fact
  // about how they like the list set up.
  const [alone, setAlone] = useState(false)
  const [fold, foldTall] = useFoldHeight()
  const reducedMotion = useReducedMotion()

  // A fetch per keystroke re-reads the whole callable set and the whole calls
  // table, so the typing and the question are two states with a pause between.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), 250)
    return () => clearTimeout(timer)
  }, [typed])

  // The account's own narrowing, twice at most and never after the reader has
  // touched a control.
  //
  // Twice because the setup arrives twice: what this browser remembered, which
  // is here on the first render and is what lets the list be read at once, and
  // then the account's own, which is the authority and may disagree - somebody
  // who narrowed the list at their desk this morning should not be handed a
  // laptop's stale copy of it. Adopting the second is one more read rather than
  // an emptied screen, because the rows stay up while it lands.
  //
  // Never after a control has moved, because by then the reader is the
  // authority: a late answer from the account reaching across to undo the
  // filter somebody just picked is the worst of the three behaviours.
  const seeded = useRef(null)
  const touched = useRef(false)
  const written = useRef(null)
  useEffect(() => {
    if (touched.current || !desk.prefs) return
    const from = desk.settled ? 'account' : 'browser'
    if (seeded.current === from || seeded.current === 'account') return
    seeded.current = from
    setFilters(desk.prefs.filters)
    setSort(desk.prefs.sort)
    written.current = JSON.stringify({ filters: desk.prefs.filters, sort: desk.prefs.sort })
  }, [desk.prefs, desk.settled])

  // And back the other way, once the caller has stopped moving controls. A
  // write per keystroke of a dropdown would be five rows for one decision.
  const save = useRef(desk.savePrefs)
  useEffect(() => {
    save.current = desk.savePrefs
  }, [desk.savePrefs])
  useEffect(() => {
    if (!seeded.current) return undefined
    const snapshot = JSON.stringify({ filters, sort })
    if (written.current === snapshot) return undefined
    const timer = setTimeout(() => {
      written.current = snapshot
      save.current({ filters, sort })
    }, 700)
    return () => clearTimeout(timer)
  }, [filters, sort])

  // How many rows a page holds, and how many businesses a batch takes. One
  // figure, because they are the same decision: a caller who wants fifty in
  // front of them wants fifty to work through.
  const take = prefs.take

  const query = useMemo(
    () => ({
      view,
      search,
      state: filters.state,
      pull: filters.pull,
      min_score: filters.min_score,
      town: filters.town,
      trade: filters.trade,
      assigned: filters.assigned,
      sort,
      take,
      page,
    }),
    [view, search, filters, sort, take, page]
  )

  const { shown, retained, error, loading, behind, saving, readAt, record, hand } = useCallsFeed({
    token,
    enabled: Boolean(token) && settled,
    filters: query,
  })

  // A new filter selects different rows and a new order selects the same rows
  // in a different sequence, and page four of the last question is no part of
  // either.
  useEffect(() => {
    setPage(1)
  }, [view, search, filters, sort, take])

  // `shown` is the answer to the question being asked, or the last one that
  // landed while that answer is on its way. A filter picked, a page turned or a
  // call recorded used to replace a correct table with grey bars for as long as
  // it took to re-rank every callable business; the businesses did not stop
  // existing while that happened, so they stay on screen and the head says the
  // list is a question behind.
  const rows = useMemo(() => shown?.rows || [], [shown])
  const totals = useMemo(() => shown?.totals || {}, [shown])

  const matchedTotals = shown?.matched_totals || {}

  // The lists the dropdowns offer and the pager's count of pages describe the
  // question rather than answer it, so they read the last payload that landed.
  // Deriving them from `data` empties a dropdown of the option just picked and
  // unmounts the pager the moment Next is pressed.
  const towns = retained?.towns || []
  const trades = retained?.trades || []
  const pages = retained?.pages || 1
  // Everybody a business can belong to, which is everybody who can open this
  // section at all. Read with the list rather than held here, so a person added
  // to the studio appears in the picker without a release.
  const people = useMemo(() => retained?.people || [], [retained])

  const band = useBand()
  // What this account chose, narrowed to what the window has room for. A column
  // somebody ticked at their desk is not a column they want three words wide on
  // a phone, and the table's widths only add up over the ones actually drawn.
  const columns = useMemo(() => columnsAt(prefs.columns, band), [prefs.columns, band])
  const tight = prefs.density === 'tight'
  const widths = useMemo(() => columnWidths(columns), [columns])
  const cellClasses = useMemo(() => columns.map(id => cellClass(id, tight)), [columns, tight])

  // The placeholder is the shape of the rows this reader last saw at this
  // density, so nothing under the table moves when the figures land.
  const shapeKey = `${REMEMBERED}_${prefs.density}`
  const shape = recalledRows(shapeKey, 10, tight ? ROW_HEIGHT.callsTight : ROW_HEIGHT.calls)
  const body = useRef(null)
  useEffect(() => {
    if (!loading) rememberRows(shapeKey, body.current)
  }, [loading, rows, shapeKey])

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

  // Call Mode is reached from a row's own dial button as well as from the tabs,
  // so it can be entered while the block above the list is folded away - and
  // its batch controls, its tabs and the way back out are all in there. It
  // unfolds rather than stranding a caller in a view with no way off it.
  useEffect(() => {
    if (view === 'calling') setAlone(false)
  }, [view])

  const current = batch[at] ?? null
  const heldHere = current ? heldByOther(desk.held, current.id, desk.you) : null
  // Whose call it is rather than the row saying so. The board is re-read every
  // twenty seconds and hands back a new object each time, so keying the claim
  // on the row would re-send it on every beat.
  const heldBy = heldHere?.user_id ?? null

  // Being on this business in Call Mode is being on the phone with it, so the
  // console says so and every other console draws the lock.
  //
  // The three ways of being on nothing all release: leaving Call Mode, reaching
  // the end of the batch, and landing on a business somebody else already holds.
  // The last is the one worth stating - a caller who moves off a number is not
  // on it any more, and holding the one behind them while they read the one in
  // front is how a colleague ends up locked out of a call that ended minutes
  // ago. Claiming the held one instead would be the double call itself.
  const claim = desk.takeNumber
  const drop = desk.dropNumber
  useEffect(() => {
    if (view !== 'calling' || !current || heldBy) {
      drop()
      return
    }
    claim(current.id)
  }, [view, current, heldBy, claim, drop])

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
      // A call back finishes on its key like every other outcome, at the
      // default day out. The key used to open the record instead, because the
      // time was required, which put a form in front of a caller mid-batch for
      // the one outcome that means somebody wants to hear from them again. The
      // record is still a button below, for the caller who was given a time.
      //
      // The two a key cannot finish on its own: the outcome does not say
      // whether anybody wanted it, and a no is what keeps the business out of
      // the lead list. The card asks, and whichever of the three answers comes
      // back records the outcome with it.
      if (outcomeAsksInterest(outcome)) {
        setAsking(outcome)
        setRecorded(null)
        return
      }
      const saved = await write({
        id: current.id,
        outcome,
        note: '',
        interested: null,
        callback_at: ringBackFor(outcome),
      })
      if (saved) {
        setWorked(held => ({ ...held, [current.id]: outcome }))
        setAt(index => index + 1)
        setRecorded(null)
      }
    },
    [current, write]
  )

  /** The waiting outcome recorded, now that the caller has said which it was. */
  const answer = useCallback(
    async interested => {
      if (!current || !asking) return
      const saved = await write({
        id: current.id,
        outcome: asking,
        note: '',
        interested,
        callback_at: null,
      })
      if (saved) {
        setWorked(held => ({ ...held, [current.id]: asking }))
        setAt(index => index + 1)
        setAsking(null)
        setRecorded(null)
      }
    },
    [current, asking, write]
  )

  // A question is asked of one business. Moving off that business, leaving Call
  // Mode or opening the record all drop it, because the answer belongs to the
  // call that was just made rather than to the next one up.
  useEffect(() => {
    setAsking(null)
  }, [view, current, openRow])

  // The eight outcomes on the eight number keys, ignored while a field has
  // focus so typing a note never records a call. While one of them is waiting
  // on whether they were interested the numbers stand down and `y`, `n` and `s`
  // answer it, so the keyboard never records the outcome under the question.
  useEffect(() => {
    if (view !== 'calling' || !current || openRow) return undefined
    const onKey = event => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (asking) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setAsking(null)
          return
        }
        const said = event.key.toLowerCase()
        if (said !== 'y' && said !== 'n' && said !== 's') return
        event.preventDefault()
        answer(said === 's' ? null : said === 'y')
        return
      }
      const outcome = CALL_OUTCOMES.find(one => one.key === event.key)
      if (!outcome) return
      event.preventDefault()
      quick(outcome.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, current, openRow, asking, quick, answer])

  const openBusiness = useCallback(row => {
    setOpenRow(row)
    setRecorded(null)
    setHandbook(false)
  }, [])

  const closeBusiness = useCallback(() => {
    setOpenRow(null)
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

  // The sitting: today's counts from the list read, against the three figures
  // this account set for itself. They arrive on two different feeds at two
  // different rates and neither is the whole answer on its own.
  const sitting = useMemo(
    () => (shown?.shift ? shiftOf(shown.shift, prefs.goals) : null),
    [shown, prefs.goals]
  )

  const narrowed = filtersNarrow(filters)
  const chips = useMemo(() => filterChips(filters, people), [filters, people])

  /**
   * One business put in somebody's name, or taken out of everybody's.
   *
   * The record on screen is held in state rather than resolved out of the
   * current page, so the re-read behind the hand-over does not reach it. It is
   * patched here from what the endpoint wrote, which is the value that is now
   * on the row rather than the one that was asked for.
   */
  const handOver = useCallback(
    async (id, to) => {
      const done = await hand(id, to)
      if (!done) return
      setOpenRow(row =>
        row && row.id === id
          ? {
              ...row,
              assigned_to: done.assigned_to ?? null,
              assigned_at: done.assigned_at ?? null,
              assigned_name: done.assigned_to
                ? (people.find(one => one.id === done.assigned_to)?.name ?? null)
                : null,
            }
          : row
      )
    },
    [hand, people]
  )
  // Every way of moving a narrowing says so, which is what stops the account's
  // own setup landing a moment later and undoing it.
  const clearAll = useCallback(() => {
    touched.current = true
    setFilters(NO_FILTERS)
  }, [])
  const narrow = useCallback((key, value) => {
    touched.current = true
    setFilters(current => ({ ...current, [key]: value }))
  }, [])

  const reorder = useCallback(value => {
    touched.current = true
    setSort(value)
  }, [])

  const applyView = useCallback(saved => {
    touched.current = true
    setFilters(saved.filters)
    setSort(saved.sort)
  }, [])

  const keepView = useCallback(
    name => {
      const id =
        globalThis.crypto?.randomUUID?.() ?? `view-${Date.now()}-${Math.random().toString(36)}`
      save.current({ views: [...prefs.views, { id, name, filters, sort }] })
    },
    [prefs.views, filters, sort]
  )

  const dropView = useCallback(
    id => save.current({ views: prefs.views.filter(one => one.id !== id) }),
    [prefs.views]
  )

  const reading = prefs.views.find(one => sameNarrowing(one, { filters, sort })) ?? null

  // A refusal with nothing behind it is the whole answer, so it stands in
  // place of the table rather than above an empty one. A refusal with a list
  // behind it is not: the rows are still right, so they stay and the notice
  // sits above them where every other console failure sits.
  if (error && !shown) return <SectionNotice>{error}</SectionNotice>

  const banded = shown?.sort === 'best'
  const bands = shown?.bands || {}

  const listRows = []
  let lastBand = null
  for (const row of rows) {
    const band = row.place === 'due' ? 'due' : 'call'
    if (banded && band !== lastBand) {
      listRows.push(
        <BandHeading
          key={`band-${band}`}
          cols={columns.length}
          title={band === 'due' ? 'Promised Back, and Due Now' : 'To Call, Best First'}
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
    const holder = desk.held.get(row.id) ?? null
    listRows.push(
      <CallRow
        key={row.id}
        row={row}
        columns={columns}
        tight={tight}
        holder={holder && holder.user_id !== desk.you ? holder : null}
        yours={Boolean(holder && holder.user_id === desk.you)}
        you={desk.you}
        onOpen={openBusiness}
        onCall={callOne}
      />
    )
  }

  return (
    <ConsolePage areas={['alert', 'chrome', 'work']} rows="auto auto minmax(0,1fr)" gap="0">
      {/* A read that did not land stands outside the fold, because the fold is
          the one thing that could hide it: a caller working the list at full
          height is exactly the reader who would otherwise be handed stale rows
          with nothing on screen saying so. It carries its own air under it
          rather than taking it from the page, which is what lets the row take
          no room at all on the reads that do land. */}
      {(error || desk.error) && (
        <div className="pb-4" style={{ '--area': 'alert' }}>
          <ConsoleError>{error || desk.error}</ConsoleError>
        </div>
      )}

      {/* Everything the list is read against: which view is open, who is on a
          number, and what the list is narrowed by. It folds away as one block
          so the table below it can have the screen, and the block carries the
          gap between itself and the table inside its own height - so a fold
          that closes leaves nothing behind it, not even the air it stood in.

          Nothing in here is reachable while it is closed. A search field and
          six dropdowns clipped to no height are still on the tab order, and a
          caller tabbing out of the table would otherwise land in controls
          nobody can see. */}
      <m.div
        id={CHROME}
        className="overflow-hidden"
        style={{ '--area': 'chrome' }}
        initial={false}
        animate={alone ? 'shut' : 'open'}
        variants={{
          open: { height: foldTall ?? 'auto', opacity: 1 },
          shut: { height: 0, opacity: 0 },
        }}
        transition={reducedMotion ? { duration: 0 } : { duration: FOLD, ease: EASE }}
        inert={alone}
      >
        <div ref={fold} className="flex flex-col gap-4 pb-4">
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

          <CallBoard
            presence={desk.presence}
            you={desk.you}
            loading={desk.loading}
            readAt={readAt}
            hanging={desk.claiming}
            onHangUp={desk.dropNumber}
          />

          {/* Said above the row rather than under it, because the point of the
              line is that a filter set here is still set tomorrow - which is
              worth knowing before the first one is picked. */}
          <p className={`${MONO_LABEL} text-paper-soft`}>
            Narrow the list here. What you pick is saved to your account and waiting next time you
            sign in.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              className={`${FIELD} max-w-[220px]`}
              placeholder="Name, town or number"
              value={typed}
              onChange={event => setTyped(event.target.value)}
              aria-label="Search the Call List"
            />
            {view !== 'resting' && view !== 'finished' && (
              <>
                <select
                  className={filters.state === 'all' ? SELECT : SELECT_ON}
                  value={filters.state}
                  onChange={event => narrow('state', event.target.value)}
                  aria-label="State"
                >
                  {CALL_STATES.map(one => (
                    <option key={one.id} value={one.id}>
                      {one.label}
                    </option>
                  ))}
                </select>
                <select
                  className={filters.min_score === 'all' ? SELECT : SELECT_ON}
                  value={filters.min_score}
                  onChange={event => narrow('min_score', event.target.value)}
                  aria-label="Least Score"
                >
                  {CALL_SCORES.map(one => (
                    <option key={one.id} value={one.id}>
                      {one.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <select
              className={filters.pull === 'all' ? SELECT : SELECT_ON}
              value={filters.pull}
              onChange={event => narrow('pull', event.target.value)}
              aria-label="For Its Trade"
            >
              {CALL_PULLS.map(one => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </select>
            {/* Whose book to work. `Mine` is first because it is the one a
                caller picks, and it is stored as a standing rather than as their
                own id so a saved narrowing means the same thing to whoever
                opens it. */}
            <select
              className={filters.assigned === 'all' ? SELECT : SELECT_ON}
              value={filters.assigned}
              onChange={event => narrow('assigned', event.target.value)}
              aria-label="Assigned To"
            >
              <option value="all">Anybody's</option>
              <option value={ASSIGNED_MINE}>Mine</option>
              <option value={ASSIGNED_NOBODY}>Nobody Yet</option>
              {people
                .filter(one => one.id !== desk.you)
                .map(one => (
                  <option key={one.id} value={one.id}>
                    {one.name || 'One Person'}
                  </option>
                ))}
            </select>
            <select
              className={filters.town === 'all' ? SELECT : SELECT_ON}
              value={filters.town}
              onChange={event => narrow('town', event.target.value)}
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
              className={filters.trade === 'all' ? SELECT : SELECT_ON}
              value={filters.trade}
              onChange={event => narrow('trade', event.target.value)}
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
                onChange={event => reorder(event.target.value)}
                aria-label="Sort Order"
              >
                {CALL_SORTS.map(one => (
                  <option key={one.id} value={one.id}>
                    {one.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className={`${QUIET} ml-auto`}
              onClick={() => setSetupOpen(true)}
              aria-haspopup="dialog"
            >
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              Set Up the List
            </button>
          </div>

          {/* What is actually narrowing the list, and this account's own
              narrowings beside it. Six dropdowns each showing a value is six
              things to read before somebody knows why a business they expected is
              not on screen; this is one line, and every part of it is the way to
              undo itself. */}
          {(chips.length > 0 || prefs.views.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {prefs.views.map(one => (
                <button
                  key={one.id}
                  type="button"
                  className={reading?.id === one.id ? CHIP_ON : CHIP_BUTTON}
                  aria-pressed={reading?.id === one.id}
                  onClick={() => applyView(one)}
                >
                  {one.name}
                </button>
              ))}
              {prefs.views.length > 0 && chips.length > 0 && (
                <span className="border-hair-paper mx-1 h-4 border-l" aria-hidden="true" />
              )}
              {chips.map(chip => (
                <button
                  key={chip.key}
                  type="button"
                  className={CHIP_BUTTON}
                  aria-label={`Stop narrowing by ${chip.label}`}
                  onClick={() => setFilters(withoutFilter(filters, chip.key))}
                >
                  {chip.label}
                  <X aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
                </button>
              ))}
              {narrowed && (
                <button type="button" className={`${QUIET} px-2.5`} onClick={clearAll}>
                  Clear All
                </button>
              )}
            </div>
          )}
        </div>
      </m.div>

      {view === 'calling' ? (
        <ConsoleSplit
          area="work"
          list={
            <Panel
              title="The Batch"
              note="The businesses this sitting works through, best first. Click any name to jump to it."
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
                <div className="flex flex-wrap gap-2 px-5 py-2">
                  <button type="button" className={QUIET} onClick={holdBatch}>
                    Take a Fresh Batch of {take}
                  </button>
                  <button
                    type="button"
                    className={QUIET}
                    onClick={() => setSetupOpen(true)}
                    aria-haspopup="dialog"
                  >
                    <SlidersHorizontal
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                    Batch Size
                  </button>
                </div>
                {/* One column at the width the card has, never at the width
                    the longest name wants. A bare `grid` sizes its column to
                    max-content, so one business with a long name widened every
                    row in the batch and pushed all fifty scores out past the
                    card's edge, where they were clipped rather than scrolled
                    to. The name is the part that gives way. */}
                <ul className="grid grid-cols-1">
                  {batch.map((one, index) => {
                    const holder = heldByOther(desk.held, one.id, desk.you)
                    return (
                      <li
                        key={one.id}
                        className={`border-hair-paper flex items-baseline justify-between gap-2 border-t px-5 py-2 ${
                          index === at ? 'bg-[color:var(--wash-accent)]' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left text-[13px] text-ink-paper hover:text-accent"
                          onClick={() => setAt(index)}
                        >
                          <span className="block truncate">{one.name || 'Unnamed business'}</span>
                          <span className={`${MONO_LABEL} text-paper-faint block truncate`}>
                            {one.town}
                          </span>
                        </button>
                        {worked[one.id] ? (
                          <Badge tone={outcomeOf(worked[one.id])?.tone ?? 'plain'}>
                            {outcomeOf(worked[one.id])?.label}
                          </Badge>
                        ) : holder ? (
                          <Badge tone="accent" title={`${callerName(holder)} is on this call`}>
                            {callerMark(holder)}
                          </Badge>
                        ) : (
                          <span className={`${MONO_LABEL} text-paper-faint flex-shrink-0`}>
                            {one.score}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </PanelBody>
            </Panel>
          }
        >
          {/* The sitting rides in the head of the card the calls are made
              from. It belongs there rather than over the whole section because
              it is a fact about the person calling rather than about the list,
              and the list's own figures are three feet to the left saying how
              many businesses are left - which is the figure this exists to stop
              being the only one on the screen. */}
          <Panel
            title="Calling"
            note="Read down to the call you are placing, ring the number and press what it came to. Say whether they were interested where it asks, and the next business comes up on its own."
            loading={loading}
            aside={
              <span className={`${MONO_LABEL} text-paper-faint`}>
                {loading ? '' : `${fullCount(Math.max(0, batch.length - at))} to go`}
              </span>
            }
            tools={sitting ? <CallRings shift={sitting} now={readAt ?? undefined} /> : null}
          >
            <PanelBody>
              {current ? (
                <CallRecord
                  row={current}
                  caller={session?.user?.user_metadata?.full_name}
                  saving={saving}
                  recorded={recorded}
                  asking={asking}
                  holder={heldHere}
                  you={desk.you}
                  onQuick={quick}
                  onAnswer={answer}
                  onDrop={() => setAsking(null)}
                  onOpen={openBusiness}
                  onSkip={() => setAt(index => index + 1)}
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
                    {shown?.next_back
                      ? `, and the first comes back ${shortWhen(shown.next_back)}`
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
          note="Work it from the top down. The name opens a business, the button beside it dials."
          loading={loading}
          aside={
            <span className={`${MONO_LABEL} text-paper-faint`}>
              {/* Said where the count sits, because the count is the thing that
                  is out of date: the rows below are the last question's answer
                  and this is the one line that would otherwise state them as
                  the answer to the question just asked. */}
              {loading ? '' : behind ? 'Reading' : `${fullCount(shown?.matched ?? 0)} matching`}
            </span>
          }
          tools={
            /* The one control that is not about which businesses are on the
               list but about how much of the screen they get. It sits in the
               card's own head because the card is what moves, and because the
               head is the only part of it still on screen once everything
               above has folded away - a button that folded with the rest
               would be a door that locks behind you. */
            <button
              type="button"
              className={QUIET_ROW}
              aria-controls={CHROME}
              aria-expanded={!alone}
              onClick={() => setAlone(one => !one)}
            >
              {alone ? (
                <Minimize2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {alone ? 'Bring the Rest Back' : 'Give It the Screen'}
            </button>
          }
        >
          <PanelBody>
            {shown?.complete === false && (
              <SectionNotice>
                The read stopped at its ceiling of {fullCount(shown.cap)} businesses, so the figures
                above cover that many rather than the whole table.
              </SectionNotice>
            )}
            <table className="console-table">
              <thead>
                <tr>
                  {columns.map(id => (
                    <th key={id} className={headClass(id)} style={{ width: widths[id] }}>
                      {columnOf(id)?.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={body}>
                {loading ? (
                  <SkeletonRows
                    cols={cellClasses}
                    rows={shape.rows}
                    height={shape.height}
                    lastHeight={shape.lastHeight}
                  />
                ) : rows.length ? (
                  listRows
                ) : (
                  <EmptyRow cols={columns.length}>
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
                  Page {fullCount(shown?.page ?? page)} of {fullCount(pages)}
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
        note="Everything known about them, and the form that puts today's call on the record."
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
            holder={heldByOther(desk.held, openRow.id, desk.you)}
            people={people}
            you={desk.you}
            onHand={handOver}
            onRecord={writeFromSheet}
            onHandbook={() => setHandbook(true)}
          />
        )}
      </SidePanel>

      {/* The list the way this account reads it. Kept on the account rather
          than in this browser, because somebody who set the columns up at their
          desk should not be handed the defaults again from a laptop. */}
      <SidePanel
        open={setupOpen}
        title="Set Up the List"
        note="Set the list up the way you work it. Every change here saves to your account as you make it."
        onClose={() => setSetupOpen(false)}
      >
        <CallSetup
          prefs={prefs}
          people={people}
          filters={filters}
          sort={sort}
          onChange={desk.savePrefs}
          onApply={applyView}
          onDrop={dropView}
          onKeep={keepView}
        />
      </SidePanel>

      {/* What the score is made of, in one place, so a number on a row is
          never the only explanation of itself. */}
      <SidePanel
        open={keyOpen}
        title="How It Is Ranked"
        note="What the score on each row is made of, so you can see why a business is near the top."
        onClose={() => setKeyOpen(false)}
      >
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
            somebody. The gap lengthens each time a number goes unanswered: a day, three days, a
            week, a fortnight, then a month. A time you name yourself always wins.
          </p>
        </div>
      </SidePanel>
    </ConsolePage>
  )
}
