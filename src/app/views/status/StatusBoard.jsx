import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { fadeInUp } from '@constants/animations'
import {
  Area,
  Badge,
  ConsolePage,
  EmptyRow,
  Panel,
  PanelBody,
  PanelFoot,
  SkeletonBar,
  SkeletonRows,
  StatCard,
} from '../console/ui'
import { CELL_TIGHT, MONO_LABEL, ROW_HEIGHT, TH_TIGHT } from '../console/lib/tokens'
import { recalledRows, rememberRows } from '../console/lib/rowMemory'
import { bareDomain, displayDomain } from '@utils/domains'
import { SiteIcon } from '../console/SiteIcon'
import { clockIn, ZONE } from '@lib/time/zone.js'

/** The host a site's mark is filed under: the first domain it answers on. */
function apexOf(site) {
  return bareDomain(site.domains?.length ? site.domains[0] : site.domain)
}

/**
 * The three states a site is in, as a word and the badge tone carrying it.
 *
 * Green is the console's settled condition - a subscriber on the list, a reply
 * in hand, a vital in Google's own top band - and the blue is what a reader is
 * being pointed at. A site that answers is settled, so it takes the green and
 * the accent is left to mean something. The dot repeats the tone at the far
 * left of the row, which is the edge a column of sixteen is scanned down.
 */
// A badge names its worst state `bad` and a tile names the same one `danger`,
// so each state carries both words rather than a tile falling back to plain ink
// on the one reading that most needs a colour.
const SITE_STATE = {
  operational: { label: 'Up', tone: 'good', card: 'good', dot: 'bg-[color:var(--good-fill)]' },
  degraded: { label: 'Issue', tone: 'warn', card: 'warn', dot: 'bg-[color:var(--warn-fill)]' },
  outage: { label: 'Down', tone: 'bad', card: 'danger', dot: 'bg-[color:var(--danger-fill)]' },
}

/** Where an issue has got to. A fault under investigation and one with a fix
 *  being written are the same condition to anyone reading the board, so they
 *  share a tone and are told apart by the word. */
const INCIDENT_STATE = {
  investigating: { label: 'Investigating', tone: 'warn' },
  identified: { label: 'Fix In Progress', tone: 'warn' },
  resolved: { label: 'Resolved', tone: 'good' },
}

const OPEN_ISSUES_SHOWN = 5

// Where each of this board's tables keeps the shape of its last render. The
// mechanism is shared with the console's own tables; only the keys are local.
const REMEMBERED = {
  sites: 'taylorurl_status_sites',
  open: 'taylorurl_status_open',
  fixed: 'taylorurl_status_fixed',
}

// The placeholder rows carry the cells' own measure, so a table waits at the
// width it lands at rather than at the console's wider gutter.
const SITE_CELLS = Array.from({ length: 4 }, () => CELL_TIGHT)
const ISSUE_CELLS = [CELL_TIGHT]
const FIXED_CELLS = Array.from({ length: 2 }, () => CELL_TIGHT)

// The board is one company's account of its own sites, so the hour an outage
// opened at is the hour it was in Texas. A visitor reading it from another zone
// is being told when the studio saw it, not when their own evening was.
function formatClock(date) {
  if (!date) return ''
  const at = clockIn(date)
  if (!at) return ''
  const hour = at.hour % 12 || 12
  const minute = at.minute.toString().padStart(2, '0')
  return `${hour}:${minute} ${at.hour >= 12 ? 'PM' : 'AM'}`
}

/** How long ago, in the coarsest unit that still says something useful. */
function relative(from, now) {
  if (!from) return ''
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** A clock that ticks, so "3 min ago" does not sit there saying "just now". */
function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function formatDay(value) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString('en-US', { timeZone: ZONE, month: 'short', day: 'numeric' })
}

function formatWhen(value) {
  const date = new Date(value)
  return `${formatDay(date)} ${formatClock(date)}`
}

function dayTone(day) {
  // A day before this site came under watch carries a figure nobody measured;
  // drawing it in the healthy colour would claim uptime that was never seen.
  if (day.measured === false) return 'bg-[color:var(--paper-hairline)]'
  const uptime = day.uptime
  if (uptime >= 99.9) return 'bg-[color:var(--good-fill)]'
  if (uptime >= 95) return 'bg-[color:var(--warn-fill)]'
  return 'bg-[color:var(--danger-fill)]'
}

