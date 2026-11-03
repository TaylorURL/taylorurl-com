import { useMemo, useRef, useState } from 'react'
import { useSession } from '@hooks/session/useSession'
import { useToast } from '@hooks/chrome/useToast'
import { useCallList } from '@hooks/console/useCallList'
import { usePlacePhotos } from '@hooks/console/usePlacePhotos'
import { dayIn, formatInstant } from '@lib/time/zone.js'
import { mapQuery } from '@lib/outreach/prospects/map.js'
import { hostOf } from '@lib/outreach/prospects/platforms.js'
import {
  CALLBACK_LENGTHS,
  CALL_OUTCOMES,
  callBody,
  outcomeOf,
  reviewsOf,
} from '@lib/outreach/prospects/calls.js'
import { Area, ConsolePage, Panel, PanelBody, SectionNotice, SkeletonList, ViewNav } from '../../ui'
import { useView } from '../../lib/views'
import { BUTTON, CONTROL_H, FIELD, MONO_LABEL } from '../../lib/tokens'

/**
 * The Call List: one list for the owner.
 *
 * Call backs due today or overdue lead it, then the businesses worth ringing in
 * the order the ranking puts them, with the closed, the chains, the shared
 * numbers and the listings nobody has reviewed already taken out by the
 * endpoint. Every row says why it is there. Opening one puts the number up as
 * one big link to dial, what is known about the business, every call to it so
 * far, and the six results a call can come to; logging one opens the next
 * business. There is no script on it: the owner asked for the list and the
 * call, nothing to read out.
 */

const VIEWS = [
  { key: 'best', label: 'Best Leads' },
  { key: 'new', label: 'New Businesses' },
]

/** The results a call can be logged with, in the order they are drawn. */
const RESULTS = CALL_OUTCOMES.filter(outcome => outcome.offered)

/** A plain button on the card's own ground: a fill, no outline. */
const FILL = `${MONO_LABEL} ${CONTROL_H} inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-[var(--console-radius-sm)] bg-[color:var(--paper-field)] px-3.5 text-ink-paper hover:bg-[color:var(--console-row-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50`

/** The same, on ground that is already the field's fill. */
const FILL_ON_FIELD = FILL.replace(
  'bg-[color:var(--paper-field)]',
  'bg-[color:var(--console-card-bg)]'
)

/** A small heading inside a card. */
const HEAD = `${MONO_LABEL} text-paper-faint`

/** A trade as it reads at the start of a line. */
function tradeLabel(trade) {
  const text = String(trade ?? '').trim()
  return text ? text[0].toUpperCase() + text.slice(1) : null
}

/** A clock time in the studio's zone. */
function clock(value) {
  return formatInstant(value, { hour: 'numeric', minute: '2-digit' })
}

