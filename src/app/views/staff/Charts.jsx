import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CALL_OUTCOMES } from '@lib/outreach/prospects/calls.js'
import { callerName } from '@lib/outreach/prospects/callPresence.js'
import { formatInstant, instantOf } from '@lib/time/zone.js'
import {
  ANIMATE,
  AXIS,
  BAR_SIZE,
  CHART_INSET,
  GRID,
  frame,
  seriesColor,
} from '@views/analytics/chartKit'
import { TooltipCard } from '@views/analytics/ChartTooltip'
import { hourLabel } from '@views/analytics/lib/format'

/**
 * The charts the management screen draws, on the console's own terms: the same
 * tick face, the same grid, the same bar weight, and no animation, because the
 * figures re-read on a poll and a chart that grows from nothing on every read is
 * never still long enough to read.
 */

// The hours a chart of the day always shows, whether or not a call landed in
// them. A day that starts at nine and ends at five reads as that day; a chart
// drawn only over the hours with calls in them reads as a different day every
// time it is opened.
const DAY_FROM = 8
const DAY_TO = 17

const HEIGHT = 150

/** What either chart says over one bar: what the bar is, and how many calls. */
function CallsTooltip({ active, payload }) {
  return active && payload?.length ? (
    <TooltipCard
      title={payload[0].payload.name}
      rows={[{ label: 'Calls', value: String(payload[0].value) }]}
    />
  ) : null
}

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
    .map(slot => ({ ...slot, name: hourLabel(slot.hour) }))

  return (
    <div {...frame(false, HEIGHT)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: CHART_INSET, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--paper-hairline)' }} content={CallsTooltip} />
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
          <Tooltip cursor={{ fill: 'var(--paper-hairline)' }} content={CallsTooltip} />
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

/**
 * A day key as the axis says it.
 *
 * `by_day` carries Central calendar dates rather than instants, and a bare
 * `YYYY-MM-DD` is deliberately refused by `formatInstant` - the platform reads
 * one as UTC midnight, which is the previous evening here, and every bar would
 * be labelled with the day before it counts. So the key is turned back into the
 * instant it stands for first, in the zone it was bucketed in.
 */
function dayLabel(day) {
  return formatInstant(instantOf(day), { month: 'short', day: 'numeric' })
}

/** What a day's bar says: the day, then whoever placed a call in it. */
function TeamTooltip({ active, payload, label, people }) {
  if (!active || !payload?.length) return null
  const rows = people
    .map(person => ({
      label: person.name,
      value: String(payload.find(one => one.dataKey === person.id)?.value ?? 0),
      color: person.color,
    }))
    .filter(row => row.value !== '0')
  return (
    <TooltipCard
      title={label}
      // A day nobody rang on is a real reading rather than a gap, so it says so
      // rather than opening an empty card under the cursor.
      rows={rows.length ? rows : [{ label: 'Calls', value: '0' }]}
    />
  )
}

/**
 * What the desk placed each day of the range, one band per person.
 *
 * Stacked rather than grouped, because the two questions asked of this chart
 * are how the desk did on a day and who did it, and a grouped chart answers the
 * first one only by adding the bars up by eye. The stack gives the day's total
 * as the height of one column and the share as the bands inside it.
 *
 * The legend is drawn in plain markup rather than through recharts' own. A
 * legend is a key to the colours and nothing else here toggles a series, so
 * rendering it inside the chart would hand a static list the chart's height
 * budget and push the bars up to pay for it.
 *
 * @param {{days: {day: string, placed: Record<string, number>}[],
 *   people: {id: string, name: string|null}[]}} props
 */
export function TeamDayChart({ days, people }) {
  const named = people.map((person, at) => ({
    id: person.id,
    name: callerName(person),
    color: seriesColor(at),
  }))
  const data = days.map(entry => {
    const row = { name: dayLabel(entry.day) }
    for (const person of named) row[person.id] = entry.placed?.[person.id] ?? 0
    return row
  })

  return (
    <div className="staff-chart">
      <div {...frame(false, HEIGHT)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: CHART_INSET, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'var(--paper-hairline)' }}
              content={props => <TeamTooltip {...props} people={named} />}
            />
            {named.map(person => (
              <Bar
                key={person.id}
                dataKey={person.id}
                name={person.name}
                stackId="team"
                fill={person.color}
                barSize={BAR_SIZE}
                isAnimationActive={ANIMATE}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="staff-legend">
        {named.map(person => (
          <li key={person.id}>
            <span aria-hidden="true" style={{ backgroundColor: person.color }} />
            {person.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
