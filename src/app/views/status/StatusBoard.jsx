import { useEffect, useMemo, useRef, useState } from 'react'
import { TYPE } from '@components/kit/styles'
import { Area, ConsolePage } from '../console/ui'
import { ROW_HEIGHT } from '../console/lib/tokens'
import { recalledRows, rememberRows } from '../console/lib/rowMemory'
import { bareDomain, displayDomain } from '@utils/domains'
import { ago, useNow } from '@hooks/console/useNow'
import { SiteIcon } from '../console/SiteIcon'
import { clockIn, ZONE } from '@lib/time/zone.js'

/*
 * The public status board, in the site's "Refined" look: a panel of four
 * figures, every site as a row in one card with a dot and a word saying whether
 * it answers, and the open and recently fixed issues beside it.
 *
 * It only ever renders inside the console, which carries a light palette and a
 * dark one, so every colour here is one of the console's own tokens rather
 * than the public site's: a card is `bg-paper`, a wash is `--wash-paper`, and
 * the three states are the console's good, warn and danger. Nothing is drawn
 * with an outline; a card is told apart from the ground by its fill.
 */

/** A card: the console's own surface, soft corners, no outline. */
const CARD = 'rounded-[16px] bg-paper'

/** The host a site's mark is filed under: the first domain it answers on. */
function apexOf(site) {
  return bareDomain(site.domains?.length ? site.domains[0] : site.domain)
}

/**
 * The three states a site is in, as a word, the dot beside it and the ink of
 * the word. A site that answers is settled, so it takes the green.
 */
const SITE_STATE = {
  operational: {
    label: 'Up',
    dot: 'bg-[color:var(--good-fill)]',
    ink: 'text-[color:var(--good)]',
  },
  degraded: {
    label: 'Issue',
    dot: 'bg-[color:var(--warn-fill)]',
    ink: 'text-[color:var(--warn)]',
  },
  outage: {
    label: 'Down',
    dot: 'bg-[color:var(--danger-fill)]',
    ink: 'text-[color:var(--danger)]',
  },
}

/** The ink a figure takes when it is the thing wrong on the board. */
const FIGURE_INK = {
  plain: '',
  good: 'text-[color:var(--good)]',
  warn: 'text-[color:var(--warn)]',
  danger: 'text-[color:var(--danger)]',
}

/** Where an issue has got to. A fault under investigation and one with a fix
 *  being written are the same condition to anyone reading the board, so they
 *  share a tone and are told apart by the word. */
const INCIDENT_STATE = {
  investigating: { label: 'Investigating', tone: 'warn' },
  identified: { label: 'Fix in progress', tone: 'warn' },
  resolved: { label: 'Resolved', tone: 'good' },
}

const CHIP_TONE = {
  warn: 'bg-[color:color-mix(in_srgb,var(--warn-fill)_16%,transparent)] text-[color:var(--warn)]',
  good: 'bg-[color:color-mix(in_srgb,var(--good-fill)_16%,transparent)] text-[color:var(--good)]',
}

const OPEN_ISSUES_SHOWN = 5

// Where each of this board's lists keeps the shape of its last render. The
// mechanism is shared with the console's own tables; only the keys are local.
const REMEMBERED = {
  sites: 'taylorurl_status_sites',
  open: 'taylorurl_status_open',
  fixed: 'taylorurl_status_fixed',
}

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

function formatDay(value) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString('en-US', { timeZone: ZONE, month: 'short', day: 'numeric' })
}

function formatWhen(value) {
  const date = new Date(value)
  return `${formatDay(date)} ${formatClock(date)}`
}

function dayTone(day) {
  // A day before this site came under watch is grey. It is the one tone in the
  // strip that is not a reading: three colours for what the monitor saw, and a
  // fourth for the days it was not there for.
  if (day.measured === false) return 'bg-[color:var(--wash-paper-strong)]'
  const uptime = day.uptime
  if (uptime >= 99.9) return 'bg-[color:var(--good-fill)]'
  if (uptime >= 95) return 'bg-[color:var(--warn-fill)]'
  return 'bg-[color:var(--danger-fill)]'
}

/** Whether the history is as long as the window yet. */
function measuredLabel(measuredSince, windowDays) {
  if (!measuredSince) return `${windowDays}-day history`
  const started = new Date(measuredSince)
  const days = (Date.now() - started) / 86400000
  return days >= windowDays ? `${windowDays}-day history` : `watched since ${formatDay(started)}`
}

/**
 * The window the counts and the percentage are taken over, from the feed, with
 * its unit, because it is read straight into a sentence - "fixed in 30 days".
 */