/** A day in the studio's zone. */
function onDay(value) {
  return formatInstant(value, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * What is owed on a business, said in a line, and whether it is late.
 *
 * A call back is either still ahead today, due earlier today, or overdue from
 * a day already gone, and the three read differently because they are three
 * different situations on the phone.
 */
function owedLine(due) {
  if (!due) return null
  const at = new Date(due.at)
  const now = new Date()
  const today = dayIn(at) === dayIn(now)
  if (due.kind === 'asked') {
    return { text: today ? 'Call asked for today' : `Call asked for on ${onDay(at)}`, late: !today }
  }
  if (at > now) return { text: `Call back today at ${clock(at)}`, late: false }
  if (today) return { text: `Call back was due at ${clock(at)}`, late: true }
  return { text: `Call back overdue since ${onDay(at)}`, late: true }
}

/** The input's own format for a moment, in the browser's clock. */
function localInput(date) {
  const pad = number => String(number).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function ListRow({ row, open, onOpen }) {
  const owed = owedLine(row.due)
  return (
    <li>
      <button
        type="button"
        aria-current={open ? 'true' : undefined}
        onClick={onOpen}
        className="grid w-full cursor-pointer gap-0.5 rounded-[var(--console-radius-sm)] px-3 py-2.5 text-left hover:bg-[color:var(--paper-field)] aria-[current=true]:bg-[color:var(--paper-field)] aria-[current=true]:shadow-[inset_2px_0_0_var(--accent)]"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] font-medium text-ink-paper">{row.name}</span>
          <span className="flex-shrink-0 font-mono text-[12px] tabular-nums text-paper-soft">
            {row.phone}
          </span>
        </span>
        <span className="text-paper-faint truncate text-[12px]">
          {[tradeLabel(row.trade), row.town].filter(Boolean).join(' · ') || 'Trade not on file'}
        </span>
        {owed && (
          <span className={`text-[12px] ${owed.late ? 'text-[color:var(--warn)]' : 'text-accent'}`}>
            {owed.text}
          </span>
        )}
        {row.reasons.length > 0 && (
          <span className="text-[12px] text-paper-soft">{row.reasons.join(' · ')}</span>
        )}
      </button>
    </li>
  )
}

/** The list: what is due first, then what is worth ringing. */
function CallList({ list, view, openId, onOpen }) {
  const groups = [
    { key: 'due', head: 'Callbacks due today', rows: list.due },
    {
      key: 'rows',
      head: view === 'new' ? 'Newest registered first' : 'Best to call next',
      rows: list.rows,
    },
  ].filter(group => group.rows.length)

  return (
    <Panel title="Businesses to call" className="min-h-0 flex-1">
      <PanelBody>
        {list.loading ? (
          <SkeletonList rows={10} />
        ) : groups.length ? (
          <div className="grid gap-4 p-2">
            {groups.map(group => (
              <section key={group.key} className="grid gap-1">
                <h3 className={`${HEAD} px-3 pt-1`}>{group.head}</h3>
                <ul className="grid gap-1">
                  {group.rows.map(row => (
                    <ListRow
                      key={row.id}
                      row={row}
                      open={row.id === openId}
                      onOpen={() => onOpen(row.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
            {list.more && (
              <div className="px-3 pb-2">
                <button
                  type="button"
                  className={FILL}
                  disabled={list.adding}
                  onClick={list.loadMore}
                >
                  {list.adding ? 'Loading' : 'Show More'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
            {view === 'new'
              ? 'No new business is waiting for a call.'
              : 'Nothing left to call. Every business here has been rung or ruled out.'}
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}

/** One fact about the business, against its label. */
function Fact({ label, children }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className={HEAD}>{label}</dt>
      <dd className="min-w-0 break-words text-[14px] text-ink-paper">{children}</dd>
    </div>
  )
}

/** What is known about the business. */
function Facts({ row }) {
  const query = mapQuery(row)
  const reviews = reviewsOf(row)
  const host = hostOf(row.website)
  return (
    <section className="grid gap-3">
      <h3 className={HEAD}>What we know</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Fact label="Trade">{tradeLabel(row.trade) || 'Not on file'}</Fact>
        <Fact label="Where">
          {row.address || row.town || 'Not on file'}
          {query && (
            <>
              {' '}
              <a
                className="console-link whitespace-nowrap"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open in Maps
              </a>
            </>
          )}
        </Fact>
        <Fact label="Website">
          {row.website ? (
            <a
              className="console-link"
              href={row.website}
              target="_blank"
              rel="noreferrer noopener"
            >
              {host || row.website}
            </a>
          ) : (
            'None'
          )}
        </Fact>
        <Fact label="Google">
          {row.rating && reviews
            ? `${row.rating} stars from ${reviews === 1 ? '1 review' : `${reviews} reviews`}`
            : reviews === 0
              ? 'No reviews yet'
              : 'No listing on file'}
        </Fact>
        {row.new_business && (
          <Fact label="Registered">
            {row.formed_on ? onDay(`${row.formed_on}T12:00:00Z`) : 'Not on file'}
          </Fact>
        )}
        {row.audit_score !== null && <Fact label="Site speed">{row.audit_score} of 100</Fact>}
        {row.email && <Fact label="Email">{row.email}</Fact>}
      </dl>
    </section>
  )
}

/** The names a listing's photos are credited to, as Google asks. */
function Credit({ photos }) {
  const seen = new Map()
  for (const photo of photos) {
    for (const author of photo.by ?? []) if (!seen.has(author.name)) seen.set(author.name, author)
  }
  const authors = [...seen.values()]
  if (!authors.length)
    return <p className="text-[12px] text-paper-soft">From the Google listing.</p>
  return (
    <p className="text-[12px] text-paper-soft">
      {'Photos by '}
      {authors.map((author, at) => (
        <span key={author.name}>
          {at > 0 ? (at === authors.length - 1 ? ' and ' : ', ') : ''}
          {author.uri ? (
            <a className="console-link" href={author.uri} target="_blank" rel="noreferrer">
              {author.name}
            </a>
          ) : (
            author.name
          )}
        </span>
      ))}
      {' on Google Maps.'}
    </p>
  )
}

/** The listing's photos, read only once they are asked for: every one is billed. */
function Photos({ row, token }) {
  const shots = usePlacePhotos({ token, id: row.id })
  if (shots.loading) return <p className="text-[13px] text-paper-soft">Loading photos</p>
  if (shots.error) return <p className="text-[13px] text-paper-soft">{shots.error}</p>
  if (!shots.listed)
    return <p className="text-[13px] text-paper-soft">No Google listing on file.</p>
  if (!shots.photos.length) {
    return <p className="text-[13px] text-paper-soft">The Google listing has no photos.</p>
  }
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shots.photos.map((photo, at) => (
          <a key={photo.uri} href={photo.uri} target="_blank" rel="noreferrer">
            <img
              className="aspect-square w-full rounded-[var(--console-radius-sm)] bg-[color:var(--paper-field)] object-cover"
              src={photo.uri}
              alt={`Photo ${at + 1} of ${row.name}`}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </a>
        ))}
      </div>
      <Credit photos={shots.photos} />
    </div>
  )
}

/** Every call to the business, newest first. */
function History({ calls }) {
  return (
    <section className="grid gap-3">
      <h3 className={HEAD}>Calls so far</h3>
      <ol className="grid gap-2">
        {calls.map(call => (
          <li
            key={call.id ?? call.called_at}
            className="grid gap-1 rounded-[var(--console-radius-sm)] bg-[color:var(--paper-field)] px-3 py-2.5"
          >
            <p className="text-[13px] text-ink-paper">
              <span className="font-medium">{outcomeOf(call.outcome)?.label ?? call.outcome}</span>
              <span className="text-paper-soft"> · {onDay(call.called_at)}</span>
            </p>
            {call.note && (
              <p className="whitespace-pre-line text-[13px] text-paper-soft">{call.note}</p>
            )}
            {call.callback_at && (
              <p className="text-paper-faint text-[12px]">
                Call back set for {onDay(call.callback_at)} at {clock(call.callback_at)}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The six results, the note, and the time a call back is set for. */
function LogCall({ saving, onLog }) {
  const [note, setNote] = useState('')
  const [timing, setTiming] = useState(false)
  const [at, setAt] = useState('')

  return (
    <section className="grid gap-3">
      <h3 className={HEAD}>Log the call</h3>
      <textarea
        className={`${FIELD} min-h-[72px] resize-y`}
        rows={3}
        maxLength={2000}
        value={note}
        onChange={event => setNote(event.target.value)}
        placeholder="What was said, who to ask for, a better number"
        aria-label="Note"
      />
      <div className="flex flex-wrap gap-2">
        {RESULTS.map(result => (
          <button
            key={result.id}
            type="button"
            className={result.keeps ? BUTTON : FILL}
            disabled={saving}
            aria-expanded={result.keeps ? timing : undefined}
            onClick={() =>
              result.keeps ? setTiming(was => !was) : onLog({ outcome: result.id, note })
            }
          >
            {result.label}
          </button>
        ))}
      </div>
      {timing && (
        <div className="grid gap-3 rounded-[var(--console-radius-sm)] bg-[color:var(--paper-field)] p-3">
          <p className="text-[13px] text-paper-soft">When should you call back?</p>
          <div className="flex flex-wrap gap-2">
            {CALLBACK_LENGTHS.map(length => (
              <button
                key={length.hours}
                type="button"
                className={FILL_ON_FIELD}
                disabled={saving}
                onClick={() => onLog({ outcome: 'callback', hours: length.hours, note })}
              >
                {length.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              className={`${FIELD} w-auto`}
              value={at}
              min={localInput(new Date())}
              onChange={event => setAt(event.target.value)}
              aria-label="Call back at"
            />
            <button
              type="button"
              className={BUTTON}
              disabled={saving || !at}
              onClick={() => onLog({ outcome: 'callback', at: new Date(at).toISOString(), note })}
            >
              Save Call Back
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** The business that is open: the number, why it is here, and the call. */
function Business({ row, token, saving, onLog }) {
  const [photos, setPhotos] = useState(false)
  const owed = owedLine(row.due)

  return (
    <Panel
      title={row.name}
      className="min-h-0 flex-1"
      aside={[tradeLabel(row.trade), row.town].filter(Boolean).join(' · ') || null}
    >
      <PanelBody>
        <div className="grid gap-6 px-5 py-5">
          <div className="grid gap-2">
            {row.dial ? (
              <a
                href={row.dial}
                className="justify-self-start text-[30px] font-semibold tabular-nums leading-tight text-accent sm:text-[36px]"
              >
                {row.phone}
              </a>
            ) : (
              <p className="text-[30px] font-semibold leading-tight">{row.phone}</p>
            )}
            {owed && (
              <p
                className={`text-[13px] ${owed.late ? 'text-[color:var(--warn)]' : 'text-accent'}`}
              >
                {owed.text}
              </p>
            )}
            {row.reasons.length > 0 && (
              <p className="text-[14px] text-paper-soft">{row.reasons.join(' · ')}</p>
            )}
          </div>

          {row.calls.length > 0 && <History calls={row.calls} />}

          <LogCall key={row.id} saving={saving} onLog={onLog} />

          <Facts row={row} />

          {!row.new_business && (
            <section className="grid gap-3">
              <h3 className={HEAD}>Photos</h3>
              {photos ? (
                <Photos row={row} token={token} />
              ) : (
                <button
                  type="button"
                  className={`${FILL} justify-self-start`}
                  onClick={() => setPhotos(true)}
                >
                  Show Photos
                </button>
              )}
            </section>
          )}
        </div>
      </PanelBody>
    </Panel>
  )
}

export default function CallListPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const [view, go] = useView(VIEWS)
  const list = useCallList({ token, view })
  const toast = useToast()
  const [openId, setOpenId] = useState(null)
  const card = useRef(null)

  const entries = useMemo(() => [...list.due, ...list.rows], [list.due, list.rows])
  const open = entries.find(row => row.id === openId) ?? entries[0] ?? null

  // On a phone the card sits under the list, so opening a business brings it
  // into view. At the desk width it is already beside the list.
  const pick = id => {
    setOpenId(id)
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => card.current?.scrollIntoView({ block: 'start' }))
    }
  }

  const log = async ({ outcome, hours = null, at = null, note }) => {
    if (!open) return
    const index = entries.findIndex(row => row.id === open.id)
    const saved = await list.record(callBody({ id: open.id, outcome, hours, at, note }), open)
    if (!saved) return
    toast(`${outcomeOf(outcome)?.label ?? 'Call'} saved for ${open.name}.`, 'success')
    const next = entries.slice(index + 1).find(row => row.id !== open.id) ?? null
    if (next) pick(next.id)
    else setOpenId(null)
  }

  if (list.error && !list.loading && !entries.length) {
    return <SectionNotice>{list.error}</SectionNotice>
  }

  return (
    <ConsolePage
      areas={['views views', 'list card']}
      cols="minmax(20rem, 28rem) minmax(0, 1fr)"
      rows="auto minmax(0, 1fr)"
    >
      <Area area="views">
        <ViewNav
          views={VIEWS}
          current={view}
          onPick={next => {
            setOpenId(null)
            go(next)
          }}
          label="Call list views"
        />
      </Area>

      <Area area="list">
        <CallList list={list} view={view} openId={open?.id ?? null} onOpen={pick} />
      </Area>

      <div ref={card} className="flex min-h-0 min-w-0 flex-col" style={{ '--area': 'card' }}>
        {open ? (
          <Business key={open.id} row={open} token={token} saving={list.saving} onLog={log} />
        ) : (
          <Panel title="Business" className="min-h-0 flex-1">
            {list.loading ? (
              <SkeletonList rows={6} />
            ) : (
              <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
                Pick a business from the list to see its number and log the call.
              </p>
            )}
          </Panel>
        )}
      </div>
    </ConsolePage>
  )
}
