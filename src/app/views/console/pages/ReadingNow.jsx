import { useEffect } from 'react'
import { useConsole } from '../lib/context'
import { recalledCount, rememberCount } from '../lib/rowMemory'
import { Panel, PanelBody } from '../ui'
import { SiteIcon } from '../SiteIcon'

const REMEMBERED = 'taylorurl_console_reading_now'

/**
 * Open sessions, right now. With a site in scope it lists the pages they are
 * on; across every site it lists the sites. Its own loading state is the live
 * feed's, which answers far faster than the windowed one, so it fills in first.
 *
 * The list is as long as there are readers, which is nothing most of the day
 * and a screenful on a good one, so it moves inside the card rather than
 * deciding the card's height. `area` names the cell the card stands in on a
 * section that lays its cards out to fit the screen.
 */
export default function ReadingNow({ area }) {
  const { inScope, live, liveForSite, liveNow, liveSites, siteId } = useConsole()
  // Across more than one site the rows are the sites themselves, and only the
  // ones in scope: a chosen pair lists that pair rather than the whole estate.
  const inScopeIds = new Set(inScope.map(row => row.site_id))
  const rows = siteId
    ? liveForSite?.pages || []
    : liveSites.filter(entry => entry.live && inScopeIds.has(entry.site_id))
  const expected = recalledCount(REMEMBERED, Math.min(8, Math.max(1, liveSites.length || 3)))

  useEffect(() => {
    if (!live.loading) rememberCount(REMEMBERED, rows.length)
  }, [live.loading, rows.length])

  return (
    <Panel area={area} title="Reading Now" aside={`${liveNow} open`} loading={live.loading}>
      <PanelBody>
        {live.loading ? (
          <ul className="divide-y divide-[color:var(--paper-hairline)]" aria-hidden="true">
            {/* The placeholder row is the real row's box, and there are as many
              of them as this reader saw last time - the site count only stands
              in on a first visit - so nothing resizes underneath them when the
              count lands. */}
            {Array.from({ length: expected }).map((_, row) => (
              <li key={row} className="flex items-baseline px-5 py-2.5 text-[13px]">
                <span className="block h-[19.5px] w-2/3 animate-pulse rounded-sm bg-paper-soft/15" />
              </li>
            ))}
          </ul>
        ) : rows.length ? (
          <ul className="divide-y divide-[color:var(--paper-hairline)]">
            {rows.map(entry => (
              <li
                key={siteId ? entry.path : entry.site_id}
                className="flex items-center gap-3 px-5 py-2.5 text-[13px]"
              >
                {/* With a site in scope the rows are its paths, and a path has
                  no mark of its own. */}
                {!siteId && <SiteIcon host={entry.name} name={entry.name} />}
                {/* A path is as long as somebody's URL and the card is a third
                  of a row, so the row keeps its one line and hands the whole
                  of it back on hover. */}
                <span
                  title={siteId ? entry.path : entry.name}
                  className="min-w-0 flex-1 truncate font-mono text-[12px]"
                >
                  {siteId ? entry.path : entry.name}
                </span>
                <span className="font-mono tabular-nums text-accent">
                  {siteId ? entry.n : entry.live}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
            Nobody is on the {siteId ? 'site' : 'sites'} right now.
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}
