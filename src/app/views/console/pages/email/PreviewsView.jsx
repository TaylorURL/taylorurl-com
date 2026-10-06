import { useCallback, useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { readEndpoint } from '@hooks/console/endpoint'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { ZONE } from '@lib/time/zone.js'
import {
  Badge,
  Board,
  ConsoleError,
  EmptyRow,
  Panel,
  PanelBody,
  RankedList,
  SkeletonBar,
  SkeletonRows,
} from '../../ui'
import { CELL_TIGHT as CELL, MONO_LABEL, SELECT, TH_TIGHT as TH } from '../../lib/tokens'
import { fullCount } from '../../../analytics/lib/format'

const PATH = '/api/previews-admin'
const NO_READ = 'The previews could not be read. Try again in a moment.'

/** Each count in the strip, in the order a preview moves through them. */
const COUNTS = [
  { key: 'built', label: 'Built' },
  { key: 'sent', label: 'Sent' },
  { key: 'opened', label: 'Opened' },
  { key: 'viewed', label: 'Viewed Site' },
  { key: 'followed_up', label: 'Followed Up' },
  { key: 'replied', label: 'Replied' },
]

/** Each trade a preview is built for, in the console's words. */
const INDUSTRY = {
  plumbing: 'Plumbing',
  barber: 'Barber',
  realestate: 'Real Estate',
  autorepair: 'Auto Repair',
  hvac: 'HVAC',
}

const COLUMNS = ['Company', 'Preview', 'Sent', 'Opened', 'Site Views', 'Follow-Up', 'Replied']

const VISIT_COLUMNS = [
  'Company',
  'Sessions',
  'Time on Site',
  'Deepest Scroll',
  'Most Time On',
  'Clicked',
  'Rage Clicks',
  'Device',
  'Last Visit',
]

/** What each kind of click is called in the console. */
const CLICK_KIND = {
  call: 'Call',
  email: 'Email',
  cta: 'Button',
  claim: 'Make It Yours',
  map: 'Map',
  text: 'Text',
  nav: 'Page Link',
  link: 'Link',
  button: 'Button',
  card: 'Card',
}

const industryOf = key => INDUSTRY[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : '—')

/** A section's id or bucket, in the console's words. */
const sectionLabel = name =>
  String(name)
    .replace(/[-_]+/g, ' ')
    .replace(/\b[a-z]/g, letter => letter.toUpperCase())

/** Milliseconds as a reader would say them: 45s, 3m 10s, 1h 4m. */
const spoken = ms => {
  const seconds = Math.round((ms ?? 0) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

const hostOf = url => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const dayOf = value =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        timeZone: ZONE,
        month: 'short',
        day: 'numeric',
      })
    : '—'

const whenAt = value =>
  value
    ? new Date(value).toLocaleString('en-US', {
        timeZone: ZONE,
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'

/**
 * The Previews view of the outreach console: every site built ahead of the
 * first email, and how far each one has got - sent, opened, looked at, followed
 * up and answered. It reads and changes nothing.
 */
export function PreviewsView({ token, area = 'work' }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const read = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const { response, payload } = await readEndpoint(token, PATH)
      if (!response.ok) throw faultFromResponse(response, payload, NO_READ)
      setData(payload)
      setError(null)
    } catch (cause) {
      setError(faultMessage(cause, NO_READ))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    read()
  }, [read])

  const counts = data?.counts ?? {}
  const previews = data?.previews ?? []
  const visited = previews.filter(preview => preview.behaviour?.sessions)
  const templates = data?.templates ?? {}
  const templateKeys = Object.keys(templates).sort(
    (a, b) => templates[b].sessions - templates[a].sessions
  )
  const [picked, setPicked] = useState('')
  const template = templates[picked] ? picked : (templateKeys[0] ?? '')
  const attention = templates[template] ?? { sessions: 0, sections: [], ctas: [] }

  return (
    <Board
      area={area}
      areas={['counts counts', 'list list', 'visits visits', 'sections ctas']}
      rows="auto minmax(0,1fr) minmax(0,1fr) auto"
    >
      <Panel area="counts" title="Previews" loading={loading && !data}>
        <PanelBody>
          <ConsoleError>{error}</ConsoleError>
          <dl className="grid grid-cols-3 sm:grid-cols-6">
            {COUNTS.map(({ key, label }) => (
              <div key={key} className="grid gap-1 px-5 py-3">
                <dt className={`${MONO_LABEL} text-paper-faint`}>{label}</dt>
                <dd className="text-[18px] text-ink-paper">
                  {data ? fullCount(counts[key] ?? 0) : <SkeletonBar className="my-1 w-8" />}
                </dd>
              </div>
            ))}
          </dl>
        </PanelBody>
      </Panel>

      <Panel
        area="list"
        title="All Previews"
        aside={`${fullCount(previews.length)} ${previews.length === 1 ? 'site' : 'sites'}`}
        loading={!data}
        busy={loading && Boolean(data)}
      >
        <PanelBody className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse">
            <thead>
              <tr>
                {COLUMNS.map(column => (
                  <th key={column} className={TH} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data && loading ? (
                <SkeletonRows cols={COLUMNS.length} rows={8} />
              ) : !previews.length ? (
                <EmptyRow cols={COLUMNS}>No preview has been built yet.</EmptyRow>
              ) : (
                previews.map(preview => (
                  <tr key={preview.slug} className="border-hair-paper border-t align-top">
                    <td className={CELL}>
                      <span className="block text-ink-paper">{preview.name}</span>
                      <span className="text-paper-faint block text-[12px]">
                        {INDUSTRY[preview.industry] ?? preview.industry}
                      </span>
                    </td>
                    <td className={CELL}>
                      <a
                        href={preview.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent"
                      >
                        {hostOf(preview.url)}
                        <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                      </a>
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      <span className="block text-paper-soft">{whenAt(preview.sent_at)}</span>
                      {preview.to_address && (
                        <span className="text-paper-faint block text-[12px]">
                          {preview.to_address}
                        </span>
                      )}
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      {preview.opened_at ? (
                        <>
                          <span className="block text-paper-soft">{whenAt(preview.opened_at)}</span>
                          <span className="text-paper-faint block text-[12px]">
                            {fullCount(preview.open_count ?? 0)}{' '}
                            {preview.open_count === 1 ? 'open' : 'opens'}
                          </span>
                        </>
                      ) : (
                        <span className="text-paper-faint">Not yet</span>
                      )}
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      <span className="block text-paper-soft">
                        {fullCount(preview.view_count ?? 0)}
                      </span>
                      {preview.last_viewed_at && (
                        <span className="text-paper-faint block text-[12px]">
                          {whenAt(preview.last_viewed_at)}
                        </span>
                      )}
                    </td>
                    <td className={`${CELL} whitespace-nowrap text-paper-soft`}>
                      {preview.follow_up_sent_at
                        ? whenAt(preview.follow_up_sent_at)
                        : preview.follow_up_due_at
                          ? `Due ${dayOf(preview.follow_up_due_at)}`
                          : '—'}
                    </td>
                    <td className={CELL}>
                      {preview.replied_at ? (
                        <Badge tone="good" title={whenAt(preview.replied_at)}>
                          Replied
                        </Badge>
                      ) : (
                        <span className="text-paper-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </PanelBody>
      </Panel>

      <Panel
        area="visits"
        title="Visitor Behaviour"
        aside={`${fullCount(visited.length)} ${visited.length === 1 ? 'prospect' : 'prospects'}`}
        note="Real prospects only. This table leaves out the studio's own browsers and connections, bots and link scanners, the same as Site Views."
        loading={!data}
        busy={loading && Boolean(data)}
      >
        <PanelBody className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse">
            <thead>
              <tr>
                {VISIT_COLUMNS.map(column => (
                  <th key={column} className={TH} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data && loading ? (
                <SkeletonRows cols={VISIT_COLUMNS.length} rows={4} />
              ) : !visited.length ? (
                <EmptyRow cols={VISIT_COLUMNS}>No prospect has visited a preview yet.</EmptyRow>
              ) : (
                visited.map(({ slug, name, industry, behaviour: b }) => (
                  <tr key={slug} className="border-hair-paper border-t align-top">
                    <td className={CELL}>
                      <span className="block text-ink-paper">{name}</span>
                      <span className="text-paper-faint block text-[12px]">
                        {industryOf(industry)}
                      </span>
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      <span className="block text-paper-soft">{fullCount(b.sessions)}</span>
                      <span className="text-paper-faint block text-[12px]">
                        {b.return_visits
                          ? `${fullCount(b.return_visits)} ${b.return_visits === 1 ? 'return' : 'returns'}`
                          : 'No returns'}
                      </span>
                    </td>
                    <td className={`${CELL} whitespace-nowrap text-paper-soft`}>
                      {spoken(b.active_ms)}
                    </td>
                    <td className={`${CELL} whitespace-nowrap text-paper-soft`}>
                      {b.max_scroll ? `${b.max_scroll}%` : '—'}
                    </td>
                    <td className={CELL}>
                      {b.sections?.length ? (
                        b.sections.map(section => (
                          <span key={section.name} className="block whitespace-nowrap">
                            <span className="text-paper-soft">{sectionLabel(section.name)}</span>{' '}
                            <span className="text-paper-faint text-[12px]">
                              {spoken(section.ms)}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="text-paper-faint">—</span>
                      )}
                    </td>
                    <td className={CELL}>
                      <span className="block whitespace-nowrap text-paper-soft">
                        {[
                          ['Call', b.calls],
                          ['Email', b.emails],
                          ['CTA', b.ctas],
                        ]
                          .map(([label, n]) => `${label} ${fullCount(n ?? 0)}`)
                          .join(' · ')}
                      </span>
                      {b.clicked?.slice(0, 3).map(click => (
                        <span
                          key={`${click.kind}-${click.name}`}
                          className="text-paper-faint block max-w-[16rem] truncate text-[12px]"
                          title={click.name}
                        >
                          {CLICK_KIND[click.kind] ?? 'Click'}: {click.name}
                          {click.n > 1 ? ` (${fullCount(click.n)})` : ''}
                        </span>
                      ))}
                    </td>
                    <td className={CELL}>
                      {b.rage_clicks ? (
                        <Badge tone="warn" title={`${fullCount(b.dead_clicks ?? 0)} dead clicks`}>
                          {fullCount(b.rage_clicks)}
                        </Badge>
                      ) : (
                        <span className="text-paper-faint">0</span>
                      )}
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      <span className="block capitalize text-paper-soft">
                        {b.last_device ?? '—'}
                      </span>
                      {b.last_system?.trim() && (
                        <span className="text-paper-faint block text-[12px]">
                          {b.last_system.trim()}
                        </span>
                      )}
                    </td>
                    <td className={`${CELL} whitespace-nowrap text-paper-soft`}>
                      {whenAt(b.last_seen_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </PanelBody>
      </Panel>

      <Panel
        area="sections"
        title="Sections That Hold Attention"
        aside={
          template
            ? `${fullCount(attention.sessions)} ${attention.sessions === 1 ? 'session' : 'sessions'}`
            : null
        }
        tools={
          templateKeys.length > 1 ? (
            <select
              aria-label="Template"
              className={SELECT}
              value={template}
              onChange={event => setPicked(event.target.value)}
            >
              {templateKeys.map(key => (
                <option key={key} value={key}>
                  {industryOf(key)}
                </option>
              ))}
            </select>
          ) : template ? (
            <span className={`${MONO_LABEL} text-paper-faint`}>{industryOf(template)}</span>
          ) : null
        }
        loading={!data}
      >
        <RankedList
          rows={attention.sections ?? []}
          nameOf={row => sectionLabel(row.name)}
          valueOf={row => (row.sessions ? row.ms / row.sessions : 0)}
          formatValue={value => `${spoken(value)} avg`}
          empty="No prospect has spent time on a section of this template yet."
          loading={!data && loading}
          dense
        />
      </Panel>

      <Panel
        area="ctas"
        title="Calls to Action"
        aside={template ? industryOf(template) : null}
        loading={!data}
      >
        <RankedList
          rows={attention.ctas ?? []}
          nameOf={row =>
            `${CLICK_KIND[row.kind] ?? 'Click'}: ${row.name}${row.hovers ? ` · ${fullCount(row.hovers)} ${row.hovers === 1 ? 'hover' : 'hovers'}` : ''}`
          }
          valueOf={row => row.clicks}
          formatValue={value => `${fullCount(value)} ${value === 1 ? 'click' : 'clicks'}`}
          empty="No prospect has clicked or hovered a call to action on this template yet."
          loading={!data && loading}
          dense
        />
      </Panel>
    </Board>
  )
}
