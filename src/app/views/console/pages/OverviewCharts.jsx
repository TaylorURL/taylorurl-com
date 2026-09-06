import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { compactCount, fullCount } from '../../analytics/lib/format'
import { TooltipCard } from '../../analytics/ChartTooltip'
import { ANIMATE, AXIS, CHART_HEIGHT, CHART_INSET, frame, GRID } from '../../analytics/chartKit'

/**
 * The one chart the landing section draws that no other section needs: the
 * week's shape, as seven bars in calendar order.
 *
 * It is drawn on the same terms as the hour chart beside it - the colours
 * read from the console's tokens, the ticks in the figure face, the busiest
 * bars at full weight and the quiet ones faded back - so the two are read
 * against each other as one clock and one calendar rather than as two
 * charts that happen to be level.
 */

/**
 * Pageviews gathered onto the weekday they landed on, Monday to Sunday.
 *
 * Each row carries the day's full name for the tooltip and a three-letter one
 * for the axis, where seven full names at a quarter of the page would run
 * into each other. The series is re-read on a poll, so the bars do not
 * animate: a chart that redraws itself every minute is a chart that is never
 * still long enough to read.
 */
export function WeekdayChart({ days, fill }) {
  const peak = Math.max(1, ...days.map(day => day.pageviews))
  return (
    <div {...frame(fill, CHART_HEIGHT.hour)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: CHART_INSET, bottom: 0, left: CHART_INSET }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="short"
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval={0}
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width="auto"
            tickFormatter={compactCount}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--paper-hairline)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={payload[0].payload.name}
                  rows={[{ label: 'Pageviews', value: fullCount(payload[0].value) }]}
                />
              ) : null
            }
          />
          <Bar dataKey="pageviews" radius={[1, 1, 0, 0]} isAnimationActive={ANIMATE}>
            {days.map(day => (
              <Cell
                key={day.name}
                fill="var(--accent)"
                fillOpacity={0.25 + 0.75 * (day.pageviews / peak)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
