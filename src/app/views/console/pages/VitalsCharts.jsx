import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TooltipCard } from '../../analytics/ChartTooltip'
import {
  AXIS,
  CHART_HEIGHT,
  CHART_INSET,
  fitName,
  frame,
  GRID,
  seriesColor,
} from '../../analytics/chartKit'

/**
 * The chart Vitals draws: scores out of a hundred, a row per name and a bar
 * per device.
 *
 * Lighthouse's bands are drawn into the axis rather than stated beside it.
 * The ticks fall at 50 and 90, the two edges the bands turn on, so a bar is
 * read against the band it lands in without its figure being looked up. The
 * two devices stand together on every row because the gap between them is
 * what the shape is for: a phone on a slow connection scores under a computer
 * on a fast one, and how far under is the reading.
 *
 * The colours are the page's own tokens, taken the way every chart in the
 * console takes them, so the chart follows the reader's theme without a
 * palette of its own.
 */

// Lighthouse's own edges: 50 opens the middle band and 90 the top one.
const BAND_TICKS = [0, 50, 90, 100]

// The first two steps of the console's series ramp, in the order the other
// charts take them.
const DEVICES = [
  { key: 'mobile', label: 'Mobile', color: seriesColor(0) },
  { key: 'desktop', label: 'Desktop', color: seriesColor(1) },
]

// The room the names get. The whole of a name that does not fit is in the
// tooltip.
const NAME_WIDTH = 112
const shorten = fitName(NAME_WIDTH)

/**
 * Scores out of a hundred, one row per name and a bar per device.
 *
 * Each row carries `name`, `mobile` and `desktop`, a score being null where
 * that device has not been measured, which draws no bar rather than a bar of
 * nothing.
 */
export function ScoreBars({ rows, height = CHART_HEIGHT.traffic, fill }) {
  if (!rows.length) return null
  // A handful of rows in a tall box is drawn with heavier bars, or four
  // categories read as four threads across a card of nothing.
  const thickness = rows.length <= 4 ? 14 : rows.length <= 8 ? 10 : 7
  return (
    <div {...frame(fill, height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: CHART_INSET, bottom: 0, left: CHART_INSET }}
          barGap={2}
          barCategoryGap="28%"
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={BAND_TICKS}
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
          <Tooltip
            cursor={{ fill: 'var(--paper-hairline)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={label}
                  rows={payload.map(entry => ({
                    label: entry.name,
                    value: entry.value === null || entry.value === undefined ? '—' : entry.value,
                    color: entry.color,
                  }))}
                />
              ) : null
            }
          />
          {DEVICES.map(device => (
            <Bar
              key={device.key}
              dataKey={device.key}
              name={device.label}
              fill={device.color}
              radius={[0, 1, 1, 0]}
              barSize={thickness}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** The chart's key: one chip per device, in the colour its bars are drawn. */
export function DeviceKey() {
  return (
    <ul className="flex items-center gap-4">
      {DEVICES.map(device => (
        <li key={device.key} className="flex items-center gap-1.5 text-[12px]">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded"
            style={{ background: device.color }}
          />
          {device.label}
        </li>
      ))}
    </ul>
  )
}
