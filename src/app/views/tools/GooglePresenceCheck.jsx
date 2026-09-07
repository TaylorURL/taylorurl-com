import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, Minus, Search } from 'lucide-react'
import CheckProgress from '@components/conversion/CheckProgress'
import CheckStage from '@components/conversion/CheckStage'
import StepFlow from '../start/steps/StepFlow'
import ToolEnquiry from './ToolEnquiry'
import { enquiryLines, reportFor } from '@app/tools/lib/findings'
import { NAV_GROUPS } from '@constants/navigation'
import { STAGES, TICK_MS, stageAt } from '@app/tools/lib/progress'
import { GROUND } from './lib/ground'

const LABEL = 'section-label-sm mb-2 block text-paper-faint'

const STAGE_LABELS = STAGES.map(stage => stage.label)

// What each state looks like in the report. A pass is drawn as plainly as a
// failure, because a report that shouts about what is wrong and whispers what
// is right is one nobody trusts the second time.
const STATES = {
  fail: {
    mark: AlertTriangle,
    label: 'Costing You',
    tone: 'text-[color:var(--danger-on-paper)]',
    edge: 'border-[color:var(--danger-on-paper)]/40',
  },
  warn: {
    mark: AlertTriangle,
    label: 'Worth Fixing',
    tone: 'text-accent',
    edge: 'border-accent/40',
  },
  pass: { mark: Check, label: 'Passing', tone: 'text-accent', edge: 'border-accent/30' },
  unknown: {
    mark: Minus,
    label: 'Not Read',
    tone: 'text-paper-faint',
    edge: 'border-[color:var(--paper-hairline-strong)]',
  },
}

// What each service page is called, read from the navigation because it names
// all six: the four sold as lines and the two that only have a page. A finding
// points at any of them, so the four alone would leave one link unnamed.
const SERVICE_NAMES = Object.fromEntries(
  (NAV_GROUPS.find(group => group.key === 'services')?.columns || [])
    .flatMap(column => column.items)
    .map(item => [item.to, item.label])
)

const serviceName = path => SERVICE_NAMES[path] || 'What This Covers'

/**
 * The Google Presence Check.
 *
 * Three steps: the address, the wait, and the report. The reading itself is
 * `api/site-audit`, which returns measurements and no wording at all; every
 * sentence on the report is composed here from those figures.
 *
 * The report says what is true. A check that passes is shown passing and a
 * check that could not be taken is shown as not taken, because this is a page
 * an owner forwards to whoever built the site, and one manufactured failure in
 * it costs the whole reading its standing.
 */
export default function GooglePresenceCheck({ tool }) {
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [reading, setReading] = useState(null)
  const [fault, setFault] = useState(null)
  const startedAt = useRef(0)

  const report = reading ? reportFor(reading) : null
  const running = status === 'reading'

  // The elapsed count is what tells a reader the page has not died on them, so
  // it runs off a clock rather than off the stages: it keeps moving whatever
  // Google is doing, and it goes on being true past the point the estimate
  // stops being.
  useEffect(() => {
    if (!running) return undefined
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), TICK_MS)
    return () => clearInterval(tick)
  }, [running])

  const run = async event => {
    event.preventDefault()
    if (running || !address.trim()) return

    setStatus('reading')
    setFault(null)
    setReading(null)
    startedAt.current = Date.now()
    setElapsed(0)

    try {
      const response = await fetch(`/api/site-audit?site=${encodeURIComponent(address.trim())}`)
      const body = await response.json().catch(() => null)
      if (!response.ok)
        throw new Error(
          body?.error || 'That address could not be read. Check the spelling and run it again.'
        )
      setReading(body)
      setStatus('done')
    } catch (error) {
      setFault(error.message)
      setStatus('idle')
    }
  }

  const steps = [
    {
      id: 'check-address',
      label: 'Your Address',
      eyebrow: 'Step One',
      title: tool.name,
      description: tool.lede,
      answered: status === 'done',
      content: (
        <CheckStage
          running={running}
          panel={
            running ? (
              <CheckProgress
                address={address.trim()}
                elapsed={elapsed}
                stages={STAGE_LABELS}
                at={stageAt(elapsed)}
                note="Google loads the page on its own hardware, which takes most of a minute. Leave this open."
                ground={GROUND}
              />
            ) : (
              <div className={`p-8 ${GROUND.shell}`}>
                <p className="section-label-sm text-accent">What Gets Checked</p>
                <ul className={`mt-5 space-y-3 text-[15px] leading-relaxed ${GROUND.body}`}>
                  <li>How long the page takes to become usable on a phone.</li>
                  <li>Whether your business details are in a form Google reads.</li>
                  <li>What your link looks like when somebody shares it.</li>
                  <li>Whether the address answers one way rather than two.</li>
                </ul>
                <p className={`mt-6 text-[14px] leading-relaxed ${GROUND.meta}`}>
                  Rankings, review counts and what competitors are doing cannot be measured for
                  free, so they are not in this report.
                </p>
              </div>
            )
          }
        >
          <form onSubmit={run} className="space-y-6">
            <div>
              <label htmlFor="check-site" className={LABEL}>
                Web address
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="check-site"
                  name="site"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={address}
                  onChange={event => setAddress(event.target.value)}
                  disabled={running}
                  aria-invalid={fault ? true : undefined}
                  aria-describedby={fault ? 'check-site-error' : undefined}
                  className="field flex-1 py-3.5"
                  placeholder="yourbusiness.com"
                />
                <button
                  type="submit"
                  disabled={running || !address.trim()}
                  className="btn btn-primary"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {running ? 'Checking…' : 'Run the Check'}
                </button>
              </div>
              {fault && (
                <p
                  id="check-site-error"
                  className="mt-3 text-[13px] leading-snug text-[color:var(--danger-on-paper)]"
                  role="alert"
                >
                  {fault}
                </p>
              )}
            </div>
          </form>
        </CheckStage>
      ),
    },
    {
      id: 'check-report',
      label: 'The Report',
      eyebrow: 'Step Two',
      title: report ? headlineFor(report) : 'Nothing read yet.',
      description: reading
        ? `Read from ${reading.site.host} just now, worst first.`
        : 'Run the check on step one and every finding lands here, worst first.',
      answered: true,
      content: report ? (
        <div className="space-y-10">
          <Scores reading={reading} />
          <Findings report={report} />
        </div>
      ) : null,
    },
    {
      id: 'check-fix',
      label: 'Get It Fixed',
      eyebrow: 'Step Three',
      title: 'Have it put right.',
      description:
        'The findings above travel with the message, so the reply comes from somebody who has already read them. A plan and a price come back before any work starts, and they cost nothing.',
      answered: true,
      content: report ? (
        <ToolEnquiry
          summary={enquiryLines(report)}
          projectType="Google Presence Check"
          idPrefix="check"
          placeholder="What does your business do, and which of these matters most to you?"
        />
      ) : null,
    },
  ]

  return <StepFlow steps={steps} atTop draft="plan" label="Presence check steps" />
}

