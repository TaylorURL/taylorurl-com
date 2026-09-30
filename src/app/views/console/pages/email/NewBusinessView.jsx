import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from 'lucide-react'
import { readEndpoint, writeEndpoint } from '@hooks/console/endpoint'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { LEAD_STAGES } from '@lib/new-business/stages.js'
import { ZONE } from '@lib/time/zone.js'
import {
  Badge,
  Board,
  ConsoleError,
  EmptyRow,
  Panel,
  PanelBody,
  PanelFoot,
  SkeletonBar,
  SkeletonRows,
} from '../../ui'
import {
  BUTTON,
  CELL_TIGHT as CELL,
  FIELD,
  MONO_LABEL,
  QUIET,
  TH_TIGHT as TH,
} from '../../lib/tokens'
import { fullCount } from '../../../analytics/lib/format'

const PATH = '/api/new-business-admin'
const NO_READ = 'The new businesses could not be read. Try again in a moment.'
const NO_SAVE = 'That change could not be saved. Try it again.'

/** Each stage in the console's words, and the tone its badge is drawn in. */
const STAGE = {
  waiting: { label: 'Looking', tone: 'plain' },
  emailable: { label: 'Email Found', tone: 'accent' },
  phone_only: { label: 'Phone Only', tone: 'accent' },
  contacted: { label: 'Emailed', tone: 'good' },
  replied: { label: 'Replied', tone: 'good' },
  unsubscribed: { label: 'Unsubscribed', tone: 'warn' },
  bounced: { label: 'Bounced', tone: 'bad' },
  undeliverable: { label: 'Undeliverable', tone: 'bad' },
  gave_up: { label: 'Not Found', tone: 'plain' },
}

const COLUMNS = ['Company', 'Formed', 'Where', 'Stage', 'Site', 'Contact']

const dayOf = value =>
  value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
        timeZone: ZONE,
        month: 'short',
        day: 'numeric',
      })
    : '—'

const hostOf = url => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const whenRan = value =>
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
 * The New Businesses view of the outreach console: every company Texas has
 * just registered, how far the search for each one has got, and the switch
 * and cap the emails to them go out under.
 */
