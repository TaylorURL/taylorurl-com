import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Radio, WifiOff } from 'lucide-react'
import Seo from '@components/Seo'
import { fadeInUp } from '@constants/animations'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { useStatusFeed } from '@hooks/useStatusFeed'

const SITE_STATE = {
  operational: { label: 'Up', dot: 'bg-accent', text: 'text-accent' },
  degraded: { label: 'Issue', dot: 'bg-amber-500', text: 'text-amber-600' },
  outage: { label: 'Down', dot: 'bg-red-500', text: 'text-red-500' },
}

const OVERALL = {
  operational: { label: 'All Clear', dot: 'bg-accent', ping: 'bg-accent/60', text: 'text-accent' },
  degraded: {
    label: 'Issue Being Worked',
    dot: 'bg-amber-500',
    ping: 'bg-amber-500/60',
    text: 'text-amber-600',
  },
  outage: { label: 'Outage', dot: 'bg-red-500', ping: 'bg-red-500/60', text: 'text-red-500' },
  unknown: {
    label: 'Checking',
    dot: 'bg-paper-soft',
    ping: 'bg-paper-soft/40',
    text: 'text-paper-soft',
  },
}

const INCIDENT_STATE = {
  investigating: {
    label: 'Investigating',
    tone: 'text-amber-600',
    chip: 'border-amber-500/40 bg-amber-500/10',
  },
  identified: {
    label: 'Fix In Progress',
    tone: 'text-amber-600',
    chip: 'border-amber-500/40 bg-amber-500/10',
  },
  resolved: { label: 'Resolved', tone: 'text-accent', chip: 'border-accent/40 bg-accent/10' },
}

const MONO_LABEL = 'font-mono text-[10px] uppercase tracking-[0.18em]'
const OPEN_ISSUES_SHOWN = 5
const TH = `${MONO_LABEL} text-paper-faint px-4 py-2.5 text-left font-medium`

