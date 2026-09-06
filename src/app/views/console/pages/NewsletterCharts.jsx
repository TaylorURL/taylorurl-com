import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fullCount, percent } from '../../analytics/lib/format'
import { TooltipCard } from '../../analytics/ChartTooltip'
import {
  ANIMATE,
  AXIS,
  BAR_SIZE,
  CHART_HEIGHT,
  CHART_INSET,
  fitName,
  frame,
  GRID,
} from '../../analytics/chartKit'

/**
 * The one chart the newsletter draws for itself: what each issue did once it
 * landed, as two bars against its name.
 *
 * It is drawn on the same terms as every chart in the console. The colours
 * are read from the page's custom properties, so the chart follows the site's
 * light and dark themes with no palette of its own, and it takes `fill` the
 * same way: given the box a card has left it draws into that, and without it
 * the fixed height a phone gets.
 */

/**
 * Opened and clicked, as a share of what each issue sent, one issue a row.
 *
 * Rates rather than counts, because the list grows between issues and a
 * count of opens says as much about how many were sent as about how many
 * were read. The two bars sit against the issue's name so a reader compares
 * one issue with the next along one edge, which is the question the chart is
 * for; the counts behind each rate are in the tooltip and on the issue's own
 * row.
 *
 * The bars run sideways because the names are words, and words read along a
 * line. Newest issue at the top, the order the list beside it keeps.
 *
 * `series` names the readings drawn, each with the key it is read from, the
 * count behind it and the colour it takes. The page hands the same list to
 * the legend beside the chart, so a swatch there and a bar here can never
 * disagree.
 */
// The room an issue's name gets on the axis. A title runs longer than any
// axis will ever be, so it is trimmed to what this holds and the whole of it
// is in the tooltip.
const NAME_WIDTH = 104
const tick = fitName(NAME_WIDTH)

export function IssueReachChart({ rows, series, fill, height = CHART_HEIGHT.traffic }) {
  if (!rows.length) return null
  return (
    <div {...frame(fill, height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          barGap={2}
          margin={{ top: 4, right: CHART_INSET, bottom: 4, left: CHART_INSET }}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={value => `${value}%`}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={NAME_WIDTH}
            interval={0}
            tickFormatter={tick}
          />
          <Tooltip
            cursor={{ fill: 'var(--paper-hairline)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={payload[0].payload.title}
                  rows={[
                    { label: 'Sent', value: fullCount(payload[0].payload.sent) },
                    ...series.map(one => ({
                      label: one.label,
                      value: `${percent(payload[0].payload[one.key])} · ${fullCount(payload[0].payload[one.count])}`,
                      color: one.color,
                    })),
                  ]}
                />
              ) : null
            }
          />
          {series.map(one => (
            <Bar
              key={one.key}
              dataKey={one.key}
              name={one.label}
              fill={one.color}
              radius={[0, 1, 1, 0]}
              barSize={BAR_SIZE}
              isAnimationActive={ANIMATE}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
