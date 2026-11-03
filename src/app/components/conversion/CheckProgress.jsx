import { Check } from 'lucide-react'
import { CARD, TYPE } from '@components/kit/styles'
import { clock, creep } from '@app/tools/lib/progress'

/**
 * The wait on a reading Google takes most of a minute to answer.
 *
 * The elapsed count is measured and exact, which is the part a reader checks
 * against their own sense of how long they have sat there. The bar beside it is
 * an estimate and is drawn as one: it eases toward the end without reaching it
 * and only the report landing fills it, so a slow run shows something still
 * moving rather than a full bar above an empty page. The stage in hand is the
 * one dot lit blue; nothing pulses or spins, because the clock is already the
 * thing on the page that shows it is alive.
 *
 * Which stage is in hand is the caller's to say, because the two pages that
 * wait this way know it differently: one estimates it from the clock, and one
 * is told by the endpoint as each stage finishes.
 *
 * It sits in a card of its own, one step up from the page, like every other box
 * on the site. A `ground` prop from a caller written for the old ruled sections
 * is accepted and ignored.
 *
 * @param {object} props
 * @param {string} props.address The address being read, shown as typed.
 * @param {number} props.elapsed Milliseconds since the run started.
 * @param {string[]} props.stages The stages, in the order they finish.
 * @param {number} props.at Index of the stage in hand.
 * @param {string} [props.note] What the reader is told about the wait.
 */
export default function CheckProgress({ address, elapsed, stages, at, note }) {
  const share = creep(elapsed)
  const current = Math.min(Math.max(at, 0), stages.length - 1)

  return (
    <div className={`${CARD} p-6 sm:p-8`}>
      <p className={TYPE.label}>Checking</p>
      <p className="mt-1.5 break-all text-[17px] font-medium text-ink">{address}</p>

      <div className="mt-7 flex items-baseline justify-between gap-4">
        <span className={TYPE.small}>Elapsed</span>
        <span aria-hidden="true" className="text-[15px] font-medium tabular-nums text-ink">
          {clock(elapsed)}
        </span>
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext="Working"
      >
        {/* Scaled rather than widened, and eased by the browser rather than a
            script: the fill is redrawn from state four times a second, and a
            short transition is all that keeps it from stepping. */}
        <div
          className="h-full w-full origin-left rounded-full bg-[var(--blue)] transition-transform duration-200 ease-linear"
          style={{ transform: `scaleX(${share})` }}
        />
      </div>

      <ol className="mt-7 space-y-3.5">
        {stages.map((label, index) => {
          const done = index < current
          const inHand = index === current
          return (
            <li key={label} className="flex items-start gap-3">
              <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                {done ? (
                  <Check
                    className="h-3 w-3 text-[color:var(--link)]"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`block h-1.5 w-1.5 rounded-full ${
                      inHand ? 'bg-[var(--blue)]' : 'bg-white/[0.18]'
                    }`}
                  />
                )}
              </span>
              <span
                className={`text-[15px] leading-[1.55] ${inHand ? 'text-ink' : 'text-ink-mute'}`}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>

      {note && <p className={`${TYPE.small} mt-7`}>{note}</p>}

      <p role="status" aria-live="polite" className="sr-only">
        {stages[current]}
      </p>
    </div>
  )
}