function windowSpan(windowDays) {
  const days = Math.max(1, windowDays)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * How many days the strip draws, which is not the window the figures cover.
 * Ninety marks fill a row, which is what a history is supposed to look like.
 */
const STRIP_DAYS = 90

/**
 * The strip's days: the feed's, padded at the front to `STRIP_DAYS` with days
 * marked unmeasured, which is what they are, and cut from the front when there
 * are more, so every row on the board is the same run of dates.
 */
function stripDays(days) {
  if (!days?.length) return days
  if (days.length >= STRIP_DAYS) return days.slice(-STRIP_DAYS)
  const first = new Date(`${days[0].date}T00:00:00Z`)
  const pad = []
  for (let back = STRIP_DAYS - days.length; back > 0; back -= 1) {
    const day = new Date(first)
    day.setUTCDate(day.getUTCDate() - back)
    pad.push({ date: day.toISOString().slice(0, 10), uptime: null, measured: false })
  }
  return pad.concat(days)
}

/**
 * A day per mark, at one height, told apart by colour alone. The strip is as
 * wide as its days make it and keeps its right edge when the row is too narrow,
 * so what survives a phone is the recent end: today is the day a reader wants.
 */
function UptimeStrip({ days, className = '' }) {
  if (!days?.length) return null
  const shown = stripDays(days)
  return (
    <div
      className={`flex h-4 w-fit max-w-full items-stretch justify-end gap-[2px] overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {shown.map(day => (
        <span
          key={day.date}
          title={`${formatDay(day.date)}: ${(day.uptime ?? 100).toFixed(2)}%`}
          className={`inline-block w-[5px] flex-none rounded-[2px] ${dayTone(day)}`}
        />
      ))}
    </div>
  )
}

/** A still placeholder bar, where a figure or a line will land. */
function Placeholder({ className = '' }) {
  return (
    <span
      className={`block rounded-[6px] bg-[color:var(--wash-paper-strong)] ${className}`}
      aria-hidden="true"
    />
  )
}

/**
 * Placeholder rows in the shape of the entries they stand in for, at the
 * height the last visit measured, so the card opens at the size it lands at.
 */
function PlaceholderRows({ rows, height, lastHeight, lines = 2 }) {
  return Array.from({ length: rows }).map((_, row) => (
    <li
      key={row}
      className="px-3 py-3"
      style={{ height: row === rows - 1 ? lastHeight : height }}
      aria-hidden="true"
    >
      <Placeholder className="h-4 w-full max-w-[11rem]" />
      {lines > 1 && <Placeholder className="mt-2.5 h-4 w-full" />}
    </li>
  ))
}

/** An issue's state as a small filled pill, kept on one line. */
function StatusChip({ status }) {
  const cfg = INCIDENT_STATE[status] || INCIDENT_STATE.investigating
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium leading-none ${CHIP_TONE[cfg.tone]}`}
    >
      {cfg.label}
    </span>
  )
}

/** What a list says when it has nothing to show, centred in its card. */
function Quiet({ children }) {
  return <li className={`${TYPE.small} px-3 py-10 text-center`}>{children}</li>
}

/**
 * One of the board's cards: a heading with a short line across from it, and a
 * body that scrolls inside the card at the desk width, where the page is the
 * height of the screen.
 */
function Card({ area, title, aside, className = '', children, foot }) {
  return (
    <section
      aria-label={title}
      className={`${CARD} flex min-h-0 flex-col ${className}`}
      style={area ? { '--area': area } : undefined}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-2 pt-5 sm:px-6">
        <h2 className={TYPE.h3}>{title}</h2>
        {aside && <p className={TYPE.small}>{aside}</p>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 sm:px-3">{children}</div>
      {foot}
    </section>
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

/** The four figures across one panel, each waiting for the feed before it says anything. */
function FigurePanel({ figures, loading }) {
  return (
    <dl
      className={`${CARD} grid grid-cols-2 gap-x-6 gap-y-6 px-6 py-6 sm:px-8 lg:grid-cols-4`}
      aria-busy={loading || undefined}
    >
      {figures.map(({ key, label, value, tone = 'plain' }) => (
        <div key={key} className="min-w-0">
          <dt className="sr-only">{label}</dt>
          <dd>
            {loading ? (
              <Placeholder className="h-6 w-16" />
            ) : (
              <span
                className={`${tone === 'plain' ? TYPE.figure : `${TYPE.figure.replace(/\btext-ink\b/, '')} ${FIGURE_INK[tone]}`} block`}
              >
                {value}
              </span>
            )}
            <span className={`${TYPE.small} mt-2 block`}>{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The status board itself: the four figures, every site the monitor watches,
 * and the open and recently fixed issues.
 *
 * It is the one section of the console anyone may read, signed in or not, and
 * the two audiences see the same board. The caller supplies the feed and the
 * chrome around it.
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
  // the list it is about to be shown instead of half of it.
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

  const sites = useMemo(
    () => (scope ? (watched ? [watched] : []) : data?.sites || []),
    [scope, watched, data]
  )
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
  // resolving seconds apart. They are folded into one row against the site and
  // the summary, keeping the earliest opening and the latest resolution so the
  // time the fault was actually open is the span across every report of it,
  // and the count of reports rides along.
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
  const span = windowSpan(windowDays)
  const feedDown = error && !data
  const state = watched ? SITE_STATE[watched.status] || SITE_STATE.operational : null
  const measured = measuredLabel(data?.measured_since, windowDays)
  // A site the console tracks and the monitor does not is not a site that is
  // down. Drawing the empty board over it would say the opposite.
  const unwatched = Boolean(scope) && !watched && !loading && Boolean(data)

  /**
   * The board's four figures. The window each is taken over is named on its
   * label, and a history shorter than the window says when it started rather
   * than claiming a month of measurement that is not there.
   */
  const boardFigures = useMemo(() => {
    const down = Math.max(0, sites.length - upCount)
    const outages = data?.outages_30d ?? 0
    const since = measured.startsWith('watched since') ? measured.replace('watched ', '') : null
    const over = since || `last ${span}`

    const answering = state
      ? {
          key: 'up',
          label: 'Status',
          value: feedDown ? '—' : state.label,
          tone: feedDown ? 'plain' : watched.status === 'outage' ? 'danger' : 'good',
        }
      : {
          key: 'up',
          label: 'Sites up',
          value: feedDown ? '—' : `${upCount}/${sites.length}`,
          tone: feedDown || !down ? 'plain' : 'danger',
        }

    return [
      answering,
      {
        key: 'issues',
        label: 'Open issues',
        value: feedDown ? '—' : String(openIncidents.length),
        tone: !feedDown && openIncidents.length ? 'warn' : 'plain',
      },
      {
        key: 'uptime',
        label: `Uptime, ${over}`,
        value: averageUptime === null ? '—' : `${averageUptime.toFixed(2)}%`,
      },
      watched
        ? {
            key: 'reported',
            label: `Issues reported, last ${span}`,
            value: data ? String(incidents.length) : '—',
            tone: incidents.length ? 'warn' : 'plain',
          }
        : {
            key: 'outages',
            label: `Outages, ${over}`,
            value: data ? String(outages) : '—',
            tone: outages ? 'danger' : 'plain',
          },
    ]
  }, [
    averageUptime,
    data,
    feedDown,
    incidents.length,
    measured,
    openIncidents,
    sites,
    span,
    state,
    upCount,
    watched,
  ])

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
        <Card title="Not watched">
          <p className={`${TYPE.body} px-3 pb-6 pt-2`}>
            The uptime monitor does not check this site, so there is nothing to report on it here.
            Its traffic is in every other section.
          </p>
        </Card>
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
        <FigurePanel figures={boardFigures} loading={loading} />
      </Area>

      <Card
        area="sites"
        title="Sites"
        aside={loading || feedDown ? '' : `${sites.length} monitored · ${measured}`}
      >
        <ul ref={siteBody}>
          {loading ? (
            <PlaceholderRows
              rows={siteSkeleton.rows}
              height={siteSkeleton.height}
              lastHeight={siteSkeleton.lastHeight}
            />
          ) : sites.length ? (
            sites.map(site => {
              const cfg = SITE_STATE[site.status] || SITE_STATE.operational
              const hosts = (site.domains?.length ? site.domains : [site.domain]).map(displayDomain)
              return (
                <li
                  key={site.id}
                  className="rounded-[12px] px-3 py-3 transition-colors duration-150 hover:bg-[color:var(--wash-paper)]"
                >
                  <div className="flex items-center gap-3 text-[15px]">
                    {/* The board names a site the way its owner does, so the
                        mark is looked up on the first domain it answers on,
                        which is what the icon set is keyed by. */}
                    <SiteIcon host={apexOf(site)} name={site.name} className="!shadow-none" />
                    {/* The host tells two sites of a similar name apart. On a
                        phone it drops under the name, so the name keeps its
                        room. */}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
                      <span className="truncate font-medium text-ink">{site.name}</span>
                      <span className="truncate text-[13px] text-ink-mute" title={hosts.join(', ')}>
                        {hosts.join(' · ')}
                      </span>
                    </span>
                    <span className="hidden shrink-0 whitespace-nowrap text-[13px] text-ink-mute sm:inline">
                      {site.uptime_30d?.toFixed(2)}%
                    </span>
                    <span
                      className={`flex w-[4.25rem] shrink-0 items-center justify-end gap-2 text-[14px] font-medium ${cfg.ink}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${cfg.dot}`}
                      />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="mt-2.5 pl-[34px]">
                    <UptimeStrip days={site.days} />
                  </div>
                </li>
              )
            })
          ) : (
            <Quiet>The status feed is not answering. This page keeps retrying on its own.</Quiet>
          )}
        </ul>
      </Card>

      <Area area="issues">
        <Card
          title="Open issues"
          aside={loading || feedDown ? '' : `${openIncidents.length} open`}
          className="lg:max-h-[55%]"
          foot={
            hiddenOpenCount > 0 || showAllOpen ? (
              <div className="px-5 pb-5 sm:px-6">
                <button
                  className="min-h-[44px] cursor-pointer touch-manipulation text-[15px] font-medium text-[color:var(--accent)] transition-colors duration-150 hover:text-ink"
                  type="button"
                  onClick={() => setShowAllOpen(open => !open)}
                  aria-expanded={showAllOpen}
                >
                  {showAllOpen ? 'Show Fewer' : `Show ${hiddenOpenCount} More`}
                </button>
              </div>
            ) : null
          }
        >
          {/* An issue is one entry: the site and its state on the first line,
              what happened under it, and when. */}
          <ul ref={openBody}>
            {loading ? (
              <PlaceholderRows
                rows={openSkeleton.rows}
                height={openSkeleton.height}
                lastHeight={openSkeleton.lastHeight}
              />
            ) : feedDown ? (
              <Quiet>Waiting on the status feed to come back.</Quiet>
            ) : openIncidents.length ? (
              visibleOpenIncidents.map(incident => (
                <li key={incident.id} className="rounded-[12px] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[15px] font-medium text-ink">
                      {incident.site}
                    </p>
                    <StatusChip status={incident.status} />
                  </div>
                  <p className="mt-1 text-[14px] text-ink">{incident.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                    {incident.summary}
                  </p>
                  <p className={`${TYPE.small} mt-1.5`}>
                    {formatWhen(incident.opened_at)} · {ago(new Date(incident.opened_at), now)}
                  </p>
                  {incident.updates?.length > 1 && (
                    <p className={`${TYPE.small} mt-1`}>
                      {formatWhen(incident.updates[incident.updates.length - 1].at)} ·{' '}
                      {incident.updates[incident.updates.length - 1].text}
                    </p>
                  )}
                </li>
              ))
            ) : (
              <Quiet>Nothing open. New reports show up here as they come in.</Quiet>
            )}
          </ul>
        </Card>

        <Card
          title="Recently fixed"
          aside={loading || feedDown ? '' : `Last ${span}`}
          className="lg:flex-1"
          foot={
            <dl className="mx-3 mb-3 grid grid-cols-3 gap-3 rounded-[12px] bg-[color:var(--wash-paper)] px-4 py-3 sm:mx-4 sm:mb-4">
              {[
                ['Reported', feedDown ? '—' : String(readings.opened)],
                ['Fixed', feedDown ? '—' : String(readings.fixed)],
                [
                  'Typical fix',
                  feedDown || readings.typicalFix === null
                    ? '—'
                    : humanizeDuration(readings.typicalFix),
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className={TYPE.small}>{label}</dt>
                  <dd className="mt-0.5 text-[16px] font-medium tabular-nums text-ink">
                    {loading ? <Placeholder className="h-4 w-10" /> : value}
                  </dd>
                </div>
              ))}
            </dl>
          }
        >
          {/* The same entry, closed: the site with the hour it was fixed at
              against it, what was fixed beneath, and how long it stood open. */}
          <ul ref={fixedBody}>
            {loading ? (
              <PlaceholderRows
                rows={fixedSkeleton.rows}
                height={fixedSkeleton.height}
                lastHeight={fixedSkeleton.lastHeight}
              />
            ) : feedDown ? (
              <Quiet>Waiting on the status feed to come back.</Quiet>
            ) : resolvedIncidents.length ? (
              resolvedIncidents.map(incident => (
                <li key={incident.id} className="rounded-[12px] px-3 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[15px] font-medium text-ink">{incident.site}</p>
                    <p className={`${TYPE.small} ml-auto whitespace-nowrap`}>
                      {formatWhen(incident.resolved_at || incident.opened_at)}
                    </p>
                  </div>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                    {incident.summary}
                  </p>
                  <p className={`${TYPE.small} mt-1.5`}>
                    {incident.resolved_at
                      ? `Open for ${ago(
                          new Date(incident.opened_at),
                          new Date(incident.resolved_at)
                        ).replace(' ago', '')}`
                      : 'Open for —'}
                    {incident.reports > 1 && ` · ${incident.reports} reports`}
                  </p>
                </li>
              ))
            ) : (
              <Quiet>No issues were fixed in this window.</Quiet>
            )}
          </ul>
        </Card>
      </Area>
    </ConsolePage>
  )
}
