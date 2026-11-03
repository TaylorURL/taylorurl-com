import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Phone, Plus } from 'lucide-react'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, START_LINK } from '@constants/navigation'
import { portfolioPreviewSrc } from '@data/portfolio'
import { retryable } from '@utils/retryImage'
import { SITE } from '../../../../lib/site/current.js'
import { BUTTONS, PROSE, TYPE } from './styles'

/*
 * THE KIT - every piece a public page is built from, in the "Signal" look.
 *
 * A page is a night masthead over a blueprint grid that says what the page is
 * and how to ask, then paper chapters numbered 01, 02, 03 that each say one
 * thing, then the signal-blue band that asks again. Headlines are set very
 * large and end on a blue square instead of a full stop. Every label, figure
 * and address is Geist Mono in capitals. Corners are square. Nothing moves.
 *
 * The frames this is built from are on the "Redesign — Signal" page of the
 * Figma file "TaylorURL — Simpler Redesign".
 */

/** The column every section sits in: 1120 wide, with the page's side gutters. */
export function Container({ as: Tag = 'div', className = '', children, narrow = false }) {
  const width = narrow ? 'max-w-[760px]' : 'max-w-[1120px]'
  return (
    <Tag className={`mx-auto w-full ${width} px-5 sm:px-8 ${className}`.trim()}>{children}</Tag>
  )
}

const KICKER_TONE = {
  night: 'text-[color:var(--light-soft)]',
  paper: 'text-ink-mute',
  blue: 'text-[color:var(--signal)]',
  white: 'text-white',
}

/** A mono label in capitals: what a page or a section is, or a readout's name. */
export function Kicker({ children, tone = 'paper', as: Tag = 'p', className = '' }) {
  return <Tag className={`${TYPE.mono} ${KICKER_TONE[tone]} ${className}`.trim()}>{children}</Tag>
}

/** The square a headline ends on, in place of its full stop. */
export function Square() {
  return <span className="signal-square" aria-hidden="true" />
}

/** A route on this site or an outside address, drawn as one of the buttons. */
export function Button({ to, href, look = 'blue', arrow = true, className = '', children, ...rest }) {
  const style = `${BUTTONS[look]} ${className}`.trim()
  const inner = (
    <>
      <span>{children}</span>
      {arrow && <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={style} {...rest}>
        {inner}
      </Link>
    )
  }
  return (
    <a href={href} className={style} {...rest}>
      {inner}
    </a>
  )
}

/** The phone number as a button. */
export function PhoneButton({ look = 'night', className = '', place, label }) {
  return (
    <a
      href={COMPANY_PHONE_HREF}
      className={`${BUTTONS[look]} ${className}`.trim()}
      data-call-place={place}
    >
      <Phone className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{label || COMPANY_PHONE}</span>
    </a>
  )
}

const QUIET = { night: 'night', paper: 'paper', blue: 'ghost' }

/**
 * The pair every first screen and every last one ends on: ask for a price, or
 * call. Full width and stacked on a phone, where a thumb wants a target the
 * width of the screen.
 */
