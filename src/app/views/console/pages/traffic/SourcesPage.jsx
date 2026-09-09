import { useConsole } from '../../lib/context'
import { fullCount } from '../../../analytics/lib/format'
import { channelOf, DIRECT, hostOf } from '../../../analytics/lib/sources'
import { seriesColor } from '../../../analytics/chartKit'
import {
  ConsolePage,
  Metric,
  Panel,
  PanelBody,
  PanelFill,
  RankedList,
  SkeletonBox,
  SkeletonRows,
} from '../../ui'
import { CELL, CHART_HEIGHT, TH } from '../../lib/tokens'
import { ChannelDonut } from './SourcesCharts'

// In the order the ring and its legend are read, which is the order the
// section describes itself in. Each channel keeps one colour from window to
// window, so a reader flipping between them is not re-learning which slice
// is which, and the four are the first steps of the ramp the shared charts
// walk.
const CHANNELS = [
  { key: 'search', label: 'Search', color: seriesColor(0) },
  { key: 'social', label: 'Social', color: seriesColor(1) },
  { key: 'referral', label: 'Referral', color: seriesColor(2) },
  { key: 'direct', label: 'Direct', color: seriesColor(3) },
]

/** A channel's name against the colour it is drawn in. */
function ChannelLabel({ name, color }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded"
        style={{ background: color }}
      />
      {name}
    </span>
  )
}

/**
 * Where visitors arrived from, and which campaign carried them.
 *
 * Three cards across, in the order the questions come: how the traffic
 * divides between the channels, then which hosts sent it, then which tagged
 * links were followed. The channels are one fixed figure however long the
 * window, so that card is held to the width a ring and four rows need, and
 * the two lists take the rest, with the table given the more since it has
 * four columns to fit and the ranking has two: at the narrow end of the desk
 * range, with the rail open, the table's column is still the width the four
 * columns ask for.
 */
export default function SourcesPage() {
  const { detail, loading } = useConsole()

  const referrers = detail?.referrers || []
  const campaigns = detail?.campaigns || []

  // Every share on this section is taken against the sum of the ranking rather
  // than against the window's session total: the two are counted at different
  // ends of the collector and differ by a few sessions, which is invisible in a
  // total and reads as an arithmetic error in a column of percentages.
  const arrivals = referrers.reduce((total, row) => total + row.sessions, 0)
  const named = referrers.filter(row => hostOf(row.source) !== DIRECT).length
  const share = value => (arrivals ? `${Math.round((value / arrivals) * 100)}%` : '—')

  const sessionsBy = referrers.reduce((sums, row) => {
    const key = channelOf(row.source)
    sums[key] = (sums[key] || 0) + row.sessions
    return sums
  }, {})
  const channels = CHANNELS.map(channel => ({
    name: channel.label,
    sessions: sessionsBy[channel.key] || 0,
    color: channel.color,
  }))

  return (
    <ConsolePage
      areas={['channels referrers campaigns']}
      cols="16rem minmax(0,1fr) minmax(0,1.5fr)"
    >
      {/* The ring takes whatever the card has left over the four rows under
          it, and the rows are the legend: each channel against its sessions
          and its share, on the same colour as its slice. */}
      <Panel
        title="Channels"
        aside={`${fullCount(arrivals)} sessions`}
        loading={loading}
        area="channels"
      >
        <PanelFill minHeight={CHART_HEIGHT.traffic}>
          {loading ? (
            <SkeletonBox className="flex flex-col [&>span]:flex-1" />
          ) : arrivals ? (
            <ChannelDonut rows={channels} total={arrivals} fill />
          ) : (
            <p className="flex items-center justify-center px-5 text-center text-[13px] text-paper-soft">
              No arrivals recorded in this window.
            </p>
          )}
        </PanelFill>
        <dl className="border-hair-paper border-t">
          {channels.map(row => (
            <Metric
              key={row.name}
              label={<ChannelLabel name={row.name} color={row.color} />}
              value={fullCount(row.sessions)}
              caption={share(row.sessions)}
              loading={loading}
            />
          ))}
        </dl>
      </Panel>

      <Panel
        title="Where From"
        aside={`sessions from ${fullCount(named)} sources`}
        loading={loading}
        area="referrers"
      >
        <PanelBody>
          <RankedList
            rows={referrers}
            nameOf={row => row.source}
            valueOf={row => row.sessions}
            formatValue={fullCount}
            empty="No arrivals recorded in this window."
            loading={loading}
          />
        </PanelBody>
      </Panel>

      <Panel title="Campaigns" aside="from utm tags" area="campaigns">
        {loading || campaigns.length ? (
          <PanelBody className="overflow-x-auto">
            <table className="w-full min-w-[400px] table-fixed border-collapse text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className={`${TH} w-[30%]`}>
                    Source
                  </th>
                  <th scope="col" className={`${TH} w-[26%]`}>
                    Medium
                  </th>
                  <th scope="col" className={`${TH} w-[26%]`}>
                    Campaign
                  </th>
                  <th scope="col" className={`${TH} w-[18%] text-right`}>
                    Sessions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows cols={4} rows={4} />}
                {campaigns.map(row => (
                  <tr
                    key={`${row.source}-${row.medium}-${row.campaign}`}
                    className="border-hair-paper border-t"
                  >
                    <td className={CELL} title={row.source || undefined}>
                      <span className="block truncate">{row.source || '—'}</span>
                    </td>
                    <td className={`${CELL} text-paper-soft`} title={row.medium || undefined}>
                      <span className="block truncate">{row.medium || '—'}</span>
                    </td>
                    <td className={`${CELL} text-paper-soft`} title={row.campaign || undefined}>
                      <span className="block truncate">{row.campaign || '—'}</span>
                    </td>
                    <td className={`${CELL} text-right font-mono tabular-nums`}>
                      {fullCount(row.sessions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelBody>
        ) : (
          <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
            No tagged links have been followed in this window.
          </p>
        )}
      </Panel>
    </ConsolePage>
  )
}
