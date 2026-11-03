import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, Phone, Plus } from 'lucide-react'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, START_LINK } from '@constants/navigation'
import { portfolioPreviewSrc } from '@data/portfolio'
import { retryable } from '@utils/retryImage'
import { SITE } from '../../../../lib/site/current.js'
import { BUTTONS, CARD, PROSE, TYPE } from './styles'

/*
 * THE KIT - every piece a public page is built from, in the "Refined" look.
 *
 * The site's own dark ground, made calmer: a page opens with a short headline,
 * one sentence and the two buttons, usually beside a live client site on a
 * laptop and a phone; then a few quiet sections of cards; then the ask again.
 * Soft corners, hairlines, pill buttons, one blue, and nothing that moves.
 *
 * The frames this is built from are on the "Directions — pick one" page of
 * the Figma file "TaylorURL — Simpler Redesign", frame A.
 */

/** The column every section sits in, with the page's side gutters. */
export function Container({ as: Tag = 'div', className = '', children, narrow = false }) {
  const width = narrow ? 'max-w-[760px]' : 'max-w-[1160px]'
  return (
    <Tag className={`mx-auto w-full ${width} px-5 sm:px-8 ${className}`.trim()}>{children}</Tag>
  )
}

/** One band of a page. */
export function Section({
  className = '',
  inner = '',
  narrow = false,
  id,
  label,
  tight = false,
  children,
}) {
  const space = tight ? 'py-10 sm:py-14' : 'py-14 sm:py-20'
  return (
    <section id={id} aria-label={label} className={`${space} ${className}`.trim()}>
      <Container narrow={narrow} className={inner}>
        {children}
      </Container>
    </section>
  )
}

/** A small pill with a green dot: where the studio is, or what a page is. */
export function Badge({ children, dot = true, className = '' }) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--edge)] bg-white/[0.04] py-1.5 pl-3 pr-3.5 text-[13px] font-medium text-ink-soft ${className}`.trim()}
    >
      {dot && <span className="h-[7px] w-[7px] rounded-full bg-[var(--live)]" aria-hidden="true" />}
      {children}
    </p>
  )
}

/** A route on this site or an outside address, drawn as one of the two pills. */
export function Button({
  to,
  href,
  variant = 'primary',
  arrow = false,
  className = '',
  children,
  ...rest
}) {
  const style = `${BUTTONS[variant]} ${className}`.trim()
  const inner = (
    <>
      <span>{children}</span>
      {arrow && <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
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

/** The phone number as the quieter pill. */
export function PhoneButton({ className = '', place, label }) {
  return (
    <a
      href={COMPANY_PHONE_HREF}
      className={`${BUTTONS.secondary} ${className}`.trim()}
      data-call-place={place}
    >
      <Phone className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span>{label || `Call ${COMPANY_PHONE}`}</span>
    </a>
  )
}

/**
 * The pair every first screen and every last one ends on: ask for a price, or
 * call. Full width and stacked on a phone, where a thumb wants a target the
 * width of the screen.
 */
export function Actions({ label, className = '', place, primary = START_LINK }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`.trim()}>
      <Button to={primary.to} className="w-full sm:w-auto">
        {label || primary.label}
      </Button>
      <PhoneButton className="w-full sm:w-auto" place={place} />
    </div>
  )
}

/**
 * The top of a page: a badge, a short headline, one sentence, the two pills,
 * and a note in small print. `media` stands beside it on a wide screen and
 * under it on a phone - a client site on a laptop and a phone, a short list of
 * facts, a photo. The soft blue glow sits behind it.
 */
export function PageIntro({
  badge,
  title,
  lead,
  actions = true,
  actionLabel,
  note,
  media,
  size = 'page',
  children,
  className = '',
}) {
  return (
    <section className={`glow ${className}`.trim()}>
      <Container
        className={`pb-12 pt-10 sm:pb-16 sm:pt-16 lg:pt-20 ${media ? 'grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14' : ''}`}
      >
        <div className="min-w-0 max-w-[600px]">
          {badge && <Badge className="mb-6">{badge}</Badge>}
          <h1 className={size === 'hero' ? TYPE.hero : TYPE.display}>{title}</h1>
          {lead && <p className={`${TYPE.lead} mt-5 max-w-[30rem]`}>{lead}</p>}
          {actions && <Actions className="mt-8" label={actionLabel} place="intro" />}
          {note && <p className={`${TYPE.small} mt-5`}>{note}</p>}
          {children}
        </div>
        {media && <div className="min-w-0">{media}</div>}
      </Container>
    </section>
  )
}

/** A screenshot of a client's live site. */
export function SiteShot({ project, device = 'desktop', eager = false, className = '' }) {
  const box =
    device === 'phone' ? { width: '390', height: '844' } : { width: '1200', height: '750' }
  return (
    <img
      src={portfolioPreviewSrc(project, device)}
      alt={`The ${project.name} website${device === 'phone' ? ' on a phone' : ''}`}
      width={box.width}
      height={box.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : undefined}
      className={`block h-auto w-full bg-[var(--card)] object-cover object-top ${device === 'phone' ? 'aspect-[390/844]' : 'aspect-[16/10]'} ${className}`.trim()}
      {...retryable()}
    />
  )
}

