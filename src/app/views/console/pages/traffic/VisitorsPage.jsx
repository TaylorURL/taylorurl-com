import { useConsole } from '../../lib/context'
import { BreakdownDonut } from '../../../analytics/charts'
import { fullCount } from '../../../analytics/lib/format'
import { ConsolePage, Panel, PanelBody, PanelFoot, RankedList, SkeletonBox } from '../../ui'
import { CHART_HEIGHT } from '../../lib/tokens'

/**
 * Who the visitors are: where they are, to about the nearest large city, and
 * what they are reading on.
 *
 * These were two sections, one for the map and one for the machine, and each
 * was a screen holding two or four small cards over the same sessions. A
 * reader asking "who comes to my site" is asking both at once, and Places
 * beside Sources read as two doors marked "where from". So the six readings
 * sit on one page, three across, in the order a reader asks them: where and
 * who along the first row, on what along the second.
 *
 * The country comes from the browser's own timezone and the city from the
 * network edge that served the request, so neither is read from an address.
 */

// The ten busiest cities are the reading. The tail below them is a row of
// ones that carries nothing, and a list that runs on into it is a longer
// scroll to the same answer.
const CITIES_LISTED = 10

// Six browsers cover everything a site actually sees; the rest of the tail is
// one session apiece and a slice too thin to carry a colour.
const BROWSERS_CHARTED = 6

/**
 * A donut and the legend reading it are one figure, so they are held to the
 * width the pair needs.
 *
 * The chart is a fixed 124px and a legend row is a word against a percentage.
 * Given a third of the work region, the percentage ends up a hand's width
 * from the name it belongs to and the card reads as mostly ground - which is
 * the same fault as a ranking stretched across a page, in a card a third the
 * size.
 */
function Breakdown({ children }) {
  return (
    <div className="px-5 py-4">
      <div className="mx-auto max-w-[19rem]">{children}</div>
    </div>
  )
}

export default function VisitorsPage() {
  const { detail, loading } = useConsole()

  const sessions = detail?.totals?.sessions || 0
  const countries = detail?.countries || []
  const cities = detail?.cities || []
  const devices = detail?.devices || []
  const browsers = detail?.browsers || []
  const systems = detail?.systems || []
  const languages = detail?.languages || []

  const nothingYet = (
    <p className="py-8 text-center text-[13px] text-paper-soft">
      No sessions recorded in this window.
    </p>
  )

  return (
    <ConsolePage
      areas={['countries cities languages', 'devices browsers systems']}
      cols="minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
      rows="minmax(0,1.15fr) minmax(0,1fr)"
    >
      {/* Six readings of the same sessions, three across and two down: the
          places and the tongue along the first row, the machine along the
          second. The rankings are as long as the window makes them and move
          inside their own cards, while a share is one fixed figure however
          long the window, so the first row is given a little more of the
          height than the second. */}
      <Panel title="Countries" aside="sessions" area="countries">
        <PanelBody>
          <RankedList
            dense
            rows={countries}
            nameOf={row => row.country}
            valueOf={row => row.sessions}
            formatValue={fullCount}
            empty="No locations recorded in this window."
            loading={loading}
          />
        </PanelBody>
      </Panel>

      <Panel title="Cities" aside="nearest network location" area="cities">
        <PanelBody>
          <RankedList
            dense
            rows={cities.slice(0, CITIES_LISTED)}
            nameOf={row => row.city}
            valueOf={row => row.sessions}
            formatValue={fullCount}
            empty="No locations recorded in this window."
            loading={loading}
          />
        </PanelBody>
      </Panel>

      <Panel title="Languages" aside="sessions" area="languages">
        <PanelBody>
          <RankedList
            dense
            rows={languages}
            nameOf={row => row.name}
            valueOf={row => row.sessions}
            formatValue={fullCount}
            empty="No sessions recorded in this window."
            loading={loading}
          />
        </PanelBody>
        <PanelFoot>The browser&apos;s language, not the page&apos;s</PanelFoot>
      </Panel>

      <Panel title="Devices" aside="share of sessions" area="devices">
        <PanelBody>
          {loading ? (
            <SkeletonBox height={CHART_HEIGHT.donut} />
          ) : (
            <Breakdown>
              {devices.length ? <BreakdownDonut rows={devices} total={sessions} /> : nothingYet}
            </Breakdown>
          )}
        </PanelBody>
      </Panel>

      <Panel title="Browsers" aside="share of sessions" area="browsers">
        <PanelBody>
          {loading ? (
            <SkeletonBox height={CHART_HEIGHT.donut} />
          ) : (
            <Breakdown>
              {browsers.length ? (
                <BreakdownDonut rows={browsers.slice(0, BROWSERS_CHARTED)} total={sessions} />
              ) : (
                nothingYet
              )}
            </Breakdown>
          )}
        </PanelBody>
      </Panel>

      <Panel title="Operating Systems" aside="sessions" area="systems">
        <PanelBody>
          <RankedList
            dense
            rows={systems}
            nameOf={row => row.name}
            valueOf={row => row.sessions}
            formatValue={fullCount}
            empty="No sessions recorded in this window."
            loading={loading}
          />
        </PanelBody>
      </Panel>
    </ConsolePage>
  )
}
