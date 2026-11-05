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
  DAILY_CALL_GOAL,
  PIPELINE_LENGTHS,
  callBody,
  dayLine,
  dayShare,
  outcomeFilesPipeline,
  outcomeOf,
  phoneLines,
  reviewsOf,
} from '@lib/outreach/prospects/calls.js'
import { engagedWords, siteWords } from '@lib/outreach/prospects/engaged.js'
import { Area, ConsolePage, GoalBar, Panel, PanelBody, SectionNotice, SkeletonList } from '../../ui'
import { BUTTON, CONTROL_H, FIELD, MONO_LABEL } from '../../lib/tokens'

/**
 * The Call List: one list for the owner.
 *
 * The businesses that answered the mail lead it - a person opened what the
 * studio sent more than once, followed the link to the preview site, or wrote
 * back - since they are the ones most likely to want the call; the more one
 * did on its preview site, the higher it sits. Call backs due today or overdue
 * come next. Then every business worth ringing that nobody has rung, best
 * first by three scores - will the owner pick up, do they need a site, can
 * they pay - with the closed, the chains, the shared
 * numbers and the listings nobody has reviewed already taken out by the
 * endpoint; the new companies registered with the state are in it with the
 * rest. At the foot are the businesses where a front desk answered, waiting
 * for the time the owner is in. Every row says the business, each number it
 * can be rung on - the owner's own apart from the main line - and its town.
 *
 * Opening one puts the first number up as one big link to dial - the owner's
 * own where there is one - and the others under it, what is known about the
 * business, every call
 * to it so far, and the eight results a call can come to; logging one opens
 * the next business. Pipeline is the one for somebody worth seeing again:
 * it asks for a follow-up day and files the business in the sales pipeline. Above it all is the day: how many calls so far against
 * fifty. There is no script on it: the owner asked for the list and the call,
 * nothing to read out.
 */

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

