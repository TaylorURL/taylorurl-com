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
import { vitalFor } from '../../lib/vitals'

/**
 * The charts Vitals draws: a row per name, a mark per device, and a banded
 * track behind them saying which side of Google's own edges the pair landed.
 *
 * Both charts on the page are that one shape. What differs is the axis: for
 * one site it is a score out of a hundred, and across the account it is the
 * timing behind the score, in the unit that timing is measured in.
 *
 * The shape is a pair of dots rather than a pair of bars because of where
 * these numbers live. A site that is being looked after scores between ninety
 * and a hundred on all four counts, and a bar from nought carries that as four
 * lengths differing by six percent of the card - four bars a reader cannot
 * tell apart, on a chart whose whole job is the difference between them. A dot
 * is read by where it sits rather than by how long it is, so the same six
 * points are a visible gap on the same axis.
 *
 * The bands are behind the dots for the same reason: those are the edges the
 * reading is judged against, and a score is read against the band it lands in
 * rather than by looking its figure up. Drawing them rather than ticking them
 * means a reader sees which band a dot is in without measuring anything, and
 * sees a site fall out of the green the moment it does.
 *
 * The two devices stay on one row because the gap between them is what the
 * shape is for: a phone on a slow connection is slower than a computer on a
 * fast one, and how much slower is the reading. The rule joining them is that
 * gap.
 *
 * The colours are the page's own tokens, taken the way every chart in the
 * console takes them, so the charts follow the reader's theme without a
 * palette of their own.
 */

/**
 * Where a score axis starts, and what it ticks, for the lowest score on it.
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

// The washes the badges on the table beside the chart are already drawn in, so
// a green dot and a green badge are the same green.
//
// Drawn at the strength the tokens themselves carry, which is a tenth of the
// colour: a band is the paper the dots are on rather than a reading of its
// own, and the tokens are already washes. Recharts starts a reference area at
// a fifth of what it is given, which on a wash that is itself a tenth is a
// tint the reader cannot see the edges of - and the edges are the whole of
// what a band is for.
const BAND_WASH = 1

const GOOD = 'var(--good-wash)'
const WARN = 'var(--warn-wash)'
const BAD = 'var(--danger-wash)'

// The first two steps of the console's series ramp, in the order the other
// charts take them, and the mark each device is drawn as.
//
// The mark matters as much as the colour here. Two readings that are equal -
// two hundreds, which is the commonest reading on the score chart - land on
// the same point, and two dots of different colours at one point is one dot. A
// solid dot inside a ring is still legibly both.
const MOBILE = { key: 'mobile', label: 'Mobile', color: seriesColor(0), mark: 'dot' }
const DESKTOP = { key: 'desktop', label: 'Desktop', color: seriesColor(1), mark: 'ring' }

// Mobile first, the order the table beside the chart and the device switch
// under it both take. Which mark is drawn on top of the other is settled in
// the shape, and is about overlap rather than about order.
const DEVICES = [MOBILE, DESKTOP]

// The room the names get. The whole of a name that does not fit is in the
// tooltip.
//
// The axis drops the `www.` the table keeps, which is four of the fourteen
// characters that fit and the same four on every row. The table has the width
// to print the host that was actually measured; a third of a card does not,
// and spending a quarter of every label on a prefix shared by all of them is
// what turns fifteen names into fifteen ellipses.
const NAME_WIDTH = 112
const fit = fitName(NAME_WIDTH)
const shorten = name => fit(String(name ?? '').replace(/^www\./, ''))

// The row the pair is drawn on. It carries no ink of its own - it is the hit
// area the tooltip answers from, and the box the marks are placed inside.
const ROW = 20

const has = value => value !== null && value !== undefined

/** The bands of an axis, cut to the length of it. */
function bandsWithin(edges, from, to) {
  let start = from
  const drawn = []
  for (const edge of edges) {
    const end = Math.min(edge.at, to)
    if (end > start) drawn.push({ from: start, to: end, fill: edge.fill })
    start = Math.max(start, end)
  }
  return drawn
}

