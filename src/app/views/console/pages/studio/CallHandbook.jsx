import { useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Search, X } from 'lucide-react'
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
 * rather than a template with blanks. Their own name goes in it too, off the
 * one they put in Settings.
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

/**
 * The two lists that fold, each under the name of the part it is drawn in.
 *
 * Which one an answer came from is part of what identifies it: the ids are
 * only unique inside their own list, and a question and an objection that
 * happened to share one would open and shut together.
 */
const FOLDS = [
  ['pushback', PUSHBACK],
  ['questions', QUESTIONS],
]

const foldKey = (part, id) => `${part}:${id}`

/** Nothing open, held once so a reset is not a new object every keystroke. */
const SHUT = new Set()

/**
 * How wide a line of the script is allowed to get.
 *
 * The card takes the whole of the screen the record leaves, which on a desk
 * monitor is most of it, and a sentence set across all of that is a sentence
 * whose next line a reader cannot find. That matters more here than on a page
 * somebody skims: these lines are read out loud to a stranger, and losing your
 * place happens in front of them. So the card fills the width and the reading
 * does not.
 */
const MEASURE = 'max-w-[68ch]'

/**
 * How the handbook divides the width it is given.
 *
 * `auto-fit` rather than a breakpoint, because what decides this is the room
 * the record leaves rather than the size of the window - the same viewport
 * carries a card of the whole screen when the handbook is an overlay and a card
 * of what is left when it is not, and a media query cannot tell those apart.
 * A track that would be narrower than this reads as two half-sentences side by
 * side, which is worse than one column of them.
 *
 * The floor is capped at the full width because `minmax` treats its minimum as
 * a hard one: on a card narrower than 29rem the track stays 29rem and the
 * sentences run off the side of the screen, which is exactly the phone the
 * overlay exists for.
 */
const COLUMNS = '[grid-template-columns:repeat(auto-fit,minmax(min(29rem,100%),1fr))]'

/** One line of the script, or one step of the close, under the name of it. */
function Line({ label, children }) {
  return (
    <div className="border-hair-paper grid gap-1 border-t px-5 py-3">
      <p className={`${MONO_LABEL} text-paper-faint`}>{label}</p>
      <p className={`${MEASURE} text-[14px] leading-relaxed text-ink-paper`}>{children}</p>
    </div>
  )
}

/**
 * A question with its answer folded under it.
 *
 * Shut until something opens it, because the two ways this is read are
 * opposites: somebody scanning for the question they were asked needs twelve
 * headings on one screen, and somebody who has typed the word needs the answer
 * without a second press. Which it is belongs to the card rather than to the
 * row, so that a search and the control at the top can both move all of them.
 */
function Foldable({ heading, out, onFold, children }) {
  return (
    <div className="border-hair-paper border-t">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-5 py-2.5 text-left transition-colors duration-150 ease-out-soft hover:bg-[color:var(--wash-paper)]"
        aria-expanded={out}
        onClick={onFold}
      >
        <span className={`${MEASURE} text-[14px] text-ink-paper`}>{heading}</span>
        <ChevronDown
          aria-hidden="true"
          className={`text-paper-faint mt-0.5 h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150 ease-out-soft ${
            out ? 'rotate-180' : ''
          }`}
          strokeWidth={1.75}
        />
      </button>
      {out && <div className={`${MEASURE} grid gap-1.5 px-5 pb-3`}>{children}</div>}
    </div>
  )
}

/**
 * The heading over one part of the handbook, with what it holds counted.
 *
 * It holds the top of the card while its own part is being read, because
 * twelve questions and eight objections run past a screen and the two lists
 * look alike once the heading has gone: what is on screen is a stack of
 * sentences in quotation marks either way.
 *
 * The wash it is tinted with is five per cent of an ink, which is a tint over
 * a card rather than a ground of its own. Stuck over moving text that is a
 * heading with the paragraph behind it showing through, so the card's own
 * ground goes underneath and the wash is painted on top of it.
 */
