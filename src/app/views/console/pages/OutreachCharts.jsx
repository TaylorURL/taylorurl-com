import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fullCount, percent } from '../../analytics/lib/format'
import { TooltipCard } from '../../analytics/ChartTooltip'
import { AXIS, CHART_HEIGHT, CHART_INSET, frame, GRID } from '../../analytics/chartKit'

/**
 * The one chart the outreach section draws: a fortnight of sending against
 * what came back undelivered.
 *
 * It reads its colours from the page's custom properties the same way the
 * analytics charts do, so it follows the console's two palettes without a
 * set of its own, and it takes the same axis face and the same tooltip card,
 * so a reader who has learned one chart in the console has learned this one.
 */

/** A day of the window as the axis prints it: the month and the day, nothing more. */
function dayLabel(date) {
  const [, month, day] = String(date).split('-')
  return month && day ? `${Number(month)}/${Number(day)}` : String(date)
}

/**
 * Sends and hard bounces per day over the trailing window, as two bars a day.
 *
 * The bounce bar stands beside the sent bar rather than on top of it, since a
 * bounce is a fraction of a day's sending and stacked it would be a sliver
 * nobody could read. The rate the ramp moves on is in the tooltip, against the
 * day it was charged to.
 */
export function BounceChart({ days, fill }) {
  if (!days?.length) return null
  return (
    <div {...frame(fill, CHART_HEIGHT.traffic)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={days}
          margin={{ top: 8, right: CHART_INSET, bottom: 0, left: CHART_INSET }}
          barGap={2}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={dayLabel}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis width="auto" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--paper-hairline)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={dayLabel(payload[0].payload.date)}
                  rows={[
                    {
                      label: 'Sent',
                      value: fullCount(payload[0].payload.sent),
                      color: 'var(--accent)',
                    },
                    {
                      label: 'Bounced',
                      value: fullCount(payload[0].payload.bounced),
                      color: 'var(--series-4)',
                    },
                    {
                      label: 'Rate',
                      value:
                        payload[0].payload.rate === null ? '—' : percent(payload[0].payload.rate),
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="sent"
            fill="var(--accent)"
            radius={[1, 1, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="bounced"
            fill="var(--series-4)"
            radius={[1, 1, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
