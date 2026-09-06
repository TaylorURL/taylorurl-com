import { useStatusFeed } from '@hooks/useStatusFeed'
import { MarkCurve, MarkGauge, MarkInflow, MarkNow, MarkPulse } from '@components/marks'

/**
 * The panel beside the sign-in form: what the console holds, and the two
 * figures that say the watching is real.
 *
 * The figures come from the public status feed, which is the same source the
 * status board reads and is readable without an account. Nothing here is a
 * sample or a mock-up, so the panel cannot drift away from what the console
 * turns out to contain.
 */
const HOLDS = [
  {
    mark: MarkNow,
    label: 'Live Readers',
    line: 'Who is on the site this minute, and the page they are on.',
  },
  {
    mark: MarkCurve,
    label: 'Traffic',
    line: 'Pageviews, sessions and visitors over a day, a week, a month or a quarter.',
  },
  {
    mark: MarkInflow,
    label: 'Sources',
    line: 'Where readers arrive from, and which pages they land on.',
  },
  {
    mark: MarkGauge,
    label: 'Page Speed',
    line: 'What the site scores on phones and on computers, measured on demand.',
  },
  {
    mark: MarkPulse,
    label: 'Uptime',
    line: 'Every check against the site, and every outage with how long it ran.',
  },
]

/** The same reading the status board takes, off the same field. */
function average(sites) {
  if (!sites.length) return null
  return sites.reduce((sum, site) => sum + (site.uptime_30d ?? 100), 0) / sites.length
}

export default function AuthCase() {
  const { data } = useStatusFeed()
  const sites = data?.sites ?? []
  const up = sites.filter(site => site.status !== 'outage').length
  const uptime = average(sites)

  return (
    <div className="auth-case">
      <div className="auth-case-body">
        <p className="auth-case-eyebrow">The Console</p>
        <h2 className="auth-case-head">
          Every figure for the site built for your business, in one place.
        </h2>

        <ul className="auth-case-list">
          {HOLDS.map(hold => (
            <li key={hold.label} className="auth-case-item">
              <hold.mark className="auth-case-mark" aria-hidden="true" />
              <div>
                <p className="auth-case-label">{hold.label}</p>
                <p className="auth-case-line">{hold.line}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* The strip holds its height before the feed answers, so the panel
            does not grow under a reader who is already typing. */}
        <dl className="auth-case-figures">
          <div className="auth-case-figure">
            <dt className="auth-case-figure-label">Sites Watched</dt>
            <dd className="auth-case-figure-value">
              {sites.length ? `${up}/${sites.length}` : '—'}
            </dd>
          </div>
          <div className="auth-case-figure">
            <dt className="auth-case-figure-label">Uptime</dt>
            <dd className="auth-case-figure-value">
              {uptime === null ? '—' : `${uptime.toFixed(2)}%`}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
