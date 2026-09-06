import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { fullCount } from '../../analytics/lib/format'
import { TooltipCard } from '../../analytics/ChartTooltip'
import { CHART_HEIGHT, frame } from '../../analytics/chartKit'

/**
 * The chart the Subscribers section draws for itself.
 *
 * It reads its colours from the page's custom properties the way every chart
 * in the console does, so it follows the site's light and dark themes with no
 * palette of its own, and it takes `fill` on the same terms: given the box a
 * card has left it draws into that, and without it the fixed height a phone
 * gets.
 */

/**
 * The list by status, as a ring that takes the whole of its box.
 *
 * The legend is not here. The card the ring stands in lists every status
 * against its count and its share, so the ring carries the shape - how much
 * of the list can still be written to - and the list carries the numbers,
 * and the two are never a hand's width apart.
 *
 * A status nobody holds is left out of the ring rather than drawn at nought,
 * because the padding between slices would still open a gap for it. Each row
 * carries its own colour and the slice takes it, so the ring and the figures
 * under it stay on the same colours whichever statuses are empty.
 *
 * The list is re-read after every change made from beside it, so the ring is
 * not animated: a chart that redraws itself from nothing each time a person
 * is added or removed is a chart the reader keeps looking at.
 */
export function StatusDonut({ rows, total, fill, height = CHART_HEIGHT.traffic }) {
  const drawn = rows.filter(row => row.count > 0)
  if (!drawn.length) return null
  return (
    <div {...frame(fill, height)}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={drawn}
            dataKey="count"
            nameKey="name"
            innerRadius="58%"
            outerRadius="92%"
            paddingAngle={1.5}
            stroke="var(--paper)"
            strokeWidth={1.5}
            isAnimationActive={false}
          >
            {drawn.map(row => (
              <Cell key={row.name} fill={row.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={payload[0].name}
                  rows={[
                    { label: 'People', value: fullCount(payload[0].value) },
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
  )
}