export function NewBusinessView({ token, area = 'work' }) {
  const [stage, setStage] = useState(null)
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cap, setCap] = useState('')

  const read = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (stage) params.set('stage', stage)
    try {
      const { response, payload } = await readEndpoint(token, `${PATH}?${params}`)
      if (!response.ok) throw faultFromResponse(response, payload, NO_READ)
      setData(payload)
      setCap(String(payload.settings?.daily_cap ?? ''))
      setError(null)
    } catch (cause) {
      setError(faultMessage(cause, NO_READ))
    } finally {
      setLoading(false)
    }
  }, [token, stage, page])

  useEffect(() => {
    read()
  }, [read])

  const save = async change => {
    setSaving(true)
    try {
      const { response, payload } = await writeEndpoint(token, PATH, {
        action: 'settings',
        ...change,
      })
      if (!response.ok) throw faultFromResponse(response, payload, NO_SAVE)
      setData(held => (held ? { ...held, settings: payload.settings } : held))
      setCap(String(payload.settings?.daily_cap ?? ''))
      setError(null)
    } catch (cause) {
      setError(faultMessage(cause, NO_SAVE))
    } finally {
      setSaving(false)
    }
  }

  const pick = name => {
    setStage(current => (current === name ? null : name))
    setPage(0)
  }

  const counts = data?.counts ?? {}
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const sending = Boolean(data?.settings?.sending_enabled)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <Board
      area={area}
      areas={['stages list', 'switches list', 'runs list']}
      cols="minmax(16rem,0.6fr) minmax(0,1.4fr)"
      rows="auto auto minmax(0,1fr)"
    >
      <Panel
        area="stages"
        title="New Businesses"
        aside={`${fullCount(total)} on file`}
        loading={loading && !data}
      >
        <PanelBody>
          <ConsoleError>{error}</ConsoleError>
          <ul>
            {LEAD_STAGES.map(name => (
              <li key={name} className="border-hair-paper border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => pick(name)}
                  aria-pressed={stage === name}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left text-[13px] ${
                    stage === name ? 'text-accent' : 'text-ink-paper'
                  }`}
                >
                  <span>{STAGE[name].label}</span>
                  <span className={`${MONO_LABEL} text-paper-faint`}>
                    {data ? fullCount(counts[name] ?? 0) : <SkeletonBar className="w-8" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PanelBody>
      </Panel>

      <Panel
        area="switches"
        title="Sending"
        aside={`${fullCount(data?.sent_today ?? 0)} sent today`}
        loading={!data}
      >
        <PanelBody>
          <div className="grid gap-3 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={sending ? 'good' : 'plain'}>{sending ? 'On' : 'Off'}</Badge>
              <button
                type="button"
                disabled={saving || !data}
                onClick={() => save({ sending_enabled: !sending })}
                className={QUIET}
              >
                {sending ? (
                  <Pause className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Play className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                )}
                {sending ? 'Pause Sending' : 'Resume Sending'}
              </button>
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={event => {
                event.preventDefault()
                save({ daily_cap: Number(cap) })
              }}
            >
              <label className="grid flex-1 gap-1">
                <span className={`${MONO_LABEL} text-paper-faint`}>Emails a Day</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  inputMode="numeric"
                  value={cap}
                  onChange={event => setCap(event.target.value)}
                  className={FIELD}
                />
              </label>
              <button type="submit" disabled={saving || !data} className={BUTTON}>
                Save
              </button>
            </form>
            <p className="text-[13px] leading-relaxed text-paper-soft">
              Emails go out from the outreach mailbox in the same hours outreach sends, newest
              companies first. Companies with only a phone number are on the call list.
            </p>
          </div>
        </PanelBody>
      </Panel>

      <Panel area="runs" title="Runs" aside="the last twelve">
        <PanelBody>
          <ul>
            {(data?.runs ?? []).map(run => (
              <li
                key={`${run.job}-${run.started_at}`}
                className="border-hair-paper grid gap-1 border-b px-5 py-2.5 last:border-b-0"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className={`${MONO_LABEL} text-ink-paper`}>{run.job}</span>
                  <span className={`${MONO_LABEL} text-paper-faint`}>
                    {whenRan(run.started_at)}
                  </span>
                </span>
                <span
                  className={`text-[12px] leading-relaxed ${run.error ? 'text-[color:var(--bad)]' : 'text-paper-soft'}`}
                >
                  {run.error || run.note || (run.finished_at ? 'Finished.' : 'Running.')}
                </span>
              </li>
            ))}
            {data && !data.runs?.length && (
              <li className="px-5 py-4 text-[13px] text-paper-soft">No runs yet.</li>
            )}
          </ul>
        </PanelBody>
      </Panel>

      <Panel
        area="list"
        title={stage ? STAGE[stage].label : 'Found Online'}
        aside={`${fullCount(data?.total ?? 0)} companies`}
        loading={!data}
        busy={loading && Boolean(data)}
      >
        <PanelBody className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse">
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
              ) : !data?.leads?.length ? (
                <EmptyRow cols={COLUMNS}>
                  {stage
                    ? 'No companies at this stage yet.'
                    : 'No company has been found online yet.'}
                </EmptyRow>
              ) : (
                data.leads.map(lead => (
                  <tr key={lead.id} className="border-hair-paper border-t align-top">
                    <td className={`${CELL} text-ink-paper`}>{lead.name}</td>
                    <td className={`${CELL} whitespace-nowrap text-paper-soft`}>
                      {dayOf(lead.formed_on)}
                    </td>
                    <td className={`${CELL} text-paper-soft`}>
                      {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className={CELL}>
                      <Badge tone={STAGE[lead.stage]?.tone ?? 'plain'}>
                        {STAGE[lead.stage]?.label ?? lead.stage}
                      </Badge>
                    </td>
                    <td className={CELL}>
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent"
                        >
                          {hostOf(lead.website)}
                          <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-paper-faint">—</span>
                      )}
                    </td>
                    <td className={`${CELL} text-paper-soft`}>
                      {[lead.email, lead.phone].filter(Boolean).join(' · ') || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </PanelBody>
        <PanelFoot className="flex items-center justify-end gap-2">
          <button
            type="button"
            className={QUIET}
            disabled={page === 0 || loading}
            onClick={() => setPage(at => Math.max(0, at - 1))}
          >
            <ChevronLeft className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
            Previous
          </button>
          <span className={`${MONO_LABEL} text-paper-faint`}>
            Page {page + 1} of {pages}
          </span>
          <button
            type="button"
            className={QUIET}
            disabled={page + 1 >= pages || loading}
            onClick={() => setPage(at => at + 1)}
          >
            Next
            <ChevronRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </PanelFoot>
      </Panel>
    </Board>
  )
}
