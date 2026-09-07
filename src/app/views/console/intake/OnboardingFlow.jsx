import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { EASE } from '@constants/animations'
import { Panel, PanelBody, PanelFoot, SkeletonBar } from '../ui'
import { BUTTON, MONO_LABEL, QUIET } from '../lib/tokens'
import { formatInstant } from '@lib/time/zone.js'

/**
 * The frame the brief is answered in: one step held in a console card, the
 * trail of them across the top, and the two controls that move between them.
 *
 * It is the configurator's shape rather than the configurator itself. The
 * marketing frame is a section of a page, drawn on the drafting field, sized
 * by the page's own rhythm and free to be as tall as its longest step. This
 * one is a card in a dashboard: it takes the cell it is given, its head keeps
 * the reading, its foot keeps the controls, and the step in the middle is the
 * only part that scrolls. A reader who has already learned the console reads
 * this without learning anything, and a reader who came through the
 * configurator before they paid recognises how it moves.
 *
 * What it does not hold is any answer. The steps arrive drawn, each saying
 * whether it has what it needs, and everything about what an answer is worth
 * belongs to the model behind them. The frame decides one thing only: which
 * step is in front of the client, and whether the control that moves them on
 * is live.
 *
 * Movement is the same idiom throughout. A step arrives from the side the
 * client is travelling and the one it replaces leaves the other way, the card
 * eases between the two heights rather than snapping so the controls stay
 * under the hand that reached for them, and reduced motion collapses both to a
 * swap. Every move puts focus on the new step's heading, which is what puts a
 * screen reader at the top of the step rather than wherever the last control
 * left it.
 */

const DURATION = 0.42

/** How far a step travels. Far enough to read as a sideways move, short enough to stay legible. */
const SHIFT = 40

const PANEL = {
  enter: direction => ({ opacity: 0, x: direction < 0 ? -SHIFT : SHIFT }),
  center: { opacity: 1, x: 0 },
  exit: direction => ({ opacity: 0, x: direction < 0 ? SHIFT : -SHIFT }),
}

/** A step's number, as the trail and the counter both write it. */
const ordinal = index => String(index + 1).padStart(2, '0')

/**
 * The trail across the top: every step, its number, and the one being answered.
 *
 * A step already reached is a button back to itself and a step still ahead is
 * text, so the tab order runs over what can be opened and nothing else. It is
 * the only way backwards that does not cost a press per step, and a brief is
 * long enough that a client checking one answer three steps back should not
 * have to walk there.
 */
function StepTrail({ steps, active, reach, onOpen }) {
  return (
    <nav
      aria-label="Brief steps"
      className="border-hair-paper flex flex-wrap gap-x-4 border-b px-5 py-2"
    >
      {steps.map((step, index) => {
        const current = index === active
        const open = index <= reach
        const tone = current
          ? 'text-accent'
          : open
            ? 'text-paper-soft hover:text-accent'
            : 'text-paper-faint'
        // Two elements and a gap rather than a space between them: the row is a
        // flex container, and a whitespace-only anonymous flex item is dropped,
        // so a written space renders as no space at all.
        const label = (
          <>
            <span className="tabular-nums">{ordinal(index)}</span>
            <span>{step.label}</span>
          </>
        )
        return open ? (
          <button
            key={step.id}
            type="button"
            onClick={() => onOpen(index)}
            aria-current={current ? 'step' : undefined}
            className={`${MONO_LABEL} flex min-h-[36px] items-center gap-1.5 transition-colors duration-150 ease-out-soft ${tone}`}
          >
            {label}
          </button>
        ) : (
          <span
            key={step.id}
            className={`${MONO_LABEL} flex min-h-[36px] items-center gap-1.5 ${tone}`}
          >
            {label}
          </span>
        )
      })}
    </nav>
  )
}

/**
 * How far in the client is, drawn as the figure, the step and a bar.
 *
 * All three are read off the stored brief, so all three wait for it. A bar at
 * nought and a counter reading step one over a brief somebody half filled in
 * last night is the console telling them their work is gone, and it is told
 * for as long as the read takes on a phone on a job site. The placeholder says
 * the honest thing instead, which is that it does not know yet.
 *
 * The bar carries no percentage inside it and the figure carries no bar. One
 * says it in a number, the other says it in a length, and a reader takes
 * whichever they read faster.
 */
