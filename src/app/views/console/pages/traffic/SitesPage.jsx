import { useCallback, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useConsole } from '../../lib/context'
import { Sparkline } from '../../../analytics/charts'
import { fullCount, percent } from '../../../analytics/lib/format'
import { recalledRows, rememberRows } from '../../lib/rowMemory'
import {
  ConsolePage,
  EmptyRow,
  Metric,
  Panel,
  PanelBody,
  PanelFill,
  PanelFoot,
  SkeletonBox,
  SkeletonRows,
} from '../../ui'
import { SiteIcon } from '../../SiteIcon'
import { CELL_TIGHT, CHART_HEIGHT, MONO_LABEL, ROW_HEIGHT, TH_TIGHT } from '../../lib/tokens'

const REMEMBERED = 'taylorurl_console_sites'

// The order the table opens in, which carries no parameter: the plain address
// of the section is the sites by views, the ranking the rest of the console
// uses for them.
const DEFAULT_SORT = 'pageviews'

/**
 * The figures a site is compared on, keyed as the overview row carries them.
 * `label` heads the column.
 */
const FIGURES = {
  pageviews: { label: 'Views', format: fullCount },
  visitors: { label: 'Visitors', format: fullCount },
  sessions: { label: 'Sessions', format: fullCount },
  live: { label: 'Now', format: fullCount },
}

// Below the tablet width the work is a phone's, where a trend drawn a hundred
// pixels wide is a squiggle and a fifth figure beside the name crowds every
// column. Both step out there and come back once there is room for them.
const FROM_MD = 'hidden md:table-cell'

/**
 * The table's columns in order, each with its share of the width and, where
 * it gives way as the page narrows, the widths it is drawn at.
 *
 * The shares are of the whole table with every column present. A column that
 * has stepped out leaves its share to the others, which is what keeps the
 * figures from crowding the name once the room is theirs. The placeholder rows
 * are drawn from the same list, so the table loads at the width it lands at.
 */
const COLUMNS = [
  { key: 'name', label: 'Site', width: 'w-[26%]' },
  { key: 'trend', label: 'Trend', width: 'w-[16%]', from: FROM_MD },
  { key: 'pageviews', width: 'w-[15%]' },
  { key: 'visitors', width: 'w-[15%]' },
  { key: 'sessions', width: 'w-[14%]', from: FROM_MD },
  { key: 'live', width: 'w-[14%]' },
]

const SORT = `inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap transition-colors duration-150 ease-out-soft hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]`

/** Whether a key names one of the figures, rather than anything else on an object. */
function isFigure(key) {
  return Object.hasOwn(FIGURES, key)
}

/** The direction a column opens in: names read upward, figures downward. */
function natural(key) {
  return key === 'name' ? 'asc' : 'desc'
}

/** The rows in the order one column puts them, ties settled by name. */
function ordered(rows, key, dir) {
  const byName = (a, b) => String(a.name).localeCompare(String(b.name))
  return [...rows].sort((a, b) => {
    const diff = key === 'name' ? byName(a, b) : (Number(a[key]) || 0) - (Number(b[key]) || 0)
    return (dir === 'asc' ? diff : -diff) || byName(a, b)
  })
}

/**
 * Which column the table is sorted on, held in the address the way a view is.
 *
 * A sort is part of where the reader is: a reload lands on the same order, and
 * a link to the sites by sessions is a link rather than a click to be repeated.
 * The default carries no parameter, so the plain address is still the front,
 * and a column's own direction carries none either. Clicking the column the
 * table is already on turns it over.
 */
function useSort() {
  const [params, setParams] = useSearchParams()
  const held = params.get('sort')
  const key = held && (held === 'name' || isFigure(held)) ? held : DEFAULT_SORT
  const heldDir = params.get('dir')
  const dir = heldDir === 'asc' || heldDir === 'desc' ? heldDir : natural(key)

  const sortBy = useCallback(
    next => {
      setParams(
        current => {
          const search = new URLSearchParams(current)
          const turned = dir === 'asc' ? 'desc' : 'asc'
          const nextDir = next === key ? turned : natural(next)
          if (next === DEFAULT_SORT) search.delete('sort')
          else search.set('sort', next)
          if (nextDir === natural(next)) search.delete('dir')
          else search.set('dir', nextDir)
          return search
        },
        { replace: true }
      )
    },
    [setParams, key, dir]
  )

  return { key, dir, sortBy }
}

/**
 * The readings that place one site against the rest of the account, in the
 * order they are drawn. The rank and each share are worked out from the
 * window's rows once they have landed; the notes here are the ones that hold
 * before they have.
 */