function measuredLabel(measuredSince, windowDays) {
  if (!measuredSince) return `${windowDays}-day history`
  const started = new Date(measuredSince)
  const days = (Date.now() - started) / 86400000
  return days >= windowDays ? `${windowDays}-day history` : `watched since ${formatDay(started)}`
}

/**
 * The span the strip actually covers: the longest run of measured days any site
 * has, never the nominal window.
 *
 * A window of thirty against a week of watching draws twenty-three empty slots
 * on every row and squeezes the real figures into the last fifth of the column.
 * Trimming to the longest real run keeps every row on the same dates, so a site
 * that came under watch later still reads as later rather than as a gap.
 */
function measuredSpan(sites, windowDays) {
  const longest = sites.reduce(
    (most, site) => Math.max(most, (site.days || []).filter(d => d.measured !== false).length),
    0
  )
  return Math.min(windowDays, Math.max(1, longest))
}

function UptimeStrip({ days, span }) {
  if (!days?.length) return null
  const shown = span ? days.slice(-span) : days
  return (
    <div className="flex h-4 items-end gap-px" aria-hidden="true">
      {shown.map(day => (
        <span
          key={day.date}
          title={
            day.measured === false
              ? `${formatDay(day.date)}: not watched yet`
              : `${formatDay(day.date)}: ${(day.uptime ?? 100).toFixed(2)}%`
          }
          className={`inline-block w-[5px] flex-1 rounded ${dayTone(day)}`}
          style={{
            height: day.measured === false ? '20%' : `${Math.max(25, day.uptime ?? 100)}%`,
            opacity: day.measured === false ? 0.6 : (day.uptime ?? 100) >= 99.9 ? 0.85 : 1,
          }}
        />
      ))}
    </div>
  )
}

/**
 * An issue's state, in the console's own badge.
 *
 * The word keeps its line whatever the column does with it: "Fix In Progress"
 * broken over two rows in a right-hand column reads as two states rather than
 * one.
 */
