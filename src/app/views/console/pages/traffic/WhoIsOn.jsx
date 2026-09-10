import { useEffect, useRef, useState } from 'react'
import { useConsole } from '../../lib/context'
import { duration } from '../../../analytics/lib/format'
import { sourceLabel } from '../../../analytics/lib/sources'
import { recalledRows, rememberRows } from '../../lib/rowMemory'
import { EmptyRow, Panel, PanelBody, SkeletonRows } from '../../ui'
import { CELL, TH, TH_END, CELL_END, ROW_HEIGHT } from '../../lib/tokens'
import { SiteIcon } from '../../SiteIcon'

const REMEMBERED = 'taylorurl_console_who_is_on'

// How the columns give way as the card narrows.
//
// The row answers for one person, and the two halves of that answer are what
// they are reading and how long they have been at it. Where they are and what
// sent them are the two that wait: both are counted in their own cards
// elsewhere in the section, where a phone reads them without dragging a table
// sideways to do it.
const FROM_SM = 'hidden sm:table-cell'
const FROM_MD = 'hidden md:table-cell'

/**
 * Everybody on the sites right now, one row each.
 *
 * The rest of the live section counts: how many are here, how that has moved,
 * which places they are in. This is the one card that answers for a person -
 * the page they have open, what sent them, where they are, and how long they
 * have been reading - and those four together are what turns a number into
 * somebody arriving from a search and opening the pricing page.
 *
 * Newest arrival first, because on a live board the news is who just turned
 * up. A row leaves when their session drops out of the presence window, which
 * is the same ten minutes the count above is taken over.
 *
 * The clock is the browser's rather than the feed's. Every other figure here
 * is only as fresh as the last poll, which is fine for a count that changes
 * when somebody arrives; a time on site that stood still for ten seconds and
 * then jumped ten would read as broken rather than as live, so the row holds
 * the moment the visit began and the second hand runs here.
 */

/** The wall clock, once a second, for as long as there is something counting. */
function useSecond(running) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running) return undefined
    // A hidden tab is not being read, and a timer firing into one spends the
    // reader's battery to redraw a figure nobody is looking at. The catch-up
    // on the way back is what keeps the durations honest rather than ten
    // minutes behind.
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') tick()
    }, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [running])

  return now
}

export default function WhoIsOn({ area }) {
  const { inScope, live, liveForSite, liveNow, liveSites, siteId } = useConsole()
  const body = useRef(null)

  // One site in scope lists its own readers; across more than one the rows are
  // every reader on every site in scope, each carrying the site they are on.
  const inScopeIds = new Set(inScope.map(row => row.site_id))
  const bulk = !siteId
  const rows = bulk
    ? liveSites
        .filter(entry => inScopeIds.has(entry.site_id))
        .flatMap(entry => (entry.visitors || []).map(one => ({ ...one, site: entry.name })))
    : liveForSite?.visitors || []
  const shown = [...rows].sort((a, b) => new Date(b.started_at) - new Date(a.started_at))

  const now = useSecond(shown.length > 0)
  // The placeholder holds the cells the head above it holds, at the widths it
  // holds them, so the table that loads is the table that lands.
  const cols = bulk
    ? [CELL, CELL, `${CELL} ${FROM_MD}`, `${CELL} ${FROM_SM}`, CELL_END]
    : [CELL, `${CELL} ${FROM_MD}`, `${CELL} ${FROM_SM}`, CELL_END]
  const skeleton = recalledRows(REMEMBERED, 4, ROW_HEIGHT.plain)

  useEffect(() => {
    if (!live.loading) rememberRows(REMEMBERED, body.current)
  }, [live.loading, shown.length])

  return (
    <Panel area={area} title="Who Is On Now" aside={`${liveNow} reading`} loading={live.loading}>
      <PanelBody>
        <table
          className={`w-full ${bulk ? 'md:min-w-[620px]' : 'md:min-w-[520px]'} table-fixed border-collapse text-[13px]`}
          aria-busy={live.loading}
        >
          <thead>
            <tr>
              {bulk && (
                <th scope="col" className={`${TH} w-[20%]`}>
                  Site
                </th>
              )}
              <th scope="col" className={`${TH} ${bulk ? 'w-[24%]' : 'w-[32%]'}`}>
                Page
              </th>
              <th scope="col" className={`${TH} ${FROM_MD} ${bulk ? 'w-[22%]' : 'w-[26%]'}`}>
                Came From
              </th>
              <th scope="col" className={`${TH} ${FROM_SM} ${bulk ? 'w-[20%]' : 'w-[24%]'}`}>
                Where
              </th>
              <th scope="col" className={`${TH_END} ${bulk ? 'w-[14%]' : 'w-[18%]'}`}>
                On For
              </th>
            </tr>
          </thead>
          <tbody ref={body}>
            {live.loading ? (
              <SkeletonRows
                cols={cols}
                rows={skeleton.rows}
                height={skeleton.height}
                lastHeight={skeleton.lastHeight}
              />
            ) : shown.length ? (
              shown.map(one => (
                <tr
                  key={bulk ? `${one.site} ${one.ref}` : one.ref}
                  className="border-hair-paper border-t"
                >
                  {bulk && (
                    <td className={CELL}>
                      <span className="flex items-center gap-2">
                        <SiteIcon host={one.site} name={one.site} />
                        <span className="truncate">{one.site}</span>
                      </span>
                    </td>
                  )}
                  {/* A path is as long as somebody's URL and a column is a
                      quarter of a card, so the cell keeps its one line and
                      hands the whole of it back on hover. */}
                  <td className={CELL}>
                    <span title={one.path} className="block truncate font-mono text-[12px]">
                      {one.path}
                    </span>
                  </td>
                  {/* What sent them, and the campaign underneath where a
                      tagged link carried them - which is the rest of the same
                      answer rather than a second one. */}
                  <td className={`${CELL} ${FROM_MD}`}>
                    <span className="block truncate">{sourceLabel(one.source)}</span>
                    {one.campaign && (
                      <span
                        title={one.campaign}
                        className="text-paper-faint block truncate font-mono text-[11px]"
                      >
                        {one.campaign}
                      </span>
                    )}
                  </td>
                  <td className={`${CELL} ${FROM_SM} text-paper-soft`}>
                    <span className="block truncate">
                      {[one.city, one.country].filter(Boolean).join(', ') || 'Unknown'}
                    </span>
                  </td>
                  {/* A dash where the visit's own first hit is not on record.
                      The collector says they are here and says nothing about
                      when they arrived, and a figure counted from nothing would
                      read exactly like one that was measured. */}
                  <td className={`${CELL_END} font-mono tabular-nums`}>
                    {one.started_at ? duration(now - new Date(one.started_at).getTime()) : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={cols}>Nobody is on the {bulk ? 'sites' : 'site'} right now.</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
    </Panel>
  )
}
