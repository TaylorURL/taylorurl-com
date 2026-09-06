import { useCallback, useEffect, useMemo, useState } from 'react'
import { m } from 'framer-motion'
import { ArrowLeft, ArrowDown, ArrowUp, Eye, Plus, Send, Trash2, X } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { useSession } from '@hooks/useSession'
import { useNewsletterFeed } from '@hooks/useNewsletterFeed'
import {
  Area,
  Badge,
  Board,
  ConsoleError,
  ConsolePage,
  EmptyRow,
  Metric,
  Panel,
  PanelBody,
  PanelFill,
  PanelFoot,
  SectionNotice,
  SkeletonBar,
  SkeletonBox,
  SkeletonRows,
  StatCard,
  ViewNav,
} from '../ui'
import { useView } from '../lib/views'
import { CLIENT, PROSPECT } from '../../../../../lib/mail/audience.js'
import {
  BUTTON,
  CELL_TIGHT,
  CHART_HEIGHT,
  FIELD,
  MONO_LABEL,
  QUIET,
  ROW_HEIGHT,
  SELECT,
  TH_TIGHT,
} from '../lib/tokens'
import { fullCount, percent } from '../../analytics/lib/format'
import { ZONE } from '@lib/time/zone.js'
import { IssueReachChart } from './NewsletterCharts'

/**
 * Where an issue is written, read as it will arrive, sent, and read back for
 * what it did.
 *
 * The page holds two views of one job. The list is every issue and where each
 * stands, beside what the sent ones did drawn as a chart; opening one replaces
 * both with the composer, because an editor sharing a screen with the table
 * it came from is an editor two columns wide.
 *
 * What an issue did once it landed - opened, clicked, bounced - sits on the
 * same row as the issue. It used to be a table of its own on the subscriber
 * list, a tab away from the issues it was about, so the question asked from
 * here was answered somewhere else. Sent is this system's own fact, that the
 * transport accepted the message; everything after it is the recipient's,
 * reported by Resend as it happens, so a row fills in over the hours after an
 * issue goes rather than all at once.
 *
 * The draft is held here and written back on save rather than on each
 * keystroke. A letter is written in passes - a paragraph moved, a heading
 * reworded, a link pasted and fixed - and a field that saves as it is typed
 * records every half-finished state of it as the issue.
 *
 * What a reader will receive is composed by the server, against a real person
 * on the list, and shown in both the parts a message carries. A preview drawn
 * here would be a third renderer agreeing with neither of the two that send.
 * It stands beside the editor while the issue is written and is composed
 * again on every save, so what is read on the right is the draft as it was
 * last kept rather than as it is being typed.
 *
 * Nothing on this page is what stops a draft going out. The endpoint refuses
 * to send anything that is not marked ready and refuses an issue that has
 * already gone, and the table refuses to let a sent issue be rewritten; this
 * is the surface those rules are worked through.
 */

/** How each status reads on a row. */
const STATUS = {
  draft: { label: 'Draft', tone: 'plain' },
  scheduled: { label: 'Ready', tone: 'accent' },
  sent: { label: 'Sent', tone: 'good' },
}

/** The six blocks an issue is built from, in the order the buttons offer them. */
const BLOCKS = [
  { type: 'heading', label: 'Heading' },
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'list', label: 'List' },
  { type: 'button', label: 'Button' },
  { type: 'image', label: 'Image' },
  { type: 'divider', label: 'Divider' },
]

/**
 * The two sides of the list, and the words the console names each one with.
 *
 * The keys come from the module that decides which side an address is on, so a
 * marker the composer writes is one the send reads back.
 */
const SIDES = [
  { key: CLIENT, label: 'Clients', name: 'clients' },
  { key: PROSPECT, label: 'Prospects', name: 'prospects' },
]

/** The two parts a message carries, as the preview offers them. */
const PARTS = [
  { key: 'html', label: 'Laid Out' },
  { key: 'text', label: 'Plain Text' },
]

/**
 * The two readings the chart draws for every sent issue, in the order they
 * are listed and the colours they take. The legend under the chart reads the
 * same list.
 */
const REACH_SERIES = [
  { key: 'open_rate', label: 'Opened', count: 'opened', color: 'var(--series-1)' },
  { key: 'click_rate', label: 'Clicked', count: 'clicked', color: 'var(--series-3)' },
]

// How many sent issues the chart draws. Each is a row of its own height, and
// past this many the names shrink under what the axis can set; the table
// beside it holds the rest.
const CHARTED = 8

// The length a title is cut to on the chart's axis, which is what the axis
// can set at the figure size before the bars beside it lose their room.
const AXIS_CHARS = 16

// The height a letter is read at where the card has none of its own to give.
// At the desk width the letter takes what the card has left; on a phone the
// card is as tall as its contents and this is the contents.
const LETTER_PHONE = 420

const DESK = '(min-width: 1024px)'

/**
 * Whether the page is laid out to fit the screen or stacked down it.
 *
 * The letter is the one thing here that has to be told which: a chart takes
 * the fixed height its token names on a phone, but a letter is read at
 * whatever height it is given and the number is not a chart's.
 */