function ProgressReading({ percent, active, count, loading }) {
  return (
    <div className="border-hair-paper flex flex-col gap-2 border-b px-5 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className={`${MONO_LABEL} text-paper-faint`}>
          {loading ? (
            <SkeletonBar className="w-24" />
          ) : (
            <>
              Step <span className="tabular-nums">{ordinal(active)}</span> of{' '}
              <span className="tabular-nums">{String(count).padStart(2, '0')}</span>
            </>
          )}
        </p>
        <p className="text-[13px] tabular-nums text-paper-soft">
          {loading ? <SkeletonBar className="w-16" /> : `${percent}% answered`}
        </p>
      </div>
      {loading ? (
        <SkeletonBar className="w-full" height="h-1.5" />
      ) : (
        <div
          className="h-1.5 w-full overflow-hidden rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="How much of the brief is answered"
        >
          <span
            className="block h-full rounded-[var(--r-tiny)] bg-accent transition-[width] duration-300 ease-out-soft"
            style={{ width: `${Math.max(percent > 0 ? 2 : 0, percent)}%` }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * What the card says about the last write, which is never more than it knows.
 *
 * A form that saves itself has to answer one question a client asks silently
 * every few minutes, and answering it wrongly is worse than not answering it
 * at all: a page that says Saved while a request is failing is a page that
 * loses somebody's afternoon and tells them it did not. So there are four
 * readings and each of them is a fact. Saving means a write is out. Saved
 * means one landed, and once there is a time on it, when. A failure names
 * itself and offers the way through, and it says still trying because the next
 * change sends everything again rather than only what has changed since.
 *
 * Nothing at all is the fourth reading, before any write has been made, and it
 * states the promise rather than a state. A client who has typed one word has
 * nothing saved yet and needs to know the form will keep it, which is a
 * different sentence from a report about a write that has not happened.
 */
function SavingLine({ state, at, onRetry }) {
  if (state === 'failed') {
    return (
      <span className="flex flex-wrap items-center gap-3">
        <span className="text-[color:var(--warn-on-paper)]">Not saved. Still trying.</span>
        {onRetry ? (
          <button type="button" className={QUIET} onClick={onRetry}>
            Try Again
          </button>
        ) : null}
      </span>
    )
  }
  if (state === 'saving') return <span>Saving</span>
  if (state === 'saved') {
    // The clock is the studio's rather than the reader's, like every other
    // time in the console. An hour with nothing readable behind it is dropped
    // rather than written as a gap, since a write that landed is the fact and
    // the minute it landed on is the detail.
    const stamp = formatInstant(at, { hour: 'numeric', minute: '2-digit' }, '')
    return <span>{stamp ? `Saved at ${stamp}` : 'Saved'}</span>
  }
  return <span>Saved as you type. Close the tab and it is here when you come back.</span>
}

/**
 * @param {object} props
 * @param {Array<{id: string, label: string, eyebrow: string, title: string,
 *   description?: string, answered?: boolean, content: React.ReactNode}>} props.steps
 * @param {number} props.percent What the model says is answered, 0 to 100.
 * @param {boolean} props.loading Whether the stored brief has landed.
 * @param {'idle'|'saving'|'saved'|'failed'} [props.saving]
 * @param {string|null} [props.savedAt] When the last write landed.
 * @param {() => void} [props.onRetry]
 * @param {number|null} [props.resumeAt] The step the stored brief was left on.
 *   It arrives after the first paint, like every other answer, and is taken
 *   then rather than opening the client on a question they have answered.
 * @param {(step: number) => void} [props.onStep] Told which step is in the
 *   frame, so whoever writes the brief down can write the place in it too.
 * @param {() => void} props.onSubmit
 * @param {boolean} [props.submitting]
 * @param {string|null} [props.error] What the last read or write failed with.
 * @param {string} [props.area] The cell of a console page this card stands in.
 */
export default function OnboardingFlow({
  steps,
  percent,
  loading,
  saving = 'idle',
  savedAt = null,
  onRetry,
  resumeAt = null,
  onStep,
  onSubmit,
  submitting = false,
  error = null,
  area,
}) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [height, setHeight] = useState(null)
  // The furthest step this client has stood on. A brief is answered over days
  // rather than in one sitting, so a step opened once stays open: emptying a
  // field on step two must not shut the four steps behind it and throw
  // somebody back to the front of a form they have nearly finished. The
  // control that moves them on still refuses, which is where an unanswered
  // step is actually reported, and the trail is what a client uses to go and
  // fix it.
  const [furthest, setFurthest] = useState(0)
  const panelRef = useRef(null)
  const travelled = useRef(false)

  // What the answers alone open up, which is every step behind the first one
  // still missing something. The high-water mark can only raise it.
  let answeredThrough = 0
  while (answeredThrough < steps.length - 1 && steps[answeredThrough].answered) {
    answeredThrough += 1
  }
  const reach = Math.max(answeredThrough, furthest, resumeAt ?? 0)

  const active = Math.min(index, reach, steps.length - 1)
  const step = steps[active]
  const previous = steps[active - 1]
  const last = active === steps.length - 1
  // Read strictly, so a step that never says it is answered holds the handover
  // rather than opening it. A step with no fields on it is answered by the
  // model the moment it exists, and the two readings only ever differ where
  // something upstream has stopped answering - which is a control that stays
  // dark and gets reported, rather than a brief sent and refused.
  const complete = steps.every(one => one.answered)
  const transition = { duration: reduced ? 0 : DURATION, ease: EASE }

  // The height the card holds, taken from the step standing in it. The step on
  // its way out is out of the flow by then, and a step that grows as it is
  // answered - a list gaining a row, a file arriving - moves the frame with it.
  useEffect(() => {
    const element = panelRef.current
    if (!element) return undefined
    const measure = () => setHeight(element.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [active])

  useEffect(() => {
    if (!travelled.current) return
    document.getElementById(`${step.id}-title`)?.focus()
  }, [step.id])

  useEffect(() => {
    setFurthest(held => Math.max(held, active))
  }, [active])

  // The step the stored brief was left on, taken once it lands. It is clamped
  // by `active` like any other, so a stale number cannot open a step that is
  // not there.
  useEffect(() => {
    if (resumeAt === null) return
    setDirection(1)
    setIndex(resumeAt)
  }, [resumeAt])

  useEffect(() => {
    onStep?.(active)
  }, [active, onStep])

  // The panel on its way out releases its node after the one arriving has
  // claimed the slot, so only a mounting node is taken.
  const holdPanel = node => {
    if (node) panelRef.current = node
  }

  const open = target => {
    if (target === active || target > reach || target < 0) return
    travelled.current = true
    setDirection(target > active ? 1 : -1)
    setIndex(target)
  }

  return (
    <Panel
      title="Your Brief"
      aside={percent >= 100 ? 'All answered' : `${percent}% answered`}
      loading={loading}
      area={area}
      className="min-h-0"
    >
      <ProgressReading percent={percent} active={active} count={steps.length} loading={loading} />
      <StepTrail steps={steps} active={active} reach={reach} onOpen={open} />

      <PanelBody>
        <p role="status" className="sr-only">
          {`Step ${active + 1} of ${steps.length}. ${step.label}.`}
        </p>

        <m.div
          initial={false}
          animate={height === null ? {} : { height }}
          transition={transition}
          // The clip the height animation needs would also cut the focus ring
          // off any control standing against the edge of the step, because a
          // field paints its ring outside its own box. The negative margin and
          // the padding cancel, so the content stays where it was and the ring
          // has somewhere to land.
          className="relative -mx-1 overflow-hidden px-1"
        >
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <m.div
              key={step.id}
              ref={holdPanel}
              custom={direction}
              variants={PANEL}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="px-5 py-4"
            >
              <header className="border-hair-paper mb-6 border-b pb-4">
                <p className={`${MONO_LABEL} mb-1.5 text-accent`}>{step.eyebrow}</p>
                <h3
                  id={`${step.id}-title`}
                  tabIndex={-1}
                  className="max-w-2xl text-[20px] font-semibold leading-snug tracking-tight text-ink-paper"
                >
                  {step.title}
                </h3>
                {step.description ? (
                  <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-paper-soft">
                    {step.description}
                  </p>
                ) : null}
              </header>
              {step.content}
            </m.div>
          </AnimatePresence>
        </m.div>
      </PanelBody>

      <PanelFoot>
        {/* The saving reading and the fault share the left of the foot, because
            they answer the same question and only one of them is ever true. */}
        <span className="min-w-0 flex-1">
          {error ? (
            <span className="text-[color:var(--warn-on-paper)]">{error}</span>
          ) : (
            <SavingLine state={saving} at={savedAt} onRetry={onRetry} />
          )}
        </span>
        {/* Neither control names the step it leads to, which the marketing
            frame does. There the trail is most of a screen away by the time a
            visitor reaches the buttons; here it is a few lines above them and
            names every step, so a button repeating one of them buys nothing and
            costs a foot wide enough to hold the longest label twice. */}
        <span className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {previous ? (
            <button type="button" className={QUIET} onClick={() => open(active - 1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          ) : null}
          {last ? (
            // The last step's control is the handover. It is live only once
            // every step has what it needs, on the same reading the stored
            // brief is checked against before it is accepted - so a client is
            // never offered a control that answers by refusing, and never
            // refused one the bar above says is ready.
            <button
              type="button"
              className={BUTTON}
              disabled={loading || submitting || !complete}
              onClick={onSubmit}
            >
              {submitting ? 'Sending' : 'Send It Over'}
            </button>
          ) : (
            <button
              type="button"
              className={BUTTON}
              disabled={!step.answered}
              onClick={() => open(active + 1)}
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </span>
      </PanelFoot>
    </Panel>
  )
}
