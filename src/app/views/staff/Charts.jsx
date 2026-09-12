import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CALL_OUTCOMES } from '@lib/outreach/prospects/calls.js'
import { ANIMATE, AXIS, BAR_SIZE, CHART_INSET, GRID, frame } from '@views/analytics/chartKit'
import { TooltipCard } from '@views/analytics/ChartTooltip'
import { hourLabel } from '@views/analytics/lib/format'

/**
 * The two charts the management screen draws, on the console's own terms: the
 * same tick face, the same grid, the same bar weight, and no animation, because
 * the figures re-read on a poll and a chart that grows from nothing on every
 * read is never still long enough to read.
 */

// The hours a chart of the day always shows, whether or not a call landed in
// them. A day that starts at nine and ends at five reads as that day; a chart
// drawn only over the hours with calls in them reads as a different day every
// time it is opened.
const DAY_FROM = 8
const DAY_TO = 17

const HEIGHT = 150

/**
 * One caller's calls by hour of the Central day.
 *
 * @param {{hours: {hour: number, calls: number}[]}} props
 */
export function HourChart({ hours }) {
  const busy = hours.filter(slot => slot.calls > 0).map(slot => slot.hour)
  const from = Math.min(DAY_FROM, ...busy)
  const to = Math.max(DAY_TO, ...busy)
  const data = hours
    .filter(slot => slot.hour >= from && slot.hour <= to)
    .map(slot => ({ ...slot, label: hourLabel(slot.hour) }))

  return (
    <div {...frame(false, HEIGHT)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: CHART_INSET, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--paper-hairline)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={payload[0].payload.label}
                  rows={[{ label: 'Calls', value: String(payload[0].value) }]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="calls"
            fill="var(--accent)"
            radius={[1, 1, 0, 0]}
            barSize={BAR_SIZE}
            isAnimationActive={ANIMATE}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * What one caller's calls came to today, one bar per outcome, in the order the
 * outcomes are offered on the call screen.
 *
 * @param {{outcomes: Record<string, number>}} props
 */
export function OutcomeChart({ outcomes }) {
  const data = CALL_OUTCOMES.map(one => ({
    id: one.id,
    name: one.label,
    calls: outcomes[one.id] ?? 0,
  }))
  const height = data.length * 22 + 8

  return (
    <div {...frame(false, height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: CHART_INSET, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={96}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'var(--paper-hairline)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={payload[0].payload.name}
                  rows={[{ label: 'Calls', value: String(payload[0].value) }]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="calls"
            fill="var(--accent)"
            radius={[0, 1, 1, 0]}
            barSize={BAR_SIZE}
            isAnimationActive={ANIMATE}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
