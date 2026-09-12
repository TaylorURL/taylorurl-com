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
import { useDesk } from '../lib/surface'
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
 * once the call is marked, the form that logs it.
 *
 * Nobody moves to the next lead without logging this one. The only way past a
 * business is a filed call, and the one shortcut is Bad Lead, which is a filed
 * call too: it says the business should never have been on the list and takes
 * it off, so the next person is not handed it. The one exception is a business
 * somebody else has already logged since it was opened here, which Next steps
 * over because there is nothing left to file.
 *
 * The form is not drawn before the call is marked. A screen that offers nine
 * outcomes and a comment box to somebody who has not dialed yet reads as a form
 * to fill in rather than a call to make, and the height it takes is height the
 * script wanted.
 *
 * On a desk the script is a column of its own and always open. On a phone it
 * folds, because a representative reads it once in the first week and after
 * that wants the two lines they forget.
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
  const wide = useDesk()
  // A phone's foot has room for three short keys and not for a long one: the
  // armed label says the whole of what it does where there is room, and the
  // one word that matters where there is not.
  const roomy = useDesk('(min-width: 768px)')

  const [trail, setTrail] = useState([])
  const [cursor, setCursor] = useState(0)
  const [marked, setMarked] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [hours, setHours] = useState(null)
  const [interest, setInterest] = useState(null)
  const [note, setNote] = useState('')
  // Bad Lead takes a business off the list for good on one press, so the first
  // press arms it and the second files it. Anything else the caller does
  // disarms it.
  const [armed, setArmed] = useState(false)

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
    setArmed(false)
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

  // A bad lead is filed the same way a call is, with nothing asked. Two presses:
  // the first arms the control, the second files it.
  const badLead = useCallback(async () => {
    if (!current || feed.saving) return
    if (!armed) {
      setArmed(true)
      return
    }
    const saved = await feed.record(callBody({ id: current.id, outcome: 'bad_lead' }))
    if (!saved) return
    await desk.dropNumber()
    onward()
  }, [current, armed, feed, desk, onward])

  // The keys, for the hand that is not holding a handset. They are only live once
  // the call is marked, because until then there is nothing on screen they
  // name - and never while somebody is typing the note.
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
  const progress = `${placed} / ${goals.calls} calls`

  const foot = current ? (
    marked ? (
      <>
        <button type="button" className="staff-quiet" onClick={clear}>
          Undo
        </button>
        <button type="button" className="staff-btn" onClick={file} disabled={!ready}>
          {feed.saving ? 'Saving' : 'Save & Next'}
        </button>
        <p className="staff-foot-note">
          {picked
            ? asksLength && !hours
              ? 'No callback time set. Files as tomorrow.'
              : next
                ? `Next: ${next.name}`
                : 'Last lead on the list.'
            : 'Choose an outcome.'}
        </p>
      </>
    ) : (
      <>
        <button type="button" className="staff-quiet" onClick={() => move(-1)} disabled={!cursor}>
          Back
        </button>
        {spent ? (
          <button
            type="button"
            className="staff-btn"
            onClick={onward}
            disabled={!next && cursor >= trail.length - 1}
          >
            Next
          </button>
        ) : (
          <>
            <button
              type="button"
              className="staff-quiet staff-bad"
              data-armed={armed}
              onClick={badLead}
              disabled={feed.saving}
            >
              {armed ? (roomy ? 'Confirm Bad Lead' : 'Confirm') : 'Bad Lead'}
            </button>
            <button type="button" className="staff-btn" onClick={() => setMarked(true)}>
              Mark as Called
            </button>
          </>
        )}
        <p className="staff-foot-note">
          {spent
            ? 'Already logged.'
            : armed
              ? 'Takes the business off the list for good.'
              : next
                ? `Next: ${next.name}`
                : 'Last lead on the list.'}
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
            {feed.loading ? 'Loading' : feed.error ? 'The list did not load' : 'No leads available'}
          </h2>
          <p>
            {feed.loading
              ? ''
              : feed.error
                ? feed.error
                : 'Every available lead has been called. Leads on callback return when their time comes. The Management Center shows the next one due.'}
          </p>
          {!feed.loading && !feed.error && (
            <Link className="staff-quiet" to="/staff/management">
              Management Center
            </Link>
          )}
        </div>
      ) : (
        <div className="staff-call">
          <div className="staff-who">
            <div className="staff-lead" key={`${current.id}-who`}>
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

            <a className="staff-dial" href={dialHref(current.phone)} key={`${current.id}-dial`}>
              <Phone aria-hidden="true" />
              {current.phone}
            </a>

            <dl className="staff-pairs staff-facts" key={`${current.id}-facts`}>
              <div>
                <dt>Address</dt>
                <dd>{current.address || 'Not on file'}</dd>
              </div>
              <div>
                <dt>Reviews</dt>
                <dd>
                  {current.rating
                    ? `${current.rating} from ${current.rating_count ?? 0}`
                    : 'Not on file'}
                </dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>{current.site_kind === 'social' ? 'Social page only' : 'None'}</dd>
              </div>
              <div>
                {/* A time the owner named is a different fact from a rest
                    running out, and reading the first as the second is how a
                    caller calls somebody an hour before they asked to be
                    called. */}
                <dt>{current.callback_at ? 'Callback' : 'Available'}</dt>
                <dd>
                  {current.callback_at
                    ? callMoment(current.callback_at)
                    : current.ready_at
                      ? callMoment(current.ready_at)
                      : 'Now'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="staff-desk">
            {marked && (
              <div className="staff-log">
                <div className="staff-part">
                  <h3>Outcome</h3>
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
                      <p className="staff-label">Call Back In</p>
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
                    <h3>Interested?</h3>
                    <div className="staff-tags">
                      <button
                        type="button"
                        className="staff-tag"
                        data-tone="good"
                        aria-pressed={interest === true}
                        onClick={() => setInterest(held => (held === true ? null : true))}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className="staff-tag"
                        data-tone="bad"
                        aria-pressed={interest === false}
                        onClick={() => setInterest(held => (held === false ? null : false))}
                      >
                        No
                      </button>
                    </div>
                    <p className="staff-read">
                      Optional. No keeps them on the call list and off the lead list.
                    </p>
                  </div>
                )}

                <div className="staff-part">
                  <h3>Notes</h3>
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
                    placeholder="Notes for the next call"
                  />
                </div>
              </div>
            )}

            <div className="staff-part staff-history" key={`${current.id}-record`}>
              <h3>Call History</h3>
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
                <p className="staff-read">No calls yet.</p>
              )}
            </div>
          </div>

          <details className="staff-fold staff-script" open={wide || undefined}>
            <summary>Script</summary>
            <div className="staff-fold-body">
              {script.map(beat => (
                <div className="staff-beat" key={beat.id}>
                  <p className="staff-label">{beat.label}</p>
                  <p>{beat.say}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </StaffScreen>
  )
}