/** A day of the week and a date in the studio's zone, for a time this week or next. */
function weekday(value) {
  return formatInstant(value, { weekday: 'short', month: 'short', day: 'numeric' })
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

/**
 * Why a business that answered the mail is at the top, said in a line:
 * "Opened your emails 4 times, last on Nov 4, 2026", "Opened your email and
 * visited the preview site 2 times, last on Nov 4, 2026" or "Replied to your
 * email on Oct 30, 2026".
 */
function answeredLine(engaged) {
  const words = engagedWords(engaged)
  if (!words) return null
  const at = engaged.replied_at ?? engaged.at
  return at ? `${words}, ${engaged.replied_at ? 'on' : 'last on'} ${onDay(at)}` : words
}

/** When a front desk said the owner is in, said in a line. */
function deskLine(desk) {
  if (!desk) return null
  if (!desk.at) return 'Front desk answered, no time given for the owner'
  return `Front desk said the owner is in ${weekday(desk.at)} at ${clock(desk.at)}`
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
  const answered = answeredLine(row.engaged)
  const owed = owedLine(row.due)
  const desk = deskLine(row.front_desk)
  return (
    <li>
      <button
        type="button"
        aria-current={open ? 'true' : undefined}
        onClick={onOpen}
        className="grid w-full cursor-pointer gap-0.5 rounded-[var(--console-radius-sm)] px-3 py-2.5 text-left hover:bg-[color:var(--paper-field)] aria-[current=true]:bg-[color:var(--paper-field)]"
      >
        <span className="truncate text-[14px] font-medium text-ink-paper">{row.name}</span>
        {/* Each number on a line of its own, so the owner's name never gets
            cut off the end of the row. */}
        {phoneLines(row).map(line => (
          <span key={line.phone} className="font-mono text-[12px] tabular-nums text-paper-soft">
            {line.said}
          </span>
        ))}
        <span className="text-paper-faint truncate text-[12px]">
          {[tradeLabel(row.trade), row.town].filter(Boolean).join(' · ') || 'Trade not on file'}
        </span>
        {answered && <span className="text-[12px] text-accent">{answered}</span>}
        {owed && (
          <span className={`text-[12px] ${owed.late ? 'text-[color:var(--warn)]' : 'text-accent'}`}>
            {owed.text}
          </span>
        )}
        {desk && <span className="text-[12px] text-paper-soft">{desk}</span>}
      </button>
    </li>
  )
}

/**
 * The list: who answered the mail first, then what is due, then what is worth
 * ringing, then what waits on its owner.
 */
function CallList({ list, openId, onOpen }) {
  const groups = [
    { key: 'engaged', head: 'Opened, visited or replied: call first', rows: list.engaged },
    { key: 'due', head: 'Callbacks due today', rows: list.due },
    { key: 'rows', head: 'Best to call next', rows: list.rows, more: list.more },
    { key: 'waiting', head: 'Waiting on the owner', rows: list.waiting },
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
                {group.more && (
                  <div className="px-3 pb-2 pt-1">
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
              </section>
            ))}
          </div>
        ) : (
          <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
            Nothing left to call. Every business here has been rung or ruled out.
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
        {row.owner_name && <Fact label="Owner">{row.owner_name}</Fact>}
        {row.audit_score !== null && <Fact label="Site Speed">{row.audit_score} of 100</Fact>}
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

/**
 * A time to ring back: one press for a length, or a date and time typed in.
 * Where `toggles` is set a length is picked rather than saved, and stays
 * pressed until another is. `lengths` are the presses offered, and `dayOnly`
 * asks for a day rather than a day and a time.
 */
function When({
  prompt,
  hours,
  at,
  saving,
  toggles = false,
  lengths = CALLBACK_LENGTHS,
  dayOnly = false,
  onHours,
  onAt,
}) {
  return (
    <>
      <p className="text-[13px] text-paper-soft">{prompt}</p>
      <div className="flex flex-wrap gap-2">
        {lengths.map(length => (
          <button
            key={length.hours}
            type="button"
            className={toggles && hours === length.hours ? BUTTON : FILL_ON_FIELD}
            aria-pressed={toggles ? hours === length.hours : undefined}
            disabled={saving}
            onClick={() => onHours(length.hours)}
          >
            {length.label}
          </button>
        ))}
      </div>
      <input
        type={dayOnly ? 'date' : 'datetime-local'}
        className={`${FIELD} w-auto justify-self-start`}
        value={at}
        min={dayOnly ? localInput(new Date()).slice(0, 10) : localInput(new Date())}
        onChange={event => onAt(event.target.value)}
        aria-label={prompt}
      />
    </>
  )
}

/**
 * What a front desk said: who the owner is, when they are in, and a number
 * that reaches them. Saving books the call back for that time and puts the
 * name and the number on the business.
 */
function FrontDesk({ saving, onSave }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [hours, setHours] = useState(null)
  const [at, setAt] = useState('')
  const pick = length => {
    setHours(was => (was === length ? null : length))
    setAt('')
  }

  return (
    <div className="grid gap-3 rounded-[var(--console-radius-sm)] bg-[color:var(--paper-field)] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className={HEAD}>Owner’s Name</span>
          <input
            type="text"
            className={FIELD}
            value={name}
            maxLength={120}
            autoComplete="off"
            onChange={event => setName(event.target.value)}
            placeholder="Who to ask for"
          />
        </label>
        <label className="grid gap-1">
          <span className={HEAD}>Direct Number</span>
          <input
            type="tel"
            className={FIELD}
            value={phone}
            autoComplete="off"
            onChange={event => setPhone(event.target.value)}
            placeholder="If they gave one"
          />
        </label>
      </div>
      <When
        prompt="When is the owner in?"
        hours={hours}
        at={at}
        saving={saving}
        toggles
        onHours={pick}
        onAt={value => {
          setAt(value)
          setHours(null)
        }}
      />
      <button
        type="button"
        className={`${BUTTON} justify-self-start`}
        disabled={saving}
        onClick={() =>
          onSave({
            hours,
            at: at ? new Date(at).toISOString() : null,
            ownerName: name,
            ownerPhone: phone,
          })
        }
      >
        Save Front Desk
      </button>
    </div>
  )
}

/**
 * A follow-up day for the pipeline: a week, two, a month or three in one
 * press, or a day picked. The follow-up is set for nine in the morning of the
 * day, which is when the pipeline's calendar puts it.
 */
function Pipeline({ saving, onSave }) {
  const [day, setDay] = useState('')
  return (
    <div className="grid gap-3 rounded-[var(--console-radius-sm)] bg-[color:var(--paper-field)] p-3">
      <When
        prompt="When should you follow up?"
        hours={null}
        at={day}
        saving={saving}
        lengths={PIPELINE_LENGTHS}
        dayOnly
        onHours={hours => onSave({ hours })}
        onAt={setDay}
      />
      <button
        type="button"
        className={`${BUTTON} justify-self-start`}
        disabled={saving || !day}
        onClick={() => onSave({ at: new Date(`${day}T09:00`).toISOString() })}
      >
        Add to Pipeline
      </button>
    </div>
  )
}

/** The eight results, the note, and what Call Back, Front Desk and Pipeline ask for. */
function LogCall({ saving, onLog }) {
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState(null)
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
            aria-expanded={result.keeps ? asking === result.id : undefined}
            onClick={() =>
              result.keeps
                ? setAsking(was => (was === result.id ? null : result.id))
                : onLog({ outcome: result.id, note })
            }
          >
            {result.label}
          </button>
        ))}
      </div>
      {asking === 'callback' && (
        <div className="grid gap-3 rounded-[var(--console-radius-sm)] bg-[color:var(--paper-field)] p-3">
          <When
            prompt="When should you call back?"
            hours={null}
            at={at}
            saving={saving}
            onHours={hours => onLog({ outcome: 'callback', hours, note })}
            onAt={setAt}
          />
          <button
            type="button"
            className={`${BUTTON} justify-self-start`}
            disabled={saving || !at}
            onClick={() => onLog({ outcome: 'callback', at: new Date(at).toISOString(), note })}
          >
            Save Call Back
          </button>
        </div>
      )}
      {asking === 'gatekeeper' && (
        <FrontDesk
          saving={saving}
          onSave={answered => onLog({ outcome: 'gatekeeper', note, ...answered })}
        />
      )}
      {asking === 'pipeline' && (
        <Pipeline
          saving={saving}
          onSave={answered => onLog({ outcome: 'pipeline', note, ...answered })}
        />
      )}
    </section>
  )
}