function useDesk() {
  const [desk, setDesk] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESK).matches
  )
  useEffect(() => {
    const query = window.matchMedia(DESK)
    const update = () => setDesk(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return desk
}

/** A new block of each type, with the fields its editor writes. */
function blankBlock(type) {
  switch (type) {
    case 'heading':
      return { type: 'heading', text: '', level: 2 }
    case 'paragraph':
      return { type: 'paragraph', text: '' }
    case 'list':
      return { type: 'list', items: [''], ordered: false }
    case 'button':
      return { type: 'button', text: '', href: '' }
    case 'image':
      return { type: 'image', src: '', alt: '', width: '', height: '' }
    default:
      return { type: 'divider' }
  }
}

/** The web address a title suggests, offered while the field is untouched. */
function slugFrom(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A day, in the shortest form that still names it. */
function day(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * A stamp in the shape a datetime field takes, which is local time with no
 * zone on it. `toISOString` is UTC and would move the date a person picked.
 */
function forField(value) {
  if (!value) return ''
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`
}

/** A title cut to what an axis can set, with the cut marked. */
function short(title) {
  const text = String(title ?? '')
  return text.length > AXIS_CHARS ? `${text.slice(0, AXIS_CHARS - 1).trimEnd()}…` : text
}

function StatusBadge({ status }) {
  const known = STATUS[status]
  return <Badge tone={known ? known.tone : 'plain'}>{known ? known.label : status}</Badge>
}

/**
 * A share of an issue, shown as a rate with the count that made it.
 *
 * A rate on its own hides how many it was taken over, and eleven per cent of
 * nine is a different fact from eleven per cent of nine hundred. An issue that
 * has not gone out has nothing to take a share of, and says so with a dash
 * rather than a nought.
 */
function Share({ part, whole, rate, tone, loading }) {
  if (loading) return <SkeletonBar className="ml-auto w-14" />
  if (!whole) return <span className="text-paper-faint">—</span>
  return (
    <span className="whitespace-nowrap">
      <span
        className={`font-mono tabular-nums ${part ? tone || 'text-ink-paper' : 'text-paper-faint'}`}
      >
        {percent(rate)}
      </span>
      <span className={`${MONO_LABEL} text-paper-faint ml-1.5`}>{fullCount(part)}</span>
    </span>
  )
}

/**
 * One reading of the figure above it, in the block its card closes on.
 *
 * A chart says which issue was read most and never what the list as a whole
 * did, so the figures answering that belong against the chart rather than in
 * a card of their own.
 */
function Reading({ label, value, note, loading }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className={`${MONO_LABEL} text-paper-faint`}>{label}</span>
      {loading ? (
        <SkeletonBar className="w-14" />
      ) : (
        <span className="font-mono text-[13px] tabular-nums text-ink-paper">{value}</span>
      )}
      {!loading && note && <span className={`${MONO_LABEL} text-paper-faint`}>{note}</span>}
    </span>
  )
}

/**
 * What a box says when there is nothing to draw in it. It takes the box
 * rather than its own padding, so the card stays the height its neighbour is
 * whichever of them has something behind it.
 */
function EmptyFill({ children }) {
  return (
    <div className="flex items-center justify-center px-5 py-4">
      <p className="max-w-prose text-center text-[13px] leading-relaxed text-paper-soft">
        {children}
      </p>
    </div>
  )
}

/** One of a pair of settings, as two buttons of which one is down. */
function Toggle({ options, value, onPick }) {
  return (
    <span className="inline-flex gap-2">
      {options.map(option => (
        <button
          key={option.key}
          type="button"
          onClick={() => onPick(option.key)}
          className={value === option.key ? BUTTON : QUIET}
        >
          {option.label}
        </button>
      ))}
    </span>
  )
}

/**
 * One copy of the message, in one of its two parts, filling whatever it is
 * given.
 *
 * The frame is sandboxed with nothing granted, since what is inside it is
 * mail from the server and not console furniture. `height` is set only where
 * the card has none to hand down.
 */
function Letter({ copy, part, sideName, height }) {
  // A height that has been given is kept, rather than flexed away to the
  // nothing a card with no height of its own would hand down.
  const held = value => (value ? { height: value, flex: 'none' } : undefined)
  if (copy?.empty) {
    return (
      <EmptyFill>
        No block in this issue is written for {sideName}, so their copy carries nothing.
      </EmptyFill>
    )
  }
  if (part === 'html') {
    return (
      <iframe
        title="The message as it will arrive"
        sandbox=""
        srcDoc={copy?.html}
        className="border-hair-paper console-letter min-h-0 w-full flex-1 rounded-sm border"
        style={held(height)}
      />
    )
  }
  return (
    <pre
      className="border-hair-paper min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-sm border bg-[color:var(--paper-field)] p-4 font-mono text-[12px] leading-relaxed text-ink-paper"
      style={held(height)}
    >
      {copy?.text}
    </pre>
  )
}

/**
 * What the preview shows when it has been asked for and answered with no
 * message: nobody on the list to compose one against.
 */
function NobodyToComposeFor() {
  return (
    <EmptyFill>
      Nobody on the list has asked for the newsletter yet, so there is no address to compose this
      against. A message is previewed for a real recipient because the unsubscribe link is built
      from their own token.
    </EmptyFill>
  )
}

/** What the preview shows when it was asked for and the ask failed. */
function NothingComposed() {
  return <EmptyFill>No message came back. Compose it again.</EmptyFill>
}

/**
 * A block marked for one side of the list, or marked for neither.
 *
 * The absence of the field is what says a block reaches everybody, so an
 * unmarked block drops the key rather than holding an empty string: an issue
 * with nothing marked carries the shape of an issue that cannot be marked.
 */
function withAudience(block, audience) {
  const next = { ...block }
  if (audience) next.audience = audience
  else delete next.audience
  return next
}

/** One block's own fields, which differ by type and nothing else. */
function BlockTypeFields({ block, onChange }) {
  const set = patch => onChange({ ...block, ...patch })

  if (block.type === 'divider') {
    return <p className="text-paper-faint text-[13px]">A rule across the column.</p>
  }

  if (block.type === 'heading') {
    return (
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Text</span>
          <input
            type="text"
            value={block.text ?? ''}
            onChange={event => set({ text: event.target.value })}
            className={FIELD}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Level</span>
          <select
            value={block.level === 3 ? '3' : '2'}
            onChange={event => set({ level: Number(event.target.value) })}
            className={`${SELECT} w-full`}
          >
            <option value="2">Section</option>
            <option value="3">Sub-Section</option>
          </select>
        </label>
      </div>
    )
  }

  if (block.type === 'paragraph') {
    return (
      <label className="grid gap-1.5">
        <span className={`${MONO_LABEL} text-paper-faint`}>Text</span>
        <textarea
          rows={4}
          value={block.text ?? ''}
          onChange={event => set({ text: event.target.value })}
          className={`${FIELD} resize-y`}
        />
      </label>
    )
  }

  if (block.type === 'button') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Label</span>
          <input
            type="text"
            value={block.text ?? ''}
            onChange={event => set({ text: event.target.value })}
            className={FIELD}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Link</span>
          <input
            type="text"
            value={block.href ?? ''}
            onChange={event => set({ href: event.target.value })}
            placeholder="https://www.taylorurl.com/work"
            className={FIELD}
          />
        </label>
      </div>
    )
  }

  if (block.type === 'image') {
    return (
      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Source</span>
          <input
            type="text"
            value={block.src ?? ''}
            onChange={event => set({ src: event.target.value })}
            placeholder="https://www.taylorurl.com/notes/cover.png"
            className={FIELD}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Alt Text</span>
          <input
            type="text"
            value={block.alt ?? ''}
            onChange={event => set({ alt: event.target.value })}
            className={FIELD}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Width</span>
            <input
              type="number"
              min="1"
              value={block.width ?? ''}
              onChange={event => set({ width: event.target.value })}
              className={FIELD}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Height</span>
            <input
              type="number"
              min="1"
              value={block.height ?? ''}
              onChange={event => set({ height: event.target.value })}
              className={FIELD}
            />
          </label>
        </div>
        <p className="text-paper-faint text-[13px] leading-relaxed">
          Mail clients strip SVG and most of them block images until a reader allows them, so use a
          PNG and write alt text that carries the point on its own.
        </p>
      </div>
    )
  }

  const items = Array.isArray(block.items) ? block.items : []
  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2.5 text-[13px] text-paper-soft">
        <input
          type="checkbox"
          checked={block.ordered === true}
          onChange={event => set({ ordered: event.target.checked })}
          className="h-3.5 w-3.5 flex-shrink-0 accent-[color:var(--accent-fill)]"
        />
        <span>Number the items</span>
      </label>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            onChange={event =>
              set({ items: items.map((held, at) => (at === index ? event.target.value : held)) })
            }
            className={FIELD}
          />
          <button
            type="button"
            onClick={() => set({ items: items.filter((held, at) => at !== index) })}
            className="text-paper-faint inline-flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center hover:text-[color:var(--danger)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Remove item {index + 1}</span>
          </button>
        </div>
      ))}
      <span>
        <button type="button" onClick={() => set({ items: [...items, ''] })} className={QUIET}>
          <Plus className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          Add Item
        </button>
      </span>
    </div>
  )
}

/**
 * One block's editor: the side of the list it is written for, then the fields
 * its own type carries.
 *
 * Every type carries a side, so the control sits once above the type's fields
 * rather than in each of the six. A sent issue is read rather than written,
 * and the control is absent there with the rest of the editing furniture.
 */
function BlockFields({ block, final, onChange }) {
  const side = SIDES.some(one => one.key === block.audience) ? block.audience : ''

  return (
    <div className="grid gap-3">
      {!final && (
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Audience</span>
          <select
            value={side}
            onChange={event => onChange(withAudience(block, event.target.value))}
            className={`${SELECT} w-full`}
          >
            <option value="">Everybody</option>
            {SIDES.map(one => (
              <option key={one.key} value={one.key}>
                {one.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <BlockTypeFields block={block} onChange={onChange} />
    </div>
  )
}

/**
 * One block in the run of them, under a ruled head that names its kind and
 * carries the three things done to a block as a whole: moved up, moved down,
 * taken out.
 *
 * A rule rather than a card of its own, because the blocks are the issue and
 * an issue is one thing: a column of cards reads as six documents, and the
 * order they are in is the order the letter reads in.
 */
function BlockEditor({ block, index, count, final, onChange, onMove, onRemove }) {
  return (
    <div className="border-hair-paper grid gap-3 border-t px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`${MONO_LABEL} text-ink-paper`}>
          {BLOCKS.find(kind => kind.type === block.type)?.label ?? block.type}
        </span>
        {!final && (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
              className="text-paper-faint inline-flex h-7 w-7 cursor-pointer items-center justify-center hover:text-[color:var(--accent)] disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Move up</span>
            </button>
            <button
              type="button"
              disabled={index === count - 1}
              onClick={() => onMove(index, index + 1)}
              className="text-paper-faint inline-flex h-7 w-7 cursor-pointer items-center justify-center hover:text-[color:var(--accent)] disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Move down</span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-paper-faint inline-flex h-7 w-7 cursor-pointer items-center justify-center hover:text-[color:var(--danger)]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Remove block</span>
            </button>
          </span>
        )}
      </div>
      <BlockFields block={block} final={final} onChange={onChange} />
    </div>
  )
}

/** The list of issues and the form that starts one; and, inside an issue, the writing, the preview and the sending. */
const ISSUE_VIEWS = [
  { key: 'issues', label: 'Issues' },
  { key: 'new', label: 'New Issue' },
]
const WRITING_VIEWS = [
  { key: 'write', label: 'Write' },
  { key: 'preview', label: 'Preview' },
  { key: 'sending', label: 'Sending' },
]

export default function NewsletterPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const {
    data,
    error,
    loading,
    results,
    resultsError,
    resultsLoading,
    acting,
    open,
    compose,
    act,
    send,
  } = useNewsletterFeed({
    token,
    enabled: Boolean(token),
  })
  const desk = useDesk()
  const letterHeight = desk ? undefined : LETTER_PHONE

  const [draft, setDraft] = useState(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [when, setWhen] = useState('')
  // Undefined until the composer has been asked for this issue, null when it
  // was asked and nothing came back; the effect below reads the difference,
  // or a failed compose would be asked for again on every render.
  const [preview, setPreview] = useState(undefined)
  const [previewing, setPreviewing] = useState(false)
  const [part, setPart] = useState('html')
  const [side, setSide] = useState(CLIENT)
  const [arming, setArming] = useState(null)
  const [outcome, setOutcome] = useState(null)

  const issues = data?.issues || []
  const audience = data?.audience ?? { client: 0, prospect: 0, total: 0 }
  const drafts = issues.filter(issue => issue.status === 'draft').length
  const ready = issues.filter(issue => issue.status === 'scheduled').length
  const sent = issues.filter(issue => issue.status === 'sent').length
  const editing = Boolean(draft)
  const final = draft?.status === 'sent'
  // The view is one set inside an issue and another outside it, and the
  // address falls back to the front of whichever set it lands in.
  const [view, go] = useView(editing ? WRITING_VIEWS : ISSUE_VIEWS)
  const draftId = draft?.id ?? null

  // What came back to each sent issue, by id. A draft has no row here and its
  // cells stay empty, which is the truth about it rather than a gap.
  const outcomes = useMemo(
    () => new Map((results?.issues || []).map(row => [row.id, row])),
    [results]
  )
  // The list's reach as one figure each: every open, click, bounce and
  // complaint against everything that left, over every issue sent.
  const reach = useMemo(() => {
    const sum = { sent: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 }
    for (const row of results?.issues || []) {
      sum.sent += row.sent || 0
      sum.opened += row.opened || 0
      sum.clicked += row.clicked || 0
      sum.bounced += row.bounced || 0
      sum.complained += row.complained || 0
    }
    return sum
  }, [results])
  const openRate = reach.sent ? (reach.opened / reach.sent) * 100 : null
  const clickRate = reach.sent ? (reach.clicked / reach.sent) * 100 : null
  const bounceRate = reach.sent ? (reach.bounced / reach.sent) * 100 : null

  // The sent issues the chart draws, newest first as the list beside it runs,
  // each under the name the axis can set, and how many there were to draw.
  const charted = useMemo(() => {
    const went = (results?.issues || []).filter(row => row.sent)
    return {
      rows: went.slice(0, CHARTED).map(row => ({ ...row, name: short(row.title) })),
      count: went.length,
    }
  }, [results])

  // The row on the list is the one the endpoint answers for. Holding the
  // status in the draft alone would leave a sent issue still offering its send
  // button until the page was left and opened again.
  const standing = draft ? (issues.find(issue => issue.id === draft.id) ?? draft) : null

  const load = useCallback(
    async id => {
      const issue = await open(id)
      if (!issue) return
      setDraft(issue)
      setTitle(issue.title || '')
      setSlug(issue.slug || '')
      setWhen(forField(issue.scheduled_for))
      setPreview(undefined)
      setPart('html')
      setSide(CLIENT)
      setOutcome(null)
      setArming(null)
    },
    [open]
  )

  // A draft that has just been sent is finished, and the composer holding it
  // open over an editor nothing can write to is a screen that invites the
  // attempt. The list is where a sent issue is read from.
  useEffect(() => {
    if (standing?.status === 'sent' && draft && draft.status !== 'sent') {
      setDraft({ ...draft, status: 'sent' })
    }
  }, [standing, draft])

  const blocks = Array.isArray(draft?.body) ? draft.body : []
  const setBlocks = next => setDraft(held => ({ ...held, body: next }))
  const moveBlock = (from, to) => {
    const next = [...blocks]
    next.splice(to, 0, next.splice(from, 1)[0])
    setBlocks(next)
  }

  const copy = preview?.copies?.[side] ?? null
  const sideName = SIDES.find(one => one.key === side)?.name ?? side

  const submitNew = async event => {
    event.preventDefault()
    const answer = await act({ action: 'create', title, slug: slug || slugFrom(title) }, 'create')
    if (!answer?.issue) return
    setTitle('')
    setSlug('')
    await load(answer.issue.id)
  }

  const openPreview = useCallback(async () => {
    if (!draftId) return
    setPreviewing(true)
    setPreview(await compose(draftId))
    setPreviewing(false)
  }, [compose, draftId])

  // The letter beside the editor is composed again once the save has landed,
  // so it reads the issue as kept and not as it was two edits ago. The copy
  // already on screen stays until the new one arrives.
  const submitSave = async event => {
    event.preventDefault()
    const answer = await act(
      {
        action: 'save',
        id: draft.id,
        title: draft.title,
        slug: draft.slug,
        preheader: draft.preheader,
        body: blocks,
      },
      'save'
    )
    if (!answer?.issue) return
    setDraft(answer.issue)
    await openPreview()
  }

  // The preview composes itself the first time a view that shows it is
  // opened, and again on request once the issue has been changed under it.
  useEffect(() => {
    if (
      editing &&
      (view === 'write' || view === 'preview') &&
      preview === undefined &&
      !previewing
    ) {
      openPreview()
    }
  }, [editing, view, preview, previewing, openPreview])

  const submitReady = async () => {
    const answer = await act(
      { action: 'ready', id: draft.id, scheduled_for: when ? new Date(when).toISOString() : null },
      'ready'
    )
    if (answer?.issue) setDraft(held => ({ ...held, ...answer.issue }))
  }

  const submitUnready = async () => {
    const answer = await act({ action: 'unready', id: draft.id }, 'unready')
    if (answer?.issue) setDraft(held => ({ ...held, ...answer.issue }))
  }

  const submitSend = async () => {
    setArming(null)
    const answer = await send(draft.id)
    if (answer) setOutcome(answer)
  }

  const submitRemove = async id => {
    setArming(null)
    const answer = await act({ action: 'remove', id }, `remove-${id}`)
    if (answer && draft?.id === id) setDraft(null)
  }

  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  if (editing) {
    const status = standing?.status ?? 'draft'
    const result = outcomes.get(draft.id)
    // How many of the blocks reach each side: the unmarked ones and the ones
    // marked for it.
    const blocksFor = key => blocks.filter(block => !block.audience || block.audience === key)
    // What the send reaches while the issue is still to go, and what came
    // back once it has gone. Two lists for one card, because the question
    // changes the moment the issue does.
    const readings = final
      ? [
          {
            label: 'Sent',
            value: fullCount(result?.sent),
            caption: result?.failed ? `${fullCount(result.failed)} failed` : null,
          },
          { label: 'Delivered', value: fullCount(result?.delivered) },
          {
            label: 'Opened',
            value: percent(result?.open_rate),
            caption: `${fullCount(result?.opened)} readers`,
          },
          {
            label: 'Clicked',
            value: percent(result?.click_rate),
            caption: `${fullCount(result?.clicked)} readers`,
          },
          {
            label: 'Bounced',
            value: percent(result?.bounce_rate),
            caption: `${fullCount(result?.bounced)} addresses`,
          },
          { label: 'Complained', value: fullCount(result?.complained) },
        ]
      : [
          {
            label: 'Clients',
            value: fullCount(audience.client),
            caption: `${fullCount(blocksFor(CLIENT).length)} blocks in their copy`,
          },
          {
            label: 'Prospects',
            value: fullCount(audience.prospect),
            caption: `${fullCount(blocksFor(PROSPECT).length)} blocks in their copy`,
          },
          { label: 'Everybody', value: fullCount(audience.total) },
        ]
    const previewAside = preview?.recipient
      ? `composed for ${preview.recipient.email}`
      : preview
        ? 'nobody on the list to compose for'
        : undefined

    return (
      <ConsolePage areas={['nav', 'work']} rows="auto minmax(0,1fr)">
        <Area area="nav">
          <ConsoleError>{error}</ConsoleError>
          {/* The way back, the issue's standing and its views on one line,
              so the work under them has the rest of the screen. */}
          <m.div {...fadeInUp} className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => setDraft(null)} className={QUIET}>
              <ArrowLeft className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
              All Issues
            </button>
            <StatusBadge status={status} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-paper-soft">
              {standing?.title}
            </span>
            <div className="ml-auto">
              <ViewNav views={WRITING_VIEWS} current={view} onPick={go} label="Issue views" />
            </div>
          </m.div>
        </Area>

        {view === 'write' ? (
          <Board area="work" areas={['editor letter']} cols="minmax(0,1fr) minmax(0,1fr)">
            <Panel area="editor" title="The Issue" aside={`/notes/${draft.slug || ''}`}>
              {/* The form is the column the card holds, so the fields scroll
                  between the head and the button that keeps them. */}
              <form onSubmit={submitSave} className="flex min-h-0 flex-1 flex-col">
                <PanelBody>
                  <div className="grid gap-3 px-5 py-4">
                    <label className="grid gap-1.5">
                      <span className={`${MONO_LABEL} text-paper-faint`}>Subject</span>
                      <input
                        required
                        type="text"
                        value={draft.title ?? ''}
                        disabled={final}
                        onChange={event => setDraft({ ...draft, title: event.target.value })}
                        className={FIELD}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className={`${MONO_LABEL} text-paper-faint`}>Preheader</span>
                      <input
                        type="text"
                        value={draft.preheader ?? ''}
                        disabled={final}
                        onChange={event => setDraft({ ...draft, preheader: event.target.value })}
                        placeholder="the line an inbox shows after the subject"
                        className={FIELD}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className={`${MONO_LABEL} text-paper-faint`}>Web Address</span>
                      <input
                        required
                        type="text"
                        value={draft.slug ?? ''}
                        disabled={final}
                        onChange={event => setDraft({ ...draft, slug: event.target.value })}
                        className={`${FIELD} font-mono text-[12px]`}
                      />
                    </label>
                  </div>

                  {blocks.map((block, index) => (
                    <BlockEditor
                      key={index}
                      block={block}
                      index={index}
                      count={blocks.length}
                      final={final}
                      onChange={next =>
                        setBlocks(blocks.map((held, at) => (at === index ? next : held)))
                      }
                      onMove={moveBlock}
                      onRemove={at => setBlocks(blocks.filter((held, where) => where !== at))}
                    />
                  ))}

                  {!final && (
                    <div className="border-hair-paper grid gap-3 border-t px-5 py-4">
                      <span className={`${MONO_LABEL} text-paper-faint`}>Add a Block</span>
                      <div className="flex flex-wrap gap-2">
                        {BLOCKS.map(kind => (
                          <button
                            key={kind.type}
                            type="button"
                            onClick={() => setBlocks([...blocks, blankBlock(kind.type)])}
                            className={QUIET}
                          >
                            <Plus className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                            {kind.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </PanelBody>
                <PanelFoot>
                  {final ? (
                    <span>
                      This issue went out on {day(standing?.sent_at)}. It stays as it was received.
                    </span>
                  ) : (
                    <>
                      <Reading label="Blocks" value={fullCount(blocks.length)} />
                      <button type="submit" disabled={acting === 'save'} className={BUTTON}>
                        {acting === 'save' ? 'Saving' : 'Save Issue'}
                      </button>
                    </>
                  )}
                </PanelFoot>
              </form>
            </Panel>

            <Panel
              area="letter"
              title="Preview"
              aside={previewAside}
              loading={previewing && !preview}
            >
              {preview?.copies && (
                <div className="border-hair-paper flex flex-wrap items-center justify-between gap-2 border-b px-5 py-2.5">
                  <Toggle options={SIDES} value={side} onPick={setSide} />
                  <Toggle options={PARTS} value={part} onPick={setPart} />
                </div>
              )}
              <PanelFill minHeight={CHART_HEIGHT.traffic}>
                {preview === undefined || (previewing && !preview) ? (
                  <SkeletonBox height="100%" />
                ) : preview?.copies ? (
                  <div className="flex min-h-0 flex-col px-5 py-4">
                    <Letter copy={copy} part={part} sideName={sideName} height={letterHeight} />
                  </div>
                ) : preview ? (
                  <NobodyToComposeFor />
                ) : (
                  <NothingComposed />
                )}
              </PanelFill>
              <PanelFoot>
                {preview?.subject ? (
                  <span className="min-w-0 truncate">
                    <span className={`${MONO_LABEL} text-paper-faint mr-2`}>Subject</span>
                    {preview.subject}
                  </span>
                ) : (
                  <span />
                )}
                <button type="button" onClick={openPreview} disabled={previewing} className={QUIET}>
                  <Eye className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  Compose Again
                </button>
              </PanelFoot>
            </Panel>
          </Board>
        ) : null}

        {view === 'preview' ? (
          <Panel area="work" title="Preview" aside={previewAside} loading={previewing && !preview}>
            {/* One issue reads differently to a client and to a prospect, so
                both copies stand side by side, in whichever part is picked. */}
            {preview?.copies && (
              <div className="border-hair-paper flex flex-wrap items-center justify-between gap-2 border-b px-5 py-2.5">
                <Toggle options={PARTS} value={part} onPick={setPart} />
                <span className="min-w-0 truncate text-[13px] text-ink-paper">
                  <span className={`${MONO_LABEL} text-paper-faint mr-2`}>Subject</span>
                  {preview.subject}
                </span>
              </div>
            )}
            <PanelFill minHeight={CHART_HEIGHT.traffic}>
              {preview === undefined || (previewing && !preview) ? (
                <SkeletonBox height="100%" />
              ) : preview?.copies ? (
                <div className="grid min-h-0 gap-4 px-5 py-4 lg:grid-cols-2">
                  {SIDES.map(one => (
                    <div key={one.key} className="flex min-h-0 flex-col gap-2">
                      <span className={`${MONO_LABEL} text-paper-faint`}>{one.label}</span>
                      <Letter
                        copy={preview.copies[one.key]}
                        part={part}
                        sideName={one.name}
                        height={letterHeight}
                      />
                    </div>
                  ))}
                </div>
              ) : preview ? (
                <NobodyToComposeFor />
              ) : (
                <NothingComposed />
              )}
            </PanelFill>
            <PanelFoot>
              <span>
                Both parts of the message, composed for the first person on the list, with the
                unsubscribe link their copy will carry.
              </span>
              <button type="button" onClick={openPreview} disabled={previewing} className={QUIET}>
                <Eye className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                Compose Again
              </button>
            </PanelFoot>
          </Panel>
        ) : null}

        {view === 'sending' ? (
          <Panel
            area="work"
            title="Sending"
            aside={`${fullCount(audience.total)} on the list`}
            loading={loading}
          >
            <PanelBody>
              {/* The date and the sentence on one side; on the other, who the
                  send reaches while it is still to go, and what came back
                  once it has gone. */}
              <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
                <div className="grid content-start gap-3">
                  {final ? (
                    <p className="text-[13px] leading-relaxed text-paper-soft">
                      This issue went out on {day(standing?.sent_at)}. It stays as it was received.
                    </p>
                  ) : (
                    <>
                      <label className="grid gap-1.5">
                        <span className={`${MONO_LABEL} text-paper-faint`}>Send On</span>
                        <input
                          type="datetime-local"
                          value={when}
                          onChange={event => setWhen(event.target.value)}
                          disabled={status === 'scheduled'}
                          className={FIELD}
                        />
                      </label>
                      <p className="text-[13px] leading-relaxed text-paper-soft">
                        {status === 'scheduled'
                          ? when
                            ? 'This issue goes out on the date above, or now if you send it.'
                            : 'This issue is ready. It goes out when you send it.'
                          : 'A draft cannot be sent. Mark it ready first; leave the date empty to send it by hand.'}
                      </p>
                    </>
                  )}

                  {outcome && (
                    <p className="text-[13px] leading-relaxed text-paper-soft">
                      {fullCount(outcome.sent)} sent, {fullCount(outcome.failed)} failed,{' '}
                      {fullCount(outcome.remaining)} still to go.
                    </p>
                  )}
                </div>

                <dl className="border-hair-paper self-start rounded-[var(--console-radius-sm)] border">
                  {readings.map(reading => (
                    <Metric
                      key={reading.label}
                      label={reading.label}
                      value={reading.value}
                      caption={reading.caption}
                      loading={final ? resultsLoading : loading}
                    />
                  ))}
                </dl>
              </div>
            </PanelBody>

            {!final && (
              <PanelFoot>
                {status === 'scheduled' ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={acting === 'unready'}
                      onClick={submitUnready}
                      className={QUIET}
                    >
                      {acting === 'unready' ? 'Reopening' : 'Reopen Draft'}
                    </button>
                    {arming === 'send' ? (
                      <>
                        <button
                          type="button"
                          disabled={acting === 'send'}
                          onClick={submitSend}
                          className={BUTTON}
                        >
                          {acting === 'send'
                            ? 'Sending'
                            : `Send to ${fullCount(audience.total)} People`}
                        </button>
                        <button type="button" onClick={() => setArming(null)} className={QUIET}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={acting === 'send' || audience.total === 0}
                        onClick={() => setArming('send')}
                        className={BUTTON}
                      >
                        <Send className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                        Send Now
                      </button>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={acting === 'ready' || blocks.length === 0}
                    onClick={submitReady}
                    className={BUTTON}
                  >
                    {acting === 'ready' ? 'Marking Ready' : 'Mark Ready'}
                  </button>
                )}
              </PanelFoot>
            )}
          </Panel>
        ) : null}
      </ConsolePage>
    )
  }

  // The list takes the wider column and the chart the rest. Starting an issue
  // is two fields, so its card keeps its own height and the chart runs on
  // down the right beside it.
  const starting = view === 'new'
  const areas = starting
    ? ['stats stats', 'nav nav', 'new reach', '. reach']
    : ['stats stats', 'nav nav', 'issues reach']

  return (
    <ConsolePage
      areas={areas}
      cols={starting ? '26rem minmax(0,1fr)' : 'minmax(0,2fr) minmax(0,1fr)'}
      rows={starting ? 'auto auto auto minmax(0,1fr)' : 'auto auto minmax(0,1fr)'}
    >
      {/* Six figures in one row at the desk width. Left to fit themselves
          they wrap to two rows on a 1280px screen, and the second row is a
          row of the issues table. */}
      <m.div
        {...fadeInUp}
        className="console-stats"
        style={{
          '--area': 'stats',
          gridTemplateColumns: desk ? 'repeat(6, minmax(0, 1fr))' : undefined,
        }}
        aria-busy={loading || resultsLoading}
      >
        <StatCard
          label="Subscribers"
          value={fullCount(audience.total)}
          caption={`${fullCount(audience.client)} clients, ${fullCount(audience.prospect)} prospects`}
          tone="accent"
          loading={loading}
        />
        <StatCard
          label="Drafts"
          value={fullCount(drafts)}
          caption="still being written"
          loading={loading}
        />
        <StatCard
          label="Ready"
          value={fullCount(ready)}
          caption="waiting to go out"
          loading={loading}
        />
        <StatCard
          label="Sent"
          value={fullCount(sent)}
          caption="issues gone out"
          loading={loading}
        />
        {/* The two readings of the list as a whole. Every issue's own share is
            on its row; these are the same counts added up, so a change in how
            the list is doing reads before any one issue is opened. */}
        <StatCard
          label="Opened"
          value={percent(openRate)}
          caption={reach.sent ? `of ${fullCount(reach.sent)} messages sent` : 'nothing sent yet'}
          tone={reach.opened ? 'good' : 'plain'}
          loading={resultsLoading}
        />
        <StatCard
          label="Clicked"
          value={percent(clickRate)}
          caption="followed a link"
          tone={reach.clicked ? 'good' : 'plain'}
          loading={resultsLoading}
        />
      </m.div>

      <Area area="nav">
        <ConsoleError>{error}</ConsoleError>
        <ViewNav
          views={[
            { key: 'issues', label: 'Issues', count: issues.length, loading },
            { key: 'new', label: 'New Issue' },
          ]}
          current={view}
          onPick={go}
          label="Newsletter views"
        />
      </Area>

      {starting ? (
        <Panel area="new" title="New Issue">
          <form onSubmit={submitNew}>
            <div className="grid gap-3 px-5 py-4">
              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Subject</span>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="What the inbox shows"
                  className={FIELD}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Web Address</span>
                <input
                  type="text"
                  value={slug}
                  onChange={event => setSlug(event.target.value)}
                  placeholder={slugFrom(title) || 'taken from the subject'}
                  className={`${FIELD} font-mono text-[12px]`}
                />
              </label>
            </div>
            <PanelFoot>
              <button type="submit" disabled={acting === 'create'} className={BUTTON}>
                <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                {acting === 'create' ? 'Creating' : 'Start Writing'}
              </button>
            </PanelFoot>
          </form>
        </Panel>
      ) : (
        <Panel
          area="issues"
          title="Issues"
          aside={`${fullCount(issues.length)} written`}
          loading={loading}
        >
          <PanelBody>
            {/* Measured columns rather than shared-out ones: a title takes the
                width a title needs, and the three readings of what came back
                sit close enough to the count they are read against. The
                standing and the date share a cell, since the date is the date
                of the standing - written, ready for, or gone on. */}
            <table
              className="w-full min-w-[640px] border-collapse text-[13px] [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5"
              aria-busy={loading}
            >
              <thead>
                <tr>
                  <th scope="col" className={TH_TIGHT}>
                    Issue
                  </th>
                  <th scope="col" className={TH_TIGHT}>
                    Status
                  </th>
                  <th scope="col" className={`${TH_TIGHT} text-right`}>
                    Sent
                  </th>
                  <th scope="col" className={`${TH_TIGHT} text-right`}>
                    Opened
                  </th>
                  <th scope="col" className={`${TH_TIGHT} text-right`}>
                    Clicked
                  </th>
                  <th scope="col" className={`${TH_TIGHT} text-right`}>
                    Bounced
                  </th>
                  <th scope="col" className={`${TH_TIGHT} w-[4rem]`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows
                    cols={Array.from({ length: 7 }, () => 'px-3')}
                    rows={4}
                    height={ROW_HEIGHT.pages}
                  />
                ) : issues.length ? (
                  issues.map(issue => {
                    // A row that has gone out waits on the second read for its
                    // three shares; one that has not has nothing to wait for.
                    const outcome = outcomes.get(issue.id)
                    const waiting = issue.status === 'sent' && resultsLoading
                    return (
                      <tr key={issue.id} className="border-hair-paper border-t align-top">
                        <td className={CELL_TIGHT}>
                          <button
                            type="button"
                            onClick={() => load(issue.id)}
                            title={issue.title}
                            className="block max-w-[16rem] cursor-pointer truncate text-left text-ink-paper hover:text-[color:var(--accent)]"
                          >
                            {issue.title}
                          </button>
                          <p className="text-paper-faint max-w-[16rem] truncate font-mono text-[12px]">
                            /notes/{issue.slug}
                          </p>
                        </td>
                        <td className={`${CELL_TIGHT} whitespace-nowrap`}>
                          <StatusBadge status={issue.status} />
                          <p className="text-paper-faint mt-1 text-[12px]">
                            {day(issue.sent_at || issue.scheduled_for || issue.created_at)}
                          </p>
                        </td>
                        <td
                          className={`${CELL_TIGHT} whitespace-nowrap text-right text-paper-soft`}
                        >
                          {issue.sent ? fullCount(issue.sent) : '—'}
                          {issue.failed ? (
                            <span className="text-[color:var(--danger)]">
                              {' '}
                              +{fullCount(issue.failed)} failed
                            </span>
                          ) : null}
                        </td>
                        <td className={`${CELL_TIGHT} text-right`}>
                          <Share
                            part={outcome?.opened}
                            whole={outcome?.sent}
                            rate={outcome?.open_rate}
                            tone="text-[color:var(--good)]"
                            loading={waiting}
                          />
                        </td>
                        <td className={`${CELL_TIGHT} text-right`}>
                          <Share
                            part={outcome?.clicked}
                            whole={outcome?.sent}
                            rate={outcome?.click_rate}
                            tone="text-[color:var(--good)]"
                            loading={waiting}
                          />
                        </td>
                        <td className={`${CELL_TIGHT} text-right`}>
                          <Share
                            part={outcome?.bounced}
                            whole={outcome?.sent}
                            rate={outcome?.bounce_rate}
                            tone="text-[color:var(--warn)]"
                            loading={waiting}
                          />
                        </td>
                        <td className={`${CELL_TIGHT} text-right`}>
                          {issue.status === 'sent' ? null : arming === issue.id ? (
                            <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={acting === `remove-${issue.id}`}
                                onClick={() => submitRemove(issue.id)}
                                className={`${QUIET} text-[color:var(--danger)] hover:text-[color:var(--danger)]`}
                              >
                                Discard
                              </button>
                              <button
                                type="button"
                                onClick={() => setArming(null)}
                                className={QUIET}
                              >
                                Keep
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setArming(issue.id)}
                              className="text-paper-faint inline-flex h-7 w-7 cursor-pointer items-center justify-center hover:text-[color:var(--danger)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">Discard {issue.title}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <EmptyRow cols={7}>No issues yet. Start one in the New Issue view.</EmptyRow>
                )}
              </tbody>
            </table>
          </PanelBody>
          {resultsError ? (
            <PanelFoot>
              <p className="leading-relaxed text-[color:var(--warn)]">{resultsError}</p>
            </PanelFoot>
          ) : sent ? (
            <PanelFoot>
              <p className="leading-relaxed">
                Opened, clicked and bounced are Resend&apos;s readings and arrive over the hours
                after an issue goes. An open is counted when a mail client fetches the pictures,
                which some do unread and others never, so it runs low.
              </p>
            </PanelFoot>
          ) : null}
        </Panel>
      )}

      {/* What each sent issue did, one against the next. The list's two
          readings are in the strip above; the two the strip does not carry,
          which are the ones that cost an address, close the card. */}
      <Panel
        area="reach"
        title="Opens and Clicks"
        aside={
          charted.count > charted.rows.length
            ? `newest ${fullCount(charted.rows.length)} of ${fullCount(charted.count)} sent`
            : `${fullCount(charted.count)} issues sent`
        }
        loading={resultsLoading}
      >
        <PanelFill minHeight={CHART_HEIGHT.traffic}>
          {resultsLoading ? (
            <SkeletonBox height="100%" />
          ) : resultsError ? (
            <EmptyFill>{resultsError}</EmptyFill>
          ) : charted.rows.length ? (
            <div className="px-2 py-3">
              <IssueReachChart rows={charted.rows} series={REACH_SERIES} fill />
            </div>
          ) : (
            <EmptyFill>Nothing has gone out yet.</EmptyFill>
          )}
        </PanelFill>
        <PanelFoot>
          <span className="inline-flex flex-wrap items-center gap-3">
            {REACH_SERIES.map(series => (
              <span key={series.key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded"
                  style={{ background: series.color }}
                />
                <span className={`${MONO_LABEL} text-paper-faint`}>{series.label}</span>
              </span>
            ))}
          </span>
          <span className="inline-flex flex-wrap items-center gap-4">
            <Reading
              label="Bounced"
              value={percent(bounceRate)}
              note={reach.bounced ? fullCount(reach.bounced) : null}
              loading={resultsLoading}
            />
            <Reading
              label="Complained"
              value={fullCount(reach.complained)}
              loading={resultsLoading}
            />
          </span>
        </PanelFoot>
      </Panel>
    </ConsolePage>
  )
}
