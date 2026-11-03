import { Link } from 'react-router-dom'
import { ArrowRight, Check, Phone, Plus } from 'lucide-react'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, START_LINK } from '@constants/navigation'
import { portfolioPreviewSrc } from '@data/portfolio'
import { retryable } from '@utils/retryImage'
import { SITE } from '../../../../lib/site/current.js'
import { BUTTONS, PROSE, TYPE } from './styles'

/*
 * THE KIT — every piece a public page is built from.
 *
 * The redesign has one rule: a page shows its point and the way to act in the
 * first screen, and everything after that is short. These pieces are how that
 * rule is kept without each page re-deciding it. One width, one set of type
 * sizes, one button pair, one card, one band, and nothing that moves.
 *
 * The values match the Figma file "TaylorURL — Simpler Redesign": a 1120px
 * column, Geist at 60/48/32/20/17/15, white ground with a warm grey band,
 * one blue for the thing to press.
 */

/** The column every page section sits in. */
export function Container({ as: Tag = 'div', className = '', children, narrow = false }) {
  const width = narrow ? 'max-w-[720px]' : 'max-w-[1120px]'
  return (
    <Tag className={`mx-auto w-full ${width} px-5 sm:px-8 ${className}`.trim()}>{children}</Tag>
  )
}

/**
 * One band of a page. `tone="band"` lays it on the warm grey, which is how a
 * section says it is a different kind of thing from the one above it - never
 * more than one or two to a page.
 */
export function Section({
  tone,
  className = '',
  inner = '',
  narrow = false,
  id,
  label,
  tight = false,
  children,
}) {
  const ground = tone === 'band' ? 'bg-[var(--band)]' : ''
  const space = tight ? 'py-10 sm:py-14' : 'py-14 sm:py-20'
  return (
    <section id={id} aria-label={label} className={`${ground} ${space} ${className}`.trim()}>
      <Container narrow={narrow} className={inner}>
        {children}
      </Container>
    </section>
  )
}

export function Eyebrow({ children, className = '' }) {
  return <p className={`${TYPE.eyebrow} ${className}`.trim()}>{children}</p>
}

/** An internal route or an outside address, drawn as one of the two buttons. */
export function Button({ to, href, variant = 'primary', arrow, className = '', children, ...rest }) {
  const look = `${BUTTONS[variant]} ${className}`.trim()
  const tail = arrow ?? variant === 'primary'
  const inner = (
    <>
      <span>{children}</span>
      {tail && <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={look} {...rest}>
        {inner}
      </Link>
    )
  }
  return (
    <a href={href} className={look} {...rest}>
      {inner}
    </a>
  )
}

/** The phone number as the second button, beside every primary one. */
export function PhoneButton({ className = '', place }) {
  return (
    <a
      href={COMPANY_PHONE_HREF}
      className={`${BUTTONS.secondary} ${className}`.trim()}
      data-call-place={place}
    >
      <Phone className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
      <span>{COMPANY_PHONE}</span>
    </a>
  )
}

/**
 * The pair every page ends its first screen on: the way to ask for a price and
 * the number to call. Stacked full width on a phone, where a thumb wants a
 * target the width of the screen.
 */
