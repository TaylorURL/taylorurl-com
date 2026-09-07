import { useEffect, useRef, useState } from 'react'
import { Gauge } from 'lucide-react'
import CheckProgress from '@components/conversion/CheckProgress'
import CheckStage from '@components/conversion/CheckStage'
import CtaSection from '@components/conversion/CtaSection'
import Mesh from '@components/mesh/Mesh'
import PageHero from '@components/page-bands/PageHero'
import Seo from '@components/Seo'
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { breadcrumbSchema } from '@constants/seo'
import { TICK_MS } from '@app/tools/lib/progress'
import { useToast } from '@hooks/chrome/useToast'
import { STAGES, runSpeedCheck, speedCheckErrorMessage, stageIndex } from '@data/leads/speedCheck'
import { isValidEmail } from '@utils/validation'

/**
 * The reading a site gets asked for by the person who owns it.
 *
 * It is the same report the studio measures a site by anywhere else: Google's
 * mobile PageSpeed run, the band the score lands in, the categories the same
 * report marked short, and a capture of the page as it loaded. The endpoint
 * composes none of that - it reads it out of the modules the rest of the site
 * reads it out of - so a figure here and a figure quoted anywhere else are the
 * same figure.
 *
 * The wait is most of a minute and the endpoint says which stage it is on as
 * each finishes, so the panel that holds the wait is the same box, in the same
 * place, as the panel that stood there before the run started. Nothing on the
 * page moves when the reading lands except that box's contents.
 */

const LABEL = 'section-label-sm mb-2 block text-paper-faint'
const FAULT = 'mt-2 text-[13px] leading-snug text-[color:var(--danger-on-paper)]'
const GROUND = GROUNDS.paper

const STAGE_LABELS = STAGES.map(stage => stage.label)

const WAIT_NOTE =
  'Google loads the page on its own hardware, which takes most of a minute. Leave this open.'

// The three bands, in the tones the sheet can carry. The ink is a token in
// every case: a band drawn in a literal is a band that reads correctly under
// one theme and disappears under another.
const BANDS = {
  poor: { label: 'Poor', ink: 'text-[color:var(--danger-on-paper)]' },
  fair: { label: 'Needs Improvement', ink: 'text-[color:var(--warn-on-paper)]' },
  good: { label: 'Good', ink: 'text-[color:var(--good-on-paper)]' },
  plain: { label: 'Not Scored', ink: 'text-ink-paper' },
}

const FIELDS = { site: 'speed-check-site', email: 'speed-check-email' }

/** What is wrong with one field, or nothing. */
function faultIn(field, values) {
  if (field === 'site' && !values.site.trim()) return 'Enter a web address.'
  if (field === 'email' && !values.email.trim()) return 'Enter an email address.'
  if (field === 'email' && !isValidEmail(values.email.trim())) {
    return 'That does not look like an email address.'
  }
  return null
}

/** One score in its band, as a cell of the mesh the categories are laid on. */
function Figure({ label, value, band, cell }) {
  const tone = BANDS[band] ?? BANDS.plain
  return (
    <div className={`p-5 ${cell}`}>
      <p className={`section-label-sm ${GROUND.meta}`}>{label}</p>
      <p className={`mt-2 text-[28px] font-semibold tabular-nums tracking-tight ${tone.ink}`}>
        {value === null ? '—' : value}
      </p>
    </div>
  )
}

/**
 * The reading, once it has landed.
 *
 * The headline figure carries the only colour in the block. The categories
 * beside it are corroboration that the page was read rather than pinged, and a
 * second use of the band colour would open a second verdict next to the one the
 * reading is about.
 */