const STANDING = [
  { key: 'rank', label: 'Rank', note: 'by views in this window' },
  { key: 'pageviews', label: 'Share of Views', note: 'of every site on the account' },
  { key: 'visitors', label: 'Share of Visitors', note: 'of every site on the account' },
  { key: 'sessions', label: 'Share of Sessions', note: 'of every site on the account' },
]

/** Where one site stands against the rest of the account, in this window. */
function standing({ scoped, sites }) {
  const byViews = ordered(sites, 'pageviews', 'desc')
  const rank = byViews.findIndex(row => row.site_id === scoped.site_id) + 1
  const share = key => {
    const whole = sites.reduce((sum, row) => sum + (row[key] || 0), 0)
    return {
      value: percent(whole ? ((scoped[key] || 0) / whole) * 100 : 0),
      note: `${fullCount(scoped[key])} of ${fullCount(whole)}`,
    }
  }
  return {
    rank: { value: `${rank} of ${sites.length}`, note: 'by views in this window' },
    pageviews: share('pageviews'),
    visitors: share('visitors'),
    sessions: share('sessions'),
  }
}

/** What a chart's box says when there is no chart to draw in it. */
function EmptyFill({ children }) {
  return (
    <div className="flex items-center justify-center px-5">
      <p className="text-center text-[13px] text-paper-soft">{children}</p>
    </div>
  )
}

/**
 * The section has two readings, and the scope chooser under the heading decides
 * which one is drawn.
 *
 * Across the account it is every site side by side over one window, which is
 * the comparison the section exists for. The table is the page, and it sorts on
 * any of its figures, so a heading clicked is the account ranked on that
 * figure. A row picked scopes the whole console to that site.
 *
 * Scoped to one it is that site's place in the same comparison - where it
 * ranks, what share of the account's reading it carries, and the shape of its
 * window - because a table of fourteen rows with one of them relevant is not a
 * narrower answer, it is the same answer with the reader doing the finding.
 *
 * What the scoped reading does not carry is the site's own totals. Those are
 * the strip above it, already scoped by the same chooser, and a card repeating
 * them is the section saying nothing twice.
 *
 * A site is named by its hostname here as it is everywhere else, so the row
 * carries the icon the site itself serves: a reader looking for one site among
 * fourteen finds its mark before they have read a word of the column. The
 * columns are held to shares of the table rather than sized to the longest
 * hostname in the account, which is what keeps the figures from drifting apart
 * as sites are added.
 */