export function Actions({ primary = START_LINK, label, className = '', place }) {
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
 * The top of a page: what it is, in a headline of a few words, one sentence
 * under it, and the two buttons. `aside` stands beside it on a wide screen and
 * under it on a phone - a screenshot, a short list of facts.
 */
export function PageIntro({
  eyebrow,
  title,
  lead,
  actions = true,
  actionLabel,
  note,
  aside,
  display = false,
  children,
  className = '',
}) {
  return (
    <section className={`pb-12 pt-10 sm:pb-16 sm:pt-16 ${className}`.trim()}>
      <Container
        className={
          aside ? 'grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-16' : ''
        }
      >
        <div className="max-w-[640px]">
          {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
          <h1 className={display ? TYPE.display : TYPE.h1}>{title}</h1>
          {lead && <p className={`${TYPE.lead} mt-5 max-w-[560px]`}>{lead}</p>}
          {actions && <Actions className="mt-8" label={actionLabel} place="intro" />}
          {note && <p className={`${TYPE.small} mt-4`}>{note}</p>}
          {children}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </Container>
    </section>
  )
}

/** A section's own heading, with an optional sentence under it and a link across from it. */
export function SectionHead({ title, lead, link, as: Tag = 'h2', className = '' }) {
  return (
    <div
      className={`mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}
    >
      <div className="max-w-[640px]">
        <Tag className={TYPE.h2}>{title}</Tag>
        {lead && <p className={`${TYPE.body} mt-3`}>{lead}</p>}
      </div>
      {link && <TextLink to={link.to} href={link.href} label={link.label} />}
    </div>
  )
}

/** A blue text link with an arrow, for "see all" and "read more". */
export function TextLink({ to, href, label, className = '' }) {
  const look = `group inline-flex items-center gap-1.5 text-[16px] font-medium text-accent hover:text-[color:var(--accent-hi)] ${className}`.trim()
  const inner = (
    <>
      {label}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </>
  )
  if (to) {
    return (
      <Link to={to} className={look}>
        {inner}
      </Link>
    )
  }
  return (
    <a href={href} className={look} target="_blank" rel="noreferrer">
      {inner}
    </a>
  )
}

/**
 * Two columns: a heading and a line on the left, the content on the right. The
 * shape for "What you get" and "More detail" - the heading says what the list
 * is, and the list does not have to.
 */
export function Split({ title, lead, children, className = '' }) {
  return (
    <div className={`grid gap-6 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] lg:gap-16 ${className}`.trim()}>
      <div>
        <h2 className={TYPE.h2}>{title}</h2>
        {lead && <p className={`${TYPE.body} mt-3`}>{lead}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** A short list with a green tick on each line. Five lines is plenty. */
export function CheckList({ items, className = '' }) {
  return (
    <ul className={`divide-y divide-[var(--line)] ${className}`.trim()}>
      {items.map(item => (
        <li key={typeof item === 'string' ? item : item.title} className="flex gap-3.5 py-4 first:pt-0">
          <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--good-wash)] text-[color:var(--good-on-paper)]">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
          </span>
          {typeof item === 'string' ? (
            <span className="text-[17px] leading-[1.5] text-ink">{item}</span>
          ) : (
            <span>
              <span className="block text-[17px] font-medium leading-[1.5] text-ink">
                {item.title}
              </span>
              {item.body && <span className={`${TYPE.small} mt-1 block`}>{item.body}</span>}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** A label over a value, a few to a card: how long, what it costs, what comes after. */
export function Facts({ items, className = '' }) {
  return (
    <dl
      className={`divide-y divide-[var(--line)] rounded-[14px] bg-[var(--band)] px-6 sm:px-7 ${className}`.trim()}
    >
      {items.map(({ label, value }) => (
        <div key={label} className="py-4 sm:py-5">
          <dt className={TYPE.small}>{label}</dt>
          <dd className="mt-0.5 text-[16px] font-medium leading-[1.4] text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Questions that open on a tap. Native disclosure, so it works before any
 * script has run and a search engine reads every answer.
 */
export function Questions({ items, className = '' }) {
  return (
    <div className={`border-t border-[var(--line)] ${className}`.trim()}>
      {items.map(({ q, a }) => (
        <details key={q} className="group border-b border-[var(--line)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium leading-[1.4] text-ink [&::-webkit-details-marker]:hidden">
            <span>{q}</span>
            <Plus
              className="h-[18px] w-[18px] shrink-0 text-ink-mute transition-transform duration-150 group-open:rotate-45"
              aria-hidden="true"
            />
          </summary>
          <div className={`${TYPE.body} -mt-1 max-w-[680px] pb-6`}>
            {typeof a === 'string' ? <p>{a}</p> : a}
          </div>
        </details>
      ))}
    </div>
  )
}

/** A screenshot of a client's live site, framed the one way the site frames them. */
export function SiteShot({ project, eager = false, className = '' }) {
  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--band)] ${className}`.trim()}
    >
      <img
        src={portfolioPreviewSrc(project, 'desktop')}
        alt={`The ${project.name} website`}
        width="1200"
        height="750"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : undefined}
        className="block aspect-[16/10] h-auto w-full object-cover object-top"
        {...retryable()}
      />
    </div>
  )
}

/** One client site as a card: the screenshot, the name, and what and where. */
export function WorkCard({ project, to, detail }) {
  const body = (
    <>
      <SiteShot project={project} />
      <span className="mt-3 block text-[16px] font-medium leading-[1.3] text-ink group-hover:text-accent">
        {project.name}
      </span>
      <span className={`${TYPE.small} mt-0.5 block`}>{detail}</span>
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
  return (
    <div className={`grid gap-x-6 gap-y-10 ${tracks} ${className}`.trim()}>{children}</div>
  )
}

/**
 * A card that is a title, a line and a link - a service, a tool, a trade, a
 * town, an article. The whole card is the link.
 */
export function LinkCard({ to, href, title, body, meta, icon: Icon, className = '' }) {
  const inner = (
    <>
      {Icon && (
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--band)] text-ink">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      {meta && <span className={`${TYPE.small} mb-1.5 block`}>{meta}</span>}
      <span className="block text-[18px] font-semibold leading-[1.35] tracking-[-0.01em] text-ink group-hover:text-accent">
        {title}
      </span>
      {body && <span className={`${TYPE.small} mt-2 block`}>{body}</span>}
    </>
  )
  const look = `group block h-full rounded-[14px] border border-[var(--line)] bg-[var(--paper)] p-6 transition-colors duration-150 hover:border-[color:var(--hairline-strong)] ${className}`.trim()
  return to ? (
    <Link to={to} className={look}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={look}>
      {inner}
    </a>
  )
}

/**
 * The ask at the foot of a page: one line of what to do, one of what happens,
 * and the two buttons. Every page ends on it.
 */
export function CallToAction({
  title = 'Tell me about the business.',
  lead = 'You get a plan and a price in writing before any work starts.',
  label,
  className = '',
}) {
  return (
    <section className={`py-14 sm:py-20 ${className}`.trim()} aria-label="Get a price">
      <Container>
        <div className="flex flex-col gap-6 rounded-[16px] bg-[var(--band)] px-6 py-9 sm:px-12 sm:py-11 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[560px]">
            <h2 className={TYPE.h2}>{title}</h2>
            <p className={`${TYPE.body} mt-2`}>{lead}</p>
          </div>
          <Actions className="shrink-0" label={label} place="cta" />
        </div>
      </Container>
    </section>
  )
}

export function Prose({ className = '', children }) {
  return <div className={`${PROSE} ${className}`.trim()}>{children}</div>
}

/** A row of label/value pairs under a rule, for the facts under a case study. */
export function FactRow({ items, className = '' }) {
  return (
    <dl
      className={`grid grid-cols-2 gap-6 border-y border-[var(--line)] py-5 sm:grid-cols-4 ${className}`.trim()}
    >
      {items.map(({ label, value, href }) => (
        <div key={label} className="min-w-0">
          <dt className={TYPE.small}>{label}</dt>
          <dd className="mt-0.5 truncate text-[16px] font-medium text-ink">
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
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
    <span className={`relative block h-[26px] w-[92px] overflow-hidden ${className}`.trim()}>
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
