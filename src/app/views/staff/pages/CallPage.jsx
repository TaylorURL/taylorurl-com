import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { useCallDesk } from '@hooks/console/useCallDesk'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import { isTyping } from '@utils/keyboard'
import {
  CALLBACK_LENGTHS,
  CALL_OUTCOMES,
  callBody,
  dialHref,
  outcomeAsksInterest,
  outcomeTakesCallback,
} from '@lib/outreach/prospects/calls.js'
import { heldByOther } from '@lib/outreach/prospects/callPresence.js'
import { DEFAULT_GOALS } from '@lib/outreach/prospects/callShift.js'
import { scriptFor } from '@lib/outreach/prospects/handbook.js'
import StaffScreen from '../StaffScreen'
import { useStaff } from '../lib/context'
import { NOTE_STAMPS, callDay, callLine, callMoment, marksFor } from '../lib/call'

// The whole list, ranked, in one read. A representative works the top of it and
// never pages, so the page size is only how far ahead this screen can see when
// the rows above the one on screen are all held by somebody else.
const FILTERS = Object.freeze({ view: 'list', take: 50 })

/**
 * The only screen a representative controls.
 *
 * One business at a time, and the order is the list's own ranking rather than
 * anything chosen here. What is on screen is the next number to call, what is
 * known about the business, every call placed to it, and the lines to say - and
 * once the call is marked, the two questions that file it.
 *
 * The questions are not drawn before the call is marked. A screen that offers
 * eight outcomes and a comment box to somebody who has not dialled yet reads as
 * a form to fill in rather than a call to make, and the height they take is
 * height the script wanted.
 *
 * The four blocks that describe the business are keyed on it, so moving to the
 * next number draws them as a card that arrived rather than as four fields whose
 * text changed under the eye. The refresher below them is not keyed: a
 * representative who opened the script wants it open on the next call too.
 *
 * Where the caller is in the list is held as a trail of businesses rather than
 * an index into the rows, because the rows re-rank under it: a business that has
 * just been called leaves the callable list within the second, and an index
 * would quietly come to mean a different business. The trail also gives the way
 * back its meaning - the last number is the one this caller was actually on,
 * whatever the ranking has done since.
 */
