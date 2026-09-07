import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useConsole } from '../../lib/context'
import { duration, fullCount } from '../../../analytics/lib/format'
import { recalledCount, recalledRows, rememberCount, rememberRows } from '../../lib/rowMemory'
import {
  ConsolePage,
  EmptyRow,
  Panel,
  PanelBody,
  RankedList,
  ShareBar,
  SkeletonRows,
} from '../../ui'
import { SiteIcon } from '../../SiteIcon'
import { CELL, FIELD, ROW_HEIGHT, TH } from '../../lib/tokens'

// A ranking beside the table holds the head of the list and no more: six rows
// is what a half-height card has room for at a laptop's height, and the rest
// of the order is one column heading away in the table.
const RANKED = 6
const REMEMBERED = 'taylorurl_console_pages'

// The figures a reader orders the table on. Each is read highest first, since
// a page is looked for by how much it carried rather than how little.
const FIGURES = {
  pageviews: row => row.pageviews,
  sessions: row => row.sessions,
  entries: row => row.entries,
  avg_dwell_ms: row => row.avg_dwell_ms || 0,
}

// A column heading that orders the table, dressed the way the sites table
// dresses its own, so the two tables answer the pointer and the keyboard alike.
const SORT = `inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap transition-colors duration-150 ease-out-soft hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]`

/**
 * The pages read in the window, and how long each one held a reader.
 *
 * The table is the section: every page the window recorded, most read first,
 * with the share each carried drawn under its path. Beside it are the two
 * rankings the table answers less directly - which pages a session began on,
 * and which held a reader longest - level with each other so the page that
 * brings people in can be read against the page that keeps them. A field over
 * the table narrows it to the paths that contain what was typed, since fifty
 * rows is more than are read by eye, and a column heading orders the table on
 * its own figure. Both rankings are taken over the pages the collector sends,
 * which are the fifty most read, so a page with a long dwell and almost no
 * readers is not among them.
 *
 * Scoped to a site it is that site's pages, and selecting one narrows the whole
 * console to it - the tile strip, the traffic chart, and every other section -
 * which is why the list itself stays unfiltered while one of its rows is
 * selected.
 *
 * Across the account a row is a page on a site rather than a path, and it names
 * which. Every other breakdown here folds the sites together and is right to:
 * a referrer and a country are the same fact about the account whether it holds
 * one site or fifteen. A path is not. Counted on the string alone, one `/` row
 * was fifteen front pages added together, and the figure it carried belonged to
 * no page anybody could open. Selecting one of these rows moves the console to
 * that site and that page at once, because the row named both.
 *
 * The columns are held to shares of the table rather than sized to whatever the
 * longest path in the window happens to be. A site whose pages are named
 * `/blog/2026/…` would otherwise take two thirds of the table for a column of
 * URLs and press five columns of three-figure numbers against the right edge.
 */