export function Actions({ tone = 'night', label, className = '', place, primary = START_LINK }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`.trim()}>
      <Button to={primary.to} look={tone === 'blue' ? 'white' : 'blue'} className="w-full sm:w-auto">
        {label || primary.label}
      </Button>
      <PhoneButton look={QUIET[tone]} className="w-full sm:w-auto" place={place} />
    </div>
  )
}

/** A label over a value, stacked under hairlines: the masthead's side readout. */
export function Readout({ items, tone = 'night', className = '' }) {
  const rule = tone === 'night' ? 'border-[var(--night-line)]' : 'border-[var(--line)]'
  const value = tone === 'night' ? 'text-[color:var(--light)]' : 'text-ink'
  return (
    <dl className={`border-b ${rule} ${className}`.trim()}>
      {items.map(({ label, value: said }) => (
        <div key={label} className={`border-t ${rule} py-4 sm:py-5`}>
          <dt className={`${TYPE.mono} ${KICKER_TONE[tone]}`}>{label}</dt>
          <dd className={`mt-1.5 text-[19px] font-medium leading-[1.35] sm:text-[20px] ${value}`}>
            {said}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The top of every page: night, over the blueprint grid. A mono kicker saying
 * where the reader is, the headline, one sentence, the two buttons. `readout`
 * stands beside it on a wide screen - how long, what it costs, what comes
 * after - and `below` runs the full width under it, which is where the home
 * page puts its live client sites.
 */
export function Masthead({
  kicker,
  title,
  lead,
  actions = true,
  actionLabel,
  note,
  readout,
  aside,
  below,
  size = 'display',
  children,
  className = '',
}) {
  const side = readout ? <Readout items={readout} /> : aside
  const hero = size === 'hero'
  return (
    <section
      className={`signal-grid border-b border-[var(--night-line)] text-[color:var(--light)] ${className}`.trim()}
    >
      <Container className="pb-14 pt-12 sm:pb-20 sm:pt-20">
        <div
          className={
            side
              ? 'grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-end lg:gap-16'
              : ''
          }
        >
          <div className="min-w-0">
            {kicker && (
              <Kicker tone="night" className="mb-6 sm:mb-8">
                {kicker}
              </Kicker>
            )}
            <h1 className={hero ? TYPE.hero : TYPE.display}>
              {title}
              <Square />
            </h1>
            {(lead || actions) && (
              <div
                className={
                  hero
                    ? 'mt-8 grid gap-8 sm:mt-10 lg:grid-cols-[minmax(0,34rem)_auto] lg:items-end lg:justify-between'
                    : 'mt-7 sm:mt-8'
                }
              >
                {lead && (
                  <p className={`${TYPE.lead} max-w-[36rem] text-[color:var(--light-soft)]`}>
                    {lead}
                  </p>
                )}
                {actions && (
                  <Actions
                    tone="night"
                    label={actionLabel}
                    place="masthead"
                    className={hero ? '' : 'mt-8'}
                  />
                )}
              </div>
            )}
            {note && (
              <Kicker tone="night" className="mt-6">
                {note}
              </Kicker>
            )}
            {children}
          </div>
          {side && <div className="min-w-0">{side}</div>}
        </div>
        {below && <div className="mt-14 sm:mt-20">{below}</div>}
      </Container>
    </section>
  )
}

/**
 * A row of big figures on night, split by hairlines: the speed score, the
 * weeks to launch, the rating. A figure whose record is empty is left out by
 * the caller rather than drawn as a zero.
 */
export function Readouts({ items, className = '' }) {
  return (
    <section
      aria-label="In figures"
      className={`border-b border-[var(--night-line)] bg-[var(--night)] text-[color:var(--light)] ${className}`.trim()}
    >
      <Container>
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {items.map(({ value, label }, index) => (
            <div
              key={label}
              className={[
                'border-[var(--night-line)] py-7 sm:py-9',
                index % 2 ? 'border-l pl-5 sm:pl-7' : '',
                index > 1 ? 'border-t lg:border-t-0' : '',
                index === 2 ? 'lg:border-l lg:pl-7' : '',
              ].join(' ')}
            >
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className={`${TYPE.figure} block`}>{value}</span>
                <span className={`${TYPE.mono} mt-3 block text-[color:var(--light-soft)]`}>
                  {label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  )
}

const GROUND = {
  paper: 'bg-[var(--paper)] text-ink',
  night: 'bg-[var(--night)] text-[color:var(--light)]',
  band: 'bg-[var(--band)] text-ink',
}

/** One full-width band of a page, on paper unless it says otherwise. */
export function Section({
  tone = 'paper',
  className = '',
  inner = '',
  narrow = false,
  id,
  label,
  tight = false,
  rule = true,
  children,
}) {
  const space = tight ? 'py-12 sm:py-16' : 'py-16 sm:py-24'
  const line = rule
    ? tone === 'night'
      ? 'border-b border-[var(--night-line)]'
      : 'border-b border-[var(--line)]'
    : ''
  return (
    <section
      id={id}
      aria-label={label}
      className={`${GROUND[tone]} ${line} ${space} ${className}`.trim()}
    >
      <Container narrow={narrow} className={inner}>
        {children}
      </Container>
    </section>
  )
}

/**
 * A numbered chapter: the number and a short heading in a column on the left,
 * the one thing the chapter says on the right. Pages count their chapters 01,
 * 02, 03 in order.
 */
export function Chapter({
  number,
  kicker,
  title,
  lead,
  tone = 'paper',
  id,
  children,
  className = '',
}) {
  const isNight = tone === 'night'
  return (
    <Section
      tone={tone}
      id={id}
      label={typeof title === 'string' ? title : kicker}
      className={className}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Kicker tone="blue">{[number, kicker].filter(Boolean).join(' / ')}</Kicker>
          {title && (
            <h2 className={`${TYPE.h2} mt-4 ${isNight ? '!text-[color:var(--light)]' : ''}`}>
              {title}
            </h2>
          )}
          {lead && (
            <p
              className={`mt-4 text-[17px] leading-[1.6] ${isNight ? 'text-[color:var(--light-soft)]' : 'text-ink-soft'}`}
            >
              {lead}
            </p>
          )}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </Section>
  )
}

/** A heading over a full-width block, with a link across from it. */
export function SectionHead({ number, kicker, title, lead, link, tone = 'paper', className = '' }) {
  const isNight = tone === 'night'
  return (
    <div
      className={`mb-10 flex flex-col gap-5 sm:mb-12 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}
    >
      <div className="max-w-[44rem]">
        {(number || kicker) && (
          <Kicker tone="blue">{[number, kicker].filter(Boolean).join(' / ')}</Kicker>
        )}
        <h2 className={`${TYPE.h2} mt-4 ${isNight ? '!text-[color:var(--light)]' : ''}`}>{title}</h2>
        {lead && (
          <p
            className={`mt-4 text-[17px] leading-[1.6] ${isNight ? 'text-[color:var(--light-soft)]' : 'text-ink-soft'}`}
          >
            {lead}
          </p>
        )}
      </div>
      {link && <TextLink to={link.to} href={link.href} label={link.label} />}
    </div>
  )
}

