import { useEffect, useMemo } from 'react'
import { useConsole } from '../../lib/context'
import { useAnalyticsFeed } from '@hooks/console/useAnalytics'
import { useSession } from '@hooks/session/useSession'
import { LiveHistory } from '../../../analytics/charts'
import { fullCount } from '../../../analytics/lib/format'
import {
  ConsolePage,
  Panel,
  PanelBody,
  PanelFill,
  PanelFoot,
  RankedList,
  SkeletonBox,
} from '../../ui'
import { CHART_HEIGHT } from '../../lib/tokens'
import { recalledCount, rememberCount } from '../../lib/rowMemory'
import WhoIsOn from './WhoIsOn'

const REMEMBERED_PLACES = 'taylorurl_console_live_places'

/**
 * The live section: how many are reading, how that has moved, and who each of
 * them is - the page they have open, what sent them, where they are, and how
 * long they have been on.
 *
 * Every figure here comes from the presence window rather than the traffic
 * history, so the section answers in a fraction of the time the windowed ones
 * take - and none of it is a total for a day, which is what the strip above
 * already carries.
 *
 * The count leads, and it leads with its own history rather than with a line
 * that starts empty. The presence table answers who is here and remembers
 * nothing, so a chart drawn from it could only begin when somebody opened the
 * page and would die on a reload. The database counts the sites every minute
 * instead, on its own clock, and this reads that record - which means the shape
 * of the morning is on screen the moment the section opens, and the window in
 * the bar changes how much of it is shown.
 *
 * The chart and the places take the top of the section between them, and the
 * readers themselves take the width underneath: a row is four things about one
 * person and a card a fifth of the page wide can carry one of them. The count
 * is in the strip above and on that card's own head, so the chart's head names
 * the stretch it draws instead, which is the one fact about it the bar does not
 * state.
 */

// How much of the record the chart draws, against the window the bar is set to.
// The bar's windows answer questions about traffic over days; concurrency over
// ninety days at six-hour steps is a different chart and not a better one, so
// the longest this shows is a month.
const SPAN = {
  1: { minutes: 1440, label: 'last 24 hours' },
  7: { minutes: 10080, label: 'last 7 days' },
  30: { minutes: 43200, label: 'last 30 days' },
  90: { minutes: 43200, label: 'last 30 days' },
}

const POLL_MS = 60_000

/** The clock a point is labelled with, at the grain the range came back at. */
function label(at, step) {
  const when = new Date(at)
  if (step <= 60) {
    return when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return when.toLocaleString(undefined, { weekday: 'short', hour: 'numeric' })
}

export default function LivePage() {
  const { days, inScope, liveForSite, liveLoading, liveSites, loading, siteId, siteIds } =
    useConsole()
  const { session } = useSession()
  const span = SPAN[days] ?? SPAN[1]

  // Where the readers in scope are, which is one site's places when one is in
  // scope and the places of every site in scope otherwise. A city with readers
  // on two sites comes back once per site, so the rows are added up by place
  // before they are ranked.
  const inScopeIds = new Set(inScope.map(row => row.site_id))
  const counted = new Map()
  const source = siteId
    ? liveForSite?.places || []
    : liveSites.filter(entry => inScopeIds.has(entry.site_id)).flatMap(entry => entry.places || [])
  for (const place of source) {
    // A reader the network could not place still counts, under one name.
    const name = [place.city, place.country].filter(Boolean).join(', ') || 'Unknown'
    counted.set(name, (counted.get(name) || 0) + (place.n || 0))
  }
  const places = [...counted]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  // Which sites are in scope is read from the windowed feed, so across more
  // than one site the places are unknown for as long as a window change is.
  const placesLoading = liveLoading || (!siteId && loading)
  const expectedPlaces = recalledCount(REMEMBERED_PLACES, 5)

  useEffect(() => {
    if (!placesLoading) rememberCount(REMEMBERED_PLACES, places.length)
  }, [placesLoading, places.length])

  // The record is the database's, taken every minute whether or not anybody is
  // looking, so the chart is already drawn when the section opens and survives
  // a reload. It is re-read on its own slow clock: a minute-by-minute record
  // gains nothing from being asked for ten times a minute.
  const params = useMemo(() => ({ minutes: span.minutes, sites: siteIds }), [span, siteIds])
  const recorded = useAnalyticsFeed({
    token: session?.access_token ?? null,
    view: 'live-history',
    params,
    intervalMs: POLL_MS,
  })

  const step = recorded.data?.step_minutes ?? 15
  const history = (recorded.data?.points || []).map(point => ({
    at: label(point.at, step),
    live: point.live,
    peak: point.peak,
  }))
  const peak = recorded.data?.peak ?? null

  return (
    <ConsolePage
      areas={['history where', 'people people']}
      cols="minmax(0,1fr) 20rem"
      rows="minmax(0,1fr) minmax(0,1.1fr)"
    >
      <Panel area="history" title="Over Time" aside={span.label} busy={recorded.loading}>
        {/* The placeholder takes the same box the chart will, so the card
            reads the same shape before and after the record lands. */}
        <PanelFill minHeight={CHART_HEIGHT.hour}>
          {recorded.loading ? (
            <SkeletonBox height="100%" />
          ) : history.length > 1 ? (
            <div className="px-3 pt-4">
              <LiveHistory series={history} fill />
            </div>
          ) : (
            <div className="flex items-center justify-center px-5 text-[13px] text-paper-soft">
              Nothing has been recorded over this window yet.
            </div>
          )}
        </PanelFill>
        <PanelFoot>
          <span>Counted every minute.</span>
          {!recorded.loading && peak ? <span>Most at once: {fullCount(peak)}</span> : null}
        </PanelFoot>
      </Panel>

      <Panel
        area="where"
        title="Where They Are"
        aside="nearest network location"
        busy={placesLoading}
      >
        <PanelBody>
          <RankedList
            rows={places}
            nameOf={row => row.name}
            valueOf={row => row.n}
            formatValue={fullCount}
            empty={`Nobody is on the ${siteId ? 'site' : 'sites'} right now.`}
            loading={placesLoading}
            expected={expectedPlaces}
          />
        </PanelBody>
      </Panel>

      <WhoIsOn area="people" />
    </ConsolePage>
  )
}