function PartHead({ label, count }) {
  return (
    <div className="border-hair-paper sticky top-0 z-[1] flex items-baseline justify-between gap-3 border-b bg-[color:var(--console-card-bg)] px-5 py-2 [background-image:linear-gradient(var(--wash-paper),var(--wash-paper))]">
      <span className={`${MONO_LABEL} text-ink-paper`}>{label}</span>
      <span className={`${MONO_LABEL} text-paper-faint`}>{count}</span>
    </div>
  )
}

/**
 * One figure a caller quotes, with the condition on it underneath.
 *
 * The console's own metric row sets the caption against the figure at the
 * right edge, which is right for a dashboard where the eye is on the numbers
 * and wrong here: this is a sentence a caller says after the number, and at
 * the width the handbook is given it ends up a column away from the label it
 * belongs to. So the figure keeps the right edge and the words stay on the
 * left, under the thing they are a condition of.
 */
function Fact({ label, value, note }) {
  return (
    <div className="border-hair-paper grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t px-5 py-2.5">
      <dt className="text-paper-mute text-[13px]">{label}</dt>
      <dd className="text-[13px] font-medium tabular-nums text-ink-paper">{value}</dd>
      {note && <dd className={`${MONO_LABEL} text-paper-faint col-span-2 mt-1`}>{note}</dd>}
    </div>
  )
}