function formatClock(date) {
  if (!date) return ''
  const hour24 = date.getHours()
  const hour = hour24 % 12 || 12
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${hour}:${minute} ${hour24 >= 12 ? 'PM' : 'AM'}`
}

function formatDay(value) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWhen(value) {
  const date = new Date(value)
  return `${formatDay(date)} ${formatClock(date)}`
}

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

function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function dayTone(day) {
  // A day before this site came under watch carries a figure nobody measured;
  // drawing it in the healthy colour would claim uptime that was never seen.
  if (day.measured === false) return 'bg-[color:var(--paper-hair)]'
  const uptime = day.uptime
  if (uptime >= 99.9) return 'bg-accent'
  if (uptime >= 95) return 'bg-amber-500'
  return 'bg-red-500'
}

function measuredLabel(measuredSince, windowDays) {
  if (!measuredSince) return `${windowDays}-day history`
  const started = new Date(measuredSince)
  const days = (Date.now() - started) / 86400000
  return days >= windowDays ? `${windowDays}-day history` : `watched since ${formatDay(started)}`
}

function Panel({ title, aside, children, className = '' }) {
  return (
    <motion.section
      {...fadeInUp}
      className={`border-hair-paper flex min-w-0 flex-col border bg-paper ${className}`}
    >
      <header className="border-hair-paper flex items-center justify-between gap-4 border-b px-4 py-2.5">
        <h2 className={`${MONO_LABEL} text-ink-paper`}>{title}</h2>
        {aside && <div className={`${MONO_LABEL} text-paper-faint`}>{aside}</div>}
      </header>
      {children}
    </motion.section>
  )
}

function Tile({ label, value, caption, tone = 'text-ink-paper', loading }) {
  return (
    <div className="border-hair-paper border bg-paper px-4 py-4">
      <p className={`${MONO_LABEL} text-paper-faint`}>{label}</p>
      <p className={`mt-2 font-mono text-[26px] font-semibold tabular-nums leading-none ${tone}`}>
        {loading ? (
          <span className="bg-paper-soft/15 inline-block h-[0.85em] w-[3ch] animate-pulse rounded-sm" />
        ) : (
          value
        )}
      </p>
      <p className={`${MONO_LABEL} mt-2 text-paper-soft`}>{caption}</p>
    </div>
  )
}

function UptimeStrip({ days }) {
  if (!days?.length) return null
  return (
    <div className="flex h-4 items-end gap-px" aria-hidden="true">
      {days.map(day => (
        <span
          key={day.date}
          title={
            day.measured === false
              ? `${formatDay(day.date)}: not watched yet`
              : `${formatDay(day.date)}: ${(day.uptime ?? 100).toFixed(2)}%`
          }
          className={`inline-block w-[5px] flex-1 rounded-[1px] ${dayTone(day)}`}
          style={{
            height: day.measured === false ? '20%' : `${Math.max(25, day.uptime ?? 100)}%`,
            opacity: day.measured === false ? 0.6 : (day.uptime ?? 100) >= 99.9 ? 0.85 : 1,
          }}
        />
      ))}
    </div>
  )
}

function SkeletonRows({ cols, rows }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r} className="border-hair-paper border-t">
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c} className="px-4 py-3">
          <span className="bg-paper-soft/15 block h-3 w-full max-w-[9rem] animate-pulse rounded-sm" />
        </td>
      ))}
    </tr>
  ))
}

function StatusChip({ status }) {
  const cfg = INCIDENT_STATE[status] || INCIDENT_STATE.investigating
  return (
    <span
      className={`${MONO_LABEL} inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-1 ${cfg.chip} ${cfg.tone}`}
    >
      {cfg.label}
    </span>
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
 * The 30-day breakdown beside the open-issue table. A bar per day reads as an
 * empty box here — most days carry no issues at all, and the column is a third
 * of the width — so the same window is shown as totals plus a ranked bar per
 * site, which stays legible whether one site reported or nine did.
 */
function Breakdown({ incidents, windowDays }) {
  const { rows, opened, fixed, stillOpen, typicalFix } = useMemo(() => {
    const counts = new Map()
    let openedCount = 0
    let fixedCount = 0
    let openCount = 0
    const fixDurations = []
    for (const incident of incidents) {
      openedCount += 1
      const entry = counts.get(incident.site) || { site: incident.site, total: 0, open: 0 }
      entry.total += 1
      if (incident.status === 'resolved') {
        fixedCount += 1
        if (incident.resolved_at) {
          fixDurations.push(new Date(incident.resolved_at) - new Date(incident.opened_at))
        }
      } else {
        entry.open += 1
        openCount += 1
      }
      counts.set(incident.site, entry)
    }
    const ranked = [...counts.values()].sort(
      (a, b) => b.total - a.total || a.site.localeCompare(b.site)
    )
    return {
      rows: ranked,
      opened: openedCount,
      fixed: fixedCount,
      stillOpen: openCount,
      typicalFix: median(fixDurations),
    }
  }, [incidents])

  const peak = Math.max(1, ...rows.map(row => row.total))

  return (
    <div className="flex flex-1 flex-col">
      <dl className="border-hair-paper grid grid-cols-3 divide-x divide-[color:var(--paper-hair)] border-b">
        {[
          { label: 'Reported', value: opened },
          { label: 'Fixed', value: fixed },
          { label: 'Typical Fix', value: typicalFix === null ? '–' : humanizeDuration(typicalFix) },
        ].map(stat => (
          <div key={stat.label} className="px-4 py-3">
            <dt className={`${MONO_LABEL} text-paper-faint`}>{stat.label}</dt>
            <dd className="mt-1.5 font-mono text-[18px] font-semibold tabular-nums leading-none">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {rows.length ? (
        <ol className="flex-1 divide-y divide-[color:var(--paper-hair)]">
          {rows.map(row => (
            <li key={row.site} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-medium">{row.site}</span>
                <span className="font-mono text-[12px] tabular-nums text-paper-soft">
                  {row.total}
                </span>
              </div>
              <div
                className="mt-2 flex h-1.5 overflow-hidden rounded-[1px] bg-[color:var(--paper-hair)]"
                role="img"
                aria-label={`${row.site}: ${row.total} reported, ${row.open} still open`}
              >
                <span
                  className="block h-full bg-accent transition-[width] duration-500 ease-out-soft"
                  style={{ width: `${((row.total - row.open) / peak) * 100}%` }}
                />
                <span
                  className="block h-full bg-amber-500 transition-[width] duration-500 ease-out-soft"
                  style={{ width: `${(row.open / peak) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="flex-1 px-4 py-8 text-center text-[13px] text-paper-soft">
          No issues reported in the last {windowDays} days.
        </p>
      )}

      <p
        className={`${MONO_LABEL} border-hair-paper text-paper-faint flex items-center gap-4 border-t px-4 py-2.5`}
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-[1px] bg-accent" />
          Fixed
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-[1px] bg-amber-500" />
          Open ({stillOpen})
        </span>
      </p>
    </div>
  )
}

