import { useState } from 'react'
import { Gauge } from 'lucide-react'
import CheckProgress from '@components/conversion/CheckProgress'
import CheckScope from '@components/conversion/CheckScope'
import { CallToAction, Section, StatPanel } from '@components/kit/Kit'
import { BUTTONS, CARD, TYPE } from '@components/kit/styles'
import Seo from '@components/Seo'
import { breadcrumbSchema } from '@constants/seo'
import { useToast } from '@hooks/chrome/useToast'
import { STAGES, runSpeedCheck, speedCheckErrorMessage, stageIndex } from '@data/leads/speedCheck'
import { isValidEmail } from '@utils/validation'
import { FIELD_FAULT, FIELD_LABEL } from '@constants/grounds'
import { BANDS, RUN_FAULT } from './lib/bands'
import { useElapsed } from './lib/useElapsed'
import { ScoreRing, ToolHero } from './parts'

/**
 * The reading a site gets asked for by the person who owns it.
 *
 * It is the same report the studio measures a site by anywhere else: Google's
 * mobile PageSpeed run, the band the score lands in, the categories the same
 * report marked short, the frames the run recorded while the page loaded, and
 * a capture of the page as it loaded. The endpoint composes none of that - it
 * reads it out of the modules the rest of the site reads it out of - so a
 * figure here and a figure quoted anywhere else are the same figure.
 *
 * The address and the email sit in a card at the top. The wait is most of a
 * minute and the endpoint says which stage it is on as each finishes, so the
 * card counting the wait out stands under the form, where the reading will
 * land, and nothing else on the page moves.
 */

const STAGE_LABELS = STAGES.map(stage => stage.label)

const WAIT_NOTE =
  'Google loads the page on its own hardware, which takes most of a minute. Leave this open.'

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

/**
 * The strip's columns, by how many frames it holds.
 *
 * A phone takes the strip in two rows and anything wider takes it in one, so
 * each frame is drawn about the same size everywhere. Every class is written
 * out, because the stylesheet is built by reading this file and a name put
 * together at runtime is a name it never sees.
 */
const STRIP_COLUMNS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-3 sm:grid-cols-6',
  7: 'grid-cols-4 sm:grid-cols-7',
  8: 'grid-cols-4 sm:grid-cols-8',
  9: 'grid-cols-5 sm:grid-cols-9',
  10: 'grid-cols-5 sm:grid-cols-10',
  11: 'grid-cols-6 sm:grid-cols-11',
  12: 'grid-cols-6 sm:grid-cols-12',
}

// What each frame shows, as the end of the sentence its picture is described
// by. The usable frames are described by whichever moment the strip was marked
// at, since the two marks name different things.
const SHOWS = {
  blank: 'nothing on the screen yet',
  painting: 'the page partly drawn',
  painted: 'the page on the screen',
  usable: {
    largest_contentful_paint: 'the main content showing',
    speed_index: 'most of the page drawn',
  },
}

// The note under the strip, a sentence at a time. The frames come from one
// load over Google's own connection, and the timings listed under them are
// Google's working-out of the same load on a phone, so the note says which is
// which before the two numbers can be read as one contradicting the other.
const STRIP_NOTE =
  "Google's test recorded the screen as your page loaded over Google's own fast connection."

const MARK_NOTES = {
  largest_contentful_paint: 'The marked frame is the first with the main content showing.',
  speed_index: 'The marked frame is the first with most of the page drawn.',
}

const PHONE_NOTE =
  'On a mid-range phone over a slower mobile connection, Google expects that to take'

/** What one frame shows, said for somebody who cannot see it. */
function frameAlt(frame, mark) {
  const shows = frame.phase === 'usable' ? SHOWS.usable[mark] : SHOWS[frame.phase]
  return `At ${frame.time}, ${shows || SHOWS.painted}`
}

/**
 * The test load, frame by frame.
 *
 * The frames are Google's own, recorded while it loaded the page, so they show
 * the reader their own site the way a visitor meets it: white for as long as it
 * is white, half drawn for as long as it is half drawn. The marked frame is the
 * first one usable, and it is marked by a blue fill behind it rather than a
 * second colour on the picture, so the strip carries no verdict of its own
 * beside the one the score already gives.
 *
 * Every frame is described by what it shows at its time, and the times read
 * under each frame are left to the descriptions for a screen reader, which
 * would otherwise hear each time twice.
 */
