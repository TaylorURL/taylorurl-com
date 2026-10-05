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
  SkeletonBar,
  SkeletonRows,
} from '../../ui'
import { CELL_TIGHT as CELL, MONO_LABEL, TH_TIGHT as TH } from '../../lib/tokens'
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
}

const COLUMNS = ['Company', 'Preview', 'Sent', 'Opened', 'Site Views', 'Follow-Up', 'Replied']

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

  return (
    <Board area={area} areas={['counts', 'list']} rows="auto minmax(0,1fr)">
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
    </Board>
  )
}
