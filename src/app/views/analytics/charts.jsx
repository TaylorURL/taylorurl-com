import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { bucketLabel, bucketTitle, fullCount } from './lib/format'
import { TooltipCard } from './ChartTooltip'
// The chart reserves its box before recharts measures the container.
import { ANIMATE, AXIS, CHART_HEIGHT, CHART_INSET, COUNT_AXIS, frame, GRID } from './chartKit'

/**
 * The console's traffic chart.
 *
 * It reads its colours from the page's CSS custom properties rather than
 * from a palette of its own, so it follows the console's palette without a
 * second set of colours to keep in step. Recharts renders SVG, and
 * `var(--token)` resolves in a fill or stroke the same as it would in CSS.
 */

/**
 * Pageviews and sessions over the selected window. Pageviews are the filled
 * area and sessions the line on top: sessions are always the smaller number, so
 * drawing both as areas would bury one behind the other.
 */
export function TrafficChart({ series, grain, fill }) {
  return (
    <div {...frame(fill, CHART_HEIGHT.traffic)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={series}
          margin={{ top: 8, right: CHART_INSET, bottom: 0, left: CHART_INSET }}
        >
          <defs>
            <linearGradient id="analytics-views" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={value => bucketLabel(value, grain)}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={18}
          />
          <YAxis {...COUNT_AXIS} />
          <Tooltip
            cursor={{ stroke: GRID }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={bucketTitle(label, grain)}
                  rows={payload.map(entry => ({
                    label: entry.name,
                    value: fullCount(entry.value),
                    color: entry.color,
                  }))}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="pageviews"
            name="Pageviews"
            stroke="var(--accent)"
            strokeWidth={1.75}
            fill="url(#analytics-views)"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={ANIMATE}
          />
          <Line
            type="monotone"
            dataKey="sessions"
            name="Sessions"
            stroke="var(--paper-ink-soft)"
            strokeWidth={1.25}
            strokeDasharray="3 3"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={ANIMATE}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