/** A mono link in capitals with an arrow: "See all work". */
export function TextLink({ to, href, label, className = '' }) {
  const style =
    `group inline-flex shrink-0 items-center gap-2 ${TYPE.mono} text-[color:var(--signal)] hover:text-[color:var(--signal-hi)] ${className}`.trim()
  const inner = (
    <>
      {label}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </>
  )
  if (to) {
    return (
      <Link to={to} className={style}>
        {inner}
      </Link>
    )
  }
  return (
    <a href={href} className={style} target="_blank" rel="noreferrer">
      {inner}
    </a>
  )
}

/**
 * Lines counted 01, 02, 03 under hairlines. The shape for "what you get": each
 * line one thing, read down in one pass.
 */
export function NumberedList({ items, tone = 'paper', className = '' }) {
  const rule = tone === 'night' ? 'border-[var(--night-line)]' : 'border-[var(--line)]'
  const text = tone === 'night' ? 'text-[color:var(--light)]' : 'text-ink'
  const soft = tone === 'night' ? 'text-[color:var(--light-soft)]' : 'text-ink-mute'
  return (
    <ol className={`border-b ${rule} ${className}`.trim()}>
      {items.map((item, index) => {
        const title = typeof item === 'string' ? item : item.title
        return (
          <li key={title} className={`flex gap-5 border-t ${rule} py-5 sm:gap-8 sm:py-6`}>
            <span className={`${TYPE.mono} ${soft} w-7 shrink-0 pt-[5px]`}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0">
              <span className={`block text-[18px] leading-[1.45] sm:text-[20px] ${text}`}>
                {title}
              </span>
              {item.body && (
                <span className={`mt-1.5 block text-[16px] leading-[1.55] ${soft}`}>
                  {item.body}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** A short list with a blue square on each line. */
export function SquareList({ items, tone = 'paper', className = '' }) {
  const text = tone === 'night' ? 'text-[color:var(--light)]' : 'text-ink'
  return (
    <ul className={`space-y-3 ${className}`.trim()}>
      {items.map(item => (
        <li key={item} className={`flex items-baseline gap-4 text-[17px] leading-[1.5] ${text}`}>
          <span className="h-2 w-2 shrink-0 -translate-y-0.5 bg-[var(--signal)]" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * Questions that open on a tap. Native disclosure, so it works before any
 * script has run and a search engine reads every answer.
 */
export function Questions({ items, tone = 'paper', className = '' }) {
  const rule = tone === 'night' ? 'border-[var(--night-line)]' : 'border-[var(--line)]'
  const text = tone === 'night' ? 'text-[color:var(--light)]' : 'text-ink'
  const soft = tone === 'night' ? 'text-[color:var(--light-soft)]' : 'text-ink-soft'
  return (
    <div className={`border-t ${rule} ${className}`.trim()}>
      {items.map(({ q, a }) => (
        <details key={q} className={`group border-b ${rule}`}>
          <summary
            className={`flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[18px] font-medium leading-[1.4] sm:py-6 sm:text-[20px] ${text} [&::-webkit-details-marker]:hidden`}
          >
            <span>{q}</span>
            <Plus
              className="mt-1 h-5 w-5 shrink-0 text-[color:var(--signal)] transition-transform duration-150 group-open:rotate-45"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </summary>
          <div
            className={`-mt-1 max-w-[42rem] pb-7 text-[17px] leading-[1.65] ${soft} [&_p+p]:mt-3`}
          >
            {typeof a === 'string' ? <p>{a}</p> : a}
          </div>
        </details>
      ))}
    </div>
  )
}

/** A screenshot of a client's live site, unframed. */
export function SiteShot({ project, eager = false, className = '' }) {
  return (
    <img
      src={portfolioPreviewSrc(project, 'desktop')}
      alt={`The ${project.name} website`}
      width="1200"
      height="750"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : undefined}
      className={`block aspect-[16/10] h-auto w-full bg-[var(--night-2)] object-cover object-top ${className}`.trim()}
      {...retryable()}
    />
  )
}

/**
 * A client's site in a night frame: its address and a green LIVE across the
 * top, the screenshot, and the two speed scores it was measured at along the
 * bottom. The way the studio's work is always shown - running, and measured.
 */
export function LiveFrame({ project, eager = false, className = '' }) {
  const speed = project.pagespeed
  return (
    <figure
      className={`border border-[var(--night-line)] bg-[var(--night-2)] text-[color:var(--light)] ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--night-line)] px-3.5 py-2.5">
        <span className="truncate font-mono text-[12px] text-[color:var(--light-soft)]">
          {project.displayUrl}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-[color:var(--live)]">
          <span className="h-1.5 w-1.5 bg-[var(--live)]" aria-hidden="true" />
          LIVE
        </span>
      </div>
      <SiteShot project={project} eager={eager} />
      {speed && (
        <figcaption className="flex gap-5 border-t border-[var(--night-line)] px-3.5 py-2.5 font-mono text-[11px] tracking-[0.08em]">
          <span>
            <span className="text-[color:var(--light-soft)]">MOBILE </span>
            {speed.mobile}
          </span>
          <span>
            <span className="text-[color:var(--light-soft)]">DESKTOP </span>
            {speed.desktop}
          </span>
        </figcaption>
      )}
    </figure>
  )
}

/** One client site as a card: the live frame, the name, and what and where. */
export function WorkCard({ project, to, detail, tone = 'paper', eager = false }) {
  const name = tone === 'night' ? 'text-[color:var(--light)]' : 'text-ink'
  const body = (
    <>
      <LiveFrame project={project} eager={eager} />
      <span
        className={`mt-4 block text-[20px] font-semibold leading-[1.3] tracking-[-0.015em] ${name} group-hover:text-[color:var(--signal)]`}
      >
        {project.name}
      </span>
      {detail && (
        <span
          className={`${TYPE.mono} mt-1.5 block ${tone === 'night' ? 'text-[color:var(--light-soft)]' : 'text-ink-mute'}`}
        >
          {detail}
        </span>
      )}
    </>
  )
  return to ? (
    <Link to={to} className="group block">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  )
}

/** A grid of cards, as many columns as the screen has room for. */
export function Grid({ cols = 3, className = '', children }) {
  const tracks = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[cols]
  return <div className={`grid gap-x-6 gap-y-12 ${tracks} ${className}`.trim()}>{children}</div>
}

/**
 * A card that is a link: a mono line on top (a number, a series, a date), a
 * title, a sentence, and an arrow in the corner. Services, tools, trades,
 * towns and articles are all drawn with it. Square corners, one hairline.
 */
export function LinkCard({ to, href, title, body, meta, tone = 'paper', className = '' }) {
  const isNight = tone === 'night'
  const look = isNight
    ? 'border-[var(--night-line)] bg-[var(--night-2)] hover:border-[color:var(--light-soft)]'
    : 'border-[var(--line)] bg-white hover:border-ink'
  const inner = (
    <>
      <span className="flex items-start justify-between gap-4">
        {meta ? (
          <span
            className={`${TYPE.mono} ${isNight ? 'text-[color:var(--light-soft)]' : 'text-ink-mute'}`}
          >
            {meta}
          </span>
        ) : (
          <span />
        )}
        <ArrowUpRight
          className="h-5 w-5 shrink-0 text-[color:var(--signal)] transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <span
        className={`mt-6 block text-[21px] font-semibold leading-[1.25] tracking-[-0.02em] ${isNight ? 'text-[color:var(--light)]' : 'text-ink'}`}
      >
        {title}
      </span>
      {body && (
        <span
          className={`mt-2.5 block text-[16px] leading-[1.55] ${isNight ? 'text-[color:var(--light-soft)]' : 'text-ink-soft'}`}
        >
          {body}
        </span>
      )}
    </>
  )
  const style =
    `group flex h-full flex-col border p-6 transition-colors duration-150 sm:p-7 ${look} ${className}`.trim()
  return to ? (
    <Link to={to} className={style}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={style}>
      {inner}
    </a>
  )
}

/**
 * The ask at the foot of every page: the full width in signal blue, the
 * headline as large as the home page's, and the two buttons. It is the loudest
 * thing on the site on purpose; it is the one thing every page wants done.
 */
export function CallToAction({
  kicker = 'Get a price',
  title = 'Tell me about the business',
  note = 'Free to ask / A written price before any work / Usually a reply within the hour',
  label,
  className = '',
}) {
  return (
    <section
      aria-label="Get a price"
      className={`bg-[var(--signal)] text-white [&_.signal-square]:bg-white ${className}`.trim()}
    >
      <Container className="py-20 sm:py-28">
        <Kicker tone="white">{kicker}</Kicker>
        <h2 className={`${TYPE.hero} mt-6 max-w-[14ch] sm:mt-8`}>
          {title}
          <Square />
        </h2>
        <Actions tone="blue" label={label} place="cta" className="mt-10 sm:mt-12" />
        {note && (
          <Kicker tone="white" className="mt-8 opacity-80">
            {note}
          </Kicker>
        )}
      </Container>
    </section>
  )
}

/** Body copy for reading, on paper. */
export function Prose({ className = '', children }) {
  return <div className={`${PROSE} ${className}`.trim()}>{children}</div>
}

/** Label/value pairs across a row under two hairlines: the facts under a case study. */
export function FactRow({ items, tone = 'paper', className = '' }) {
  const rule = tone === 'night' ? 'border-[var(--night-line)]' : 'border-[var(--line)]'
  const value = tone === 'night' ? 'text-[color:var(--light)]' : 'text-ink'
  return (
    <dl
      className={`grid grid-cols-2 gap-6 border-y ${rule} py-6 sm:grid-cols-4 ${className}`.trim()}
    >
      {items.map(({ label, value: said, href }) => (
        <div key={label} className="min-w-0">
          <dt className={`${TYPE.mono} ${KICKER_TONE[tone]}`}>{label}</dt>
          <dd className={`mt-1.5 truncate text-[17px] font-medium ${value}`}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--signal)] hover:underline"
              >
                {said}
              </a>
            ) : (
              said
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The wordmark. The file is a 384-unit square with the lettering across its
 * middle, so it is drawn through a window cut to the lettering.
 */
export function Logo({ className = '' }) {
  return (
    <span className={`relative block h-[28px] w-[100px] overflow-hidden ${className}`.trim()}>
      <img
        src="/images/TaylorURL-Logo.webp"
        alt={SITE.logoAlt}
        width="384"
        height="384"
        fetchPriority="high"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380%] w-auto max-w-none select-none"
        style={{ transform: 'translate(-50%, -53.5%)' }}
        draggable={false}
        {...retryable()}
      />
    </span>
  )
}
