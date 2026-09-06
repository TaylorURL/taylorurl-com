import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fullCount, percent } from '../../analytics/lib/format'
import { TooltipCard } from '../../analytics/ChartTooltip'
import { ANIMATE, AXIS, CHART_HEIGHT, CHART_INSET, frame, GRID } from '../../analytics/chartKit'

/**
 * The one chart the outreach section draws: a fortnight of sending, and the
 * share of it that came back undelivered.
 *
 * The rate is a line rather than a second bar, and it has an axis of its own.
 * A hard bounce is a low single-digit percentage of a day's sending, so drawn
 * as a bar against the sends it is charged to it is three pixels tall on a
 * chart two hundred tall - which is to say invisible, on the card the console
 * calls Bounces by Day. Against its own axis the same figure has the whole
 * height to move in, and the day it moved is the thing the card is read for.
 *
 * The sends stay, held back, because a rate off four messages and a rate off
 * four hundred are not the same reading and the bars are what says which one
 * this is.
 *
 * The cap the daily ramp stops at is drawn across the rate axis, since every
 * other thing on this card is about staying under it.
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

// The rate axis is given headroom over whatever the fortnight actually did, so
// the cap is on the chart even on a clean window - a line the readings never
// approach is the reading. It never shrinks below the cap and a little over.
const RATE_FLOOR = 1.25

/**
 * Sends per day as bars, the bounce rate over them as a line, and the cap the
 * ramp holds under drawn across it.
 *
 * `limit` is that cap as a percentage. The counts behind each rate are in the
 * tooltip, against the day they were charged to.
 */
export function BounceChart({ days, limit, fill }) {
  if (!days?.length) return null
  const peak = Math.max(0, ...days.map(day => day.rate ?? 0))
  const ceiling = Math.max(peak, (limit ?? 0) * RATE_FLOOR, 1)
  return (
    <div {...frame(fill, CHART_HEIGHT.traffic)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={days}
          margin={{ top: 8, right: CHART_INSET, bottom: 0, left: CHART_INSET }}
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
          <YAxis
            yAxisId="sent"
            width="auto"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            width="auto"
            domain={[0, ceiling]}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={value => `${Number(value).toFixed(0)}%`}
          />
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
                    { label: 'Bounced', value: fullCount(payload[0].payload.bounced) },
                    {
                      label: 'Rate',
                      value:
                        payload[0].payload.rate === null ? '—' : percent(payload[0].payload.rate),
                      color: 'var(--series-4)',
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar
            yAxisId="sent"
            dataKey="sent"
            fill="var(--accent)"
            fillOpacity={0.35}
            radius={[1, 1, 0, 0]}
            isAnimationActive={ANIMATE}
          />
          {limit ? (
            <ReferenceLine
              yAxisId="rate"
              y={limit}
              stroke="var(--warn)"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          ) : null}
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="rate"
            stroke="var(--series-4)"
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={ANIMATE}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
