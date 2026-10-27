import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Phone } from 'lucide-react'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, START_LINK } from '@constants/navigation'
import Portrait from '@components/people/Portrait'
import { clockIn } from '@lib/time/zone.js'
import CaptureShot from '../CaptureShot'
import { PERSON, leadOf } from './boardData'

/**
 * The pieces the home page board is built from: the two ways in, the byline,
 * whether Trenton is available, the speed ring, the text thread, the client
 * site frames and the quote. Drawn here rather than inline so the board itself
 * reads as the layout it is.
 */

/**
 * The two ways in: the project form, and the number. Stacked full width on a
 * phone, where a thumb is aiming at them, and side by side from the small
 * breakpoint up. The classes are passed in because one draft stands these on
 * the accent, where the site's own primary key would vanish.
 */
export function CallActions({
  className = '',
  startClass = 'btn-primary',
  phoneClass = 'btn-secondary',
  startLabel = START_LINK.label,
}) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      <Link to={START_LINK.to} className={`btn ${startClass} group`}>
        {startLabel}
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
      <a href={COMPANY_PHONE_HREF} className={`btn ${phoneClass} tabular-nums`}>
        <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {COMPANY_PHONE}
      </a>
    </div>
  )
}

/** A quiet link with an arrow, for the one place a band points onward. */
export function ArrowLink({ to, children, className = '' }) {
  return (
    <Link
      to={to}
      className={`group inline-flex min-h-[44px] touch-manipulation items-center gap-2 text-[15px] font-medium text-ink-paper transition-colors duration-200 hover:text-[color:var(--accent-loud)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] ${className}`}
    >
      {children}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}

/**
 * Trenton's photograph and name, drawn with the site's own `Portrait` so the
 * photo is framed the way the about, contact and start pages frame it.
 * `stacked` sets the name under the photo, for a tile with more height than
 * width to spare.
 */
export function Person({
  size = 48,
  eager = false,
  stacked = false,
  className = '',
  subtitle = `${PERSON.title}, TaylorURL`,
}) {
  return (
    <div
      className={`flex ${stacked ? 'flex-col items-start gap-3' : 'items-center gap-3.5'} ${className}`}
    >
      <Portrait size={size} alt="" eager={eager} />
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight text-ink-paper">
          {PERSON.name}
        </span>
        <span className="text-paper-faint mt-0.5 block text-[13px] leading-tight">{subtitle}</span>
      </span>
    </div>
  )
}

const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
const OPENS = 8 * 60
const CLOSES = 17 * 60

/**
 * Whether Trenton is working right now, in the words a reader can act on: he
 * is available, or when he is back and that a text still lands. Read off
 * Central time with the same hours `useBusinessHours` keeps.
 */
function readHours(now) {
  const clock = clockIn(now)
  if (!clock) return null
  const weekday = WEEKDAYS.has(clock.weekday)
  if (weekday && clock.minutes >= OPENS && clock.minutes < CLOSES) {
    return { open: true, note: 'Available now' }
  }
  const morning = weekday && clock.minutes < OPENS
  const weekend =
    clock.weekday === 'Sat' ||
    clock.weekday === 'Sun' ||
    (clock.weekday === 'Fri' && clock.minutes >= CLOSES)
  const back = morning ? 'Back at 8 AM' : weekend ? 'Back Monday at 8 AM' : 'Back tomorrow at 8 AM'
  return { open: false, note: `${back}. Text anytime.` }
}

/**
 * Whether Trenton can pick up now, kept to the minute.
 *
 * The served page carries an empty line of the same height, because the build
 * has no clock worth reading; the state arrives once the page is in the
 * browser, so the markup a visitor received and the one their browser adopts
 * agree, and nothing under the line moves when it fills.
 */
export function Availability({ className = '' }) {
  const [hours, setHours] = useState(null)

  useEffect(() => {
    const read = () => setHours(readHours(new Date()))
    read()
    const tick = setInterval(read, 30 * 1000)
    return () => clearInterval(tick)
  }, [])

  return (
    <p
      className={`flex min-h-[20px] items-center gap-2.5 text-[14px] leading-[20px] text-paper-soft ${className}`}
    >
      {hours && (
        <>
          <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
            {hours.open && (
              <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--good-fill)] opacity-60 motion-reduce:hidden" />
            )}
            <span
              className={`relative h-2 w-2 rounded-full ${
                hours.open ? 'bg-[color:var(--good-fill)]' : 'bg-ink-paper/25'
              }`}
            />
          </span>
          <span
            className={hours.open ? 'font-medium text-[color:var(--good-on-paper)]' : undefined}
          >
            {hours.note}
          </span>
        </>
      )}
    </p>
  )
}

