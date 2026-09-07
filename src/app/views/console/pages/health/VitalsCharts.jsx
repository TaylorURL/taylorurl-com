import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TooltipCard } from '../../../analytics/ChartTooltip'
import {
  ANIMATE,
  AXIS,
  CHART_HEIGHT,
  CHART_INSET,
  fitName,
  frame,
  GRID,
  seriesColor,
} from '../../../analytics/chartKit'

/**
 * The chart Vitals draws: scores out of a hundred, a row per name and a mark
 * per device.
 *
 * It is drawn as a pair of dots on a banded track rather than as a pair of
 * bars, because of where these particular numbers live. A site that is being
 * looked after scores between ninety and a hundred on all four counts, and a
 * bar from nought carries that as four lengths that differ by six percent of
 * the card - which is to say four bars a reader cannot tell apart, on a chart
 * whose whole job is the difference between them. A dot is read by where it
 * sits rather than by how long it is, so the same six points are a visible gap
 * on the same axis.
 *
 * The bands are behind the dots for the same reason the ticks used to be at
 * fifty and ninety: those are Lighthouse's own edges, and a score is read
 * against the band it lands in rather than by looking its figure up. Drawing
 * them rather than ticking them means a reader sees which band a dot is in
 * without measuring anything, and sees a site fall out of the green the moment
 * it does.
 *
 * The two devices stay on one row because the gap between them is what the
 * shape is for: a phone on a slow connection scores under a computer on a fast
 * one, and how far under is the reading. The rule joining them is that gap.
 *
 * The colours are the page's own tokens, taken the way every chart in the
 * console takes them, so the chart follows the reader's theme without a
 * palette of its own.
 */

/**
 * Where the axis starts, and what it ticks, for the lowest score on the chart.
 *
 * A fixed nought to a hundred spends nine tenths of the card on scores nobody
 * on it holds: a site being looked after reads between ninety and a hundred,
 * and against the whole scale that is eight marks in the last tenth of the
 * width. So the axis starts at the band edge under the lowest reading rather
 * than at nought - never at an arbitrary crop, always at one of Lighthouse's
 * own three edges, and always printed, so the zoom is on the axis rather than
 * hidden in it.
 *
 * It widens on its own as a score falls. A site that drops out of the green
 * pulls the axis back to fifty, and the chart says so by redrawing at a scale
 * the reader can see it did.
 */
const SCALES = [
  { from: 90, ticks: [90, 95, 100] },
  { from: 50, ticks: [50, 70, 90, 100] },
  { from: 0, ticks: [0, 50, 90, 100] },
]

const scaleFor = lowest => SCALES.find(scale => lowest >= scale.from) ?? SCALES[SCALES.length - 1]

// The three bands behind the track, in the washes the badges on the table
// beside it are already drawn in, so a green dot and a green badge are the
// same green.
//
// Held well back. A band is the paper the dots are on, not a reading of its
// own, and at full strength the two-thirds of the axis nobody ever scores in
// is the loudest thing on the card - a site holding four hundreds sitting on
// a field of red. The dots carry the answer; these only say where the lines
// are.
const BAND_WASH = 0.55

const BANDS = [
  { from: 0, to: 50, fill: 'var(--danger-wash)' },
  { from: 50, to: 90, fill: 'var(--warn-wash)' },
  { from: 90, to: 100, fill: 'var(--good-wash)' },
]

// The first two steps of the console's series ramp, in the order the other
// charts take them, and the mark each device is drawn as.
//
// The mark matters as much as the colour here. Two scores that are equal - two
// hundreds, which is the commonest reading on this chart - land on the same
// point, and two dots of different colours at one point is one dot. A solid
// dot inside a ring is still legibly both.
const MOBILE = { key: 'mobile', label: 'Mobile', color: seriesColor(0), mark: 'dot' }
const DESKTOP = { key: 'desktop', label: 'Desktop', color: seriesColor(1), mark: 'ring' }

// Mobile first, the order the table beside the chart and the device switch
// under it both take. Which mark is drawn on top of the other is settled in
// the shape, and is about overlap rather than about order.
const DEVICES = [MOBILE, DESKTOP]

