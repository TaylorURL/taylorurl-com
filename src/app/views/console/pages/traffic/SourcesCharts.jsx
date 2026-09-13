import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ShareTooltip } from '../../../analytics/ChartTooltip'
import { ANIMATE, CHART_HEIGHT, frame } from '../../../analytics/chartKit'

/**
 * The chart the Sources section draws for itself.
 *
 * It reads its colours from the page's custom properties the way every chart
 * in the console does, so it follows the site's light and dark themes with no
 * palette of its own, and it takes `fill` on the same terms: given the box a
 * card has left it draws into that, and without it the fixed height a phone
 * gets.
 */

/**
 * Sessions by channel, as a ring that takes the whole of its box.
 *
 * The legend is not here. The card the ring stands in lists every channel
 * against its figure and its share, so the ring carries the shape and the
 * list carries the numbers, and the two are never a hand's width apart.
 *
 * A channel with nothing in it is left out of the ring rather than drawn at
 * nought, because the padding between slices would still open a gap for it.
 * Each row carries its own colour and the slice takes it, so the ring and the
 * list under it stay on the same colours whichever channels are empty.
 *
 * The figures are re-read every half minute, so the ring is not animated: a
 * chart that redraws itself from nothing on every poll is a chart the reader
 * keeps looking at.
 */
export function ChannelDonut({ rows, total, fill, height = CHART_HEIGHT.traffic }) {
  const drawn = rows.filter(row => row.sessions > 0)
  if (!drawn.length) return null
  return (
    <div {...frame(fill, height)}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={drawn}
            dataKey="sessions"
            nameKey="name"
            innerRadius="58%"
            outerRadius="92%"
            paddingAngle={1.5}
            stroke="var(--paper)"
            strokeWidth={1.5}
            isAnimationActive={ANIMATE}
          >
            {drawn.map(row => (
              <Cell key={row.name} fill={row.color} />
            ))}
          </Pie>
          <Tooltip content={<ShareTooltip total={total} />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
