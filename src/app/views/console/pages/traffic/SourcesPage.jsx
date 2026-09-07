import { useConsole } from '../../lib/context'
import { fullCount } from '../../../analytics/lib/format'
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

// What the collector calls an arrival that carried no referrer. It is one row
// of the same ranking as every named source, and it is almost always the
// largest, so the split between it and everything else is the first thing the
// section has to answer.
const DIRECT = 'direct'

// The collector files an arrival under the host that sent it and nothing more,
// so which channel a host belongs to is read here, from the host's own name.
// A name without a dot is matched against the labels of the host, so a search
// engine is found under any of its country domains and behind any subdomain;
// a name with one is a whole domain, since a two-letter host like `t.co`
// would otherwise be found inside half the web.
const SEARCH = [
  'google',
  'bing',
  'duckduckgo',
  'yahoo',
  'ecosia',
  'brave',
  'yandex',
  'baidu',
  'startpage',
  'qwant',
  'kagi',
  'aol',
]
const SOCIAL = [
  'facebook',
  'fb.com',
  'fb.me',
  'instagram',
  'twitter',
  't.co',
  'x.com',
  'linkedin',
  'lnkd.in',
  'reddit',
  'pinterest',
  'pin.it',
  'tiktok',
  'youtube',
  'youtu.be',
  'threads',
  'bsky.app',
  'mastodon',
  'snapchat',
  'nextdoor',
  'tumblr',
  'quora',
  'discord',
  'whatsapp',
  'telegram',
  'messenger',
]

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

/** The host a source names, however the collector spelled it. */
function hostOf(source) {
  return String(source || '')
    .toLowerCase()
    .replace(/^[a-z][\w+.-]*:\/\//, '')
    .split('/')[0]
}

function inFamily(host, names) {
  const labels = host.split('.')
  return names.some(name =>
    name.includes('.') ? host === name || host.endsWith(`.${name}`) : labels.includes(name)
  )
}

function channelOf(source) {
  const host = hostOf(source)
  if (host === DIRECT) return 'direct'
  if (inFamily(host, SEARCH)) return 'search'
  if (inFamily(host, SOCIAL)) return 'social'
  return 'referral'
}

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
