import { Check } from 'lucide-react'
import { GROUNDS } from '@constants/grounds'
import { clock, creep } from '@app/tools/lib/progress'

/**
 * The wait on a reading Google takes most of a minute to answer.
 *
 * The elapsed count is measured and exact, which is the part a reader checks
 * against their own sense of how long they have sat there. The bar beside it is
 * an estimate and is drawn as one: it eases toward the end without reaching it
 * and only the report landing fills it, so a slow run shows something still
 * moving rather than a full bar above an empty page. The stage in hand carries
 * the pulsing hairline the rest of the site waits with rather than a spinner.
 *
 * Which stage is in hand is the caller's to say, because the two pages that
 * wait this way know it differently: one estimates it from the clock, and one
 * is told by the endpoint as each stage finishes.
 *
 * @param {object} props
 * @param {string} props.address The address being read, shown as typed.
 * @param {number} props.elapsed Milliseconds since the run started.
 * @param {string[]} props.stages The stages, in the order they finish.
 * @param {number} props.at Index of the stage in hand.
 * @param {string} props.note What the reader is told about the wait.
 * @param {object} [props.ground] The ground the block is drawn on.
 */
export default function CheckProgress({
  address,
  elapsed,
  stages,
  at,
  note,
  ground = GROUNDS.paper,
}) {
  const share = creep(elapsed)
  const current = Math.min(Math.max(at, 0), stages.length - 1)

  return (
    <div className={`p-8 ${ground.shell}`}>
      <p className="section-label-sm text-accent">Checking</p>
      <p className="mt-2 break-all text-[16px] font-semibold tracking-tight text-ink-paper">
        {address}
      </p>

      <div className="mt-7 flex items-baseline justify-between gap-4">
        <span className={`section-label-sm ${ground.meta}`}>Elapsed</span>
        <span
          aria-hidden="true"
          className="font-mono text-[15px] tabular-nums tracking-tight text-accent"
        >
          {clock(elapsed)}
        </span>
      </div>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline-strong)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext="Working"
      >
        {/* Scaled rather than widened, and moved by a transition rather than by
            the motion library: the fill is redrawn from state four times a
            second, so the browser has a value to ease toward on its own and
            nothing here has to hold an animation frame open. The blanket
            reduced-motion rule stops the transition with everything else. */}
        <div
          className="h-full w-full origin-left rounded-[var(--r-tiny)] bg-accent transition-transform duration-200 ease-linear"
          style={{ transform: `scaleX(${share})` }}
        />
      </div>

      <ol className="mt-7 space-y-4">
        {stages.map((label, index) => {
          const done = index < current
          const inHand = index === current
          return (
            <li key={label} className="flex items-start gap-3">
              <span className="mt-1.5 flex h-3 w-3 flex-shrink-0 items-center justify-center">
                {done ? (
                  <Check className="h-3 w-3 text-accent" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`block h-px w-3 rounded-[var(--r-tiny)] ${
                      inHand ? 'animate-pulse bg-accent' : 'bg-[color:var(--paper-hairline-strong)]'
                    }`}
                  />
                )}
              </span>
              <span
                className={`text-[15px] leading-snug ${
                  done ? ground.meta : inHand ? 'text-ink-paper' : ground.meta
                }`}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>

      <p className={`mt-7 border-t pt-6 text-[14px] leading-relaxed ${ground.rule} ${ground.meta}`}>
        {note}
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {stages[current]}
      </p>
    </div>
  )
}