function Reading({ reading }) {
  const tone = BANDS[reading.band] ?? BANDS.plain

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      <div className="space-y-10">
        <div className={`p-8 ${GROUND.shell}`}>
          <p className="section-label-sm text-accent">Mobile Performance</p>
          <p className="mt-2 break-all text-[16px] font-semibold tracking-tight text-ink-paper">
            {reading.host}
          </p>

          <div className="mt-7 flex items-end gap-5">
            <span
              className={`display-2 font-semibold tabular-nums leading-none tracking-tightest ${tone.ink}`}
            >
              {reading.score === null ? '—' : reading.score}
            </span>
            <span className={`section-label-sm pb-2 ${tone.ink}`}>{tone.label}</span>
          </div>

          <p className={`mt-6 text-[16px] leading-relaxed ${GROUND.body}`}>{reading.verdict}</p>

          <p
            className={`mt-7 border-t pt-6 text-[14px] leading-relaxed ${GROUND.rule} ${GROUND.meta}`}
          >
            {reading.verify.lead}{' '}
            <a className="accent-underline text-accent" href={reading.verify.href}>
              {reading.verify.link}
            </a>
            . {reading.verify.tail}
          </p>
        </div>

        <div>
          <p className="section-label text-accent">The Same Report, in Full</p>
          <Mesh items={reading.categories} className="mt-5" columns={{ base: 2, sm: 4 }}>
            {(category, index, cell) => (
              <Figure
                key={category.label}
                label={category.label}
                value={category.value}
                band={category.band}
                cell={cell}
              />
            )}
          </Mesh>
          <p className={`mt-4 text-[14px] leading-relaxed ${GROUND.meta}`}>
            Anything under {reading.goodFloor} sits below the band Google calls good.
          </p>
        </div>

        {reading.metrics.length > 0 && (
          <div>
            <p className="section-label text-accent">What the Score Is Built From</p>
            <dl className={`divide-hair-paper mt-5 divide-y border-y ${GROUND.rule}`}>
              {reading.metrics.map(metric => (
                <div key={metric.label} className="flex items-baseline justify-between gap-6 py-4">
                  <dt className={`text-[15px] leading-snug ${GROUND.body}`}>{metric.label}</dt>
                  <dd className="font-mono text-[15px] tabular-nums tracking-tight text-ink-paper">
                    {metric.display}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="space-y-10">
        {reading.shot && (
          <div>
            <p className="section-label text-accent">The Page as It Loaded</p>
            <div className={`mt-5 ${GROUND.shell}`}>
              <img
                src={reading.shot}
                alt={`The home page at ${reading.host}`}
                width="800"
                height="750"
                loading="lazy"
                className="block h-auto w-full"
                style={{ aspectRatio: '800 / 750' }}
              />
            </div>
          </div>
        )}

        {reading.opportunities.length > 0 && (
          <div>
            <p className="section-label text-accent">The Largest Savings Named</p>
            <ul className={`divide-hair-paper mt-5 divide-y border-y ${GROUND.rule}`}>
              {reading.opportunities.map(entry => (
                <li key={entry.title} className="flex items-baseline justify-between gap-6 py-4">
                  <span className={`text-[15px] leading-snug ${GROUND.body}`}>{entry.title}</span>
                  <span className="font-mono text-[15px] tabular-nums tracking-tight text-accent">
                    {entry.savings}s
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {reading.short.length > 0 && (
          <div className={`p-8 ${GROUND.shell}`}>
            <p className="section-label-sm text-accent">Also Short of Good</p>
            <dl className="mt-5 space-y-3">
              {reading.short.map(entry => (
                <div key={entry.label} className="flex items-baseline justify-between gap-6">
                  <dt className={`text-[15px] leading-snug ${GROUND.body}`}>{entry.label}</dt>
                  <dd className="font-mono text-[15px] tabular-nums tracking-tight text-ink-paper">
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SpeedCheck() {
  const toast = useToast()
  const [values, setValues] = useState({ site: '', email: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [stage, setStage] = useState(STAGES[0].id)
  const [elapsed, setElapsed] = useState(0)
  const [reading, setReading] = useState(null)
  const [fault, setFault] = useState(null)
  const startedAt = useRef(0)

  const running = status === 'reading'

  // The elapsed count is what tells a reader the page has not died on them, so
  // it runs off a clock rather than off the stages: it keeps moving whatever
  // Google is doing, and it goes on being true past the point the last stage
  // stops saying anything new.
  useEffect(() => {
    if (!running) return undefined
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), TICK_MS)
    return () => clearInterval(tick)
  }, [running])

  const change = field => event => {
    const next = { ...values, [field]: event.target.value }
    setValues(next)
    if (errors[field] && !faultIn(field, next)) {
      setErrors(current => {
        const rest = { ...current }
        delete rest[field]
        return rest
      })
    }
  }

  const blur = field => () => {
    const said = faultIn(field, values)
    setErrors(current => (said ? { ...current, [field]: said } : current))
  }

  const run = async event => {
    event.preventDefault()
    if (running) return

    const found = {}
    for (const field of ['site', 'email']) {
      const said = faultIn(field, values)
      if (said) found[field] = said
    }
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      document.getElementById(FIELDS[first])?.focus()
      return
    }

    setStatus('reading')
    setFault(null)
    setReading(null)
    setStage(STAGES[0].id)
    startedAt.current = Date.now()
    setElapsed(0)

    try {
      const answered = await runSpeedCheck(values, { onStage: setStage })
      setReading(answered)
      setStatus('done')
    } catch (cause) {
      // Said in two places, because the wait is most of a minute and the page
      // returns to exactly what it looked like before the button was pressed.
      // The notice reaches whoever is still watching it happen; the line under
      // the button is what is left for whoever looked away and came back. Only
      // the notice announces itself, so the two are not read out twice.
      const said = speedCheckErrorMessage(cause)
      setFault(said)
      toast(said, 'error')
      setStatus('idle')
    }
  }

  return (
    <div>
      <Seo
        title="Free Mobile Website Speed Check"
        description="Measure how your website loads on a phone. Google's own mobile PageSpeed reading, the band the score lands in, and a picture of the page as it loaded."
        path="/speed-check"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Speed Check', path: '/speed-check' },
          ]),
        ]}
      />

      <PageHero
        draft="node"
        eyebrow="Speed Check"
        title="How your site loads on a phone."
        description="Google measures the page on its own hardware and scores it out of a hundred. This runs that measurement against your address and shows what came back."
      />

      <section {...GROUND.attrs} className={`section-y relative overflow-hidden ${GROUND.section}`}>
        <div className={`absolute inset-0 ${GROUND.grid} ${DRAFTS.ledger}`} aria-hidden="true" />
        <div className="container-rail relative">
          <CheckStage
            running={running}
            panel={
              running ? (
                <CheckProgress
                  address={values.site.trim()}
                  elapsed={elapsed}
                  stages={STAGE_LABELS}
                  at={stageIndex(stage)}
                  note={WAIT_NOTE}
                  ground={GROUND}
                />
              ) : (
                <div className={`p-8 ${GROUND.shell}`}>
                  <p className="section-label-sm text-accent">What Gets Measured</p>
                  <ul className={`mt-5 space-y-3 text-[15px] leading-relaxed ${GROUND.body}`}>
                    <li>How the page performs on a throttled phone, scored out of a hundred.</li>
                    <li>
                      Accessibility, build quality, and search readiness from the same report.
                    </li>
                    <li>The five timings the performance score is built from.</li>
                    <li>What the page looked like when it finished loading.</li>
                  </ul>
                  <p className={`mt-6 text-[14px] leading-relaxed ${GROUND.meta}`}>
                    This measures speed. Rankings and competitor data are not part of it.
                  </p>
                </div>
              )
            }
          >
            <form onSubmit={run} className="space-y-6" noValidate>
              <div>
                <label htmlFor={FIELDS.site} className={LABEL}>
                  Web address
                </label>
                <input
                  id={FIELDS.site}
                  name="site"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={values.site}
                  onChange={change('site')}
                  onBlur={blur('site')}
                  disabled={running}
                  aria-invalid={errors.site ? true : undefined}
                  aria-describedby={errors.site ? `${FIELDS.site}-error` : undefined}
                  className="field w-full py-3.5"
                  placeholder="yourbusiness.com"
                />
                {errors.site && (
                  <p id={`${FIELDS.site}-error`} className={FAULT} role="alert">
                    {errors.site}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={FIELDS.email} className={LABEL}>
                  Email address
                </label>
                <input
                  id={FIELDS.email}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={change('email')}
                  onBlur={blur('email')}
                  disabled={running}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? `${FIELDS.email}-error` : `${FIELDS.email}-note`}
                  className="field w-full py-3.5"
                  placeholder="you@yourbusiness.com"
                />
                {errors.email ? (
                  <p id={`${FIELDS.email}-error`} className={FAULT} role="alert">
                    {errors.email}
                  </p>
                ) : (
                  <p
                    id={`${FIELDS.email}-note`}
                    className={`mt-2 text-[14px] leading-relaxed ${GROUND.meta}`}
                  >
                    The reading appears on this page. I keep the address with it so a reply can
                    reach you, and it joins no mailing list.
                  </p>
                )}
              </div>

              <button type="submit" disabled={running} className="btn btn-primary">
                <Gauge className="h-4 w-4" aria-hidden="true" />
                {running ? 'Checking…' : 'Run the Check'}
              </button>

              {fault && (
                <p className="text-[14px] leading-snug text-[color:var(--danger-on-paper)]">
                  {fault}
                </p>
              )}
            </form>
          </CheckStage>

          {reading && (
            <div className="mt-20 animate-fade-in-up sm:mt-28">
              <Reading reading={reading} />
            </div>
          )}
        </div>
      </section>

      <CtaSection
        draft="column"
        eyebrow="Next"
        title="The number tells you where to start."
        description="If the reading found something worth fixing, the fix is a build. Tell me what the site is for and get a plan and a price back before any work starts."
      />
    </div>
  )
}