/** The business that is open: the number, who to ask for, and the call. */
function Business({ row, token, saving, onLog }) {
  const [photos, setPhotos] = useState(false)
  const answered = answeredLine(row.engaged)
  const looked = siteWords(row.engaged?.site)
  const owed = owedLine(row.due)
  const desk = deskLine(row.front_desk)
  const [first, ...rest] = phoneLines(row)

  return (
    <Panel
      title={row.name}
      className="min-h-0 flex-1"
      aside={[tradeLabel(row.trade), row.town].filter(Boolean).join(' · ') || null}
    >
      <PanelBody>
        <div className="grid gap-6 px-5 py-5">
          <div className="grid gap-2">
            {first?.dial ? (
              <a
                href={first.dial}
                aria-label={`Call ${first.said}`}
                className="justify-self-start text-[30px] font-semibold tabular-nums leading-tight text-accent sm:text-[36px]"
              >
                {first.phone}
                {first.label && (
                  <span className="text-[20px] font-medium text-ink-paper sm:text-[22px]">
                    {' · '}
                    {first.label}
                  </span>
                )}
              </a>
            ) : (
              <p className="text-[30px] font-semibold leading-tight">
                {first?.said ?? 'No number on file'}
              </p>
            )}
            {rest.map(line => (
              <a
                key={line.phone}
                href={line.dial}
                aria-label={`Call ${line.said}`}
                className="justify-self-start text-[20px] font-semibold tabular-nums leading-tight text-accent"
              >
                {line.phone}
                <span className="text-[15px] font-medium text-ink-paper">
                  {' · '}
                  {line.label}
                </span>
              </a>
            ))}
            {answered && <p className="text-[13px] text-accent">{answered}</p>}
            {looked && <p className="text-[13px] text-paper-soft">On the preview site: {looked}</p>}
            {owed && (
              <p
                className={`text-[13px] ${owed.late ? 'text-[color:var(--warn)]' : 'text-accent'}`}
              >
                {owed.text}
              </p>
            )}
            {desk && <p className="text-[13px] text-paper-soft">{desk}</p>}
          </div>

          {row.engaged?.reply && (
            <section className="grid gap-3">
              <h3 className={HEAD}>What they wrote</h3>
              <blockquote className="whitespace-pre-line rounded-[var(--console-radius-sm)] bg-[color:var(--paper-field)] px-3 py-2.5 text-[13px] text-ink-paper">
                {row.engaged.reply}
              </blockquote>
            </section>
          )}

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

/** The day so far: calls made since midnight against the goal. */
function Today({ today, loading }) {
  const made = today?.calls ?? 0
  const goal = today?.goal ?? DAILY_CALL_GOAL
  return (
    <div className="max-w-[28rem]">
      <GoalBar label={dayLine(made, goal)} share={dayShare(made, goal)} loading={loading} />
    </div>
  )
}

export default function CallListPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const list = useCallList({ token })
  const toast = useToast()
  const [openId, setOpenId] = useState(null)
  const card = useRef(null)

  const entries = useMemo(
    () => [...list.engaged, ...list.due, ...list.rows, ...list.waiting],
    [list.engaged, list.due, list.rows, list.waiting]
  )
  const open = entries.find(row => row.id === openId) ?? entries[0] ?? null

  // On a phone the card sits under the list, so opening a business brings it
  // into view. At the desk width it is already beside the list.
  const pick = id => {
    setOpenId(id)
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => card.current?.scrollIntoView({ block: 'start' }))
    }
  }

  const log = async ({ outcome, hours = null, at = null, note, ownerName, ownerPhone }) => {
    if (!open) return
    const index = entries.findIndex(row => row.id === open.id)
    const saved = await list.record(
      callBody({ id: open.id, outcome, hours, at, note, ownerName, ownerPhone }),
      open
    )
    if (!saved) return
    if (outcomeFilesPipeline(outcome)) {
      if (saved.pipeline) {
        const day = saved.callback_at ? ` Follow up ${onDay(saved.callback_at)}.` : ''
        toast(`${open.name} is in your pipeline.${day}`, 'success')
      } else {
        toast(`The call saved, but ${open.name} did not reach the pipeline.`, 'error')
      }
    } else {
      toast(`${outcomeOf(outcome)?.label ?? 'Call'} saved for ${open.name}.`, 'success')
    }
    const next = entries.slice(index + 1).find(row => row.id !== open.id) ?? null
    if (next) pick(next.id)
    else setOpenId(null)
  }

  if (list.error && !list.loading && !entries.length) {
    return <SectionNotice>{list.error}</SectionNotice>
  }

  return (
    <ConsolePage
      areas={['today today', 'list card']}
      cols="minmax(20rem, 28rem) minmax(0, 1fr)"
      rows="auto minmax(0, 1fr)"
    >
      <Area area="today">
        <Today today={list.today} loading={list.loading} />
      </Area>

      <Area area="list">
        <CallList list={list} openId={open?.id ?? null} onOpen={pick} />
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
