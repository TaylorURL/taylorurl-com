import { useMemo, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
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
import { Metric } from '../../ui'
import { FIELD, MONO_LABEL, QUIET } from '../../lib/tokens'

/**
 * What to say, beside whoever is being said it to.
 *
 * The record panel opens against the right edge with one business in it, and
 * until this existed the left three quarters of that screen was the list the
 * caller had just stopped reading. What a caller actually needs at that moment
 * is not more rows: it is the opening line for this business, the price, and
 * the sentence that answers whatever was just said down the phone.
 *
 * Three things decide how this is built.
 *
 * THE SCRIPT IS ABOUT THE BUSINESS ON SCREEN. It is composed from the same row
 * the panel opposite is drawing - the platform their listing points at, their
 * reviews against the middle for their trade, the client of ours in their line
 * of work - so a caller reads a sentence with this business's own facts in it
 * rather than a template with blanks. The one blank left is the caller's own
 * name, because nothing here knows it.
 *
 * SEARCH IS THE ONLY WAY THROUGH IT. Somebody mid-call has one hand and about
 * four seconds. Every question, every objection and every line of the script is
 * searched at once by whatever word was just said to them - "facebook",
 * "expensive", "how long" - and the parts that match nothing fold away, so the
 * answer is on screen rather than three headings down.
 *
 * NOTHING HERE IS EDITABLE AND NOTHING HERE SENDS. This is a reference beside a
 * phone call. The one thing that gets recorded is what the caller heard, and
 * that is the form in the panel opposite.
 */

/** A part with nothing left in it after a search is a part that comes off. */
function kept(entries, typed) {
  return entries.filter(entry => handbookMatches(entry, typed))
}

/** One line of the script, or one answer, under the heading that names it. */
function Line({ label, children, aside }) {
  return (
    <div className="border-hair-paper grid gap-1 border-t px-5 py-3">
      <p className={`${MONO_LABEL} text-paper-faint`}>{label}</p>
      <p className="text-[14px] leading-relaxed text-ink-paper">{children}</p>
      {aside && <p className={`${MONO_LABEL} text-paper-faint`}>{aside}</p>}
    </div>
  )
}

/**
 * A question with its answer folded under it.
 *
 * Shut by default and open as soon as a search reaches it, because the two
 * ways this is read are opposites: somebody scanning for the question they
 * were asked needs twelve headings on one screen, and somebody who has typed
 * the word needs the answer without a second press.
 */
function Foldable({ heading, open, children }) {
  const [shown, setShown] = useState(false)
  const out = open || shown

  return (
    <div className="border-hair-paper border-t">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-5 py-2.5 text-left"
        aria-expanded={out}
        onClick={() => setShown(one => !one)}
      >
        <span className="text-[14px] text-ink-paper">{heading}</span>
        <ChevronDown
          aria-hidden="true"
          className={`text-paper-faint mt-0.5 h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150 ease-out-soft ${
            out ? 'rotate-180' : ''
          }`}
          strokeWidth={1.75}
        />
      </button>
      {out && <div className="grid gap-1.5 px-5 pb-3">{children}</div>}
    </div>
  )
}

/** The heading over one part of the handbook, with what it holds counted. */
function PartHead({ label, count }) {
  return (
    <div className="flex items-baseline justify-between gap-3 bg-[color:var(--wash-paper)] px-5 py-2">
      <span className={`${MONO_LABEL} text-ink-paper`}>{label}</span>
      <span className={`${MONO_LABEL} text-paper-faint`}>{count}</span>
    </div>
  )
}

export default function CallHandbook({ row, onClose }) {
  const [typed, setTyped] = useState('')
  const searching = typed.trim().length > 0

  // The script is the only part of this that changes with the business, so it
  // is composed against the row rather than on every keystroke in the search.
  const script = useMemo(() => (row ? scriptFor(row) : []), [row])

  const lines = kept(script, typed)
  const questions = kept(QUESTIONS, typed)
  const pushback = kept(PUSHBACK, typed)
  const facts = kept(FACTS, typed)
  const closing = kept(CLOSING, typed)
  const found = lines.length + questions.length + pushback.length + facts.length + closing.length

  return (
    <>
      <header>
        <div className="grid min-w-0 gap-0.5">
          <h2>What To Say</h2>
          <p>{row?.name || 'The business on the right'}</p>
        </div>
        {/* Only ever the way back on a screen too narrow to hold both cards.
            Where they sit side by side there is nothing to go back to, and the
            stylesheet takes the button off. */}
        <button type="button" aria-label="Back To The Business" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>

      <div className="console-side-body">
        <div className="border-hair-paper grid gap-2 border-b px-5 py-3">
          <label className="relative block">
            <Search
              aria-hidden="true"
              className="text-paper-faint pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              strokeWidth={1.75}
            />
            <input
              type="search"
              className={`${FIELD} pl-8`}
              placeholder="What did they just say?"
              value={typed}
              onChange={event => setTyped(event.target.value)}
              aria-label="Search The Handbook"
            />
          </label>
          <p className={`${MONO_LABEL} text-paper-faint`}>
            {searching
              ? found
                ? `${found} of these answer that.`
                : 'Nothing here answers that. Say you will find out and ring them back.'
              : HANDBOOK_PARTS.map(part => part.label).join(' · ')}
          </p>
        </div>

        {lines.length > 0 && (
          <section>
            <PartHead label="Opening The Call" count={`${lines.length} lines`} />
            {lines.map(line => (
              <Line key={line.id} label={line.label}>
                {line.say}
              </Line>
            ))}
          </section>
        )}

        {pushback.length > 0 && (
          <section>
            <PartHead
              label="When They Push Back"
              count={`${pushback.length} of ${PUSHBACK.length}`}
            />
            {pushback.map(one => (
              <Foldable key={one.id} heading={one.said} open={searching}>
                <p className="text-[14px] leading-relaxed text-ink-paper">{one.say}</p>
                <p className={`${MONO_LABEL} text-paper-faint`}>{one.after}</p>
              </Foldable>
            ))}
          </section>
        )}

        {questions.length > 0 && (
          <section>
            <PartHead
              label="Questions They Ask"
              count={`${questions.length} of ${QUESTIONS.length}`}
            />
            {questions.map(one => (
              <Foldable key={one.id} heading={one.ask} open={searching}>
                <p className="text-[14px] leading-relaxed text-ink-paper">{one.say}</p>
              </Foldable>
            ))}
          </section>
        )}

        {facts.length > 0 && (
          <section>
            <PartHead label="The Facts" count={`${facts.length} of ${FACTS.length}`} />
            {/* One column rather than two. A metric brings its own gutter and
                its own rule between neighbours, and at this width a second
                column leaves each note wrapping over four lines. */}
            <dl>
              {facts.map(fact => (
                <Metric key={fact.id} label={fact.label} value={fact.value} caption={fact.note} />
              ))}
            </dl>
            <div className="border-hair-paper flex flex-wrap gap-2 border-t px-5 py-3">
              {PLACES_TO_SEND.map(place => (
                <a
                  key={place.id}
                  href={place.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={QUIET}
                  title={place.note}
                >
                  {place.label}
                </a>
              ))}
            </div>
          </section>
        )}

        {closing.length > 0 && (
          <section>
            <PartHead label="Closing The Call" count={`${closing.length} of ${CLOSING.length}`} />
            {closing.map(step => (
              <Line key={step.id} label={step.label}>
                {step.say}
              </Line>
            ))}
          </section>
        )}
      </div>
    </>
  )
}
