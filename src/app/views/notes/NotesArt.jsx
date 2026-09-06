/*
 * Artwork for the notes index, drawn as inline SVG so it renders at prerender
 * time with no external fetch and costs nothing to load.
 *
 * The subject is what the page is: one thing written, carried outward to a
 * list of people. A square node on a measured baseline, four arcs leaving it,
 * each fainter than the last. Drafting language throughout — hairlines, ticks,
 * and a single accent, which is the language a diagram is read in.
 *
 * Vector art belongs to the web version alone: Gmail strips SVG, so the mailed
 * issue opens on a headline and a rule instead.
 */

const ORIGIN = { x: 66, y: 250 }
const RADII = [58, 102, 146, 190]
const BASELINE = { from: 20, to: 300 }
const TICK_STEP = 20

/** A quarter arc leaving the node, from due right around to due up. */
function arcPath(radius) {
  const { x, y } = ORIGIN
  return `M ${x + radius} ${y} A ${radius} ${radius} 0 0 0 ${x} ${y - radius}`
}

const TICKS = Array.from(
  { length: Math.floor((BASELINE.to - BASELINE.from) / TICK_STEP) + 1 },
  (_, index) => BASELINE.from + index * TICK_STEP
)

/**
 * The notes index showpiece. It reads by its own ground's ink and hairline, so
 * the same drawing carries onto whichever surface it is set down on.
 */
export function SignalMark({ className = '' }) {
  return (
    <svg
      viewBox="0 0 320 320"
      className={className}
      role="img"
      aria-label="A square node on a measured baseline with four arcs radiating outward from it."
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="notes-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={ORIGIN.x} cy={ORIGIN.y} r="150" fill="url(#notes-halo)" />

      {RADII.map((radius, index) => (
        <path
          key={radius}
          d={arcPath(radius)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={index === 0 ? 1.6 : 1}
          strokeLinecap="round"
          opacity={0.7 - index * 0.14}
        />
      ))}

      <line
        x1={BASELINE.from}
        y1={ORIGIN.y}
        x2={BASELINE.to}
        y2={ORIGIN.y}
        stroke="var(--hairline-strong)"
        strokeWidth="1"
      />
      {TICKS.map(x => (
        <line
          key={x}
          x1={x}
          y1={ORIGIN.y}
          x2={x}
          y2={ORIGIN.y + (x % 100 === 0 ? 10 : 5)}
          stroke="var(--hairline-strong)"
          strokeWidth="1"
        />
      ))}

      <rect
        x={ORIGIN.x - 13}
        y={ORIGIN.y - 13}
        width="26"
        height="26"
        fill="none"
        stroke="var(--hairline-strong)"
        strokeWidth="1"
      />
      <rect x={ORIGIN.x - 5} y={ORIGIN.y - 5} width="10" height="10" fill="var(--accent)" />

      {/* The subject, lettered along the baseline the way a drawing is titled.
          Tracked capitals belong here and nowhere else on the page: this is an
          annotation on a drawing rather than a line of type. */}
      <text
        x={BASELINE.to}
        y={ORIGIN.y + 26}
        textAnchor="end"
        fontSize="9"
        letterSpacing="2"
        fill="var(--ink-faint)"
        className="font-mono"
      >
        ONE TO MANY
      </text>
    </svg>
  )
}
