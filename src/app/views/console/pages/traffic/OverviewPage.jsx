import { useEffect } from 'react'
import { useConsole } from '../../lib/context'
import { HourChart, TrafficChart } from '../../../analytics/charts'
import {
  bucketTitle,
  compactCount,
  fullCount,
  hourLabel,
  percent,
} from '../../../analytics/lib/format'
import {
  ConsolePage,
  EmptyFill,
  Metric,
  Panel,
  PanelBody,
  PanelFill,
  PanelFoot,
  RankedList,
  SectionNotice,
  SkeletonBar,
  SkeletonBox,
} from '../../ui'
import { recalledCount, rememberCount } from '../../lib/rowMemory'
import { CHART_HEIGHT, MONO_LABEL, ROW_HEIGHT } from '../../lib/tokens'
import ReadingNow from './ReadingNow'
import { WeekdayChart } from './OverviewCharts'
import { SiteIcon } from '../../SiteIcon'

/**
 * The landing section, and the whole of the traffic reading: the shape of the
 * window, who is on right now, the clock and the calendar the traffic arrives
 * on, what is carrying it, and the few readings of the window no other section
 * takes. The headline figures are the shell's tile strip above it, so this does
 * not repeat them.
 *
 * The hour and day charts used to be a section of their own, opening on the
 * same series this one opens on. Two sections that begin with one drawing are
 * one question with two doors, and a reader asking when the traffic comes had
 * to guess which door. The series is drawn once, here, and everything folded
 * out of it sits underneath it.
 *
 * Nothing here re-states a section that has its own tab. The breakdown is
 * ranked rather than tabulated, which is the digest of Sites and Pages rather
 * than a copy of either, and the readings beside it are derived from the
 * series already in hand - a busiest day and a pages-per-session are questions
 * the console answers nowhere else.
 *
 * Two rows. The chart takes three quarters of the first beside the live
 * count, because a shape is read from a chart and a figure is not: given the
 * whole row it is the only thing on a screen, and the first question the
 * section is opened on is whether this minute agrees with the window. The
 * four cards under it are level with each other, since the clock, the
 * calendar, the ranking and the readings are four answers of one size to the
 * same series, and reading one against another is the point of the row.
 *
 * The hour chart is a site's clock. Summing every site's together says when
 * TaylorURL's whole estate is busy rather than when any one audience is.
 */

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKEND = new Set(['Saturday', 'Sunday'])

/**
 * Pageviews gathered onto the weekday they landed on, Monday to Sunday.
 *
 * The series above runs in order, which says what happened and never what
 * happens: a Saturday is only readable against the other Saturdays, and on a
 * month of chart those are five columns apart. Calendar order rather than
 * busiest first, because the drawing is the week's shape and the ranking is
 * read off the bar heights; keeping the weekend at one end keeps the two days
 * the foot counts together.
 */
function byWeekday(series) {
  const totals = new Map(WEEK.map(name => [name, 0]))
  for (const point of series) {
    const name = new Date(point.bucket).toLocaleDateString('en-US', { weekday: 'long' })
    totals.set(name, (totals.get(name) || 0) + point.pageviews)
  }
  return WEEK.map(name => ({ name, short: name.slice(0, 3), pageviews: totals.get(name) }))
}

/** The extremes of a set of buckets, which is what a shape is read for. */
function edges(rows, valueOf) {
  if (!rows.length) return { top: null, bottom: null }
  return {
    top: rows.reduce((a, b) => (valueOf(b) > valueOf(a) ? b : a)),
    bottom: rows.reduce((a, b) => (valueOf(b) < valueOf(a) ? b : a)),
  }
}

/**
 * The one-line readings of a window, from the series and totals already read.
 *
 * Over one day the buckets are hours, and the busiest and quietest of those
 * already close the hour chart; the same two figures under a second label are
 * not a second reading. Over a week or more the buckets are days, which the
 * hour chart cannot name, so the two lead here.
 */