export default function CallHandbook({ row, caller, onClose }) {
  const [typed, setTyped] = useState('')
  const [opened, setOpened] = useState(SHUT)
  const searching = typed.trim().length > 0

  // The script is the only part of this that changes with the business, so it
  // is composed against the row rather than on every keystroke in the search.
  const script = useMemo(() => (row ? scriptFor(row, caller) : []), [row, caller])

  const lines = kept(script, typed)
  const questions = kept(QUESTIONS, typed)
  const pushback = kept(PUSHBACK, typed)
  const facts = kept(FACTS, typed)
  const closing = kept(CLOSING, typed)
  const found = lines.length + questions.length + pushback.length + facts.length + closing.length

  // Every folded answer left on screen, which is what the control at the top
  // acts on: a search has already taken the rest away, and a button that
  // opened what is not being shown would report a number nobody can see.
  const folded = [
    ...pushback.map(one => foldKey('pushback', one.id)),
    ...questions.map(one => foldKey('questions', one.id)),
  ]
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

  const fold = useCallback(key => {
    setOpened(was => {
      const next = new Set(was)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])

  return (
    <>
      <header>
        <div className="grid min-w-0 gap-0.5">
          <h2>What to Say</h2>
          <p>{row?.name || 'The business on the right'}</p>
        </div>
        {/* Only ever the way back on a screen too narrow to hold both cards.
            Where they sit side by side there is nothing to go back to, and the
            stylesheet takes the button off. */}
        <button type="button" aria-label="Back to the Business" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>

      {/* The search sits outside the part that scrolls, because the moment it
          is wanted is the moment somebody has scrolled away from it: they are
          three questions down and have just been asked a fourth. Held here
          rather than stuck to the top of the body so the headings inside can
          stick to the top of the body themselves, against something rather
          than underneath it. */}
      <div className="border-hair-paper grid flex-shrink-0 gap-2 border-b px-5 py-3">
        <div className={`${MEASURE} flex items-center gap-2`}>
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="text-paper-faint pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              strokeWidth={1.75}
            />
            <input
              type="search"
              // The browser draws its own clear on a search field, and it
              // arrives beside the one that is always in the same place rather
              // than instead of it: two crosses in one field.
              className={`${FIELD} pl-8 pr-9 [&::-webkit-search-cancel-button]:appearance-none`}
              placeholder="What did they just say?"
              value={typed}
              onChange={event => retype(event.target.value)}
              // The panel closes on Escape, and a caller clearing a search
              // has not asked to lose the business they are on. So the first
              // one empties the field and stops there; with the field
              // already empty it never runs and Escape closes as it always
              // has.
              onKeyDown={event => {
                if (event.key !== 'Escape' || !typed) return
                event.stopPropagation()
                retype('')
              }}
              aria-label="Search the Handbook"
            />
            {typed && (
              <button
                type="button"
                className="text-paper-faint absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--r-tiny)] transition-colors duration-150 ease-out-soft hover:text-accent"
                onClick={() => retype('')}
                aria-label="Clear the Search"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </div>
          {/* One control rather than a pair, and which of the two it is is
                decided by what is on screen: with anything still shut the
                useful press is the one that opens the rest. */}
          {folded.length > 0 && (
            <button
              type="button"
              className={`${QUIET} flex-shrink-0`}
              onClick={() => setOpened(allOut ? SHUT : new Set(folded))}
            >
              {allOut ? (
                <ChevronsDownUp aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {allOut ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>
        <p className={`${MONO_LABEL} text-paper-faint`}>
          {searching
            ? found
              ? `${found} of these answer that.`
              : 'Nothing here answers that. Say you will find out and ring them back.'
            : HANDBOOK_PARTS.map(part => part.label).join(' · ')}
        </p>
      </div>

      <div className="console-side-body">
        {/* Two columns where there is room for two, and the split is how the
            handbook is actually used rather than an even division of it. The
            left is read straight down in the first twenty seconds of the call.
            The right is jumped into, mid-call, by somebody who has just been
            asked something.

            `auto-fit` is what makes a search survive this: a column whose
            sections all filtered away is not rendered at all, and the track it
            would have held collapses, so the one that is left stretches across
            instead of sitting in half a screen with a blank beside it. */}
        <div className={`${COLUMNS} grid items-start`}>
          {(lines.length > 0 || closing.length > 0) && (
            <div>
              {lines.length > 0 && (
                <section>
                  <PartHead label="Opening" count={`${lines.length} lines`} />
                  {lines.map(line => (
                    <Line key={line.id} label={line.label}>
                      {line.say}
                    </Line>
                  ))}
                </section>
              )}

              {closing.length > 0 && (
                <section>
                  <PartHead label="Closing" count={`${closing.length} of ${CLOSING.length}`} />
                  {closing.map(step => (
                    <Line key={step.id} label={step.label}>
                      {step.say}
                    </Line>
                  ))}
                </section>
              )}
            </div>
          )}

          {(pushback.length > 0 || questions.length > 0 || facts.length > 0) && (
            <div className="border-hair-paper [&:not(:first-child)]:border-l">
              {pushback.length > 0 && (
                <section>
                  <PartHead label="Objections" count={`${pushback.length} of ${PUSHBACK.length}`} />
                  {pushback.map(one => (
                    <Foldable
                      key={one.id}
                      heading={one.said}
                      out={opened.has(foldKey('pushback', one.id))}
                      onFold={() => fold(foldKey('pushback', one.id))}
                    >
                      <p className="text-[14px] leading-relaxed text-ink-paper">{one.say}</p>
                      <p className={`${MONO_LABEL} text-paper-faint`}>{one.after}</p>
                    </Foldable>
                  ))}
                </section>
              )}

              {questions.length > 0 && (
                <section>
                  <PartHead
                    label="Common Questions"
                    count={`${questions.length} of ${QUESTIONS.length}`}
                  />
                  {questions.map(one => (
                    <Foldable
                      key={one.id}
                      heading={one.ask}
                      out={opened.has(foldKey('questions', one.id))}
                      onFold={() => fold(foldKey('questions', one.id))}
                    >
                      <p className="text-[14px] leading-relaxed text-ink-paper">{one.say}</p>
                    </Foldable>
                  ))}
                </section>
              )}

              {facts.length > 0 && (
                <section>
                  <PartHead
                    label="Pricing and Facts"
                    count={`${facts.length} of ${FACTS.length}`}
                  />
                  <dl>
                    {facts.map(fact => (
                      <Fact key={fact.id} label={fact.label} value={fact.value} note={fact.note} />
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
            </div>
          )}
        </div>
      </div>
    </>
  )
}
