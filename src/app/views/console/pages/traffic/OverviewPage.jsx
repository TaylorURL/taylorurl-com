import { useConsole } from '../../lib/context'
import { TrafficChart } from '../../../analytics/charts'
import { fullCount } from '../../../analytics/lib/format'
import { visitorGroups } from '../../lib/onNow'
import { bySource, pageVisitors, topPages } from '../../lib/rankings'
import {
  ConsolePage,
  EmptyFill,
  EmptyRow,
  Panel,
  PanelBody,
  PanelFill,
  RankedList,
  SectionNotice,
  SkeletonBox,
  SkeletonList,
  SkeletonRows,
} from '../../ui'
import { CELL_END, CELL_TIGHT, CHART_HEIGHT, TH_END, TH_TIGHT } from '../../lib/tokens'
import { SiteIcon } from '../../SiteIcon'

/**
 * The one traffic screen a client has, answering "is my site getting
 * visitors": who is on it right now, by the page they have open and where
 * they came from, the shape
 * of the window, the pages carrying it, and where the visitors came from. With
 * more than one site in scope, a short list puts the sites side by side.
 *
 * The totals - online now, visitors, pageviews and the rest - are the strip the
 * frame draws above every traffic section, so this page draws the shape and
 * the rankings under them rather than the same figures twice.
 *
 * Everything is read from the feeds the frame already holds. The live feed is
 * its own read and answers long before the windowed one, so the "now" card
 * fills first and keeps answering when the windowed figures do not.
 */

// The columns of the per-site list, so the placeholder rows hold the cells the
// head above them holds.
const SITE_CELLS = [CELL_TIGHT, CELL_END, CELL_END]

/**
 * Who is on right now, put together by the page they have open and where they
 * came from - the site they found the link on, the tag a link carried where it
 * had no referrer, or Direct for an address typed in or a bookmark - with how
 * many are on each. A tagged link's campaign rides beside its source, since it
 * is the rest of the same answer.
 */
