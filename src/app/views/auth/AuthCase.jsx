import { useStatusFeed } from '@hooks/console/useStatusFeed'
import { CheckList } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'

/**
 * What stands under the sign-in headline on a wide screen: what the console
 * holds, and the two figures that say the watching is real.
 *
 * The figures come from the public status feed, which is the same source the
 * status board reads and is readable without an account. Nothing here is a
 * sample or a mock-up, so the panel cannot drift away from what the console
 * turns out to contain.
 */
const HOLDS = [
  {
    title: 'Live readers',
    body: 'Who is on the site this minute, and the page they are on.',
  },
  {
    title: 'Traffic',
    body: 'Pageviews, sessions and visitors over a day, a week, a month or a quarter.',
  },
  {
    title: 'Sources',
    body: 'Where readers arrive from, and which pages they land on.',
  },
  {
    title: 'Page speed',
    body: 'What the site scores on phones and on computers, measured on demand.',
  },
  {
    title: 'Uptime',
    body: 'Every check against the site, and every outage with how long it ran.',
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
    <div className="max-w-[30rem]">
      <h2 className={TYPE.h3}>Every figure for the site built for your business, in one place.</h2>
      <CheckList items={HOLDS} className="mt-6" />

      {/* The pair holds its height before the feed answers, so the column
          does not grow under a reader who is already typing. */}
      <dl className="mt-8 grid grid-cols-2 gap-6">
        <div>
          <dt className={TYPE.small}>Sites up</dt>
          <dd className={`${TYPE.figure} mt-2`}>{sites.length ? `${up}/${sites.length}` : '—'}</dd>
        </div>
        <div>
          <dt className={TYPE.small}>Uptime, last 30 days</dt>
          <dd className={`${TYPE.figure} mt-2`}>
            {uptime === null ? '—' : `${uptime.toFixed(2)}%`}
          </dd>
        </div>
      </dl>
    </div>
  )
}
