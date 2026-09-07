import { useEffect, useMemo, useRef, useState } from 'react'
import { Gauge, Smartphone, Monitor } from 'lucide-react'
import { useSession } from '@hooks/session/useSession'
import { useConsole } from '../../lib/context'
import { useSpeedFeed } from '@hooks/console/useSpeedFeed'
import { displayDomain } from '@utils/domains'
import {
  Area,
  Badge,
  ConsoleError,
  ConsolePage,
  EmptyRow,
  Panel,
  PanelBody,
  PanelFill,
  PanelFoot,
  SectionNotice,
  SkeletonBox,
  SkeletonRows,
} from '../../ui'
import { CELL_TIGHT, CHART_HEIGHT, MONO_LABEL, QUIET, ROW_HEIGHT, TH_TIGHT } from '../../lib/tokens'
import { recalledRows, rememberRows } from '../../lib/rowMemory'
import { SiteIcon } from '../../SiteIcon'
import { DeviceKey, ScoreBars } from './VitalsCharts'

/**
 * What a page costs the person opening it, measured by Google's PageSpeed
 * Insights on both of the devices it reports for.
 *
 * A reading is stored and shown with the time it was taken rather than
 * measured on arrival, because the measurement is two real page loads on
 * Google's hardware and takes the better part of a minute. Measuring is
 * therefore something asked for, one site at a time.
 *
 * The table leads and the chart stands beside it. Across the account the
 * table is a row per site carrying the four scores of one device, with the
 * other device a switch away, and the chart is every site's performance on
 * both devices, ranked - which is where a slow site is seen before its row is
 * found. With one site in scope the table is the whole reading, the four
 * scores and then what they were built from, with the two devices as its
 * columns, and the chart is the same four scores drawn so the distance
 * between the phone and the desktop is a shape rather than a subtraction.
 *
 * The bands are Lighthouse's own: 90 and over is good, 50 to 89 needs work,
 * under 50 is poor. A score is drawn in its band rather than described in a
 * paragraph, and the three bands stand as a key at the foot of the card that
 * draws them, because a reader who needs the key needs it beside the figures.
 */

const STRATEGIES = [
  {
    key: 'mobile',
    label: 'Mobile',
    Icon: Smartphone,
    // Why the same page scores lower on one device than the other belongs
    // beside the scores it explains: the context line of the table across the
    // account, and the column head over the figures for one site.
    conditions: 'A phone on a slow connection',
  },
  {
    key: 'desktop',
    label: 'Desktop',
    Icon: Monitor,
    conditions: 'A computer on a fast connection',
  },
]

// The width is the column's in the account table, where the four stand
// beside a site name and a measured time and every one is declared so the
// table fits the card rather than pushing past it.
const CATEGORIES = [
  { key: 'performance', label: 'Performance', width: 'w-[6.5rem]' },
  { key: 'accessibility', label: 'Accessibility', width: 'w-[6.75rem]' },
  { key: 'best_practices', label: 'Best Practices', width: 'w-[7rem]' },
  { key: 'seo', label: 'SEO', width: 'w-[4rem]' },
]

const METRICS = [
  { key: 'lcp_ms', label: 'Largest Contentful Paint', unit: 'seconds' },
  { key: 'fcp_ms', label: 'First Contentful Paint', unit: 'seconds' },
  { key: 'tbt_ms', label: 'Total Blocking Time', unit: 'ms' },
  { key: 'si_ms', label: 'Speed Index', unit: 'seconds' },
  { key: 'cls', label: 'Cumulative Layout Shift', unit: 'raw' },
]

// Lighthouse's own three bands, named the way Google names them, so a reader
// who has seen a PageSpeed report reads the same words here.
const BANDS = [
  { range: '90 to 100', tone: 'good', label: 'Good' },
  { range: '50 to 89', tone: 'warn', label: 'Needs Improvement' },
  { range: '0 to 49', tone: 'bad', label: 'Poor' },
]

const ROWS_KEY = 'taylorurl_console_vitals_rows'
const READING_KEY = 'taylorurl_console_vitals_reading_rows'

// The cells of each table in the order its head declares them, so the
// placeholder rows share the columns the readings land in.
const ESTATE_CELLS = [CELL_TIGHT, CELL_TIGHT, CELL_TIGHT, CELL_TIGHT, CELL_TIGHT, 'px-3', 'px-3']
const READING_CELLS = [CELL_TIGHT, CELL_TIGHT, CELL_TIGHT]

