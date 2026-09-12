import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { useCallDesk } from '@hooks/console/useCallDesk'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import {
  CLOSING,
  FACTS,
  HANDBOOK_PARTS,
  PLACES_TO_SEND,
  PUSHBACK,
  QUESTIONS,
  handbookMatches,
  scriptFor,
} from '@lib/outreach/prospects/handbook.js'
import { DEFAULT_GOALS, shiftOf } from '@lib/outreach/prospects/callShift.js'
import ShiftFigures from './ShiftFigures'
import { useStaff } from '../lib/context'
import { usePortalNav } from '../lib/nav'

/**
 * The handbook, on a screen a representative can reach mid-call.
 *
 * Every word of it comes from `handbook.js`, which is the same source the call
 * screen's refresher reads. A second copy of the script written for this page
 * would be a second price to quote the moment either is edited.
 *
 * The opening is drawn against no business, because this is the script read in
 * the first week rather than the script read with somebody on the line - the
 * call screen is where the lines fill in around the business on the phone.
 *
 * Three things decide how it is built.
 *
 * SEARCH IS THE WAY THROUGH IT. Somebody mid-call has one hand and about four
 * seconds. Every question, every objection and every line of the script is
 * searched at once by whatever word was just said to them - "facebook",
 * "expensive", "how long" - and the parts that match nothing come off the
 * screen, so the answer is there rather than three headings down. A search
 * opens what it found, because the word was typed to read the answer rather
 * than to be told where it lives.
 *
 * WHETHER A FOLD IS OPEN BELONGS TO THE PAGE. Twenty answers fold, and the two
 * things done with all of them at once are opening them to read down and
 * shutting them to scan the headings again. A fold holding its own state
 * cannot be moved by the control above it or by a search, and both of those
 * are how this is actually read.
 *
 * NOTHING HERE IS EDITABLE AND NOTHING HERE SENDS. This is a reference beside
 * a phone call. The one thing that gets recorded is what the caller heard, and
 * that is the form on the call screen.
 *
 * THE RAIL IS WHERE THE READER STANDS. The script holds a reading measure and
 * will not widen past it, which on a desk leaves room going spare beside it.
 * The three figures of the day go there: somebody who has opened the handbook
 * mid-shift is between calls, and between calls is exactly when where they
 * stand is worth knowing. Below the width that has room for two columns the
 * rail is simply the last thing on the screen.
 *
 * @param {{Shell: React.ComponentType}} props
 */

/* The figures come off the top of the list's own answer, so the rail asks for
   the smallest page that carries them rather than a read of its own. */
const SHIFT_FILTERS = Object.freeze({ view: 'list', take: 1 })

/** A part with nothing left in it after a search is a part that comes off. */
function kept(entries, typed) {
  return entries.filter(entry => handbookMatches(entry, typed))
}

/**
 * The two lists that fold, each under the name of the part it is drawn in.
 *
 * Which one an answer came from is part of what identifies it: the ids are only
 * unique inside their own list, and a question and an objection that happened
 * to share one would open and shut together.
 */
const FOLDS = [
  ['questions', QUESTIONS],
  ['pushback', PUSHBACK],
]

const foldKey = (part, id) => `${part}:${id}`

/** Nothing open, held once so a reset is not a new object every keystroke. */
const SHUT = new Set()

const partLabel = id => HANDBOOK_PARTS.find(one => one.id === id)?.label ?? id