export default function Status() {
  const { data, error, fetchedAt, loading } = useStatusFeed()
  const now = useNow(10_000)
  const [showAllOpen, setShowAllOpen] = useState(false)

  const overall = data ? OVERALL[data.overall] || OVERALL.unknown : OVERALL.unknown
  const sites = data?.sites || []
  const incidents = useMemo(() => data?.incidents || [], [data])
  const openIncidents = useMemo(() => incidents.filter(i => i.status !== 'resolved'), [incidents])
  const resolvedIncidents = useMemo(
    () => incidents.filter(i => i.status === 'resolved').slice(0, 15),
    [incidents]
  )
  const visibleOpenIncidents = showAllOpen
    ? openIncidents
    : openIncidents.slice(0, OPEN_ISSUES_SHOWN)
  const hiddenOpenCount = openIncidents.length - visibleOpenIncidents.length
  const upCount = sites.filter(s => s.status === 'operational').length
  const averageUptime = sites.length
    ? sites.reduce((sum, s) => sum + (s.uptime_30d ?? 100), 0) / sites.length
    : null
  const windowDays = data?.window_days || 30
  const feedStale = error && data
  const feedDown = error && !data

  return (
    <div className="bg-paper text-ink-paper">
      <Seo
        title="System Status"
        description="Live status console for every site TaylorURL hosts and maintains: uptime, open issues in plain English, and the last 30 days."
        path="/status"
      />

      <div className="relative overflow-hidden">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1240px] px-4 pb-20 pt-28 sm:px-8 sm:pt-32">
          <motion.header
            {...fadeInUp}
            className="border-hair-paper mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-4"
          >
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${overall.ping}`}
                />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${overall.dot}`} />
              </span>
              <h1 className="text-[15px] font-semibold tracking-tight">System Status</h1>
              <span className={`${MONO_LABEL} ${overall.text}`}>{overall.label}</span>
            </div>
            <p
              className={`${MONO_LABEL} inline-flex items-center gap-2 ${feedStale ? 'text-amber-600' : 'text-paper-faint'}`}
              aria-live="polite"
            >
              {feedStale ? (
                <WifiOff className="h-3 w-3" strokeWidth={1.75} />
              ) : (
                <Radio className="h-3 w-3" strokeWidth={1.75} />
              )}
              {feedStale
                ? `Feed unreachable · showing data from ${relative(fetchedAt, now)}`
                : fetchedAt
                  ? `Live · updated ${relative(fetchedAt, now)}`
                  : error
                    ? 'Feed unreachable · retrying'
                    : 'Connecting'}
            </p>
            <p className={`${MONO_LABEL} text-paper-faint`}>
              {fetchedAt
                ? `Last check ${formatClock(fetchedAt)} · every minute`
                : 'Checked every minute'}
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className={`${MONO_LABEL} ml-auto inline-flex items-center gap-1.5 text-accent hover:text-[color:var(--accent-hi)]`}
            >
              Report a Problem
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </motion.header>

          <motion.div
            {...fadeInUp}
            className="bg-hair-paper grid grid-cols-2 gap-px lg:grid-cols-4"
          >
            <Tile
              label="Sites Up"
              value={feedDown ? '–' : `${upCount}/${sites.length}`}
              caption="answering right now"
              loading={loading}
              tone={feedDown || upCount === sites.length ? 'text-ink-paper' : 'text-amber-600'}
            />
            <Tile
              label="Open Issues"
              value={feedDown ? '–' : String(openIncidents.length)}
              caption={openIncidents.length === 1 ? 'being worked' : 'being worked'}
              loading={loading}
              tone={!feedDown && openIncidents.length ? 'text-amber-600' : 'text-ink-paper'}
            />
            <Tile
              label="Uptime"
              value={averageUptime === null ? '–' : `${averageUptime.toFixed(2)}%`}
              caption={`all sites · ${measuredLabel(data?.measured_since, windowDays)}`}
              loading={loading}
            />
            <Tile
              label="Outages"
              value={data ? String(data.outages_30d ?? 0) : '–'}
              caption={`stopped answering · ${measuredLabel(data?.measured_since, windowDays)}`}
              loading={loading}
              tone={data?.outages_30d ? 'text-red-500' : 'text-ink-paper'}
            />
          </motion.div>

          <Panel
            title="Sites"
            aside={`${sites.length || '–'} monitored · ${measuredLabel(data?.measured_since, windowDays)}`}
            className="mt-4"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={TH}>Site</th>
                    <th className={TH}>Domain</th>
                    <th className={`${TH} w-[26%]`}>Last 30 Days</th>
                    <th className={`${TH} text-right`}>Uptime</th>
                    <th className={`${TH} text-right`}>Open</th>
                    <th className={`${TH} text-right`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows cols={6} rows={8} />
                  ) : sites.length ? (
                    sites.map(site => {
                      const cfg = SITE_STATE[site.status] || SITE_STATE.operational
                      return (
                        <tr key={site.id} className="border-hair-paper border-t">
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <span
                                aria-hidden="true"
                                className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`}
                              />
                              <span className="font-medium">{site.name}</span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[12px] text-paper-soft">
                            {(site.domains?.length ? site.domains : [site.domain]).map(
                              (domain, index) => (
                                <span
                                  key={domain}
                                  className={index ? 'text-paper-faint block' : 'block'}
                                >
                                  {domain}
                                </span>
                              )
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <UptimeStrip days={site.days} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums">
                            {site.uptime_30d?.toFixed(2)}%
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-paper-soft">
                            {site.open_issues || 0}
                          </td>
                          <td className={`${MONO_LABEL} px-4 py-2.5 text-right ${cfg.text}`}>
                            <span aria-label={`${site.name} is ${cfg.label.toLowerCase()}`}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr className="border-hair-paper border-t">
                      <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-paper-soft">
                        The status feed is not answering. This page keeps retrying on its own.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel
              title="Open Issues"
              aside={loading || feedDown ? '' : `${openIncidents.length} open`}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className={TH}>Opened</th>
                      <th className={TH}>Site</th>
                      <th className={TH}>What Happened</th>
                      <th className={`${TH} text-right`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonRows cols={4} rows={3} />
                    ) : feedDown ? (
                      <tr className="border-hair-paper border-t">
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-[13px] text-paper-soft"
                        >
                          Waiting on the status feed to come back.
                        </td>
                      </tr>
                    ) : openIncidents.length ? (
                      visibleOpenIncidents.map(incident => (
                        <tr key={incident.id} className="border-hair-paper border-t align-top">
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-paper-soft">
                            {formatWhen(incident.opened_at)}
                            <span className="text-paper-faint block">
                              {relative(new Date(incident.opened_at), now)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium">
                            {incident.site}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{incident.title}</p>
                            <p className="mt-1 max-w-xl leading-relaxed text-paper-soft">
                              {incident.summary}
                            </p>
                            {incident.updates?.length > 1 && (
                              <p className="text-paper-faint mt-1.5 font-mono text-[11px]">
                                {formatWhen(incident.updates[incident.updates.length - 1].at)} ·{' '}
                                {incident.updates[incident.updates.length - 1].text}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <StatusChip status={incident.status} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-hair-paper border-t">
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-[13px] text-paper-soft"
                        >
                          Nothing open. New reports appear here within a minute.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(hiddenOpenCount > 0 || showAllOpen) && (
                <button
                  type="button"
                  onClick={() => setShowAllOpen(open => !open)}
                  aria-expanded={showAllOpen}
                  className={`${MONO_LABEL} border-hair-paper w-full border-t px-4 py-2.5 text-left text-accent transition-colors duration-200 ease-out-soft hover:bg-[color:var(--paper-hair)] hover:text-[color:var(--accent-hi)]`}
                >
                  {showAllOpen ? 'Show Fewer' : `Show ${hiddenOpenCount} More`}
                </button>
              )}
            </Panel>

            <Panel title="Last 30 Days" aside="by site">
              {loading ? (
                <div className="bg-paper-soft/5 h-64 animate-pulse" />
              ) : feedDown ? (
                <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-[13px] text-paper-soft">
                  Waiting on the status feed to come back.
                </p>
              ) : (
                <Breakdown incidents={incidents} windowDays={windowDays} />
              )}
            </Panel>
          </div>

          <Panel
            title="Recently Fixed"
            aside={loading || feedDown ? '' : `last ${windowDays} days`}
            className="mt-4"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={TH}>Resolved</th>
                    <th className={TH}>Site</th>
                    <th className={TH}>What Was Fixed</th>
                    <th className={`${TH} text-right`}>Open For</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows cols={4} rows={4} />
                  ) : feedDown ? (
                    <tr className="border-hair-paper border-t">
                      <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-paper-soft">
                        Waiting on the status feed to come back.
                      </td>
                    </tr>
                  ) : resolvedIncidents.length ? (
                    resolvedIncidents.map(incident => (
                      <tr key={incident.id} className="border-hair-paper border-t align-top">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-paper-soft">
                          {formatWhen(incident.resolved_at || incident.opened_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                          {incident.site}
                        </td>
                        <td className="px-4 py-2.5 text-paper-soft">{incident.summary}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[11px] text-paper-soft">
                          {incident.resolved_at
                            ? relative(
                                new Date(incident.opened_at),
                                new Date(incident.resolved_at)
                              ).replace(' ago', '')
                            : '–'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-hair-paper border-t">
                      <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-paper-soft">
                        Nothing has needed fixing in this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