// The room the names get. The whole of a name that does not fit is in the
// tooltip.
const NAME_WIDTH = 112
const shorten = fitName(NAME_WIDTH)

// The row the pair is drawn on. It carries no ink of its own - it is the hit
// area the tooltip answers from, and the box the marks are placed inside.
const ROW = 20

const has = value => value !== null && value !== undefined

/**
 * One row's pair of marks.
 *
 * The row is drawn as a bar spanning the whole axis, so `x` and `width` are
 * the pixels nought and a hundred sit at and every score can be placed
 * against them without the chart's scale being reached for.
 */
function Pair({ x, y, width, height, payload, start = 0 }) {
  const at = score => x + (width * (score - start)) / (100 - start)
  const mid = y + height / 2
  const { mobile, desktop } = payload
  return (
    <g>
      {has(mobile) && has(desktop) && (
        <line
          x1={at(Math.min(mobile, desktop))}
          x2={at(Math.max(mobile, desktop))}
          y1={mid}
          y2={mid}
          stroke="var(--paper-hairline-strong)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
      {has(desktop) && (
        <circle
          cx={at(desktop)}
          cy={mid}
          r={5}
          fill="none"
          stroke={DESKTOP.color}
          strokeWidth={2}
        />
      )}
      {has(mobile) && <circle cx={at(mobile)} cy={mid} r={3.5} fill={MOBILE.color} />}
    </g>
  )
}

/**
 * Scores out of a hundred, one row per name and a mark per device.
 *
 * Each row carries `name`, `mobile` and `desktop`, a score being null where
 * that device has not been measured, which draws no mark rather than a mark at
 * nothing.
 */
export function ScoreBars({ rows, height = CHART_HEIGHT.traffic, fill }) {
  if (!rows.length) return null
  const scores = rows.flatMap(row => [row.mobile, row.desktop]).filter(has)
  const scale = scaleFor(scores.length ? Math.min(...scores) : 0)
  // The track each pair is placed on. Its length is the axis, so the shape is
  // handed the pixels the domain's two ends fall at.
  const tracked = rows.map(row => ({ ...row, track: 100 }))
  // The bands, cut to the axis actually drawn. A band wholly under the start
  // is not drawn at all, and the one the start falls inside begins there.
  const bands = BANDS.filter(band => band.to > scale.from).map(band => ({
    ...band,
    from: Math.max(band.from, scale.from),
  }))
  return (
    <div {...frame(fill, height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={tracked}
          layout="vertical"
          margin={{ top: 4, right: CHART_INSET, bottom: 0, left: CHART_INSET }}
          barCategoryGap="24%"
        >
          <XAxis
            type="number"
            domain={[scale.from, 100]}
            ticks={scale.ticks}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={NAME_WIDTH}
            interval={0}
            tickFormatter={shorten}
          />
          {bands.map(band => (
            <ReferenceArea
              key={band.from}
              x1={band.from}
              x2={band.to}
              fill={band.fill}
              fillOpacity={BAND_WASH}
              strokeOpacity={0}
              ifOverflow="hidden"
            />
          ))}
          <CartesianGrid stroke={GRID} horizontal={false} />
          <Tooltip
            cursor={{ fill: 'var(--paper-hairline)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={label}
                  rows={DEVICES.map(device => ({
                    label: device.label,
                    value: has(payload[0].payload[device.key])
                      ? payload[0].payload[device.key]
                      : '—',
                    color: device.color,
                  }))}
                />
              ) : null
            }
          />
          <Bar
            dataKey="track"
            shape={<Pair start={scale.from} />}
            fill="none"
            barSize={ROW}
            isAnimationActive={ANIMATE}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** The chart's key: one mark per device, drawn the way its dots are drawn. */
export function DeviceKey() {
  return (
    <ul className="flex items-center gap-4">
      {DEVICES.map(device => (
        <li key={device.key} className="flex items-center gap-1.5 text-[12px]">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            {device.mark === 'ring' ? (
              <circle cx="6" cy="6" r="4" fill="none" stroke={device.color} strokeWidth="2" />
            ) : (
              <circle cx="6" cy="6" r="3.5" fill={device.color} />
            )}
          </svg>
          {device.label}
        </li>
      ))}
    </ul>
  )
}