export default function SitesPage() {
  const {
    inScope,
    knownSites,
    liveSites,
    loading,
    pickSite,
    scoped,
    scopeName,
    siteId,
    sites,
    unreachable,
    windowLabel,
  } = useConsole()
  const { key, dir, sortBy } = useSort()
  const body = useRef(null)
  // On a first visit there is no remembered shape, and the live feed answers
  // well before the windowed one - so its site count is the best guess going.
  const skeletonRows = recalledRows(REMEMBERED, liveSites.length || 3, ROW_HEIGHT.sites)

  useEffect(() => {
    if (!loading) rememberRows(REMEMBERED, body.current)
  }, [loading, sites])

  // Branching on the id rather than on the row keeps the cards in place while
  // the window's figures are still landing. Waiting for the row would draw the
  // table's placeholder first and swap it for the cards the moment it arrived,
  // which is the section changing shape under a reader who has not moved.
  if (siteId) {
    // Rank and share are readings of a set. An account holding one site has no
    // set, and "1 of 1" over "100%" is a card stating that arithmetic works.
    // The set is read from the sites the account is known to hold, which
    // outlives a window change, so the card does not say "only site" for the
    // length of every read. Before anything is known it draws the readings'
    // placeholders, since a sentence about the account is a finding and the
    // list is the shape nearly every account resolves to.
    const known = knownSites.length
    const peers = !known || known > 1
    // A collector that is not answering has nothing on the way, so the card
    // says so rather than pulsing at it.
    const waiting = loading || (!scoped && !unreachable)
    const readings = scoped && peers ? standing({ scoped, sites }) : {}
    const origins = scoped?.origins || []

    return (
      <ConsolePage areas={['standing trend']} cols="18rem minmax(0,1fr)">
        <Panel
          area="standing"
          title="Where It Stands"
          aside={known > 1 ? `of ${known} sites` : windowLabel}
          loading={waiting}
        >
          {unreachable ? (
            <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
              The traffic figures are not answering. Trying again every few seconds.
            </p>
          ) : peers ? (
            <dl>
              {STANDING.map(reading => (
                <Metric
                  key={reading.key}
                  label={reading.label}
                  value={readings[reading.key]?.value}
                  caption={readings[reading.key]?.note ?? reading.note}
                  loading={waiting}
                />
              ))}
            </dl>
          ) : (
            <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
              The only site on this account.
            </p>
          )}
        </Panel>

        <Panel area="trend" title="Over the Window" aside={windowLabel} busy={waiting}>
          {scoped ? (
            <PanelFill minHeight={CHART_HEIGHT.trend} className="pt-3">
              <Sparkline series={scoped.series} fill />
            </PanelFill>
          ) : unreachable ? (
            <PanelFill minHeight={CHART_HEIGHT.trend}>
              <EmptyFill>The traffic figures are not answering.</EmptyFill>
            </PanelFill>
          ) : (
            <PanelFill minHeight={CHART_HEIGHT.trend}>
              <SkeletonBox className="flex flex-col [&>span]:flex-1" />
            </PanelFill>
          )}
          {/* The name outlives the window's figures, so the foot names the site
              through every read rather than going blank for the length of one. */}
          <PanelFoot>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {scopeName && <SiteIcon host={scopeName} name={scopeName} />}
              <span className={`${MONO_LABEL} text-paper-faint min-w-0 truncate`}>
                {origins.length ? origins.join(' · ') : scopeName}
              </span>
            </span>
          </PanelFoot>
        </Panel>
      </ConsolePage>
    )
  }

  const rows = ordered(inScope, key, dir)

  return (
    <ConsolePage areas={['table']}>
      <Panel
        area="table"
        title="Sites"
        aside={
          inScope.length === sites.length
            ? `${sites.length} tracked`
            : `${inScope.length} of ${sites.length}`
        }
        loading={loading}
      >
        <PanelBody>
          <table className="console-table text-[13px]" aria-busy={loading}>
            <thead>
              <tr>
                {COLUMNS.map(column => {
                  const heading = FIGURES[column.key]
                  const active = column.key === key
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={`${TH_TIGHT} ${column.width} ${column.from || ''} ${heading ? 'text-right' : ''}`}
                    >
                      {column.key === 'trend' ? (
                        column.label
                      ) : (
                        <button
                          type="button"
                          className={`${SORT} ${active ? 'text-ink-paper' : ''}`}
                          onClick={() => sortBy(column.key)}
                        >
                          {heading ? heading.label : column.label}
                          {active &&
                            (dir === 'asc' ? (
                              <ChevronUp className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                            ) : (
                              <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                            ))}
                        </button>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody ref={body}>
              {loading ? (
                <SkeletonRows
                  cols={COLUMNS.map(column => `${CELL_TIGHT} ${column.from || ''}`)}
                  rows={skeletonRows.rows}
                  height={skeletonRows.height}
                  lastHeight={skeletonRows.lastHeight}
                />
              ) : unreachable ? (
                <EmptyRow cols={COLUMNS.length}>
                  The traffic figures are not answering. Trying again every few seconds.
                </EmptyRow>
              ) : rows.length ? (
                rows.map(row => (
                  <tr
                    key={row.site_id}
                    tabIndex={0}
                    title={row.name}
                    className="border-hair-paper cursor-pointer touch-manipulation border-t transition-colors hover:bg-[color:var(--console-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:bg-[color:var(--paper-hairline-strong)]"
                    onClick={() => pickSite(row.site_id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        pickSite(row.site_id)
                      }
                    }}
                  >
                    {COLUMNS.map(column => {
                      if (column.key === 'name') {
                        return (
                          <td key={column.key} className={`${CELL_TIGHT} font-medium`}>
                            <span className="flex items-center gap-2">
                              <SiteIcon host={row.name} name={row.name} />
                              <span className="truncate">{row.name}</span>
                            </span>
                          </td>
                        )
                      }
                      if (column.key === 'trend') {
                        return (
                          <td key={column.key} className={`px-3 py-1.5 ${column.from}`}>
                            <Sparkline series={row.series} />
                          </td>
                        )
                      }
                      // The sorted figure is the one the reader is comparing,
                      // so it carries the ink and the rest stand back; the live
                      // count keeps its own colour, since a nought there is a
                      // different kind of quiet from a small total.
                      const tone =
                        column.key === 'live'
                          ? row.live
                            ? 'text-accent'
                            : 'text-paper-faint'
                          : column.key === key
                            ? 'text-ink-paper'
                            : 'text-paper-soft'
                      return (
                        <td
                          key={column.key}
                          className={`${CELL_TIGHT} ${column.from || ''} whitespace-nowrap text-right font-mono tabular-nums ${tone}`}
                        >
                          {FIGURES[column.key].format(row[column.key])}
                        </td>
                      )
                    })}
                  </tr>
                ))
              ) : (
                <EmptyRow cols={COLUMNS.length}>No sites are reporting yet.</EmptyRow>
              )}
            </tbody>
          </table>
        </PanelBody>
      </Panel>
    </ConsolePage>
  )
}
