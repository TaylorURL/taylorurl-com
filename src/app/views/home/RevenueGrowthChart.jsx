import { useMemo, useState } from 'react'

const WIDTH = 520
const HEIGHT = 260
const PADDING = { top: 14, right: 14, bottom: 32, left: 36 }
const Y_DOMAIN = [90, 220]
const Y_TICKS = [100, 130, 160, 190, 220]
const AXIS_COLOR = 'rgba(255,255,255,0.5)'
const AXIS_FAINT = 'rgba(255,255,255,0.32)'
const AXIS_LINE = 'rgba(255,255,255,0.15)'
const WITHOUT_COLOR = 'rgba(255,255,255,0.4)'
const WITH_COLOR = '#2f6bff'
const CURSOR_COLOR = 'rgba(47,107,255,0.4)'

const buildScales = data => {
  const xStep = (WIDTH - PADDING.left - PADDING.right) / (data.length - 1)
  const yRange = HEIGHT - PADDING.top - PADDING.bottom
  const [yMin, yMax] = Y_DOMAIN
  return {
    x: index => PADDING.left + index * xStep,
    y: value => PADDING.top + (1 - (value - yMin) / (yMax - yMin)) * yRange,
  }
}

const toSmoothPath = points => {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  const segments = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    segments.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    )
  }
  return segments.join(' ')
}

/**
 * Lean replacement for the recharts LineChart we used on the home "by the
 * numbers" panel. Same visual treatment (two interpolated lines, dotted dots,
 * mono-uppercase axes, hover tooltip with crosshair) at a tiny fraction of the
 * bundle weight — recharts itself was ~100 kB gzip for one trivial 6-point
 * chart.
 */
export default function RevenueGrowthChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null)

  const { withPath, withoutPath, withPoints, withoutPoints, scales } = useMemo(() => {
    const s = buildScales(data)
    const withPts = data.map((d, i) => ({ x: s.x(i), y: s.y(d.withSite) }))
    const withoutPts = data.map((d, i) => ({ x: s.x(i), y: s.y(d.withoutSite) }))
    return {
      scales: s,
      withPoints: withPts,
      withoutPoints: withoutPts,
      withPath: toSmoothPath(withPts),
      withoutPath: toSmoothPath(withoutPts),
    }
  }, [data])

  const handlePointerMove = event => {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    const xRatio = (event.clientX - rect.left) / rect.width
    const xViewBox = xRatio * WIDTH
    const innerWidth = WIDTH - PADDING.left - PADDING.right
    const relative = (xViewBox - PADDING.left) / innerWidth
    const idx = Math.round(relative * (data.length - 1))
    const clamped = Math.max(0, Math.min(data.length - 1, idx))
    setHoverIndex(clamped)
  }

  const hovered = hoverIndex === null ? null : data[hoverIndex]
  const hoverX = hoverIndex === null ? null : scales.x(hoverIndex)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label="12-month indexed revenue: businesses with a website vs. without"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        className="block touch-none select-none"
      >
        {Y_TICKS.map(value => (
          <g key={value}>
            <text
              x={PADDING.left - 8}
              y={scales.y(value)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fontFamily="Geist Mono, ui-monospace, monospace"
              fill={AXIS_FAINT}
            >
              {value}
            </text>
          </g>
        ))}

        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={HEIGHT - PADDING.bottom}
          y2={HEIGHT - PADDING.bottom}
          stroke={AXIS_LINE}
          strokeWidth="1"
        />
        {data.map((point, i) => (
          <text
            key={point.month}
            x={scales.x(i)}
            y={HEIGHT - PADDING.bottom + 18}
            textAnchor="middle"
            fontSize="11"
            fontFamily="Geist Mono, ui-monospace, monospace"
            fill={AXIS_COLOR}
          >
            {point.month}
          </text>
        ))}

        <path d={withoutPath} fill="none" stroke={WITHOUT_COLOR} strokeWidth="1.25" strokeDasharray="4 4" />
        <path d={withPath} fill="none" stroke={WITH_COLOR} strokeWidth="2" />

        {withoutPoints.map((p, i) => (
          <circle key={`wo-${i}`} cx={p.x} cy={p.y} r="2" fill={WITHOUT_COLOR} />
        ))}
        {withPoints.map((p, i) => (
          <circle key={`w-${i}`} cx={p.x} cy={p.y} r="3" fill={WITH_COLOR} />
        ))}

        {hoverX !== null && (
          <line
            x1={hoverX}
            x2={hoverX}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            stroke={CURSOR_COLOR}
            strokeWidth="1"
          />
        )}
      </svg>

      {hovered && hoverX !== null && (
        <div
          className="pointer-events-none absolute top-2 -translate-x-1/2 whitespace-nowrap border border-white/20 bg-[#0a0a0a] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.05em] text-white"
          style={{ left: `${(hoverX / WIDTH) * 100}%`, borderRadius: '2px' }}
        >
          <div className="text-white/50">{hovered.month}</div>
          <div>{hovered.withSite}% · With a website</div>
          <div className="text-white/70">{hovered.withoutSite}% · Without</div>
        </div>
      )}
    </div>
  )
}