function StatusChip({ status }) {
  const cfg = INCIDENT_STATE[status] || INCIDENT_STATE.investigating
  return (
    <Badge tone={cfg.tone}>
      <span className="whitespace-nowrap">{cfg.label}</span>
    </Badge>
  )
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function humanizeDuration(ms) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${Math.max(1, minutes)}m`
  const hours = minutes / 60
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

/**
 * The window's own account of its issues: how many were reported, how many
 * were fixed, and how long a fix typically took.
 *
 * They close the fixed list rather than standing in a card of their own. Three
 * figures are a reading of the rows above them, and a card holding three
 * figures and nothing else is a head over a foot.
 */
function windowReadings(incidents) {
  let opened = 0
  let fixed = 0
  const fixDurations = []
  for (const incident of incidents) {
    opened += 1
    if (incident.status !== 'resolved') continue
    fixed += 1
    if (incident.resolved_at) {
      fixDurations.push(new Date(incident.resolved_at) - new Date(incident.opened_at))
    }
  }
  return { opened, fixed, typicalFix: median(fixDurations) }
}

/** One figure of the window, in the block a card closes on. */
function Reading({ label, value, loading }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className={`${MONO_LABEL} text-paper-faint`}>{label}</span>
      {loading ? (
        <SkeletonBar className="w-10" />
      ) : (
        <span className="font-mono text-[13px] tabular-nums text-ink-paper">{value}</span>
      )}
    </span>
  )
}

/**
 * The status board itself: the four figures, the site table, and the open and
 * fixed issue tables.
 *
 * It is the one section of the console anyone may read, signed in or not, and
 * the two audiences see the same board. The caller supplies the feed and the
 * chrome around it.
 *
 * The table is the board's reading - a column of sixteen dots and the strip
 * beside each - so it takes the left and the whole height, and the sites past
 * the bottom move inside it under their own column heads. The issues stand
 * beside it in a column a third of the width, each one an entry rather than a
 * row of cells, and the open card is sized to what it holds: it is empty
 * nearly always, and a card held at half the column for one sentence is a
 * column half spent on nothing, so the fixed list takes whatever the open one
 * leaves.
 *
 * @param {{data: object|null, error: Error|null, loading: boolean}} feed
 *   the result of useStatusFeed, read by the caller so one mount polls once
 * @param {string|null} [scope]
 *   the bare host of the site in scope, or nothing for every site at once. The
 *   monitor keeps its own ids and names a site in an incident by a string, so
 *   the row is found on the domain first and its incidents taken by every name
 *   that row goes by.
 */
export function StatusBoard({ feed, scope }) {
  const { data, error, loading } = feed
  const now = useNow(10_000)
  const [showAllOpen, setShowAllOpen] = useState(false)
  const siteBody = useRef(null)
  const openBody = useRef(null)
  const fixedBody = useRef(null)
  // The count is what the monitor currently watches. It moves when a site is
  // taken on rather than with anything a reader does, so a first visit reserves
  // the table it is about to be shown instead of half of it.
  const siteSkeleton = recalledRows(REMEMBERED.sites, 15, ROW_HEIGHT.statusSite)
  const openSkeleton = recalledRows(REMEMBERED.open, 1, ROW_HEIGHT.statusIssue)
  const fixedSkeleton = recalledRows(REMEMBERED.fixed, 4, ROW_HEIGHT.statusFixed)

  const watched = useMemo(
    () =>
      scope
        ? (data?.sites || []).find(row =>
            [row.domain, ...(row.domains || [])].some(host => bareDomain(host) === scope)
          ) || null
        : null,
    [data, scope]
  )
  // Every name the monitor might file an incident under for this site, in the
  // one form both sides are compared in.
  const aliases = useMemo(() => {
    if (!watched) return null
    const names = new Set()
    for (const value of [watched.name, watched.domain, ...(watched.domains || [])]) {
      if (!value) continue
      names.add(String(value).trim().toLowerCase())
      names.add(bareDomain(value))
    }
    return names
  }, [watched])

  const sites = scope ? (watched ? [watched] : []) : data?.sites || []
  const incidents = useMemo(() => {
    const all = data?.incidents || []
    if (!aliases) return all
    return all.filter(
      entry =>
        aliases.has(
          String(entry.site || '')
            .trim()
            .toLowerCase()
        ) || aliases.has(bareDomain(entry.site))
    )
  }, [data, aliases])
  const openIncidents = useMemo(() => incidents.filter(i => i.status !== 'resolved'), [incidents])
  // One fault reaches the collector once per browser that hit it, so a single
  // broken page arrives as several incidents carrying the same sentence and
  // resolving seconds apart. Read one at a time they are the same line four
  // times over. They are folded into one row against the site and the summary,
  // keeping the earliest opening and the latest resolution so the time the
  // fault was actually open is the span across every report of it, and the
  // count of reports rides along.
  const resolvedIncidents = useMemo(() => {
    const folded = new Map()
    for (const incident of incidents) {
      if (incident.status !== 'resolved') continue
      const key = `${incident.site}\u0000${incident.summary}`
      const held = folded.get(key)
      if (!held) {
        folded.set(key, { ...incident, reports: 1 })
        continue
      }
      held.reports += 1
      if (incident.opened_at < held.opened_at) held.opened_at = incident.opened_at
      if ((incident.resolved_at || '') > (held.resolved_at || '')) {
        held.resolved_at = incident.resolved_at
      }
    }
    return [...folded.values()]
      .sort((a, b) => (b.resolved_at || '').localeCompare(a.resolved_at || ''))
      .slice(0, 15)
  }, [incidents])
  const readings = useMemo(() => windowReadings(incidents), [incidents])
  const visibleOpenIncidents = showAllOpen
    ? openIncidents
    : openIncidents.slice(0, OPEN_ISSUES_SHOWN)
  const hiddenOpenCount = openIncidents.length - visibleOpenIncidents.length
  // A site with an open issue is still answering; only one that stopped
  // responding is missing from this count.
  const upCount = sites.filter(s => s.status !== 'outage').length
  const averageUptime = sites.length
    ? sites.reduce((sum, s) => sum + (s.uptime_30d ?? 100), 0) / sites.length
    : null
  const windowDays = data?.window_days || 30
  // Before any row has landed there is no run to measure, and the column head
  // names the window rather than a span of one day.
  const span = sites.length ? measuredSpan(sites, windowDays) : windowDays
  const feedDown = error && !data
  const state = watched ? SITE_STATE[watched.status] || SITE_STATE.operational : null
  // A site the console tracks and the monitor does not is not a site that is
  // down. Drawing the empty board over it would say the opposite.
  const unwatched = Boolean(scope) && !watched && !loading && Boolean(data)

  // Measured once the real rows are on screen, for the next visit's placeholder.
  useEffect(() => {
    if (loading) return
    rememberRows(REMEMBERED.sites, siteBody.current)
    rememberRows(REMEMBERED.open, openBody.current)
    rememberRows(REMEMBERED.fixed, fixedBody.current)
  }, [loading, data])

  if (unwatched) {
    return (
      <ConsolePage rows="auto">
        <Panel title="Not Watched">
          <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
            The uptime monitor does not check this site, so there is nothing to report on it here.
            Its traffic is in every other section.
          </p>
        </Panel>
      </ConsolePage>
    )
  }

  return (
    <ConsolePage
      areas={['figures figures', 'sites issues']}
      cols="minmax(0,2fr) minmax(24rem,1fr)"
      rows="auto minmax(0,1fr)"
    >
      <Area area="figures">
        <m.div {...fadeInUp} className="console-stats" aria-busy={loading}>
          {state ? (
            <StatCard
              label="Answering"
              value={feedDown ? '—' : state.label}
              caption="checked from outside"
              loading={loading}
              tone={feedDown ? 'plain' : state.card}
            />
          ) : (
            <StatCard
              label="Sites Up"
              value={feedDown ? '—' : `${upCount}/${sites.length}`}
              caption="answering right now"
              loading={loading}
              tone={feedDown || upCount === sites.length ? 'plain' : 'danger'}
            />
          )}
          <StatCard
            label="Open Issues"
            value={feedDown ? '—' : String(openIncidents.length)}
            caption="not fixed yet"
            loading={loading}
            tone={!feedDown && openIncidents.length ? 'warn' : 'plain'}
          />
          <StatCard
            label="Uptime"
            value={averageUptime === null ? '—' : `${averageUptime.toFixed(2)}%`}
            caption={
              watched
                ? measuredLabel(data?.measured_since, windowDays)
                : `all sites · ${measuredLabel(data?.measured_since, windowDays)}`
            }
            loading={loading}
          />
          {/* The outage count the monitor publishes is the portfolio's, and it
              answers for no single site. Over one site the window's own reports
              are the figure the feed can stand behind. */}
          {watched ? (
            <StatCard
              label="Reported"
              value={data ? String(incidents.length) : '—'}
              caption={`issues raised · last ${span} days`}
              loading={loading}
              tone={incidents.length ? 'warn' : 'plain'}
            />
          ) : (
            <StatCard
              label="Outages"
              value={data ? String(data.outages_30d ?? 0) : '—'}
              caption={`stopped answering · ${measuredLabel(data?.measured_since, windowDays)}`}
              loading={loading}
              tone={data?.outages_30d ? 'danger' : 'plain'}
            />
          )}
        </m.div>
      </Area>

      <Panel
        area="sites"
        title="Sites"
        aside={`${sites.length || '—'} monitored · ${measuredLabel(data?.measured_since, windowDays)}`}
        loading={loading}
      >
        {/* The table keeps a measure of its own below the desk width and moves
            sideways inside the card there; from the desk width up it is held
            to its column and the columns share the width, since the bars are
            the board's reading and a strip of them scrolled out of view is a
            board that says nothing. */}
        <PanelBody className="overflow-x-auto">
          <table className="console-table min-w-[40rem] text-[13px] lg:min-w-0">
            <thead>
              <tr>
                <th className={`${TH_TIGHT} w-[52%]`}>Site</th>
                <th className={`${TH_TIGHT} w-[20%]`}>Last {span} Days</th>
                <th className={`${TH_TIGHT} w-[15%] text-right`}>Uptime</th>
                <th className={`${TH_TIGHT} w-[13%] text-right`}>Status</th>
              </tr>
            </thead>
            <tbody ref={siteBody}>
              {loading ? (
                <SkeletonRows
                  cols={SITE_CELLS}
                  rows={siteSkeleton.rows}
                  height={siteSkeleton.height}
                  lastHeight={siteSkeleton.lastHeight}
                />
              ) : sites.length ? (
                sites.map(site => {
                  const cfg = SITE_STATE[site.status] || SITE_STATE.operational
                  const hosts = (site.domains?.length ? site.domains : [site.domain]).map(
                    displayDomain
                  )
                  return (
                    <tr key={site.id} className="border-hair-paper animate-fade-in-up border-t">
                      {/* The name over the host it answers on, in one cell.
                          Beside the strip and the two figures there is no
                          column wide enough for a hostname of its own, and a
                          name cut to "Dickinson B..." is a row that cannot be
                          found. A site on more than one host names them on the
                          one line, the first in the soft ink and the rest in
                          the faint, with the whole list in the cell's title. */}
                      <td className={CELL_TIGHT}>
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`}
                          />
                          {/* The board names a site the way its owner does -
                              "Baytown Go Karts" rather than a hostname - so the
                              mark is looked up on the first domain it answers
                              on, which is what the icon set is keyed by. */}
                          <SiteIcon host={apexOf(site)} name={site.name} />
                          <span className="min-w-0 leading-snug">
                            <span className="block truncate font-medium">{site.name}</span>
                            <span
                              className="block truncate font-mono text-[12px] text-paper-soft"
                              title={hosts.join(', ')}
                            >
                              {hosts.map((host, index) => (
                                <span key={host} className={index ? 'text-paper-faint' : undefined}>
                                  {index ? ' · ' : ''}
                                  {host}
                                </span>
                              ))}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className={CELL_TIGHT}>
                        <UptimeStrip days={site.days} span={span} />
                      </td>
                      <td className={`${CELL_TIGHT} text-right font-mono tabular-nums`}>
                        {site.uptime_30d?.toFixed(2)}%
                      </td>
                      <td className={`${CELL_TIGHT} text-right`}>
                        <Badge tone={cfg.tone}>
                          <span aria-label={`${site.name} is ${cfg.label.toLowerCase()}`}>
                            {cfg.label}
                          </span>
                        </Badge>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <EmptyRow cols={4}>
                  The status feed is not answering. This page keeps retrying on its own.
                </EmptyRow>
              )}
            </tbody>
          </table>
        </PanelBody>
      </Panel>

      <Area area="issues">
        <Panel
          title="Open Issues"
          aside={loading || feedDown ? '' : `${openIncidents.length} open`}
          busy={loading}
          className="min-h-0 lg:max-h-[55%]"
        >
          {/* An issue is one entry: the site and its state on the first line,
              what happened under it, and when. In a column this narrow a site
              column beside the account of the fault leaves each with a third
              of the width, and a sentence wrapped six deep in a third of a
              card is a card that shows two issues of the seven it holds. */}
          <PanelBody>
            <table className="console-table text-[13px]">
              <thead>
                <tr>
                  <th className={TH_TIGHT}>What Happened</th>
                </tr>
              </thead>
              <tbody ref={openBody}>
                {loading ? (
                  <SkeletonRows
                    cols={ISSUE_CELLS}
                    rows={openSkeleton.rows}
                    height={openSkeleton.height}
                    lastHeight={openSkeleton.lastHeight}
                  />
                ) : feedDown ? (
                  <EmptyRow cols={1}>Waiting on the status feed to come back.</EmptyRow>
                ) : openIncidents.length ? (
                  visibleOpenIncidents.map(incident => (
                    <tr key={incident.id} className="border-hair-paper animate-fade-in-up border-t">
                      <td className={CELL_TIGHT}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate font-medium">{incident.site}</p>
                          <StatusChip status={incident.status} />
                        </div>
                        <p className="mt-1">{incident.title}</p>
                        <p className="mt-1 leading-relaxed text-paper-soft">{incident.summary}</p>
                        <p className={`${MONO_LABEL} text-paper-faint mt-1.5 font-mono`}>
                          {formatWhen(incident.opened_at)} ·{' '}
                          {relative(new Date(incident.opened_at), now)}
                        </p>
                        {incident.updates?.length > 1 && (
                          <p className={`${MONO_LABEL} text-paper-faint mt-1 font-mono`}>
                            {formatWhen(incident.updates[incident.updates.length - 1].at)} ·{' '}
                            {incident.updates[incident.updates.length - 1].text}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow cols={1}>
                    Nothing open. New reports show up here as they come in.
                  </EmptyRow>
                )}
              </tbody>
            </table>
          </PanelBody>
          {(hiddenOpenCount > 0 || showAllOpen) && (
            <button
              className={`border-hair-paper min-h-[44px] w-full flex-shrink-0 cursor-pointer touch-manipulation border-t px-5 py-2.5 text-left text-accent transition-colors duration-150 ease-out-soft hover:bg-[color:var(--console-row-hover)] hover:text-[color:var(--accent-hi)] active:bg-[color:var(--paper-hairline)] ${MONO_LABEL}`}
              type="button"
              onClick={() => setShowAllOpen(open => !open)}
              aria-expanded={showAllOpen}
            >
              {showAllOpen ? 'Show Fewer' : `Show ${hiddenOpenCount} More`}
            </button>
          )}
        </Panel>

        <Panel
          title="Recently Fixed"
          aside={loading || feedDown ? '' : `last ${span} days`}
          busy={loading}
          className="min-h-0 lg:flex-1"
        >
          {/* The same entry, closed: the site with the hour it was fixed at
              against it, what was fixed beneath, and the time the fault stood
              open as the one figure of its own. The hour drops under the name
              when the two will not share a line, rather than the name being
              cut to make room. */}
          <PanelBody>
            <table className="console-table text-[13px]">
              <thead>
                <tr>
                  <th className={`${TH_TIGHT} w-[76%]`}>What Was Fixed</th>
                  <th className={`${TH_TIGHT} w-[24%] text-right`}>Open For</th>
                </tr>
              </thead>
              <tbody ref={fixedBody}>
                {loading ? (
                  <SkeletonRows
                    cols={FIXED_CELLS}
                    rows={fixedSkeleton.rows}
                    height={fixedSkeleton.height}
                    lastHeight={fixedSkeleton.lastHeight}
                  />
                ) : feedDown ? (
                  <EmptyRow cols={2}>Waiting on the status feed to come back.</EmptyRow>
                ) : resolvedIncidents.length ? (
                  resolvedIncidents.map(incident => (
                    <tr
                      key={incident.id}
                      className="border-hair-paper animate-fade-in-up border-t align-top"
                    >
                      <td className={CELL_TIGHT}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="font-medium">{incident.site}</p>
                          <p
                            className={`${MONO_LABEL} text-paper-faint ml-auto whitespace-nowrap font-mono`}
                          >
                            {formatWhen(incident.resolved_at || incident.opened_at)}
                          </p>
                        </div>
                        <p className="mt-1 leading-relaxed text-paper-soft">
                          {incident.summary}
                          {incident.reports > 1 && (
                            <span
                              className={`${MONO_LABEL} text-paper-faint ml-2 whitespace-nowrap font-mono`}
                            >
                              {incident.reports} reports
                            </span>
                          )}
                        </p>
                      </td>
                      <td
                        className={`${CELL_TIGHT} whitespace-nowrap text-right font-mono text-paper-soft`}
                      >
                        {incident.resolved_at
                          ? relative(
                              new Date(incident.opened_at),
                              new Date(incident.resolved_at)
                            ).replace(' ago', '')
                          : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow cols={2}>No issues were fixed in this window.</EmptyRow>
                )}
              </tbody>
            </table>
          </PanelBody>
          <PanelFoot>
            <Reading label="Reported" value={feedDown ? '—' : readings.opened} loading={loading} />
            <Reading label="Fixed" value={feedDown ? '—' : readings.fixed} loading={loading} />
            <Reading
              label="Typical Fix"
              value={
                feedDown || readings.typicalFix === null
                  ? '—'
                  : humanizeDuration(readings.typicalFix)
              }
              loading={loading}
            />
          </PanelFoot>
        </Panel>
      </Area>
    </ConsolePage>
  )
}