/**
 * One row's pair of marks.
 *
 * The row is drawn as a bar spanning the whole axis, so `x` and `width` are
 * the pixels the axis begins and ends at, and every reading can be placed
 * against them without the chart's scale being reached for.
 */
function Pair({ x, y, width, height, payload, start = 0, end = 100 }) {
  const span = end - start || 1
  // Clamped to the axis, so a reading past the end of it sits on the end
  // rather than outside the card.
  const at = value => x + (width * (Math.min(Math.max(value, start), end) - start)) / span
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
 * The chart both of the page's readings are drawn as.
 *
 * `scale` is the whole of what an axis is here: where it runs from and to,
 * what it ticks, how a figure on it is written, and the bands behind it. The
 * two callers below build one each and share everything after it.
 */
function Dumbbell({ rows, scale, height, fill }) {
  // The track each pair is placed on. Its length is the axis, so the shape is
  // handed the pixels the domain's two ends fall at.
  const tracked = rows.map(row => ({ ...row, track: scale.to }))
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
            domain={[scale.from, scale.to]}
            ticks={scale.ticks}
            tick={AXIS}
            tickFormatter={scale.tick}
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
          {scale.bands.map(band => (
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
                      ? scale.value(payload[0].payload[device.key])
                      : '—',
                    color: device.color,
                  }))}
                />
              ) : null
            }
          />
          <Bar
            dataKey="track"
            shape={<Pair start={scale.from} end={scale.to} />}
            fill="none"
            barSize={ROW}
            isAnimationActive={ANIMATE}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
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
  const { from, ticks } = scaleFor(scores.length ? Math.min(...scores) : 0)
  return (
    <Dumbbell
      rows={rows}
      height={height}
      fill={fill}
      scale={{
        from,
        to: 100,
        ticks,
        tick: String,
        value: String,
        // High is good on a score, so the green is at the far end - the
        // mirror of every timing chart on the page, and the reason the bands
        // are drawn rather than assumed.
        bands: bandsWithin(
          [
            { at: 50, fill: BAD },
            { at: 90, fill: WARN },
            { at: 100, fill: GOOD },
          ],
          from,
          100
        ),
      }}
    />
  )
}

/**
 * One of the three vitals across every site, one row per name and a mark per
 * device.
 *
 * Each row carries `name`, `mobile` and `desktop` as the raw reading in the
 * metric's own unit - milliseconds, or the unitless shift - a null being a
 * device that has not been measured.
 *
 * The axis runs from nothing, because these are amounts rather than positions
 * on a scale and half a second means half of nothing. What moves is the other
 * end: it climbs the metric's ladder to the first rung that holds the slowest
 * reading, so an account well inside good is drawn against the good edge and
 * not against a ceiling nobody is near.
 */
export function VitalBars({ rows, vital: key, height = CHART_HEIGHT.traffic, fill }) {
  if (!rows.length) return null
  const vital = vitalFor(key)
  const readings = rows.flatMap(row => [row.mobile, row.desktop]).filter(has)
  const highest = readings.length ? Math.max(...readings) : 0
  const last = vital.ceilings[vital.ceilings.length - 1]
  const to = vital.ceilings.find(edge => highest <= edge) ?? Math.ceil(highest / last) * last
  return (
    <Dumbbell
      rows={rows}
      height={height}
      fill={fill}
      scale={{
        from: 0,
        to,
        // Nought, the two edges the reading is judged at, and the end of the
        // axis - dropped where the axis stops short of one, and never repeated
        // where the end of the axis is an edge.
        ticks: [...new Set([0, vital.good, vital.poor, to].filter(at => at <= to))].sort(
          (a, b) => a - b
        ),
        tick: vital.tick,
        value: vital.value,
        // Low is good on a timing, so the green is at the near end.
        bands: bandsWithin(
          [
            { at: vital.good, fill: GOOD },
            { at: vital.poor, fill: WARN },
            { at: to, fill: BAD },
          ],
          0,
          to
        ),
      }}
    />
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