/** What the report says about itself, before any single finding. */
function headlineFor(report) {
  const { fail, warn } = report.counts
  if (fail === 0 && warn === 0) return 'Nothing here needs fixing.'
  if (fail === 0) return `${warn} thing${warn === 1 ? '' : 's'} worth tightening up.`
  return `${fail} thing${fail === 1 ? '' : 's'} costing you visitors.`
}

const SCORE_ROWS = [
  { key: 'performance', label: 'Speed' },
  { key: 'accessibility', label: 'Usable by Anyone' },
  { key: 'bestPractices', label: 'Built Right' },
  { key: 'seo', label: 'Findable' },
]

/**
 * Google's own four scores, on both the phone and the desktop reading.
 *
 * They sit above the findings rather than among them because a score out of a
 * hundred is a summary, not something an owner can act on: the findings below
 * are what actually names the work. The desktop column is dropped rather than
 * drawn empty when Google did not answer for it in time.
 */
function Scores({ reading }) {
  const columns = [
    { id: 'mobile', label: 'On a Phone', scores: reading.mobile?.scores },
    { id: 'desktop', label: 'On a Desktop', scores: reading.desktop?.scores },
  ].filter(column => column.scores)

  return (
    <div className={`overflow-x-auto ${GROUND.shell}`}>
      <table className="w-full min-w-[420px] border-collapse">
        <caption className="sr-only">Google&rsquo;s scores out of a hundred</caption>
        <thead>
          <tr className={`border-b ${GROUND.rule}`}>
            <th scope="col" className={`section-label-sm p-5 text-left ${GROUND.meta}`}>
              Google&rsquo;s Scores
            </th>
            {columns.map(column => (
              <th
                key={column.id}
                scope="col"
                className="section-label-sm p-5 text-right text-accent"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SCORE_ROWS.map(row => (
            <tr key={row.key} className={`border-b last:border-b-0 ${GROUND.rule}`}>
              <th scope="row" className="p-5 text-left text-[14px] font-medium text-ink-paper">
                {row.label}
              </th>
              {columns.map(column => {
                const value = column.scores[row.key]
                return (
                  <td
                    key={column.id}
                    className="p-5 text-right font-mono text-[15px] tabular-nums text-ink-paper"
                  >
                    {typeof value === 'number' ? value : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!reading.desktop && (
        <p className={`border-t p-5 text-[13px] leading-relaxed ${GROUND.rule} ${GROUND.meta}`}>
          Google did not return a desktop reading in time. Everything below is measured from the
          phone reading, which is the one it ranks on.
        </p>
      )}
    </div>
  )
}

function Findings({ report }) {
  return (
    <ul className={`divide-hair-paper divide-y ${GROUND.shell}`}>
      {report.findings.map(finding => {
        const state = STATES[finding.state]
        const Mark = state.mark
        return (
          <li key={finding.id} className="p-6 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <span
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border ${state.edge}`}
                >
                  <Mark className={`h-4 w-4 ${state.tone}`} strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className={`section-label-sm ${state.tone}`}>
                    {state.label} · {finding.label}
                  </p>
                  <h3 className="mt-2 text-[16px] font-semibold tracking-tight text-ink-paper">
                    {finding.headline}
                  </h3>
                  <p className={`mt-2 max-w-2xl text-[15px] leading-relaxed ${GROUND.body}`}>
                    {finding.detail}
                  </p>
                </div>
              </div>
              {(finding.state === 'fail' || finding.state === 'warn') && (
                <Link
                  to={finding.fixes}
                  className="section-label-sm inline-flex min-h-[44px] flex-shrink-0 items-center rounded-[var(--r-tiny)] text-accent underline-offset-4 transition-colors duration-200 ease-out-soft hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] active:scale-[0.97]"
                >
                  {serviceName(finding.fixes)}
                </Link>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