function Filmstrip({ strip, host }) {
  const count = strip.frames.length
  // Two rows on a phone leave one cell short on an odd count, and the last
  // frame takes the gap rather than leaving an empty box at the end of the row.
  const short = count > 5 && count % 2 === 1
  const helper = 'speed-check-filmstrip-note'
  const note = [STRIP_NOTE]
  if (MARK_NOTES[strip.mark]) {
    note.push(MARK_NOTES[strip.mark])
    if (strip.phoneAt) note.push(`${PHONE_NOTE} ${strip.phoneAt}.`)
  }

  return (
    <div className={`${CARD} p-5 sm:p-7`}>
      <h3 className={TYPE.h3}>What Google&rsquo;s test showed, frame by frame</h3>
      <ol
        className={`mt-5 grid gap-2 ${STRIP_COLUMNS[count] ?? STRIP_COLUMNS[12]}`}
        aria-label={`The test load of ${host}, frame by frame`}
        aria-describedby={helper}
      >
        {strip.frames.map((frame, index) => (
          <li
            key={frame.at}
            className={`rounded-[10px] p-1.5 ${
              frame.marked ? 'bg-[rgba(59,107,255,0.22)]' : 'bg-[var(--card-hi)]'
            } ${short && index === count - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
          >
            <img
              src={frame.src}
              alt={frameAlt(frame, strip.mark)}
              width={strip.width ?? undefined}
              height={strip.height ?? undefined}
              loading="lazy"
              decoding="async"
              className={`mx-auto block h-auto rounded-[6px] ${
                short && index === count - 1 ? 'w-1/2 sm:w-full' : 'w-full'
              }`}
              style={
                strip.width && strip.height
                  ? { aspectRatio: `${strip.width} / ${strip.height}` }
                  : undefined
              }
            />
            <p
              aria-hidden="true"
              className={`mt-1.5 text-center text-[12px] tabular-nums ${
                frame.marked ? 'font-semibold text-[color:var(--link)]' : 'text-ink-mute'
              }`}
            >
              {frame.time}
            </p>
          </li>
        ))}
      </ol>
      <p id={helper} className={`${TYPE.small} mt-4`}>
        {note.join(' ')}
      </p>
    </div>
  )
}

/** Label and figure rows in a card: no rule between them, just the space. */
function Rows({ title, rows }) {
  return (
    <div className={`${CARD} p-6 sm:p-7`}>
      <h3 className={TYPE.h3}>{title}</h3>
      <dl className="mt-4 space-y-1">
        {rows.map(row => (
          <div key={row.label} className="flex items-baseline justify-between gap-6 py-2">
            <dt className="text-[15px] leading-snug text-ink-soft">{row.label}</dt>
            <dd
              className={`shrink-0 text-[15px] font-medium tabular-nums ${row.ink || 'text-ink'}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * The reading, once it has landed.
 *
 * The headline figure carries the only colour in the block. The categories
 * under it are corroboration that the page was read rather than pinged, and a
 * second use of the band colour would open a second verdict next to the one the
 * reading is about.
 */
function Reading({ reading }) {
  const tone = BANDS[reading.band] ?? BANDS.plain

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className={`${CARD} p-6 sm:p-8`}>
          <p className={TYPE.label}>Mobile performance</p>
          <p className="mt-1.5 break-all text-[17px] font-medium text-ink">{reading.host}</p>

          <div className="mt-7 flex items-center gap-5">
            <ScoreRing score={reading.score} stroke={tone.stroke} size={84} width={6} />
            <div>
              <span
                className={`block text-[52px] font-semibold tabular-nums leading-none tracking-[-0.03em] ${tone.ink}`}
              >
                {reading.score === null ? '—' : reading.score}
              </span>
              <span className={`mt-2 block text-[15px] font-medium ${tone.ink}`}>{tone.label}</span>
            </div>
          </div>

          <p className={`${TYPE.body} mt-6`}>{reading.verdict}</p>

          <p className={`${TYPE.small} mt-5`}>
            {reading.verify.lead}{' '}
            <a
              className="text-[color:var(--link)] underline underline-offset-[3px] hover:text-ink"
              href={reading.verify.href}
            >
              {reading.verify.link}
            </a>
            . {reading.verify.tail}
          </p>
        </div>

        {reading.shot && (
          <figure className={`${CARD} p-5 sm:p-6`}>
            <figcaption className={TYPE.h3}>The page as it loaded</figcaption>
            <img
              src={reading.shot}
              alt={`The home page at ${reading.host}`}
              width="800"
              height="750"
              loading="lazy"
              className="mt-4 block h-auto w-full rounded-[10px] bg-[var(--card-hi)]"
              style={{ aspectRatio: '800 / 750' }}
            />
          </figure>
        )}
      </div>

      <div>
        <h3 className={`${TYPE.h3} mb-4 mt-10`}>The same report, in full</h3>
        <StatPanel
          items={reading.categories.map(category => ({
            label: category.label,
            value: category.value === null ? '—' : String(category.value),
          }))}
        />
        <p className={`${TYPE.small} mt-3`}>
          Anything under {reading.goodFloor} sits below the band Google calls good.
        </p>
      </div>

      {reading.filmstrip && <Filmstrip strip={reading.filmstrip} host={reading.host} />}

      {(reading.metrics.length > 0 ||
        reading.opportunities.length > 0 ||
        reading.short.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {reading.metrics.length > 0 && (
            <Rows
              title="What the score is built from"
              rows={reading.metrics.map(metric => ({
                label: metric.label,
                value: metric.display,
              }))}
            />
          )}
          {(reading.opportunities.length > 0 || reading.short.length > 0) && (
            <div className="space-y-5">
              {reading.opportunities.length > 0 && (
                <Rows
                  title="The largest savings named"
                  rows={reading.opportunities.map(entry => ({
                    label: entry.title,
                    value: `${entry.savings}s`,
                    ink: 'text-[color:var(--link)]',
                  }))}
                />
              )}
              {reading.short.length > 0 && (
                <Rows
                  title="Also short of good"
                  rows={reading.short.map(entry => ({ label: entry.label, value: entry.value }))}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SpeedCheck() {
  const toast = useToast()
  const [values, setValues] = useState({ site: '', email: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [stage, setStage] = useState(STAGES[0].id)
  const [reading, setReading] = useState(null)
  const [fault, setFault] = useState(null)

  const running = status === 'reading'

  const { elapsed, restart } = useElapsed(running)

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
    restart()

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

      <ToolHero
        title="How your site loads on a phone."
        lead="Google measures the page on its own hardware and scores it out of a hundred."
        narrow
      >
        <div className={`${CARD} p-6 sm:p-8`}>
          <form onSubmit={run} className="space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor={FIELDS.site} className={FIELD_LABEL}>
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
                  className="field disabled:[--field-ring:transparent]"
                  placeholder="yourbusiness.com"
                />
                {errors.site && (
                  <p id={`${FIELDS.site}-error`} className={FIELD_FAULT} role="alert">
                    {errors.site}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={FIELDS.email} className={FIELD_LABEL}>
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
                  className="field disabled:[--field-ring:transparent]"
                  placeholder="you@yourbusiness.com"
                />
                {/* What the address is kept for, said where it is asked for.
                    It is the one note on the form, because it is a promise
                    about somebody's data rather than help with the box. */}
                {errors.email ? (
                  <p id={`${FIELDS.email}-error`} className={FIELD_FAULT} role="alert">
                    {errors.email}
                  </p>
                ) : (
                  <p id={`${FIELDS.email}-note`} className="mt-2 text-[14px] text-ink-mute">
                    The reading appears on this page. I keep the address with it so a reply can
                    reach you, and it joins no mailing list.
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={running}
              className={`${BUTTONS.primary} w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto`}
            >
              <Gauge className="h-4 w-4" aria-hidden="true" />
              {running ? 'Checking…' : 'Run the Check'}
            </button>

            {fault && <p className={RUN_FAULT}>{fault}</p>}
          </form>
        </div>

        {running ? (
          <CheckProgress
            address={values.site.trim()}
            elapsed={elapsed}
            stages={STAGE_LABELS}
            at={stageIndex(stage)}
            note={WAIT_NOTE}
          />
        ) : (
          !reading && (
            <CheckScope
              title="What gets measured"
              items={[
                'How the page performs on a throttled phone, scored out of a hundred.',
                'Accessibility, build quality, and search readiness from the same report.',
                'The five timings the performance score is built from.',
                'What the screen showed at each step of the load.',
                'What the page looked like when it finished loading.',
              ]}
              note="This measures speed. Rankings and competitor data are not part of it."
            />
          )
        )}
      </ToolHero>

      {reading && (
        <Section label="The reading" className="!pt-0">
          <Reading reading={reading} />
        </Section>
      )}

      <CallToAction title="The number tells you where to start." />
    </div>
  )
}