function digest({ series, totals, grain }) {
  if (!series.length) return []
  const { top, bottom } = edges(series, point => point.pageviews)
  const mean = series.reduce((sum, point) => sum + point.pageviews, 0) / series.length
  const perSession = totals?.sessions ? totals.pageviews / totals.sessions : 0
  const returning =
    totals?.visitors && totals.visitors >= totals.new_visitors
      ? ((totals.visitors - totals.new_visitors) / totals.visitors) * 100
      : 0

  const readings = []
  if (grain !== 'hour') {
    readings.push(
      {
        label: 'Busiest Day',
        value: bucketTitle(top.bucket, grain),
        note: `${fullCount(top.pageviews)} views`,
      },
      {
        label: 'Quietest Day',
        value: bucketTitle(bottom.bucket, grain),
        note: `${fullCount(bottom.pageviews)} views`,
      }
    )
  }
  readings.push(
    {
      label: 'Typical',
      value: compactCount(Math.round(mean)),
      note: `views per ${grain === 'hour' ? 'hour' : 'day'}`,
    },
    {
      label: 'Pages per Session',
      value: perSession ? perSession.toFixed(1) : '0',
      note: 'in one visit',
    },
    { label: 'Returning', value: percent(returning), note: 'seen here before' }
  )
  return readings
}

/**
 * One reading of the figure above it, in the block its card closes on.
 *
 * A chart says where the peak sits and never what it was worth, so the figure
 * answering that belongs against the chart rather than in a card of its own.
 */
function Reading({ label, value, note, loading }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className={`${MONO_LABEL} text-paper-faint`}>{label}</span>
      {loading ? (
        <SkeletonBar className="w-16" />
      ) : (
        <span className="font-mono text-[13px] tabular-nums text-ink-paper">{value}</span>
      )}
      {!loading && note && <span className={`${MONO_LABEL} text-paper-faint`}>{note}</span>}
    </span>
  )
}

const REMEMBERED = 'taylorurl_console_ranked'

// The ranking is a digest rather than the table, so it holds the head of the
// list and no more: the rest is one click away on its own section. Five rows
// of sites, each carrying its mark, is what the card holds at the desk width
// with nothing moving inside it.
const RANKED = 5

