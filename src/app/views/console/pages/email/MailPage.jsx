import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { useSession } from '@hooks/session/useSession'
import { useMailFeed } from '@hooks/console/useMailFeed'
import {
  Area,
  Badge,
  ConsoleError,
  ConsolePage,
  ConsoleSplit,
  Panel,
  PanelBody,
  PanelFill,
  PanelFoot,
  SectionNotice,
  SkeletonBar,
  SkeletonBox,
  ViewNav,
} from '../../ui'
import { useView } from '../../lib/views'
import { BUTTON, FIELD, MONO_LABEL, QUIET, SELECT } from '../../lib/tokens'
import { dayIn, ZONE } from '@lib/time/zone.js'

/**
 * Every message the site sends, read as the person on the other end reads it.
 *
 * Four systems send from this domain and each one is otherwise inspected where
 * it was written: an outreach draft as a row, a newsletter issue in its own
 * composer, and the two that keep no record nowhere at all. A message is a
 * thing with a layout, and none of those show one.
 *
 * The history has the room to itself until a row is picked, and carries the
 * two facts a narrow column has to drop. Picking one narrows it to a column
 * and the message takes the rest, with the history's own scroll held inside
 * its card so moving down it does not carry the message off the top. The
 * catalogue of every kind of message the site can send is a view of its own,
 * and picking a kind from it opens that kind's sample in the same pane.
 *
 * The two families that keep no record of a send are drawn from a sample rather
 * than from a row, which is the only way a message nobody stored can be looked
 * at, and it is still the code that sends them doing the drawing.
 *
 * A message is drawn in a frame of its own because an email carries a whole
 * document's worth of styling, and rendering it into the console would let that
 * styling out into the console.
 *
 * Nothing here can be read into a figure elsewhere. What arrives has already
 * had its open counter, its unsubscribe link and its campaign tag taken out, so
 * scrolling past a cold message does not record the business as having read it.
 */

const SYSTEMS = [
  { id: 'all', label: 'Every System' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'newsletter', label: 'Newsletter' },
]

/** What a message's state is called on a row, and the badge tone carrying it. */
const STATUS = {
  drafted: { label: 'Drafted', tone: 'plain' },
  failed: { label: 'Failed', tone: 'bad' },
  bounced: { label: 'Bounced', tone: 'bad' },
  sample: { label: 'Sample', tone: 'plain' },
}

/**
 * A moment at the width a list column has for it.
 *
 * A full date and time is four lines in a column this narrow, which is what
 * turns a hundred and forty rows into a page nobody can scan. Today is the hour
 * it arrived, this year is the day, and anything older carries the year it
 * belongs to - which is how every mail client states the same thing, and how a
 * reader already expects to read it.
 */
function shortWhen(value) {
  if (!value) return null
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return null
  const now = new Date()
  // Today and this year are the studio's, not the reader's: the box is one
  // desk's mail, and a message that arrived this afternoon should not be
  // filed under yesterday because the reader opened it from a later zone.
  const day = dayIn(at)
  const thisDay = dayIn(now)
  if (day === thisDay) {
    return at.toLocaleTimeString(undefined, { timeZone: ZONE, hour: 'numeric', minute: '2-digit' })
  }
  if (day.slice(0, 4) === thisDay.slice(0, 4)) {
    return at.toLocaleDateString(undefined, { timeZone: ZONE, month: 'short', day: 'numeric' })
  }
  return at.toLocaleDateString(undefined, { timeZone: ZONE, month: 'short', year: 'numeric' })
}