/** A small ring drawn to a score out of a hundred. */
function ScoreRing({ score, size = 34 }) {
  const radius = (size - 4) / 2
  const length = 2 * Math.PI * radius
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="shrink-0 -rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(244,243,238,0.12)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--live)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - score / 100)}
      />
    </svg>
  )
}

/**
 * A client's live site on a laptop window and a phone, with the speed score
 * it was measured at. The way the studio's work is shown first: running, on
 * the screen most customers will see it on, and measured.
 */
export function DeviceShowcase({ project, eager = false, className = '' }) {
  const mobile = project.pagespeed?.mobile
  return (
    <div className={`relative pb-10 pr-6 sm:pb-14 sm:pr-14 ${className}`.trim()}>
      <figure className="overflow-hidden rounded-[14px] border border-[var(--edge-strong)] bg-[var(--card)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-1.5 border-b border-[var(--edge)] px-4 py-2.5">
          <span className="h-[9px] w-[9px] rounded-full bg-white/[0.16]" aria-hidden="true" />
          <span className="h-[9px] w-[9px] rounded-full bg-white/[0.16]" aria-hidden="true" />
          <span className="h-[9px] w-[9px] rounded-full bg-white/[0.16]" aria-hidden="true" />
          <span className="ml-2 truncate rounded-md bg-white/[0.06] px-3 py-1 text-[12px] text-ink-mute">
            {project.displayUrl}
          </span>
        </div>
        <SiteShot project={project} eager={eager} />
      </figure>
      <div className="absolute bottom-0 right-0 w-[26%] min-w-[96px] max-w-[170px] rounded-[26px] border border-[var(--edge-strong)] bg-[#0b0b0b] p-[5px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.65)]">
        <SiteShot project={project} device="phone" className="rounded-[21px]" />
      </div>
      {mobile && (
        <div className="absolute -bottom-1 left-4 flex items-center gap-2.5 rounded-[12px] border border-[var(--edge-strong)] bg-[var(--card-hi)] px-3.5 py-2.5 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6)] sm:left-[-1.25rem]">
          <ScoreRing score={mobile} />
          <span>
            <span className="block text-[15px] font-semibold leading-tight text-ink">
              {mobile} / 100
            </span>
            <span className="block text-[12px] leading-tight text-ink-mute">
              Google speed, on a phone
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

/** A row of short figures in one rounded panel: the speed, the weeks, the rating. */
export function StatPanel({ items, className = '' }) {
  return (
    <dl
      className={`grid grid-cols-2 gap-x-6 gap-y-6 rounded-[16px] border border-[var(--edge)] bg-white/[0.025] px-6 py-6 sm:px-8 lg:grid-cols-4 ${className}`.trim()}
    >
      {items.map(({ value, label }) => (
        <div key={label}>
          <dt className="sr-only">{label}</dt>
          <dd>
            <span className={`${TYPE.figure} block`}>{value}</span>
            <span className={`${TYPE.small} mt-2 block`}>{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** A section's heading, with an optional sentence under it and a link across from it. */
export function SectionHead({ title, lead, link, className = '' }) {
  return (
    <div
      className={`mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}
    >
      <div className="max-w-[640px]">
        <h2 className={TYPE.h2}>{title}</h2>
        {lead && <p className={`${TYPE.body} mt-3`}>{lead}</p>}
      </div>
      {link && <TextLink to={link.to} href={link.href} label={link.label} />}
    </div>
  )
}

/** A blue text link with an arrow: "See all work". */
export function TextLink({ to, href, label, className = '' }) {
  const style =
    `group inline-flex shrink-0 items-center gap-1.5 text-[15px] font-medium text-[color:var(--link)] hover:text-ink ${className}`.trim()
  const inner = (
    <>
      {label}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
        strokeWidth={2}
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

/** A grid of cards, as many columns as the screen has room for. */
export function Grid({ cols = 3, className = '', children }) {
  const tracks = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[cols]
  return <div className={`grid gap-5 ${tracks} ${className}`.trim()}>{children}</div>
}

/** One client site as a card: the screenshot, the name, and what and where. */
export function WorkCard({ project, to, detail, eager = false }) {
  const body = (
    <>
      <SiteShot project={project} eager={eager} />
      <span className="block px-5 pb-5 pt-4">
        <span className="block text-[16px] font-medium leading-snug text-ink">{project.name}</span>
        {detail && <span className={`${TYPE.small} mt-0.5 block`}>{detail}</span>}
      </span>
    </>
  )
  const style = `${CARD} block overflow-hidden transition-colors duration-150 hover:border-[color:var(--edge-strong)]`
  return to ? (
    <Link to={to} className={style}>
      {body}
    </Link>
  ) : (
    <div className={style}>{body}</div>
  )
}

/**
 * A card that is a link: an optional small line on top, a title, a sentence,
 * and an arrow in the corner. Services, tools, trades, towns and articles are
 * all drawn with it.
 */
export function LinkCard({ to, href, title, body, meta, className = '' }) {
  const inner = (
    <>
      <span className="flex items-start justify-between gap-4">
        <span className={TYPE.label}>{meta}</span>
        <ArrowUpRight
          className="h-[18px] w-[18px] shrink-0 text-ink-mute transition-[transform,color] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </span>
      <span className={`${TYPE.h3} ${meta ? 'mt-3' : '-mt-1'} block pr-6`}>{title}</span>
      {body && <span className={`${TYPE.small} mt-2 block`}>{body}</span>}
    </>
  )
  const style =
    `${CARD} group flex h-full flex-col p-6 transition-colors duration-150 hover:border-[color:var(--edge-strong)] hover:bg-[var(--card-hi)] ${className}`.trim()
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

const STEP_COLUMNS = {
  1: '',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
}

/** Numbered steps as a row of cards: what happens, in order. */
export function Steps({ items, className = '' }) {
  const columns = STEP_COLUMNS[Math.min(items.length, 4)] ?? 'md:grid-cols-3'
  return (
    <ol className={`grid gap-5 ${columns} ${className}`.trim()}>
      {items.map((item, index) => (
        <li key={item.title} className={`${CARD} p-6 sm:p-7`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(59,107,255,0.16)] text-[13px] font-semibold text-[color:var(--link)]">
            {index + 1}
          </span>
          <h3 className={`${TYPE.h3} mt-4`}>{item.title}</h3>
          {item.body && <p className={`${TYPE.body} mt-2`}>{item.body}</p>}
        </li>
      ))}
    </ol>
  )
}

/** A short list with a blue tick on each line. */
export function CheckList({ items, className = '' }) {
  return (
    <ul className={`space-y-3.5 ${className}`.trim()}>
      {items.map(item => {
        const title = typeof item === 'string' ? item : item.title
        return (
          <li key={title} className="flex gap-3">
            <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(59,107,255,0.18)] text-[color:var(--link)]">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[16px] leading-[1.55] text-ink">{title}</span>
              {item.body && <span className={`${TYPE.small} mt-0.5 block`}>{item.body}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** A label over a value, a few to a card: how long, what it costs, what comes after. */
export function FactList({ items, className = '' }) {
  return (
    <dl className={`${CARD} divide-y divide-[var(--edge)] px-6 ${className}`.trim()}>
      {items.map(({ label, value }) => (
        <div key={label} className="py-4">
          <dt className={TYPE.small}>{label}</dt>
          <dd className="mt-0.5 text-[16px] font-medium leading-[1.4] text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Questions that open on a tap, in one card. Native disclosure, so it works
 * before any script has run and a search engine reads every answer.
 */
export function Questions({ items, className = '' }) {
  return (
    <div className={`${CARD} divide-y divide-[var(--edge)] ${className}`.trim()}>
      {items.map(({ q, a }) => (
        <details key={q} className="group px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-medium leading-[1.45] text-ink [&::-webkit-details-marker]:hidden">
            <span>{q}</span>
            <Plus
              className="h-[18px] w-[18px] shrink-0 text-ink-mute transition-transform duration-150 group-open:rotate-45"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </summary>
          <div className={`${TYPE.body} -mt-1 max-w-[680px] pb-6 [&_p+p]:mt-3`}>
            {typeof a === 'string' ? <p>{a}</p> : a}
          </div>
        </details>
      ))}
    </div>
  )
}

/**
 * The ask at the foot of a page: one rounded panel with the blue glow in it,
 * a line of what to do, a line of what happens, and the two pills.
 */
export function CallToAction({
  title = 'Tell me about the business.',
  lead = 'You get a plan and a price in writing before any work starts. Asking is free.',
  label,
  className = '',
}) {
  return (
    <section className={`py-14 sm:py-20 ${className}`.trim()} aria-label="Get a price">
      <Container>
        <div className="glow flex flex-col gap-7 overflow-hidden rounded-[20px] border border-[var(--edge)] bg-[var(--card)] px-6 py-10 sm:px-12 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[560px]">
            <h2 className={TYPE.h2}>{title}</h2>
            <p className={`${TYPE.body} mt-3`}>{lead}</p>
          </div>
          <Actions className="shrink-0" label={label} place="cta" />
        </div>
      </Container>
    </section>
  )
}

/** Body copy for reading. */
export function Prose({ className = '', children }) {
  return <div className={`${PROSE} ${className}`.trim()}>{children}</div>
}

/** Label/value pairs across one panel: the facts under a case study. */
export function FactRow({ items, className = '' }) {
  return (
    <dl
      className={`grid grid-cols-2 gap-6 rounded-[16px] border border-[var(--edge)] bg-white/[0.025] px-6 py-5 sm:grid-cols-4 ${className}`.trim()}
    >
      {items.map(({ label, value, href }) => (
        <div key={label} className="min-w-0">
          <dt className={TYPE.small}>{label}</dt>
          <dd className="mt-0.5 truncate text-[16px] font-medium text-ink">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--link)] hover:text-ink"
              >
                {value}
              </a>
            ) : (
              value
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
