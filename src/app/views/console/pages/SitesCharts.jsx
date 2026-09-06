import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
 * The chart the Sites section draws: one figure across every site, ranked.
 *
 * It is drawn on the same terms as the shared charts - colours read from the
 * page's tokens, the axis in the console's figure face, the tooltip on the
 * card every other chart uses - and lives beside the section rather than with
 * them because no other section compares sites on a figure of the reader's
 * choosing. The figure is whatever the table beside it is sorted on, so the
 * axis and the tooltip take their formatting from the caller rather than
 * assuming a count.
 */

/** The height one bar and the room around it take, which is what the chart's floor is counted from. */
export const BAR_PITCH = 28

// A hostname longer than the axis is trimmed to it rather than wrapped onto a
// second line or dropped from the axis altogether; the tooltip carries the
// whole of it.
const NAME_WIDTH = 112
const tick = fitName(NAME_WIDTH)

/**
 * One figure per site, as a bar the length of it. `dataKey` names the figure
 * on the row, `label` is what the tooltip calls it, `format` writes a value
 * in full and `axisFormat` writes it short enough for a tick. The bars never
 * animate, since the rows poll and a chart that slides on every read is a
 * chart that is always moving.
 */
export function SiteBars({
  rows,
  dataKey,
  label,
  format,
  axisFormat = format,
  height = CHART_HEIGHT.traffic,
  fill,
}) {
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
            tickFormatter={value => axisFormat(value)}
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
            content={({ active, payload, label: name }) =>
              active && payload?.length ? (
                <TooltipCard title={name} rows={[{ label, value: format(payload[0].value) }]} />
              ) : null
            }
          />
          <Bar
            dataKey={dataKey}
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
