import { useState } from 'react'
import { AlertTriangle, Check, Minus, Search } from 'lucide-react'
import CheckProgress from '@components/conversion/CheckProgress'
import CheckScope from '@components/conversion/CheckScope'
import { Section, TextLink } from '@components/kit/Kit'
import { BUTTONS, CARD, TYPE } from '@components/kit/styles'
import ToolEnquiry from './ToolEnquiry'
import { enquiryLines, reportFor } from '@app/tools/lib/findings'
import { NAV_GROUPS } from '@constants/navigation'
import { STAGES, stageAt } from '@app/tools/lib/progress'
import { useToast } from '@hooks/chrome/useToast'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { FIELD_LABEL } from '@constants/grounds'
import { RUN_FAULT, toneOf } from './lib/bands'
import { useElapsed } from './lib/useElapsed'
import { ScoreRing, ToolHero } from './parts'

// What a reading that did not land says when nothing better came back with it.
// It names the address rather than whatever failed behind it, because the
// address is the half of this the reader can do something about.
const NOT_READ = 'That address could not be read. Check the spelling and run it again.'

const STAGE_LABELS = STAGES.map(stage => stage.label)

// What each state looks like in the report. A pass is drawn as plainly as a
// failure, because a report that shouts about what is wrong and whispers what
// is right is one nobody trusts the second time.
const STATES = {
  fail: {
    mark: AlertTriangle,
    label: 'Costing you',
    tone: 'text-[color:var(--danger)]',
    wash: 'bg-[rgba(248,113,113,0.14)]',
  },
  warn: {
    mark: AlertTriangle,
    label: 'Worth fixing',
    tone: 'text-[color:var(--warn)]',
    wash: 'bg-[rgba(251,191,36,0.14)]',
  },
  pass: {
    mark: Check,
    label: 'Passing',
    tone: 'text-[color:var(--live)]',
    wash: 'bg-[rgba(74,222,128,0.14)]',
  },
  unknown: {
    mark: Minus,
    label: 'Not read',
    tone: 'text-ink-mute',
    wash: 'bg-white/[0.06]',
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
 * The address in a card at the top, the wait and then the report under it,
 * and the way to have it put right under that. The reading itself is
 * `api/site-audit`, which returns measurements and no wording at all; every
 * sentence on the report is composed here from those figures.
 *
 * The report says what is true. A check that passes is shown passing and a
 * check that could not be taken is shown as not taken, because this is a page
 * an owner forwards to whoever built the site, and one manufactured failure in
 * it costs the whole reading its standing.
 */
export default function GooglePresenceCheck({ tool }) {
  const toast = useToast()
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('idle')
  const [reading, setReading] = useState(null)
  const [fault, setFault] = useState(null)

  const report = reading ? reportFor(reading) : null
  const running = status === 'reading'

  const { elapsed, restart } = useElapsed(running)

  // A failure here ends a wait of most of a minute, so it is said in two places
  // rather than one. The notice is what reaches somebody still watching the
  // button; the line under the form is what is left for somebody who looked
  // away during the wait and came back to a page that has quietly put itself
  // back the way it was before they pressed anything. Only the notice announces
  // itself, so the two do not read the same sentence out twice.
  const failed = said => {
    setFault(said)
    toast(said, 'error')
    setStatus('idle')
  }

  const run = async event => {
    event.preventDefault()
    if (running || !address.trim()) return

    setStatus('reading')
    setFault(null)
    setReading(null)
    restart()

    try {
      const response = await fetch(`/api/site-audit?site=${encodeURIComponent(address.trim())}`)
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        failed(faultFromResponse(response, body, NOT_READ))
        return
      }
      setReading(body)
      setStatus('done')
    } catch (cause) {
      failed(faultMessage(cause, NOT_READ))
    }
  }

  return (
    <>
      <ToolHero title="See what Google sees." lead={tool.lede} narrow>
        <div className={`${CARD} p-6 sm:p-8`}>
          <form onSubmit={run}>
            <label htmlFor="check-site" className={FIELD_LABEL}>
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
                className="field flex-1 disabled:[--field-ring:transparent]"
                placeholder="yourbusiness.com"
              />
              <button
                type="submit"
                disabled={running || !address.trim()}
                className={`${BUTTONS.primary} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {running ? 'Checking…' : 'Run the Check'}
              </button>
            </div>
            {/* The address itself is not marked wrong by any of this. What
                stands here is a run that did not finish, which is as often the
                measurement as the address, and telling a screen reader the
                field is invalid would name the wrong one. */}
            {fault && <p className={`${RUN_FAULT} mt-3`}>{fault}</p>}
          </form>
        </div>

        {running ? (
          <CheckProgress
            address={address.trim()}
            elapsed={elapsed}
            stages={STAGE_LABELS}
            at={stageAt(elapsed)}
            note="Google loads the page on its own hardware, which takes most of a minute. Leave this open."
          />
        ) : (
          !report && (
            <CheckScope
              title="What gets checked"
              items={[
                'How long the page takes to become usable on a phone.',
                'Whether your business details are in a form Google reads.',
                'What your link looks like when somebody shares it.',
                'Whether the address answers one way rather than two.',
              ]}
              note="Rankings, review counts and what competitors are doing cannot be measured for free, so they are not in this report."
            />
          )
        )}
      </ToolHero>

      {report && (
        <Section label="The report" className="!pt-0">
          <h2 className={TYPE.h2}>{headlineFor(report)}</h2>
          <p className={`${TYPE.body} mt-3`}>
            Read from {reading.site.host} just now, worst first.
          </p>
          <div className="mt-8 space-y-5">
            <Scores reading={reading} />
            <Findings report={report} />
          </div>
        </Section>
      )}

      {report && (
        <Section label="Get it fixed">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:gap-16">
            <h2 className={TYPE.h2}>Have it put right.</h2>
            <ToolEnquiry
              summary={enquiryLines(report)}
              projectType="Google Presence Check"
              idPrefix="check"
              placeholder="What does your business do, and which of these matters most to you?"
            />
          </div>
        </Section>
      )}
    </>
  )
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
  { key: 'accessibility', label: 'Usable by anyone' },
  { key: 'bestPractices', label: 'Built right' },
  { key: 'seo', label: 'Findable' },
]

/**
 * Google's own four scores, on both the phone and the desktop reading, each as
 * a ring in the band Google files it under.
 *
 * They sit above the findings rather than among them because a score out of a
 * hundred is a summary, not something an owner can act on: the findings below
 * are what actually names the work. The desktop row is dropped rather than
 * drawn empty when Google did not answer for it in time.
 */
function Scores({ reading }) {
  const rows = [
    { id: 'mobile', label: 'On a phone', scores: reading.mobile?.scores },
    { id: 'desktop', label: 'On a desktop', scores: reading.desktop?.scores },
  ].filter(row => row.scores)

  return (
    <div className={`${CARD} px-6 py-6 sm:px-8`}>
      <h3 className="sr-only">Google&rsquo;s scores out of a hundred</h3>
      <div className="space-y-7">
        {rows.map(row => (
          <div key={row.id}>
            <p className={TYPE.label}>{row.label}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
              {SCORE_ROWS.map(score => {
                const value = row.scores[score.key]
                const scored = typeof value === 'number'
                return (
                  <div key={score.key}>
                    <dt className="sr-only">{score.label}</dt>
                    <dd className="flex items-center gap-3">
                      <ScoreRing
                        score={scored ? value : null}
                        stroke={toneOf(value).stroke}
                        size={44}
                      />
                      <span>
                        <span className={`${TYPE.figure} block tabular-nums`}>
                          {scored ? value : '—'}
                        </span>
                        <span className={`${TYPE.small} mt-1 block`} aria-hidden="true">
                          {score.label}
                        </span>
                      </span>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        ))}
      </div>
      {!reading.desktop && (
        <p className={`${TYPE.small} mt-6`}>
          Google did not return a desktop reading in time. Everything below is measured from the
          phone reading, which is the one it ranks on.
        </p>
      )}
    </div>
  )
}

function Findings({ report }) {
  return (
    <ul className="space-y-2.5">
      {report.findings.map(finding => {
        const state = STATES[finding.state]
        const Mark = state.mark
        return (
          <li key={finding.id} className={`${CARD} p-6 sm:p-7`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${state.wash}`}
                >
                  <Mark className={`h-4 w-4 ${state.tone}`} strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className={`text-[13px] font-medium leading-[1.4] ${state.tone}`}>
                    {state.label} · {finding.label}
                  </p>
                  <h3 className={`${TYPE.h3} mt-1.5`}>{finding.headline}</h3>
                  <p className={`${TYPE.body} mt-2 max-w-2xl`}>{finding.detail}</p>
                </div>
              </div>
              {(finding.state === 'fail' || finding.state === 'warn') && (
                <TextLink
                  to={finding.fixes}
                  label={serviceName(finding.fixes)}
                  className="min-h-[44px] sm:ml-4"
                />
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