/**
 * Google's PageSpeed score drawn the way Lighthouse draws it: a ring that
 * fills to the score, in the green it gives a pass.
 */
export function ScoreRing({ score, size = 96, stroke = 6, className = '' }) {
  const r = (size - stroke) / 2
  const length = 2 * Math.PI * r
  return (
    <span
      className={`relative inline-flex flex-shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`PageSpeed score ${score} out of 100`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-[color:var(--good-wash)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - score / 100)}
          className="stroke-[color:var(--good-fill)]"
        />
      </svg>
      <span
        className="absolute font-semibold tabular-nums tracking-[-0.03em] text-[color:var(--good-on-paper)]"
        style={{ fontSize: size * 0.34 }}
        aria-hidden="true"
      >
        {score}
      </span>
    </span>
  )
}

/**
 * How a change gets made, drawn as the text thread it is. The two messages are
 * an illustration of the process rather than a quote from a client, so neither
 * side carries a client's name.
 */
export function TextThread({ className = '' }) {
  return (
    <figure className={`flex flex-col gap-2.5 ${className}`}>
      <figcaption className="sr-only">An example of a change sent by text</figcaption>
      <p className="text-paper-faint text-center font-mono text-[11px]">Tue 9:12 AM</p>
      <p className="bg-surface-2 max-w-[85%] self-start rounded-[18px] rounded-bl-[6px] px-4 py-2.5 text-[15px] leading-snug text-ink-paper">
        Closing at 3 on Friday for the holiday. Can you put that on the site?
      </p>
      <p className="max-w-[85%] self-end rounded-[18px] rounded-br-[6px] bg-[color:var(--accent-fill)] px-4 py-2.5 text-[15px] leading-snug text-[color:var(--on-accent)]">
        Done. It’s on the home page and your Google hours match.
      </p>
      <p className="text-paper-faint text-right font-mono text-[11px]">Read 9:26 AM</p>
    </figure>
  )
}

/**
 * A client's live site in a browser frame, with its address in the bar. The
 * address is the proof - a real hostname a reader can go and open - so it is
 * printed rather than left to the picture.
 */
export function SiteFrame({ project, className = '' }) {
  return (
    <div
      className={`border-hair-paper overflow-hidden rounded-[var(--r-card)] border bg-[color:var(--paper-field)] shadow-[var(--lift)] ${className}`}
    >
      <div
        className="border-hair-paper flex h-8 items-center gap-1.5 border-b px-3"
        aria-hidden="true"
      >
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-ink-paper/15" />
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-ink-paper/15" />
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-ink-paper/15" />
        <span className="text-paper-faint ml-1.5 truncate font-mono text-[11px]">
          {project.displayUrl}
        </span>
      </div>
      <CaptureShot
        project={project}
        device="desktop"
        alt={`The ${project.name} home page`}
        className="block aspect-[1200/750] w-full object-cover object-top"
      />
    </div>
  )
}

/** The same client site as a phone shows it. */
export function PhoneFrame({ project, eager = false, className = '' }) {
  return (
    <div
      className={`rounded-[var(--device-shell)] bg-[color:var(--device-body)] p-2 shadow-[var(--lift)] ${className}`}
    >
      <CaptureShot
        project={project}
        device="phone"
        eager={eager}
        alt={`The ${project.name} site on a phone`}
        className="block aspect-[390/844] w-full rounded-[var(--device-screen)] object-cover object-top"
      />
    </div>
  )
}

/**
 * A review, quoted as its first sentences, with who wrote it and where. A
 * network that rates out of five gets its stars; one that only recommends says so.
 */
export function Quote({
  review,
  sentences = 1,
  className = '',
  size = 'text-[24px] sm:text-[30px]',
}) {
  const lead = leadOf(review.quote, sentences)
  return (
    <figure className={className}>
      <blockquote
        className={`${size} font-semibold leading-[1.18] tracking-[-0.03em] text-ink-paper [text-wrap:pretty]`}
      >
        “{lead}”
      </blockquote>
      <figcaption className="text-paper-faint mt-5 flex flex-wrap items-center gap-x-2 text-[14px]">
        <span className="font-medium text-ink-paper">{review.name}</span>
        <span aria-hidden="true">·</span>
        <span>{review.business}</span>
        <span aria-hidden="true">·</span>
        <span>
          {review.rating
            ? `${review.rating}/5 on ${review.network}`
            : `Recommends on ${review.network}`}
        </span>
      </figcaption>
    </figure>
  )
}
