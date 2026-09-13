import { ArrowLeft, ArrowRight } from 'lucide-react'
import { GROUND } from '../lib/ground'
import { useStepTravel } from '../lib/useStepTravel'
import StepFrame from './StepFrame'

// How far a step travels on its way in and out. Far enough to read as a
// sideways move, short enough that the words stay legible the whole way.
const SHIFT = 56

const TRAIL_LABEL = 'section-label transition duration-200'

/** A step's number, as the trail and the counter both write it. */
const ordinal = index => String(index + 1).padStart(2, '0')

/** How many steps there are, written the same way. */
const total = steps => String(steps.length).padStart(2, '0')

/**
 * The trail across the top of the frame: every step, its number, and which one
 * the frame is holding.
 *
 * A step already answered is a button back to itself. A step still out of
 * reach is text, so the tab order runs over what can be opened and nothing
 * else.
 */
function StepTrail({ steps, active, reach, onOpen, label }) {
  return (
    <nav aria-label={label} className="mb-12">
      <p className="section-label mb-5 text-accent">
        Step {ordinal(active)} of {total(steps)}
      </p>
      <ol className={`flex flex-wrap items-stretch gap-x-8 border-b pb-4 ${GROUND.rule}`}>
        {steps.map((step, index) => {
          const current = index === active
          const open = index <= reach

          const tone = current
            ? 'text-ink-paper'
            : open
              ? 'text-paper-soft hover:text-accent'
              : 'text-paper-faint'

          return (
            <li key={step.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`h-px w-6 transition duration-200 ${
                  current ? 'bg-accent' : 'bg-[color:var(--paper-hairline-strong)]'
                }`}
              />
              {open ? (
                <button
                  type="button"
                  onClick={() => onOpen(index)}
                  aria-current={current ? 'step' : undefined}
                  className={`${TRAIL_LABEL} ${tone} min-h-[44px]`}
                >
                  {ordinal(index)} {step.label}
                </button>
              ) : (
                <span className={`${TRAIL_LABEL} ${tone} flex min-h-[44px] items-center`}>
                  {ordinal(index)} {step.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * The configurator frame: one step in it at a time, the trail above it, and
 * the controls that move between them below.
 *
 * The frame keeps its place on the page, and a step moves through it the way
 * `StepFrame` describes.
 *
 * A step is answered or it is not, and the control that opens the next one is
 * live only once the current step has its answer. The trail behind the frame
 * stays open, so an answer can be revisited without being lost.
 *
 * A control that does nothing and says nothing is a page somebody decides is
 * broken, so a step that will not open the next one names what it is waiting
 * on beside the button rather than leaving a dead control to be worked out.
 * The line is the button's own description, so it is read out with the control
 * rather than sitting near it.
 *
 * @param {object} props
 * @param {Array<{ id: string, label: string, eyebrow: string, title: string,
 *   description?: string, meta?: React.ReactNode, answered?: boolean,
 *   missing?: string | null, content: React.ReactNode }>} props.steps
 * @param {boolean} [props.atTop] - The configurator is the first thing on the
 *   page rather than something under a hero. It then owes what the hero owed:
 *   clearance under the fixed bar, no rule against it, and the page's one h1.
 * @param {string} [props.label] - What the trail is called to a screen reader.
 *   The frame carries the configurator and each of the free tools, so the name
 *   belongs to whoever mounted it rather than to the frame.
 * @param {number|null} [props.resumeAt] - The step to open on, once. A mount
 *   that restores answers made before a reload arrives at this as a number,
 *   and the frame moves to it rather than opening on a first question the
 *   visitor has already answered.
 * @param {(step: number) => void} [props.onStep] - Told which step the frame is
 *   holding, so a caller that writes the configuration down can write the place
 *   in it too.
 * @param {React.ReactNode} [props.aside] - Something that stands under the
 *   steps on the frame's own rail without being one of them. The caller
 *   decides which steps it appears on, because what belongs beside a sequence
 *   is a question about the sequence rather than about the frame.
 * @param {React.ReactNode} [props.head] - Standing type above the trail, on
 *   the same rail, saying what the sequence is for. It carries the page's
 *   heading when it is given, because a title that says what the page is beats
 *   one that changes every time the frame moves.
 */
export default function StepFlow({
  steps,
  atTop,
  label = 'Configurator steps',
  resumeAt = null,
  onStep,
  aside = null,
  head = null,
}) {
  // The furthest step the answers so far open up. Everything before it has
  // been answered, so clearing an answer pulls the frame back with it.
  let reach = 0
  while (reach < steps.length - 1 && steps[reach].answered) reach += 1

  // An answer taken back closes the steps behind it, and the frame has to come
  // back with them rather than only being clamped for the render. Held apart,
  // giving the answer again would throw the visitor forward to wherever they
  // had reached before they changed their mind.
  const { active, step, direction, open } = useStepTravel({
    steps,
    reach,
    retreat: true,
    resumeAt,
    onStep,
  })
  const previous = steps[active - 1]
  const next = steps[active + 1]

  // The step's heading is the page's own only where nothing above it holds
  // one. A frame given a head has its heading there instead.
  const Title = atTop && !head ? 'h1' : 'h2'

  // What the step is waiting on, and only while it is waiting. A line still
  // standing under a live button reads as a refusal of the thing that just
  // worked.
  const waiting = step.answered ? null : step.missing || null

  // The page's own section rhythm either way. Standing first on the page, the
  // frame takes the extra top clearance a hero takes, because the fixed bar is
  // over it and a rule against the top of the page has nothing to divide.
  return (
    <section
      aria-labelledby={`${step.id}-title`}
      className={`section-y relative overflow-hidden ${
        atTop ? 'pt-28 sm:pt-36' : 'border-t'
      } ${GROUND.section}`}
    >
      <div className="container-rail relative">
        {head}

        <StepTrail steps={steps} active={active} reach={reach} onOpen={open} label={label} />

        <StepFrame steps={steps} active={active} direction={direction} shift={SHIFT}>
          <header className={`mb-12 border-b pb-8 ${GROUND.rule}`}>
            <p className="section-label mb-5 block text-accent">{step.eyebrow}</p>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              {/* The step's own title is the page's heading when the
                  frame is the page and nothing above it holds one. A page
                  whose only headings are second level reads to a screen
                  reader, and to a crawler, as a fragment of a page that is
                  missing. */}
              <Title
                id={`${step.id}-title`}
                tabIndex={-1}
                className={`display-4 max-w-2xl font-semibold leading-[1.05] tracking-tightest [text-wrap:balance] ${GROUND.title}`}
              >
                {step.title}
              </Title>
              {step.meta && (
                <div className="flex flex-shrink-0 items-center gap-4 self-start lg:self-auto">
                  {step.meta}
                </div>
              )}
            </div>
            {step.description && (
              <p className={`mt-6 max-w-2xl text-[16px] leading-relaxed ${GROUND.body}`}>
                {step.description}
              </p>
            )}
          </header>
          {step.content}
        </StepFrame>

        {(previous || next) && (
          <div
            className={`mt-14 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center ${
              previous ? 'sm:justify-between' : 'sm:justify-end'
            } ${GROUND.rule}`}
          >
            {previous && (
              <button type="button" onClick={() => open(active - 1)} className="btn btn-secondary">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to {previous.label}
              </button>
            )}
            {next && (
              <div className="flex flex-col gap-3 sm:items-end">
                <button
                  type="button"
                  onClick={() => open(active + 1)}
                  disabled={!step.answered}
                  aria-describedby={waiting ? `${step.id}-waiting` : undefined}
                  className="btn btn-primary self-start sm:self-auto"
                >
                  Continue to {next.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                {waiting && (
                  <p
                    id={`${step.id}-waiting`}
                    className={`max-w-[46ch] text-[13px] leading-snug sm:text-right ${GROUND.meta}`}
                  >
                    {waiting}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {aside}
      </div>
    </section>
  )
}
