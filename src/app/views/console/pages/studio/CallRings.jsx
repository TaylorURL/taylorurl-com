import { memo } from 'react'
import { formatInstant } from '@lib/time/zone.js'
import { SHIFT_GOALS, callsLeft, finishAt, shiftShare } from '@lib/outreach/prospects/callShift.js'
import { MONO_LABEL } from '../../lib/tokens'

/**
 * The sitting, in the head of the card the calls are made from.
 *
 * Three figures the caller set for themselves and one sentence saying when the
 * first of them is met at the rate the day has actually gone. It is the only
 * thing on this page that counts up: everything else counts what is left, and
 * what is left is four thousand this morning and four thousand tomorrow.
 *
 * A ring rather than a bar, because there are three of them and three bars
 * stacked in a card head read as a chart somebody put there. A ring is read as
 * a state, which is what this is - and the three sit on one line beside their
 * own figures, so the head stays a head.
 *
 * The unfilled part of a ring is the wash the console draws its own empty
 * tracks in, so a ring at nought is a faint circle rather than a grey plate.
 * A ring that is full stops carrying the accent: the accent is what a reader
 * should look at, and a figure already met is the one thing on the screen that
 * never needs looking at again.
 */

/** The ring's geometry, in its own viewBox. One place, so the arc and the circumference agree. */
const R = 14
const SIZE = 34
const ROUND = 2 * Math.PI * R

/** One figure, drawn against what the caller set it to. */
function Ring({ label, had, want, met, share }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        className="block flex-shrink-0"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth="4"
          stroke="var(--wash-paper-strong)"
        />
        {share > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            stroke={met ? 'var(--good-on-paper)' : 'var(--accent-fill)'}
            strokeDasharray={ROUND.toFixed(2)}
            strokeDashoffset={(ROUND * (1 - share)).toFixed(2)}
            // Drawn from the top rather than from three o'clock, which is where
            // an SVG arc starts and nowhere a person reads a dial from.
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </svg>
      <div className="grid leading-tight">
        <span className="text-[15px] font-semibold text-ink-paper">
          {had} of {want}
        </span>
        <span className={`${MONO_LABEL} text-paper-faint`}>{label}</span>
      </div>
    </div>
  )
}

/**
 * When the calls figure is met at the rate the day has gone, said as a clock
 * time.
 *
 * Nobody converts calls a minute into anything with a phone against their ear.
 * A clock time is held against the hour somebody meant to leave, which is the
 * comparison they were making anyway.
 *
 * The three cases with no rate in them each say what is actually true rather
 * than falling back to one sentence: a shift not started, a shift one call in,
 * and a shift already past its figure are three different mornings.
 */
function paceLine(shift, now) {
  if (!shift) return ''
  const left = callsLeft(shift)
  if (!left) return `That is ${shift.placed} placed. You met it.`
  if (!shift.placed) return `${left} calls to place. The first one starts the clock.`
  if (shift.placed < 2) return `${left} calls left. One call is not a rate yet.`
  const at = finishAt(shift, now)
  if (!at) return `${left} calls left.`
  return `${left} calls left. At this rate you finish at ${formatInstant(at, {
    hour: 'numeric',
    minute: '2-digit',
  })}.`
}

function CallRings({ shift, now }) {
  if (!shift) return null
  return (
    <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-3">
      {SHIFT_GOALS.map(one => (
        <Ring
          key={one.id}
          label={one.label}
          had={shift[one.of] ?? 0}
          want={shift.goals?.[one.id] ?? 0}
          met={Boolean(shift.met?.[one.id])}
          share={shiftShare(shift, one.id)}
        />
      ))}
      {/* The sentence takes whatever the rings leave and sits against the far
          edge where there is room for it, which is the shape every other head
          in the console has: a name at one edge and its reading at the other. */}
      <p className="min-w-[14rem] flex-1 text-[13px] text-paper-soft sm:text-right">
        {paceLine(shift, now)}
      </p>
    </div>
  )
}

export default memo(CallRings)