/** The same moment written out, for the one message being read. */
function fullWhen(value) {
  if (!value) return 'Not sent'
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return 'Not sent'
  return at.toLocaleString(undefined, {
    timeZone: ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * One row of the history: which message, who had it, when.
 *
 * Beside a message the row has a column to fit in and states the three facts
 * that identify it. With the page to itself it has room for the two more the
 * narrow column has to drop - which system sent it, and whether anybody opened
 * it - rather than leaving that width as margin.
 */
function Row({ row, open, wide, onOpen }) {
  return (
    <li className="border-hair-paper border-t">
      <button
        type="button"
        data-wide={wide ? 'true' : undefined}
        aria-current={open ? 'true' : undefined}
        onClick={onOpen}
        className="console-mail-row"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[13px] text-ink-paper">{row.subject}</span>
          <span className="text-paper-faint truncate text-[12px]">{row.to}</span>
        </span>
        {wide && (
          <span className={`console-mail-col ${MONO_LABEL} text-paper-faint`}>{row.system}</span>
        )}
        {wide && (
          <span className="console-mail-col text-paper-faint text-[12px] tabular-nums">
            {row.opens ? `${row.opens} open${row.opens === 1 ? '' : 's'}` : 'Not opened'}
          </span>
        )}
        <span className="grid justify-items-end gap-1 text-right">
          <span className="text-paper-faint whitespace-nowrap text-[12px] tabular-nums">
            {shortWhen(row.sent_at)}
          </span>
          {/* Almost every row says sent, and a badge on all of them is a column
              of one word. Only a message that did something else says so. */}
          {row.status !== 'sent' && (
            <Badge tone={STATUS[row.status]?.tone ?? 'plain'}>
              {STATUS[row.status]?.label ?? row.status}
            </Badge>
          )}
        </span>
      </button>
    </li>
  )
}

/** One kind of message, as a card in the catalogue. */
function Kind({ family, onOpen }) {
  const drawable = family.previewable !== false
  return (
    <button
      type="button"
      disabled={!drawable}
      onClick={onOpen}
      className="console-mail-kind"
      data-system={family.system}
    >
      <span className={`${MONO_LABEL} text-accent`}>{family.system}</span>
      <span className="text-[15px] font-medium text-ink-paper">{family.label}</span>
      <span className="text-[13px] text-paper-soft">{family.note}</span>
      <span className={`${MONO_LABEL} text-paper-faint mt-auto`}>
        {drawable
          ? family.keeps
            ? 'Kept, and drawn from a sample'
            : 'Drawn from a sample'
          : 'Held by Supabase'}
      </span>
    </button>
  )
}

/**
 * One fact of the envelope: a label over its value, in a row of the same.
 *
 * Each takes the width its value needs and the row wraps after that, rather
 * than ruling four columns across the pane: two of these are email addresses,
 * and an address held to a quarter of the pane is an address read by hovering
 * it.
 */
function Fact({ label, value, caption, loading }) {
  return (
    <div className="grid min-w-0 max-w-full gap-0.5">
      <dt className={`${MONO_LABEL} text-paper-faint`}>{label}</dt>
      <dd className="truncate text-[13px] text-ink-paper">
        {loading ? <SkeletonBar className="my-1 w-24" /> : value}
        {caption && !loading && (
          <span className="text-paper-faint ml-2 text-[12px]">{caption}</span>
        )}
      </dd>
    </div>
  )
}

/** What has been sent, and every kind of message the site can send. */
const MAIL_VIEWS = [
  { key: 'sent', label: 'Sent' },
  { key: 'kinds', label: 'Every Kind' },
]

export default function MailPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const [system, setSystem] = useState('all')
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(null)
  const [half, setHalf] = useState('html')
  const reading = useRef(null)
  const [view, go] = useView(MAIL_VIEWS)

  // A read per keystroke would ask the endpoint to merge two tables for a
  // search nobody has finished typing.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 250)
    return () => clearTimeout(timer)
  }, [typed])

  useEffect(() => {
    setPage(0)
  }, [system, search])

  const filters = useMemo(
    () => ({ system: system === 'all' ? '' : system, search, page }),
    [system, search, page]
  )

  const {
    data,
    retained,
    error,
    loading,
    message,
    messageError,
    messageLoading,
    sending,
    sent,
    send,
  } = useMailFeed({ token, enabled: Boolean(token), filters, open })

  // Below the width that gives the message a column of its own it sits under
  // the history, far enough down that picking a row changes nothing a reader
  // can see, so the page is brought to the head of what they opened. At the
  // desk width the pane is beside the list and the region under the bar does
  // not scroll, so there is nothing to bring into view - and a region that
  // does not scroll can still be moved by a call asking it to, which would
  // carry the tabs off the top.
  //
  // Once when the message is asked for and again when it lands, because the
  // pane changes height between the two and a scroll animated across that
  // change is cancelled part way by the change itself.
  useEffect(() => {
    if (!open) return
    if (window.matchMedia('(min-width: 1024px)').matches) return
    reading.current?.scrollIntoView({ block: 'start' })
  }, [open, messageLoading])

  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  const rows = data?.rows ?? []
  const families = retained?.families ?? []
  const pages = retained?.pages ?? 1

  const wide = !open

  const history = (
    <Panel
      title="Sent"
      loading={loading}
      aside={data ? `${data.total} message${data.total === 1 ? '' : 's'}` : null}
      area={wide ? 'work' : undefined}
    >
      {/* The filter and the search stay over the list while it scrolls under
          them, so what the rows are narrowed by is always on screen with the
          rows it narrowed. */}
      <div className="border-hair-paper flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <select
          className={SELECT}
          value={system}
          aria-label="Which system"
          onChange={event => setSystem(event.target.value)}
        >
          {SYSTEMS.map(one => (
            <option key={one.id} value={one.id}>
              {one.label}
            </option>
          ))}
        </select>
        <input
          className={`${FIELD} min-w-[10rem] flex-1 ${wide ? 'sm:max-w-xs' : ''}`}
          type="search"
          value={typed}
          placeholder="Subject or address"
          aria-label="Search sent mail"
          onChange={event => setTyped(event.target.value)}
        />
      </div>
      <PanelBody>
        <ul className="grid">
          {loading ? (
            Array.from({ length: 9 }).map((_, index) => (
              <li key={index} className="border-hair-paper border-t px-5 py-3">
                <SkeletonBar className="w-3/4" />
                <SkeletonBar className="mt-1.5 w-1/2" />
              </li>
            ))
          ) : rows.length ? (
            rows.map(row => (
              <Row
                key={row.id}
                row={row}
                wide={wide}
                open={open === row.id}
                onOpen={() => setOpen(row.id)}
              />
            ))
          ) : (
            <li className="border-hair-paper border-t px-5 py-10 text-center text-[13px] text-paper-soft">
              No messages match. Every message the site sends appears here once it goes out.
            </li>
          )}
        </ul>
      </PanelBody>
      {pages > 1 && (
        <PanelFoot className="flex items-center justify-between gap-2">
          <button
            type="button"
            className={QUIET}
            disabled={page === 0}
            onClick={() => setPage(current => Math.max(0, current - 1))}
          >
            Previous
          </button>
          <span className={`${MONO_LABEL} text-paper-faint whitespace-nowrap`}>
            {page + 1} of {pages}
          </span>
          <button
            type="button"
            className={QUIET}
            disabled={page + 1 >= pages}
            onClick={() => setPage(current => current + 1)}
          >
            Next
          </button>
        </PanelFoot>
      )}
    </Panel>
  )

  const catalogue = (
    <Panel
      title="Every Kind"
      loading={loading}
      aside={families.length ? `${families.length} kinds` : null}
      area="work"
    >
      <PanelBody>
        <div className="console-mail-kinds">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => <SkeletonBox key={index} height="9rem" />)
            : families.map(family => (
                <Kind
                  key={family.slug}
                  family={family}
                  onOpen={() => {
                    setOpen(`family:${family.slug}`)
                    go('sent')
                  }}
                />
              ))}
        </div>
      </PanelBody>
    </Panel>
  )

  // The way out of a message is the way back to the history at its full
  // width. Every other way somewhere is a tab, and a tab is already on screen.
  const close = (
    <button type="button" className={QUIET} onClick={() => setOpen(null)}>
      <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      Close
    </button>
  )

  // Nothing is drawn for a message until one is open. The pane is built here
  // whether or not it will be shown, and a message that has not been asked
  // for is not a message that is still loading.
  const letter = !open ? null : messageError ? (
    <Panel title="Not Readable">
      <p className="flex flex-1 items-center justify-center px-5 py-10 text-center text-[13px] text-paper-soft">
        {messageError}
      </p>
      <PanelFoot>{close}</PanelFoot>
    </Panel>
  ) : (
    <Panel
      title={messageLoading || !message ? 'Reading' : message.subject}
      loading={messageLoading}
      aside={message ? message.system : null}
    >
      <dl className="border-hair-paper flex flex-wrap gap-x-8 gap-y-2 border-b px-5 py-3">
        <Fact label="To" value={message?.to ?? 'Nobody yet'} loading={messageLoading} />
        <Fact label="From" value={message?.from ?? '—'} loading={messageLoading} />
        <Fact label="Sent" value={fullWhen(message?.sent_at)} loading={messageLoading} />
        <Fact
          label="Opens"
          value={message?.opens ?? '—'}
          caption="Not counting this one"
          loading={messageLoading}
        />
      </dl>
      {/* At the desk width the frame takes whatever the card has left under
          the envelope. On a phone the card has no height of its own to give,
          so the frame keeps a floor tall enough to read a letter in. */}
      <PanelFill minHeight={480}>
        {messageLoading || !message ? (
          <SkeletonBox className="flex flex-col [&>span]:flex-1" />
        ) : half === 'html' ? (
          <iframe
            title={`${message.subject}, as it was sent`}
            sandbox=""
            srcDoc={message.html}
            className="console-letter w-full"
          />
        ) : (
          <pre className="overflow-auto whitespace-pre-wrap px-5 py-4 text-[13px] text-ink-paper">
            {message.text}
          </pre>
        )}
      </PanelFill>
      <PanelFoot>
        <div className="flex flex-wrap items-center gap-2">
          {close}
          <button
            type="button"
            className={half === 'html' ? BUTTON : QUIET}
            onClick={() => setHalf('html')}
          >
            Laid Out
          </button>
          <button
            type="button"
            className={half === 'text' ? BUTTON : QUIET}
            onClick={() => setHalf('text')}
          >
            Plain Text
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {sent && (
            <span
              role="status"
              className={`${MONO_LABEL} ${sent.ok ? 'text-accent' : 'text-[color:var(--warn)]'}`}
            >
              {sent.said}
            </span>
          )}
          <button
            type="button"
            className={BUTTON}
            disabled={messageLoading || Boolean(sending)}
            onClick={() => send(open)}
          >
            <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {sending ? 'Sending' : 'Send to My Inbox'}
          </button>
        </div>
      </PanelFoot>
    </Panel>
  )

  return (
    <ConsolePage areas={['nav', 'work']} rows="auto minmax(0,1fr)">
      {/* A notice stands beside the tabs rather than over them. The one about
          the list's depth is up whenever the systems hold more than the merge
          reaches, which is most of the time, and a row of its own over the
          list would be a row taken from the list for as long as that is so. */}
      <Area area="nav">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ViewNav
            views={[
              { key: 'sent', label: 'Sent', count: data?.total, loading },
              { key: 'kinds', label: 'Every Kind', count: families.length, loading },
            ]}
            current={view}
            onPick={go}
            label="Sent mail views"
          />
          {(error || data?.capped) && (
            <div className="flex min-w-0 flex-wrap items-center gap-4">
              {error && <ConsoleError>{error}</ConsoleError>}
              {data?.capped && (
                <ConsoleError>
                  The list is merged from the most recent messages of each system, so older ones are
                  not reached from here.
                </ConsoleError>
              )}
            </div>
          )}
        </div>
      </Area>

      {view === 'kinds' ? (
        catalogue
      ) : wide ? (
        history
      ) : (
        <ConsoleSplit list={history} area="work">
          <div
            ref={reading}
            className="grid min-h-0 gap-4 lg:h-full lg:auto-rows-[minmax(0,1fr)] [&>*]:min-h-0"
          >
            {letter}
          </div>
        </ConsoleSplit>
      )}
    </ConsolePage>
  )
}
