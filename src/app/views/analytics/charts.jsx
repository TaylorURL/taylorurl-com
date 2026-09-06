import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { bucketLabel, bucketTitle, compactCount, fullCount, hourLabel } from './lib/format'
import { TooltipCard } from './ChartTooltip'
// Each chart reserves its box before recharts measures the container.
import {
  ANIMATE,
  AXIS,
  BAR_SIZE,
  CHART_HEIGHT,
  CHART_INSET,
  fitName,
  frame,
  GRID,
  seriesColor,
} from './chartKit'

/**
 * Charts for the analytics console.
 *
 * They read their colours from the page's CSS custom properties rather than
 * from a palette of their own, so the console follows the site's light and dark
 * themes without a second set of colours to keep in step. Recharts renders SVG,
 * and `var(--token)` resolves in a fill or stroke the same as it would in CSS.
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
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width="auto"
            tickFormatter={compactCount}
            allowDecimals={false}
          />
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

/** Pageviews by hour of day, in the reader's own timezone. */
export function HourChart({ hours, fill }) {
  const peak = Math.max(1, ...hours.map(hour => hour.pageviews))
  return (
    <div {...frame(fill, CHART_HEIGHT.hour)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={hours}
          margin={{ top: 8, right: CHART_INSET, bottom: 0, left: CHART_INSET }}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={hourLabel}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval={2}
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
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={`${hourLabel(label)} – ${hourLabel((label + 1) % 24)}`}
                  rows={[{ label: 'Pageviews', value: fullCount(payload[0].value) }]}
                />
              ) : null
            }
          />
          <Bar dataKey="pageviews" radius={[1, 1, 0, 0]} isAnimationActive={ANIMATE}>
            {hours.map(hour => (
              <Cell
                key={hour.hour}
                fill="var(--accent)"
                // The busiest hours are the point of this chart; the quiet ones
                // fade back rather than being drawn at the same weight.
                fillOpacity={0.25 + 0.75 * (hour.pageviews / peak)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A breakdown of sessions by one dimension, as a donut with its own legend. */
export function BreakdownDonut({ rows, total }) {
  if (!rows.length) return null
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0" style={{ height: CHART_HEIGHT.donut, width: CHART_HEIGHT.donut }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="sessions"
              nameKey="name"
              innerRadius={34}
              outerRadius={58}
              paddingAngle={1.5}
              stroke="var(--paper)"
              strokeWidth={1.5}
              isAnimationActive={ANIMATE}
            >
              {rows.map((row, index) => (
                <Cell key={row.name} fill={seriesColor(index)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={payload[0].name}
                    rows={[
                      { label: 'Sessions', value: fullCount(payload[0].value) },
                      {
                        label: 'Share',
                        value: total ? `${Math.round((payload[0].value / total) * 100)}%` : '—',
                      },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* The share follows the name rather than being pushed to the far edge of
          whatever the card happens to be wide. A legend of six words in a card
          of nine hundred pixels leaves the reader crossing an empty half-inch
          between "Desktop" and the figure that belongs to it, six times over,
          and the pair stops reading as a pair. */}
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((row, index) => (
          <li key={row.name} className="flex items-baseline gap-2 text-[12px]">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 rounded"
              style={{ background: seriesColor(index) }}
            />
            <span className="truncate capitalize">{row.name}</span>
            <span className="font-mono tabular-nums text-paper-soft">
              {total ? `${Math.round((row.sessions / total) * 100)}%` : compactCount(row.sessions)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The room a source's name gets on the axis; the tooltip carries the whole
// of one that does not fit.
const RANK_NAME_WIDTH = 104
const rankTick = fitName(RANK_NAME_WIDTH)

/** Where sessions came from, ranked. Vertical bars keep long names readable. */
export function RankedBars({ rows, height = CHART_HEIGHT.traffic, fill }) {
  if (!rows.length) return null
  return (
    <div {...frame(fill, height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: CHART_INSET, bottom: 4, left: CHART_INSET }}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={compactCount}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={RANK_NAME_WIDTH}
            interval={0}
            tickFormatter={rankTick}
          />
          <Tooltip
            cursor={{ fill: 'var(--paper-hairline)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={label}
                  rows={[{ label: 'Sessions', value: fullCount(payload[0].value) }]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="sessions"
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
 * The site's shape over the window, small enough to sit in a table row. No axes
 * and no tooltip: the row's own figures carry the numbers, and this carries
 * whether they are climbing, flat, or a single spike.
 */
/**
 * The live count over the last stretch of readings, as a filled line.
 *
 * The axis is time and the readings are evenly spaced, so nothing is labelled
 * along the bottom: what the shape says is whether the number is climbing,
 * holding or falling, and a row of clock times under it would be read instead
 * of the shape. The last point carries a dot, because on a line that is still
 * being drawn the end of it is the only part that is now.
 */
export function LiveHistory({ series, height = CHART_HEIGHT.hour, fill }) {
  if (!series?.length) return null
  const peak = Math.max(1, ...series.map(point => point.live))
  return (
    <div {...frame(fill, height)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={series}
          margin={{ top: 8, right: CHART_INSET, bottom: 0, left: CHART_INSET }}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <YAxis
            width="auto"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            domain={[0, Math.max(2, peak)]}
          />
          <Area
            type="monotone"
            dataKey="live"
            stroke="var(--accent)"
            strokeWidth={1.75}
            fill="var(--accent)"
            fillOpacity={0.12}
            isAnimationActive={ANIMATE}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Tooltip
            cursor={{ stroke: GRID }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={payload[0].payload.at}
                  rows={[{ label: 'Reading', value: fullCount(payload[0].value) }]}
                />
              ) : null
            }
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Sparkline({ series, height = CHART_HEIGHT.spark, fill }) {
  if (!series?.length) return null
  return (
    <div {...frame(fill, height)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="pageviews"
            stroke="var(--accent)"
            strokeWidth={1.25}
            fill="var(--accent)"
            fillOpacity={0.12}
            dot={false}
            isAnimationActive={ANIMATE}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