function OnNow({ area }) {
  const { bulk, live, liveLoading, liveNow, liveSites, siteIds } = useConsole()
  const rows = visitorGroups(liveSites, siteIds)
  const peak = Math.max(1, ...rows.map(row => row.n))
  // A read that failed has not said nobody is here, so it says that it failed
  // and puts no count in the head.
  const failed = Boolean(live.error) && !live.data
  const empty = failed
    ? 'The live count is not answering. Trying again every few seconds.'
    : `Nobody is on ${bulk ? 'any of these sites' : 'the site'} right now.`

  return (
    <Panel
      area={area}
      title={bulk ? 'On your sites now' : 'On the site now'}
      aside={failed ? null : `${fullCount(liveNow)} ${liveNow === 1 ? 'visitor' : 'visitors'}`}
      loading={liveLoading}
    >
      <PanelBody>
        {liveLoading ? (
          <SkeletonList rows={5} />
        ) : rows.length ? (
          <ul className="flex flex-col gap-px p-2" aria-label="Visitors on now">
            {rows.map(row => {
              // Two sites' front pages are two rows carrying one path, so
              // across more than one site the row names the site and the path
              // together.
              const page = bulk ? `${row.site}${row.path}` : row.path
              const from = row.campaign ? `${row.source} · ${row.campaign}` : row.source
              return (
                <li
                  key={row.key}
                  className="relative flex items-center justify-between gap-3 overflow-hidden rounded-[var(--console-radius-sm)] px-3 py-1.5 text-[13px] transition-colors duration-150 ease-out-soft hover:bg-[color:var(--console-row-hover)]"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 rounded-[var(--console-radius-sm)] bg-[color:var(--wash-accent)] transition-[width] duration-300 ease-out-soft"
                    style={{ width: `${Math.max(1.5, (row.n / peak) * 100)}%` }}
                  />
                  <span className="relative min-w-0 truncate" title={page}>
                    {page}
                  </span>
                  <span className="relative flex min-w-0 max-w-[60%] flex-shrink-0 items-center gap-3">
                    <span className="min-w-0 truncate text-paper-soft" title={`Came from ${from}`}>
                      {from}
                    </span>
                    <span className="flex-shrink-0 font-mono tabular-nums text-paper-soft">
                      {fullCount(row.n)}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-[13px] text-paper-soft">{empty}</p>
        )}
      </PanelBody>
    </Panel>
  )
}

/** The sites in scope side by side: who came over the window, and who is on now. */
function YourSites({ area }) {
  const { inScope, loading, windowLabel } = useConsole()
  const rows = [...inScope].sort(
    (a, b) => (b.visitors || 0) - (a.visitors || 0) || String(a.name).localeCompare(b.name)
  )

  return (
    <Panel area={area} title="Your sites" aside={windowLabel}>
      <PanelBody>
        <table className="console-table" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col" className={`${TH_TIGHT} w-[56%]`}>
                Site
              </th>
              <th scope="col" className={`${TH_END} w-[26%]`}>
                Visitors
              </th>
              <th scope="col" className={`${TH_END} w-[18%]`}>
                Now
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={SITE_CELLS} rows={4} />
            ) : rows.length ? (
              rows.map(row => (
                <tr key={row.site_id} className="border-hair-paper border-t">
                  <td className={CELL_TIGHT}>
                    <span className="flex min-w-0 items-center gap-2">
                      <SiteIcon host={row.name} name={row.name} />
                      <span className="truncate" title={row.name}>
                        {row.name}
                      </span>
                    </span>
                  </td>
                  <td className={`${CELL_END} font-mono tabular-nums`}>
                    {fullCount(row.visitors)}
                  </td>
                  <td
                    className={`${CELL_END} font-mono tabular-nums ${row.live ? 'text-accent' : 'text-paper-soft'}`}
                  >
                    {fullCount(row.live)}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={SITE_CELLS}>No sites are reporting yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
    </Panel>
  )
}

export default function OverviewPage() {
  const { bulk, detail, knownSites, loading, overview, role, unreachable } = useConsole()

  // A client with no site linked yet is told so by the frame, in the place the
  // figures would stand. A page of empty cards under it would say it four more
  // times.
  if (role === 'client' && overview.data && !knownSites.length) return null

  // The live feed keeps answering while the windowed one does not, so who is on
  // right now stays on screen beside the notice.
  if (unreachable) {
    return (
      <ConsolePage
        areas={['notice now', '. now']}
        cols="minmax(0,2fr) minmax(0,1fr)"
        rows="auto minmax(0,1fr)"
      >
        <SectionNotice area="notice">
          The traffic figures are not answering. Trying again every few seconds.
        </SectionNotice>
        <OnNow area="now" />
      </ConsolePage>
    )
  }

  const series = detail?.series || overview.data?.series || []
  const grain = detail?.grain || overview.data?.grain || 'day'

  const pages = topPages(detail?.pages)
  const sources = bySource(detail?.referrers || [])

  return (
    <ConsolePage
      areas={
        bulk
          ? ['chart chart now', 'sites pages sources']
          : ['chart chart now', 'pages pages sources']
      }
      cols="minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
      rows="minmax(0,1.1fr) minmax(0,1fr)"
    >
      <Panel
        area="chart"
        title="Visits"
        aside={`Pageviews, with sessions dashed, ${grain === 'hour' ? 'by the hour' : 'by the day'}`}
        busy={loading}
      >
        <PanelFill minHeight={CHART_HEIGHT.traffic}>
          {loading ? (
            <SkeletonBox height="100%" className="px-2 py-3" />
          ) : series.length ? (
            <div className="px-2 py-3">
              <TrafficChart series={series} grain={grain} fill />
            </div>
          ) : (
            <EmptyFill>No visits in this window.</EmptyFill>
          )}
        </PanelFill>
      </Panel>

      <OnNow area="now" />

      {bulk && <YourSites area="sites" />}

      <Panel area="pages" title="Top pages" aside="by visitors" busy={loading}>
        <PanelBody>
          <RankedList
            rows={pages}
            nameOf={page => (bulk ? `${page.site}${page.path}` : page.path)}
            valueOf={pageVisitors}
            formatValue={fullCount}
            empty="No pages were opened in this window."
            loading={loading}
          />
        </PanelBody>
      </Panel>

      <Panel area="sources" title="Where visitors came from" aside="by visitors" busy={loading}>
        <PanelBody>
          <RankedList
            rows={sources}
            nameOf={row => row.name}
            valueOf={row => row.visitors}
            formatValue={fullCount}
            empty="No arrivals were recorded in this window."
            loading={loading}
          />
        </PanelBody>
      </Panel>
    </ConsolePage>
  )
}