// The height the account chart keeps on a phone is a row's worth per site,
// two bars and the gap between rows. The ceiling is what the shortest desk
// cell still holds after the card's head and foot, because the floor is kept
// at the desk too, and a chart taller than its card puts its foot below the
// card's edge.
const BAR_PITCH = 24
const CHART_CEILING = 360

function band(value) {
  if (value === null || value === undefined) return 'plain'
  if (value >= 90) return 'good'
  if (value >= 50) return 'warn'
  return 'bad'
}

/** One score in its band, or the mark for a reading that has not been taken. */
function Score({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-paper-faint inline-block w-7 text-center">—</span>
  }
  return <Badge tone={band(value)}>{value}</Badge>
}

function metric(value, unit) {
  if (value === null || value === undefined) return '—'
  if (unit === 'seconds') return `${(value / 1000).toFixed(1)}s`
  if (unit === 'ms') return `${Math.round(value)}ms`
  return Number(value).toFixed(3)
}

/** How long ago, in the coarsest unit that still says something. */
function since(stamp) {
  if (!stamp) return 'not measured yet'
  const minutes = Math.round((Date.now() - new Date(stamp).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** The newer of a site's two readings, which is when it was last measured. */
function latestOf(readings) {
  const stamps = STRATEGIES.map(strategy => readings?.[strategy.key]?.fetched_at).filter(Boolean)
  if (!stamps.length) return null
  return stamps.reduce((held, stamp) => (new Date(stamp) > new Date(held) ? stamp : held))
}

// The console's quiet control, held to a finger's height on a phone, where
// the row beside it is the only other thing to hit. At the desk a pointer
// needs less, and a table of sites shows a third more rows for it.
function MeasureButton({ onClick, busy, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`${QUIET} h-11 lg:h-8 lg:min-h-0`}
    >
      <Gauge className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
      {busy ? 'Measuring' : label}
    </button>
  )
}

/** The two devices, as a switch between the readings of one at a time. */
function DeviceSwitch({ device, onPick }) {
  return (
    <span className="console-segmented" role="group" aria-label="Device">
      {STRATEGIES.map(strategy => (
        <button
          key={strategy.key}
          type="button"
          onClick={() => onPick(strategy.key)}
          aria-pressed={device === strategy.key}
          className="inline-flex items-center gap-1.5"
        >
          <strategy.Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          {strategy.label}
        </button>
      ))}
    </span>
  )
}

/** Lighthouse's three bands, as the key to every score on the page. */
function BandKey() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {BANDS.map(entry => (
        <li key={entry.range} className="flex items-center gap-1.5">
          <Badge tone={entry.tone}>{entry.label}</Badge>
          <span className="text-paper-faint font-mono text-[11px] tabular-nums">{entry.range}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Every site in scope, a row each, with the four scores of one device.
 *
 * One device at a time rather than both, because eight scores beside a name
 * and a time is a table wider than the card it sits in, and a reader comparing
 * sites compares them on one device at a time anyway. The switch stands at
 * the foot beside the sentence saying what that device is.
 */
function EstateTable({ title, sites, loading, measuring, measure, device, onDevice, placeholder }) {
  const chosen = STRATEGIES.find(strategy => strategy.key === device)
  const body = useRef(null)

  useEffect(() => {
    if (!loading) rememberRows(ROWS_KEY, body.current)
  }, [loading, sites.length])

  return (
    <Panel title={title} aside={chosen.conditions} busy={loading} area="reading">
      <PanelBody className="overflow-x-auto">
        <table className="console-table min-w-[47rem] text-[13px]" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col" className={`${TH_TIGHT} w-[10rem]`}>
                Site
              </th>
              {CATEGORIES.map(category => (
                <th key={category.key} scope="col" className={`${TH_TIGHT} ${category.width}`}>
                  {category.label}
                </th>
              ))}
              <th scope="col" className={`${TH_TIGHT} w-[5.5rem]`}>
                Measured
              </th>
              <th scope="col" className={`${TH_TIGHT} text-right`}>
                <span className="sr-only">Measure</span>
              </th>
            </tr>
          </thead>
          <tbody ref={body}>
            {loading && (
              <SkeletonRows
                cols={ESTATE_CELLS}
                rows={placeholder.rows}
                height={placeholder.height}
                lastHeight={placeholder.lastHeight}
              />
            )}
            {sites.map(site => {
              const reading = site.readings?.[device]
              return (
                <tr key={site.site_id} className="border-hair-paper border-t">
                  <td className={CELL_TIGHT}>
                    <span className="flex items-center gap-2.5">
                      <SiteIcon host={site.name} name={site.name} />
                      <span
                        className="min-w-0 truncate font-medium"
                        title={displayDomain(site.name)}
                      >
                        {displayDomain(site.name)}
                      </span>
                    </span>
                  </td>
                  {CATEGORIES.map(category => (
                    <td key={category.key} className={CELL_TIGHT}>
                      <Score value={reading?.[category.key]} />
                    </td>
                  ))}
                  {/* A site never measured shows the mark its scores show,
                      rather than a sentence wider than the column. */}
                  <td className={`${MONO_LABEL} text-paper-faint whitespace-nowrap px-3 py-3`}>
                    {reading?.fetched_at ? since(reading.fetched_at) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <MeasureButton
                      onClick={() => measure(site.site_id)}
                      busy={measuring === site.site_id}
                      label="Measure"
                    />
                  </td>
                </tr>
              )
            })}
            {!loading && !sites.length && (
              <EmptyRow cols={7}>No sites are linked to this account yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        <BandKey />
        <DeviceSwitch device={device} onPick={onDevice} />
      </PanelFoot>
    </Panel>
  )
}

/**
 * One site's whole reading, the two devices side by side.
 *
 * The scores and the timings are two different kinds of answer, so a heavier
 * rule separates them rather than a heading repeating what each label already
 * says. The head of each device column carries what that device is, since
 * why the same page scores lower in one column than the other is the first
 * thing a reader asks of the pair.
 */
function SiteReading({ name, site, siteId, loading, measuring, measure }) {
  const readings = site?.readings
  const latest = latestOf(readings)
  const busy = measuring === siteId
  const body = useRef(null)
  // The row count is fixed, so what is remembered is the height, which is a
  // badge's row rather than a line of text's.
  const placeholder = recalledRows(
    READING_KEY,
    CATEGORIES.length + METRICS.length,
    ROW_HEIGHT.plain
  )

  useEffect(() => {
    if (!loading) rememberRows(READING_KEY, body.current)
  }, [loading, siteId])

  return (
    <Panel
      title={name}
      aside={latest ? `measured ${since(latest)}` : 'not measured yet'}
      loading={loading}
      busy={busy}
      area="reading"
    >
      <PanelBody className="overflow-x-auto">
        <table className="console-table min-w-[30rem] text-[13px]" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col" className={TH_TIGHT}>
                <span className="sr-only">Reading</span>
              </th>
              {STRATEGIES.map(strategy => (
                <th key={strategy.key} scope="col" className={`${TH_TIGHT} w-[9.5rem] align-top`}>
                  <span className="flex items-center gap-1.5">
                    <strategy.Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {strategy.label}
                  </span>
                  <span className="mt-0.5 block whitespace-normal text-[11px] font-normal leading-snug">
                    {strategy.conditions}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={body}>
            {loading && (
              <SkeletonRows
                cols={READING_CELLS}
                rows={placeholder.rows}
                height={placeholder.height}
                lastHeight={placeholder.lastHeight}
              />
            )}
            {!loading &&
              CATEGORIES.map(category => (
                <tr key={category.key} className="border-hair-paper border-t">
                  <td className={CELL_TIGHT}>{category.label}</td>
                  {STRATEGIES.map(strategy => (
                    <td key={strategy.key} className={CELL_TIGHT}>
                      <Score value={readings?.[strategy.key]?.[category.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              METRICS.map((row, index) => (
                <tr
                  key={row.key}
                  className={
                    index ? 'border-hair-paper border-t' : 'border-hair-paper-strong border-t-2'
                  }
                >
                  <td className={CELL_TIGHT}>{row.label}</td>
                  {STRATEGIES.map(strategy => (
                    <td key={strategy.key} className={`${CELL_TIGHT} font-mono tabular-nums`}>
                      {metric(readings?.[strategy.key]?.[row.key], row.unit)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
          {loading ? '' : readings?.mobile?.url || readings?.desktop?.url || 'not measured yet'}
        </span>
        <MeasureButton onClick={() => measure(siteId)} busy={busy || loading} label="Measure" />
      </PanelFoot>
    </Panel>
  )
}

export default function VitalsPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const {
    sites: measured,
    error,
    loading,
    measuring,
    measure,
  } = useSpeedFeed({
    token,
    enabled: Boolean(token),
  })
  // The console's own site picker is the scope here too, so Vitals answers to
  // the same control as every other section rather than carrying a second one.
  const { siteIds, siteId, scopeLabel, scopeName } = useConsole()
  // The readings come from their own feed over every site the account holds,
  // so the scope is applied here: a chosen pair is two rows in the table
  // rather than the whole estate with two of them meant. It is read from the
  // set itself rather than from the window's rows, which empty for the length
  // of every window change and would take the table with them.
  const sites = useMemo(() => {
    if (!siteIds.length) return measured
    const held = new Set(siteIds)
    return measured.filter(site => held.has(site.site_id))
  }, [measured, siteIds])
  // Branching on the id rather than on the row it finds. `sites` is empty until
  // the readings land, so a scoped visit that waited for the row drew the
  // account-wide table first and replaced it with the reading a moment later.
  const site = siteId ? sites.find(row => row.site_id === siteId) : null
  const [device, setDevice] = useState('mobile')
  // The shape of the table the reader last saw, which is also how many bars
  // the chart beside it is about to draw.
  const remembered = recalledRows(ROWS_KEY, 5, ROW_HEIGHT.plain)

  // Ranked by the phone, which is the harsher of the two and the one Google
  // ranks a page by. A site measured on neither device has no bar to draw.
  const ranked = useMemo(
    () =>
      sites
        .map(row => ({
          name: displayDomain(row.name),
          mobile: row.readings?.mobile?.performance ?? null,
          desktop: row.readings?.desktop?.performance ?? null,
        }))
        .filter(row => row.mobile !== null || row.desktop !== null)
        .sort((a, b) => (b.mobile ?? -1) - (a.mobile ?? -1)),
    [sites]
  )
  const categories = useMemo(() => {
    const readings = site?.readings
    if (!STRATEGIES.some(strategy => readings?.[strategy.key])) return []
    return CATEGORIES.map(category => ({
      name: category.label,
      mobile: readings.mobile?.[category.key] ?? null,
      desktop: readings.desktop?.[category.key] ?? null,
    }))
  }, [site])

  if (error && !measured.length) return <SectionNotice>{error}</SectionNotice>

  const chart = siteId
    ? { title: 'Scores', aside: 'out of 100', rows: categories, empty: 'Not measured yet.' }
    : {
        title: 'Performance',
        aside: 'out of 100, best first',
        rows: ranked,
        empty: 'Nothing has been measured yet.',
      }
  // The floor the chart keeps on a phone, where the card has no height to hand
  // it. While the read is out the count is the remembered one, so the card
  // does not grow under the reader when the bars land.
  const expected = loading ? remembered.rows : ranked.length
  const floor = siteId
    ? CHART_HEIGHT.traffic
    : Math.min(CHART_CEILING, Math.max(CHART_HEIGHT.traffic, expected * BAR_PITCH + 24))

  return (
    <ConsolePage
      // The notice takes a row of its own only while there is one to show, so
      // the two cards have the whole of the room the rest of the time.
      areas={error ? ['note note', 'reading chart'] : ['reading chart']}
      cols={siteId ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,2.8fr) minmax(18rem,1fr)'}
      rows={error ? 'auto minmax(0,1fr)' : 'minmax(0,1fr)'}
    >
      {error && (
        <Area area="note">
          <ConsoleError>{error}</ConsoleError>
        </Area>
      )}

      {siteId ? (
        <SiteReading
          name={scopeName || (site ? displayDomain(site.name) : '')}
          site={site}
          siteId={siteId}
          loading={loading}
          measuring={measuring}
          measure={measure}
        />
      ) : (
        <EstateTable
          title={scopeLabel}
          sites={sites}
          loading={loading}
          measuring={measuring}
          measure={measure}
          device={device}
          onDevice={setDevice}
          placeholder={remembered}
        />
      )}

      <Panel
        title={chart.title}
        aside={chart.aside}
        area="chart"
        busy={loading || Boolean(measuring)}
      >
        <PanelFill minHeight={floor}>
          {loading ? (
            <SkeletonBox height="100%" />
          ) : chart.rows.length ? (
            <ScoreBars rows={chart.rows} fill />
          ) : (
            <p className="flex items-center justify-center px-5 text-center text-[13px] text-paper-soft">
              {chart.empty}
            </p>
          )}
        </PanelFill>
        <PanelFoot>
          <DeviceKey />
          {siteId && <BandKey />}
        </PanelFoot>
      </Panel>
    </ConsolePage>
  )
}
