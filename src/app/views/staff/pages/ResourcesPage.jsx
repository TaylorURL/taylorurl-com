import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import StaffScreen from '../StaffScreen'
import { useStaff } from '../lib/context'

/**
 * The handbook, on a screen a representative can reach mid-call.
 *
 * Every word of it comes from `handbook.js`, which is the same source the call
 * screen's refresher reads and the same one the console's own handbook panel
 * reads. A second copy of the script written for this page would be a second
 * price to quote the moment either is edited.
 *
 * The opening is drawn against no business, because this is the script read in
 * the first week rather than the script read with somebody on the line - the
 * call screen is where the lines fill in around the business on the phone.
 *
 * One part open at a time, and all of them closed on arrival. A representative
 * opening this while a phone is ringing wants one answer, and a page that is
 * already six screens long has buried it.
 */
export default function ResourcesPage() {
  const { name } = useStaff()
  const [typed, setTyped] = useState('')
  const script = useMemo(() => scriptFor(null, name), [name])

  // What survives the search, part by part. A part with nothing left is not
  // drawn at all: an empty heading reads as an answer that exists and is blank.
  const found = useMemo(() => {
    const keep = entries => entries.filter(entry => handbookMatches(entry, typed))
    return {
      open: keep(script),
      questions: keep(QUESTIONS),
      pushback: keep(PUSHBACK),
      facts: keep(FACTS),
      close: keep(CLOSING),
      send: keep(PLACES_TO_SEND),
    }
  }, [script, typed])

  const hits = Object.values(found).reduce((count, entries) => count + entries.length, 0)
  const part = id => HANDBOOK_PARTS.find(one => one.id === id)?.label ?? id
  // A search opens what it found, because a reader who typed a word is looking
  // at the answer rather than at a list of places it might be.
  const open = Boolean(typed.trim())

  return (
    <StaffScreen title="Resources Center" back={{ to: '/staff', label: 'Portal' }}>
      <label className="staff-greet" htmlFor="staff-handbook-search">
        <span className="staff-label">Search the Handbook</span>
        <input
          id="staff-handbook-search"
          className="staff-input"
          type="search"
          value={typed}
          onChange={event => setTyped(event.target.value)}
          placeholder="price, facebook, how long"
        />
      </label>

      {!hits ? (
        <div className="staff-spent">
          <h2>Nothing here answers that</h2>
          <p>
            Try the word you heard on the phone. Failing that, the questions page on the main site
            is longer than this one.
          </p>
        </div>
      ) : (
        <div className="staff-topics">
          {found.open.length > 0 && (
            <details className="staff-topic" open={open}>
              <summary>{part('open')}</summary>
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
            <details className="staff-topic" open={open}>
              <summary>{part('questions')}</summary>
              <div className="staff-topic-body">
                {found.questions.map(entry => (
                  <div key={entry.id}>
                    <h4>{entry.ask}</h4>
                    <p>{entry.say}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {found.pushback.length > 0 && (
            <details className="staff-topic" open={open}>
              <summary>{part('pushback')}</summary>
              <div className="staff-topic-body">
                {found.pushback.map(entry => (
                  <div key={entry.id}>
                    <h4>{entry.said}</h4>
                    <p>{entry.say}</p>
                    {entry.after && <p className="staff-aside">{entry.after}</p>}
                  </div>
                ))}
              </div>
            </details>
          )}

          {found.facts.length > 0 && (
            <details className="staff-topic" open={open}>
              <summary>{part('facts')}</summary>
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
            <details className="staff-topic" open={open}>
              <summary>{part('close')}</summary>
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
            <details className="staff-topic" open={open}>
              <summary>Pages to Send Them</summary>
              <div className="staff-topic-body">
                {found.send.map(place => (
                  <div key={place.id}>
                    <h4>
                      <a href={place.href}>{place.label}</a>
                    </h4>
                    <p>{place.note}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="staff-part">
        <Link className="staff-btn" to="/staff/calls">
          Back to Calling
        </Link>
      </div>
    </StaffScreen>
  )
}