export default function CallPage() {
  const { token, userId, name } = useStaff()
  const desk = useCallDesk({ token, userId, enabled: Boolean(token) })
  const feed = useCallsFeed({ token, enabled: Boolean(token), filters: FILTERS })

  const [trail, setTrail] = useState([])
  const [cursor, setCursor] = useState(0)
  const [marked, setMarked] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [hours, setHours] = useState(null)
  const [interest, setInterest] = useState(null)
  const [note, setNote] = useState('')

  const rows = useMemo(() => feed.data?.rows ?? [], [feed.data])
  const shift = feed.data?.shift ?? null
  const goals = desk.prefs?.goals ?? DEFAULT_GOALS

  // Every business this screen has drawn, so the way back can draw one that has
  // since left the callable list. A call that was just recorded takes its
  // business off the list it was read from, and a back button that blanks the
  // screen is a back button nobody presses twice.
  //
  // Written after the render rather than during it, because what the fallback is
  // ever asked for is a business that left the list - which was drawn from
  // `rows` in an earlier render and is in here by the time it is needed.
  const seen = useRef(new Map())
  useEffect(() => {
    for (const row of rows) seen.current.set(row.id, row)
  }, [rows])

  // What this caller may be handed: the ranked list, less whatever a colleague
  // is on the phone with this minute. The claim is the server's, so two people
  // opening the screen a minute apart are not handed the same business.
  const queue = useMemo(
    () => rows.filter(row => !heldByOther(desk.held, row.id, userId)),
    [rows, desk.held, userId]
  )

  const at = trail[cursor] ?? null
  const current = at ? (rows.find(row => row.id === at) ?? seen.current.get(at) ?? null) : null
  // A business the trail remembers but the list no longer offers has been dealt
  // with - by this caller a moment ago, or by somebody else while they read it.
  const spent = Boolean(at) && !queue.some(row => row.id === at)
  const next = queue.find(row => !trail.includes(row.id)) ?? null

  // The first business, and every one after a recorded call. Nothing is chosen
  // until the list has actually landed, because the one sentence that would
  // make somebody dial a wrong number is an empty list drawn as a finished day.
  useEffect(() => {
    if (at || !next) return
    setTrail(held => [...held, next.id])
    setCursor(held => (trail.length ? held : 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, next])

  useEffect(() => {
    if (trail.length) setCursor(trail.length - 1)
  }, [trail.length])

  // Say which number this console is on, so the board beside it draws the lock
  // and a colleague is handed somebody else. Dropping it when the screen is left
  // is the hook's own job; this only ever says what changed.
  useEffect(() => {
    if (!at || spent) return
    desk.takeNumber(at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, spent])

  const clear = useCallback(() => {
    setMarked(false)
    setOutcome(null)
    setHours(null)
    setInterest(null)
    setNote('')
  }, [])

  // Arriving at a business clears what was answered about the last one. Carrying
  // an answer forward is how a whole afternoon ends up filed the same way.
  useEffect(() => {
    clear()
  }, [at, clear])

  const move = useCallback(
    step => {
      setCursor(held => Math.min(Math.max(0, held + step), Math.max(0, trail.length - 1)))
    },
    [trail.length]
  )

  const onward = useCallback(() => {
    if (cursor < trail.length - 1) {
      move(1)
      return
    }
    if (next) setTrail(held => [...held, next.id])
  }, [cursor, trail.length, move, next])

  const picked = outcome ? CALL_OUTCOMES.find(one => one.id === outcome) : null
  const asksLength = Boolean(picked && outcomeTakesCallback(picked.id))
  const asksInterest = Boolean(picked && outcomeAsksInterest(picked.id))
  // A length is asked for and never required. The list settled this once already
  // for a call back nobody timed - it files at a default rather than refusing -
  // and a screen that refuses here gets a made-up time typed into it, which is
  // worse than the shortest one.
  const ready = Boolean(picked) && !feed.saving

  const file = useCallback(async () => {
    if (!current || !picked) return
    const saved = await feed.record(
      callBody({ id: current.id, outcome: picked.id, hours, interested: interest, note })
    )
    if (!saved) return
    await desk.dropNumber()
    onward()
  }, [current, picked, note, hours, interest, feed, desk, onward])

  // The keys, for the hand that is not holding a handset. They are only live once
  // the call is marked, because until then there is nothing on screen they
  // name - and never while somebody is typing the comment.
  useEffect(() => {
    if (!marked) return undefined
    const onKey = event => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      const hit = CALL_OUTCOMES.find(one => one.key === event.key)
      if (hit) {
        event.preventDefault()
        setOutcome(held => (held === hit.id ? null : hit.id))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [marked])

  // The caller's own name goes into the opener, so the line a representative
  // reads out loud is theirs rather than a slot they have to fill.
  const script = useMemo(() => (current ? scriptFor(current, name) : []), [current, name])

  const placed = shift?.placed ?? 0
  const progress = `${placed} of ${goals.calls}`

  const foot = current ? (
    marked ? (
      <>
        <button type="button" className="staff-btn" onClick={file} disabled={!ready}>
          {feed.saving ? 'Filing' : 'File Call & Next'}
        </button>
        <div className="staff-foot-pair">
          <button type="button" className="staff-quiet" onClick={clear}>
            Not Yet
          </button>
          <button type="button" className="staff-quiet" onClick={onward} disabled={!next}>
            Skip
          </button>
        </div>
        <p className="staff-foot-note">
          {picked
            ? asksLength && !hours
              ? 'You have not picked a length. They come back on the list tomorrow.'
              : next
                ? `Next up is ${next.name}.`
                : 'That is the last one on the list.'
            : 'Press what the call came to.'}
        </p>
      </>
    ) : (
      <>
        <button
          type="button"
          className="staff-btn"
          onClick={() => setMarked(true)}
          disabled={spent}
        >
          Mark This One Called
        </button>
        <div className="staff-foot-pair">
          <button type="button" className="staff-quiet" onClick={() => move(-1)} disabled={!cursor}>
            Last Number
          </button>
          <button
            type="button"
            className="staff-quiet"
            onClick={onward}
            disabled={!next && cursor >= trail.length - 1}
          >
            Next Number
          </button>
        </div>
        <p className="staff-foot-note">
          {spent
            ? 'This one is already filed. Press Next Number to carry on.'
            : 'Ring the number above, then mark it called to file what it came to.'}
        </p>
      </>
    )
  ) : null

  return (
    <StaffScreen
      title="Call Center"
      back={{ to: '/staff', label: 'Portal' }}
      aside={<span className="staff-badge">{progress}</span>}
      foot={foot}
    >
      {!current ? (
        <div className="staff-spent">
          {/* Three different nothings, and they must not be drawn as one. A read
              that has not landed, a read that was refused and a list that has
              genuinely run out all put an empty column on the screen, and
              telling somebody the day is over when the answer was 403 sends
              them home. */}
          <h2>
            {feed.loading
              ? 'Reading the list'
              : feed.error
                ? 'This screen cannot read the list'
                : 'The list is spent'}
          </h2>
          <p>
            {feed.loading
              ? 'One moment.'
              : feed.error
                ? feed.error
                : 'Every business that was ready has been rung. The ones resting come back on their own, and the Management Center says when the soonest is due.'}
          </p>
          {!feed.loading && !feed.error && (
            <Link className="staff-quiet" to="/staff/management">
              Management Center
            </Link>
          )}
        </div>
      ) : (
        <div className="staff-cols">
          <div className="staff-main">
            <div className="staff-biz" key={`${current.id}-who`}>
              <h2>{current.name}</h2>
              <p>
                {[current.trade, current.town].filter(Boolean).join(' in ') || 'Trade not on file'}
              </p>
              <div className="staff-marks">
                {marksFor(current).map(mark => (
                  <span key={mark.key} className="staff-badge" data-tone={mark.tone}>
                    {mark.label}
                  </span>
                ))}
              </div>
            </div>

            <a className="staff-number" href={dialHref(current.phone)} key={`${current.id}-dial`}>
              <Phone aria-hidden="true" />
              {current.phone}
            </a>

            <dl className="staff-pairs" key={`${current.id}-facts`}>
              <div>
                <dt>Address</dt>
                <dd>{current.address || 'Not on file'}</dd>
              </div>
              <div>
                <dt>Reviews</dt>
                <dd>
                  {current.rating
                    ? `${current.rating} from ${current.rating_count ?? 0}`
                    : 'None on file'}
                </dd>
              </div>
              <div>
                <dt>Site</dt>
                <dd>{current.site_kind === 'social' ? 'Social page only' : 'None'}</dd>
              </div>
              <div>
                {/* A time the owner named is a different fact from a rest running
                  out, and reading the first as the second is how a caller rings
                  somebody an hour before they asked to be rung. */}
                <dt>{current.callback_at ? 'They Said' : 'Comes Back'}</dt>
                <dd>
                  {current.callback_at
                    ? callMoment(current.callback_at)
                    : current.ready_at
                      ? callMoment(current.ready_at)
                      : 'Ready now'}
                </dd>
              </div>
            </dl>

            {marked && (
              <div className="staff-answers">
                <div className="staff-part">
                  <h3>What the Call Came To</h3>
                  <div className="staff-tags-grid">
                    {CALL_OUTCOMES.map(one => (
                      <button
                        key={one.id}
                        type="button"
                        className="staff-tag"
                        data-tone={one.tone}
                        aria-pressed={outcome === one.id}
                        onClick={() => setOutcome(held => (held === one.id ? null : one.id))}
                      >
                        <span className="staff-key">{one.key}</span>
                        {one.label}
                      </button>
                    ))}
                  </div>
                  {asksLength && (
                    <div className="staff-range">
                      <p className="staff-label">Ring Back In</p>
                      <div className="staff-tags">
                        {CALLBACK_LENGTHS.map(length => (
                          <button
                            key={length.hours}
                            type="button"
                            className="staff-tag"
                            aria-pressed={hours === length.hours}
                            onClick={() =>
                              setHours(held => (held === length.hours ? null : length.hours))
                            }
                          >
                            {length.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {asksInterest && (
                  <div className="staff-part">
                    <h3>Were They Interested</h3>
                    <div className="staff-tags">
                      <button
                        type="button"
                        className="staff-tag"
                        data-tone="good"
                        aria-pressed={interest === true}
                        onClick={() => setInterest(held => (held === true ? null : true))}
                      >
                        Interested
                      </button>
                      <button
                        type="button"
                        className="staff-tag"
                        data-tone="bad"
                        aria-pressed={interest === false}
                        onClick={() => setInterest(held => (held === false ? null : false))}
                      >
                        Not Interested
                      </button>
                    </div>
                    <p className="staff-read">
                      Leave it unpressed where the call did not get that far. Not interested keeps
                      them on the call list and off the lead list.
                    </p>
                  </div>
                )}

                <div className="staff-part">
                  <h3>Comment</h3>
                  <div className="staff-tags">
                    {NOTE_STAMPS.map(stamp => (
                      <button
                        key={stamp}
                        type="button"
                        className="staff-tag"
                        onClick={() =>
                          setNote(held => (held ? `${held.trimEnd()} ${stamp}` : stamp))
                        }
                      >
                        {stamp}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="staff-input"
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="What the next person ringing them needs to know."
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="staff-side">
            <div className="staff-part" key={`${current.id}-record`}>
              <h3>The Record</h3>
              {current.calls?.length ? (
                <dl className="staff-record">
                  {current.calls.map(call => (
                    <div key={call.id}>
                      <dt>{callDay(call.called_at)}</dt>
                      <dd>
                        {callLine(call)}
                        {call.note ? `. ${call.note}` : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="staff-read">Nobody has rung this one yet. Yours is the first call.</p>
              )}
            </div>

            <details className="staff-fold">
              <summary>Refresher</summary>
              <div className="staff-fold-body">
                {script.map(beat => (
                  <div className="staff-beat" key={beat.id}>
                    <p className="staff-label">{beat.label}</p>
                    <p>{beat.say}</p>
                  </div>
                ))}
              </div>
            </details>
          </aside>
        </div>
      )}
    </StaffScreen>
  )
}