export default function PagesPage() {
  const { bulk, detail, loading, path, pickSite, setPath, unreachable } = useConsole()
  const body = useRef(null)
  const skeletonRows = recalledRows(REMEMBERED, 12, ROW_HEIGHT.pages)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('pageviews')

  const pages = detail?.pages || []
  const peak = Math.max(1, ...pages.map(page => page.pageviews))
  const cols = bulk ? 6 : 5

  // Matched on what the row shows: the path, and across the account the site
  // as well, so typing a site's name finds its pages.
  const typed = query.trim().toLowerCase()
  const shown = pages
    .filter(
      page =>
        !typed ||
        page.path.toLowerCase().includes(typed) ||
        (bulk && String(page.site).toLowerCase().includes(typed))
    )
    .sort((a, b) => FIGURES[sort](b) - FIGURES[sort](a))

  const landed = pages
    .filter(page => page.entries > 0)
    .sort((a, b) => b.entries - a.entries)
    .slice(0, RANKED)
  const held = pages
    .filter(page => page.avg_dwell_ms > 0)
    .sort((a, b) => b.avg_dwell_ms - a.avg_dwell_ms)
    .slice(0, RANKED)

  useEffect(() => {
    if (loading) return
    rememberRows(REMEMBERED, body.current)
    rememberCount(`${REMEMBERED}_landed`, landed.length)
    rememberCount(`${REMEMBERED}_held`, held.length)
  }, [loading, detail, landed.length, held.length])

  // Across the account the row carries a site, so opening it goes there. Within
  // one it is the filter it has always been, and pressing the selected row again
  // lifts it.
  const open = page =>
    bulk ? pickSite(page.site_id, page.path) : setPath(page.path === path ? null : page.path)

  // Two sites' front pages are two rows carrying one path, so the site is part
  // of what tells them apart, in the rankings as in the table.
  const nameOf = page => (bulk ? `${page.site} ${page.path}` : page.path)
  const markOf = bulk ? page => <SiteIcon host={page.site} name={page.site} /> : undefined

  const aside = path
    ? `filtered to ${path}`
    : typed
      ? `${shown.length} of ${pages.length}`
      : `${pages.length} seen`

  const heading = (key, label, width) => (
    <th
      scope="col"
      aria-sort={sort === key ? 'descending' : undefined}
      className={`${TH} ${width} text-right`}
    >
      <button
        type="button"
        onClick={() => setSort(key)}
        className={`${SORT} ${sort === key ? 'text-ink-paper' : ''}`}
      >
        {label}
        {/* The mark holds its room on every heading so the label does not step
            sideways when the order moves to it. */}
        <ChevronDown
          className={`h-3 w-3 ${sort === key ? '' : 'opacity-0'}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    </th>
  )

  return (
    <ConsolePage
      areas={['table landed', 'table held']}
      cols="minmax(0,1fr) 22rem"
      rows="minmax(0,1fr) minmax(0,1fr)"
    >
      <Panel area="table" title="Pages" aside={aside} loading={loading}>
        <div className="border-hair-paper flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <label className="min-w-[11rem] flex-1 sm:max-w-xs">
            <span className="sr-only">Filter Pages</span>
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={bulk ? 'Filter by site or path' : 'Filter by path'}
              autoComplete="off"
              className={FIELD}
            />
          </label>
        </div>
        <PanelBody>
          <table
            className={`w-full ${bulk ? 'min-w-[700px]' : 'min-w-[560px]'} table-fixed border-collapse text-[13px]`}
            aria-busy={loading}
          >
            <thead>
              <tr>
                {bulk && (
                  <th scope="col" className={`${TH} w-[22%]`}>
                    Site
                  </th>
                )}
                <th scope="col" className={`${TH} ${bulk ? 'w-[26%]' : 'w-[30%]'}`}>
                  Page
                </th>
                {heading('pageviews', 'Views', bulk ? 'w-[13%]' : 'w-[17.5%]')}
                {heading('sessions', 'Sessions', bulk ? 'w-[13%]' : 'w-[17.5%]')}
                {heading('entries', 'Entries', bulk ? 'w-[13%]' : 'w-[17.5%]')}
                {heading('avg_dwell_ms', 'Avg Time', bulk ? 'w-[13%]' : 'w-[17.5%]')}
              </tr>
            </thead>
            <tbody ref={body}>
              {loading ? (
                <SkeletonRows
                  cols={cols}
                  rows={skeletonRows.rows}
                  height={skeletonRows.height}
                  lastHeight={skeletonRows.lastHeight}
                />
              ) : unreachable ? (
                <EmptyRow cols={cols}>
                  The traffic figures are not answering. Trying again every few seconds.
                </EmptyRow>
              ) : shown.length ? (
                shown.map(page => {
                  const id = bulk ? `${page.site_id} ${page.path}` : page.path
                  const selected = !bulk && page.path === path
                  return (
                    <tr
                      key={id}
                      tabIndex={0}
                      aria-selected={selected}
                      title={bulk ? `${page.site}${page.path}` : page.path}
                      className={`border-hair-paper cursor-pointer touch-manipulation border-t transition-colors hover:bg-[color:var(--console-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:bg-[color:var(--paper-hairline-strong)] ${
                        selected ? 'bg-[color:var(--paper-hairline)]' : ''
                      }`}
                      onClick={() => open(page)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          open(page)
                        }
                      }}
                    >
                      {bulk && (
                        <td className={CELL}>
                          <span className="flex items-center gap-2">
                            <SiteIcon host={page.site} name={page.site} />
                            <span className="truncate">{page.site}</span>
                          </span>
                        </td>
                      )}
                      <td className={CELL}>
                        <span className="block max-w-[24rem] truncate font-mono text-[12px]">
                          {page.path}
                        </span>
                        <ShareBar value={page.pageviews} peak={peak} />
                      </td>
                      <td className={`${CELL} text-right font-mono tabular-nums`}>
                        {fullCount(page.pageviews)}
                      </td>
                      <td className={`${CELL} text-right font-mono tabular-nums text-paper-soft`}>
                        {fullCount(page.sessions)}
                      </td>
                      <td className={`${CELL} text-right font-mono tabular-nums text-paper-soft`}>
                        {fullCount(page.entries)}
                      </td>
                      <td className={`${CELL} text-right font-mono tabular-nums text-paper-soft`}>
                        {page.avg_dwell_ms ? duration(page.avg_dwell_ms) : '—'}
                      </td>
                    </tr>
                  )
                })
              ) : pages.length ? (
                <EmptyRow cols={cols}>No page in this window matches the filter.</EmptyRow>
              ) : (
                <EmptyRow cols={cols}>No pages were opened in this window.</EmptyRow>
              )}
            </tbody>
          </table>
        </PanelBody>
      </Panel>

      <Panel area="landed" title="Landed On" aside="sessions began here">
        <PanelBody>
          <RankedList
            rows={landed}
            nameOf={nameOf}
            valueOf={page => page.entries}
            formatValue={fullCount}
            markOf={markOf}
            empty="No session began on a page in this window."
            loading={loading}
            expected={recalledCount(`${REMEMBERED}_landed`, RANKED)}
          />
        </PanelBody>
      </Panel>

      <Panel area="held" title="Held Longest" aside="average time on page">
        <PanelBody>
          <RankedList
            rows={held}
            nameOf={nameOf}
            valueOf={page => page.avg_dwell_ms}
            formatValue={duration}
            markOf={markOf}
            empty="No time on a page was measured in this window."
            loading={loading}
            expected={recalledCount(`${REMEMBERED}_held`, RANKED)}
          />
        </PanelBody>
      </Panel>
    </ConsolePage>
  )
}