export default function Handbook({ Shell }) {
  const { name, token, userId } = useStaff()
  const nav = usePortalNav()
  const [typed, setTyped] = useState('')
  const [opened, setOpened] = useState(SHUT)

  const feed = useCallsFeed({ token, enabled: Boolean(token), filters: SHIFT_FILTERS })
  const desk = useCallDesk({ token, userId, enabled: Boolean(token) })
  const goals = desk.prefs?.goals ?? DEFAULT_GOALS
  const shift = useMemo(() => shiftOf(feed.data?.shift, goals), [feed.data?.shift, goals])

  const script = useMemo(() => scriptFor(null, name), [name])

  // What survives the search, part by part. A part with nothing left is not
  // drawn at all: an empty heading reads as an answer that exists and is blank.
  const found = useMemo(
    () => ({
      open: kept(script, typed),
      questions: kept(QUESTIONS, typed),
      pushback: kept(PUSHBACK, typed),
      facts: kept(FACTS, typed),
      close: kept(CLOSING, typed),
      send: kept(PLACES_TO_SEND, typed),
    }),
    [script, typed]
  )

  const hits = Object.values(found).reduce((count, entries) => count + entries.length, 0)
  const searching = typed.trim().length > 0

  // Every folded answer left on screen, which is what the control at the top
  // acts on: a search has already taken the rest away, and a button that
  // opened what is not being shown would report a number nobody can see.
  const folded = useMemo(
    () => FOLDS.flatMap(([part]) => found[part].map(one => foldKey(part, one.id))),
    [found]
  )
  const allOut = folded.length > 0 && folded.every(key => opened.has(key))

  /**
   * A search opens what it found.
   *
   * The word was typed because somebody down the phone just said it, so the
   * sentence that answers it belongs on screen rather than behind one more
   * press. Emptying the field puts the handbook back to headings, which is the
   * state it is scanned in.
   */
  const retype = useCallback(next => {
    setTyped(next)
    const wanted = next.trim()
    if (!wanted) {
      setOpened(SHUT)
      return
    }
    setOpened(
      new Set(
        FOLDS.flatMap(([part, entries]) => kept(entries, wanted).map(one => foldKey(part, one.id)))
      )
    )
  }, [])

  const fold = useCallback((key, open) => {
    setOpened(was => {
      const next = new Set(was)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  return (
    <Shell
      title="Resources Center"
      back={{ to: nav.hrefFor('portal'), label: 'Portal' }}
      layout="reading"
    >
      <div className="staff-reading">
        <div className="staff-reading-main">
          <div className="staff-find">
            <label className="staff-greet" htmlFor="staff-handbook-search">
              <span className="staff-label">Search</span>
              <input
                id="staff-handbook-search"
                className="staff-input"
                type="search"
                value={typed}
                onChange={event => retype(event.target.value)}
                placeholder="price, Facebook, timeline"
              />
            </label>
            {folded.length > 0 && (
              <button
                type="button"
                className="staff-quiet"
                onClick={() => setOpened(allOut ? SHUT : new Set(folded))}
              >
                {allOut ? (
                  <ChevronsDownUp aria-hidden="true" />
                ) : (
                  <ChevronsUpDown aria-hidden="true" />
                )}
                {allOut ? 'Collapse All' : 'Expand All'}
              </button>
            )}
          </div>

          {searching && (
            <p className="staff-read">
              {hits
                ? `${hits} of these answer that.`
                : 'Nothing here answers that. Say you will find out and call them back.'}
            </p>
          )}

          {!hits ? (
            <div className="staff-spent">
              <h2>No results</h2>
              <p>Try another word, or open the questions page on the main site.</p>
            </div>
          ) : (
            <div className="staff-topics">
              {found.open.length > 0 && (
                <details className="staff-topic" open={searching || undefined}>
                  <summary>{partLabel('open')}</summary>
                  <div className="staff-topic-body">
                    {found.open.map(beat => (
                      <div key={beat.id}>
                        <h4>{beat.label}</h4>
                        <p>{beat.say}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {found.questions.length > 0 && (
                <section className="staff-topic-set">
                  <h3 className="staff-set-head">
                    {partLabel('questions')}
                    <span>
                      {found.questions.length} of {QUESTIONS.length}
                    </span>
                  </h3>
                  {found.questions.map(entry => (
                    <details
                      className="staff-topic"
                      key={entry.id}
                      open={opened.has(foldKey('questions', entry.id))}
                      onToggle={event => fold(foldKey('questions', entry.id), event.target.open)}
                    >
                      <summary>{entry.ask}</summary>
                      <div className="staff-topic-body">
                        <p>{entry.say}</p>
                      </div>
                    </details>
                  ))}
                </section>
              )}

              {found.pushback.length > 0 && (
                <section className="staff-topic-set">
                  <h3 className="staff-set-head">
                    {partLabel('pushback')}
                    <span>
                      {found.pushback.length} of {PUSHBACK.length}
                    </span>
                  </h3>
                  {found.pushback.map(entry => (
                    <details
                      className="staff-topic"
                      key={entry.id}
                      open={opened.has(foldKey('pushback', entry.id))}
                      onToggle={event => fold(foldKey('pushback', entry.id), event.target.open)}
                    >
                      <summary>{entry.said}</summary>
                      <div className="staff-topic-body">
                        <p>{entry.say}</p>
                        {entry.after && <p className="staff-aside">{entry.after}</p>}
                      </div>
                    </details>
                  ))}
                </section>
              )}

              {found.facts.length > 0 && (
                <details className="staff-topic" open={searching || undefined}>
                  <summary>{partLabel('facts')}</summary>
                  <div className="staff-topic-body">
                    <dl className="staff-pairs">
                      {found.facts.map(fact => (
                        <div key={fact.id}>
                          <dt>{fact.label}</dt>
                          <dd>{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {found.facts.map(fact => (
                      <p className="staff-mute" key={`${fact.id}-note`}>
                        <b>{fact.label}.</b> {fact.note}
                      </p>
                    ))}
                  </div>
                </details>
              )}

              {found.close.length > 0 && (
                <details className="staff-topic" open={searching || undefined}>
                  <summary>{partLabel('close')}</summary>
                  <div className="staff-topic-body">
                    <ol className="staff-steps">
                      {found.close.map(step => (
                        <li key={step.id}>
                          <b>{step.label}.</b> {step.say}
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              )}

              {found.send.length > 0 && (
                <details className="staff-topic" open={searching || undefined}>
                  <summary>Links to Send</summary>
                  <div className="staff-topic-body">
                    {found.send.map(place => (
                      <div key={place.id}>
                        <h4>
                          <a href={place.href} target="_blank" rel="noreferrer noopener">
                            {place.label}
                          </a>
                        </h4>
                        <p>{place.note}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Where the reader stands, beside what they are reading. The figures
            are the Management Center's own, drawn from one component so the
            two screens cannot come to disagree about a number. */}
        <aside className="staff-reading-side">
          <div className="staff-part">
            <h3>Your Day</h3>
            {feed.loading ? (
              <p className="staff-mute">Loading</p>
            ) : (
              <ShiftFigures shift={shift} spent={shift.met.calls} />
            )}
          </div>
        </aside>
      </div>

      <div className="staff-part">
        <Link className="staff-btn" to={nav.hrefFor('calls')}>
          Back to Calls
        </Link>
      </div>
    </Shell>
  )
}