export default function OverviewPage() {
  const { days, detail, inScope, liveSites, overview, loading, scopeLabel, unreachable, siteId } =
    useConsole()
  const series = detail?.series || overview.data?.series || []
  const grain = detail?.grain || overview.data?.grain || 'day'
  const totals = detail?.totals || overview.data?.totals

  const readings = digest({ series, totals, grain })

  const hours = detail?.hours || []
  const hourEdges = edges(hours, hour => hour.pageviews)

  // A window of one day folds onto one weekday, which compares nothing with
  // nothing. The calendar waits for a window with more than one day in it.
  const comparingDays = days > 1
  const weekdays = comparingDays && series.length ? byWeekday(series) : []
  const dayEdges = edges(weekdays, day => day.pageviews)
  const dayTotal = weekdays.reduce((sum, day) => sum + day.pageviews, 0)
  const weekend = weekdays
    .filter(day => WEEKEND.has(day.name))
    .reduce((sum, day) => sum + day.pageviews, 0)

  // With a site in scope the breakdown is its pages; across the account it is
  // the sites themselves, which is the same question asked one level up.
  const ranked = siteId
    ? {
        title: 'Top Pages',
        rows: (detail?.pages || []).slice(0, RANKED),
        nameOf: row => row.path,
        valueOf: row => row.pageviews,
        empty: 'No pages were opened in this window.',
        expected: recalledCount(`${REMEMBERED}_pages`, 5),
      }
    : {
        title: 'Busiest Sites',
        rows: inScope.slice(0, RANKED),
        nameOf: row => row.name,
        valueOf: row => row.pageviews,
        empty: 'No sites are reporting yet.',
        // Only the site ranking has a mark to show. A path has none, so the
        // pages branch leaves it out rather than reserving a box for nothing.
        markOf: row => <SiteIcon host={row.name} name={row.name} />,
        expected: recalledCount(
          `${REMEMBERED}_sites`,
          Math.min(RANKED, Math.max(1, liveSites.length || 5))
        ),
      }

  useEffect(() => {
    if (!loading) rememberCount(`${REMEMBERED}_${siteId ? 'pages' : 'sites'}`, ranked.rows.length)
  }, [loading, siteId, ranked.rows.length])

  // The live feed is its own read and keeps answering while the windowed one
  // does not, so who is on right now stays on screen beside the notice. The
  // notice is one sentence and takes one sentence's height; the live list
  // takes the rest.
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
        <ReadingNow area="now" />
      </ConsolePage>
    )
  }

  return (
    <ConsolePage
      areas={['chart chart chart now', 'hour day top window']}
      cols="minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
      rows="minmax(0,1.05fr) minmax(0,1fr)"
    >
      {/* The chart against the live count: one is the window and the other is
          this minute, and the first question a section is opened on is which
          of the two disagrees with the other. */}
      <Panel
        area="chart"
        title={scopeLabel}
        aside={`pageviews and sessions · ${grain === 'hour' ? 'hourly' : 'daily'}`}
        loading={loading}
      >
        {/* The plot is inset from the card rather than the card being padded,
            so the head's rule still meets both edges above it. */}
        <PanelFill minHeight={CHART_HEIGHT.traffic}>
          {loading ? (
            <SkeletonBox height="100%" className="px-2 py-3" />
          ) : series.length ? (
            <div className="px-2 py-3">
              <TrafficChart series={series} grain={grain} fill />
            </div>
          ) : (
            <EmptyFill>No traffic in this window.</EmptyFill>
          )}
        </PanelFill>
      </Panel>

      <ReadingNow area="now" />

      {/* The same traffic folded a different way round: the hour chart folds
          the window onto one day and the day chart folds it onto one week. */}
      <Panel area="hour" title="By Hour" aside="your timezone" busy={loading}>
        <PanelFill minHeight={CHART_HEIGHT.hour}>
          {loading ? (
            <SkeletonBox height="100%" className="px-2 py-3" />
          ) : hours.length ? (
            <div className="px-2 py-3">
              <HourChart hours={hours} fill />
            </div>
          ) : (
            <EmptyFill>No traffic in this window.</EmptyFill>
          )}
        </PanelFill>
        <PanelFoot>
          <Reading
            label="Busiest"
            value={hourEdges.top ? hourLabel(hourEdges.top.hour) : '—'}
            note={hourEdges.top ? `${fullCount(hourEdges.top.pageviews)} views` : null}
            loading={loading}
          />
          <Reading
            label="Quietest"
            value={hourEdges.bottom ? hourLabel(hourEdges.bottom.hour) : '—'}
            note={hourEdges.bottom ? `${fullCount(hourEdges.bottom.pageviews)} views` : null}
            loading={loading}
          />
        </PanelFoot>
      </Panel>

      <Panel area="day" title="By Day" aside="gathered over the window" busy={loading}>
        {comparingDays ? (
          <>
            <PanelFill minHeight={CHART_HEIGHT.hour}>
              {loading ? (
                <SkeletonBox height="100%" className="px-2 py-3" />
              ) : weekdays.length ? (
                <div className="px-2 py-3">
                  <WeekdayChart days={weekdays} fill />
                </div>
              ) : (
                <EmptyFill>No traffic in this window.</EmptyFill>
              )}
            </PanelFill>
            <PanelFoot>
              <Reading
                label="Busiest"
                value={dayEdges.top ? dayEdges.top.name : '—'}
                note={dayEdges.top ? `${fullCount(dayEdges.top.pageviews)} views` : null}
                loading={loading}
              />
              <Reading
                label="Weekend"
                value={dayTotal ? percent((weekend / dayTotal) * 100, 0) : '—'}
                loading={loading}
              />
            </PanelFoot>
          </>
        ) : (
          <PanelFill minHeight={CHART_HEIGHT.hour}>
            <EmptyFill>
              One day is one day. Pick a window of a week or more to compare the days.
            </EmptyFill>
          </PanelFill>
        )}
      </Panel>

      <Panel area="top" title={ranked.title} aside="by pageviews" busy={loading}>
        {/* The count the placeholder is drawn at comes from the live feed,
            which answers first, so the list does not resize when the windowed
            figures land on top of it. */}
        <PanelBody>
          <RankedList
            rows={ranked.rows}
            nameOf={ranked.nameOf}
            valueOf={ranked.valueOf}
            formatValue={fullCount}
            empty={ranked.empty}
            markOf={ranked.markOf}
            loading={loading}
            expected={ranked.expected}
          />
        </PanelBody>
      </Panel>

      <Panel
        area="window"
        title="This Window"
        aside={grain === 'hour' ? 'by the hour' : 'by the day'}
        loading={loading}
      >
        <PanelBody>
          {loading ? (
            /* The placeholder is the metric row's own box, so the five
               readings land in the space already held for them. */
            <ul className="divide-y divide-[color:var(--paper-hairline)]" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, row) => (
                <li key={row} className="px-5 py-2.5" style={{ height: ROW_HEIGHT.plain }}>
                  <span className="block h-[19.5px] w-1/2 animate-pulse rounded bg-paper-soft/15" />
                </li>
              ))}
            </ul>
          ) : readings.length ? (
            <dl>
              {readings.map(reading => (
                <Metric
                  key={reading.label}
                  label={reading.label}
                  value={reading.value}
                  caption={reading.note}
                />
              ))}
            </dl>
          ) : (
            <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
              No traffic in this window.
            </p>
          )}
        </PanelBody>
      </Panel>
    </ConsolePage>
  )
}
