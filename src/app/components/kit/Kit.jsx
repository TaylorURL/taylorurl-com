import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Phone, Plus } from 'lucide-react'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, START_LINK } from '@constants/navigation'
import { portfolioPreviewSrc } from '@data/portfolio'
import { retryable } from '@utils/retryImage'
import { SITE } from '../../../../lib/site/current.js'
import { BUTTONS, CARD, PROSE, TYPE } from './styles'

/*
 * THE KIT - every piece a public page is built from, after whatsapp.com.
 *
 * A page opens on one big rounded hero card with the headline, a sentence and
 * the two pills, usually beside a live client site; then wide alternating
 * feature rows and 32px cards that rise into view as they are scrolled to; then
 * the ask again in a blue card. TaylorURL's dark ground and blue throughout.
 *
 * The frames this is built from are in the Figma file "TaylorURL — WhatsApp-
 * Style Redesign" (https://www.figma.com/design/g9K8x6H6nU12rqQvVNKOkO).
 */

/** The column every section sits in, with the page's side gutters. */
export function Container({ as: Tag = 'div', className = '', children, narrow = false }) {
  // whatsapp.com's column: 1080px of content with 24px gutters.
  const width = narrow ? 'max-w-[948px]' : 'max-w-[1128px]'
  return <Tag className={`mx-auto w-full ${width} px-6 ${className}`.trim()}>{children}</Tag>
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
  const space = tight ? 'py-10 sm:py-12' : 'py-16 sm:py-20 lg:py-[96px]'
  return (
    <section
      id={id}
      aria-label={label}
      className={`wa-section ${space} ${className}`.trim()}
      data-reveal
    >
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
      className={`inline-flex items-center gap-2 rounded-full border border-white/[0.16] py-1.5 pl-3 pr-3.5 text-[13px] font-normal text-ink-soft ${className}`.trim()}
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
      <span className="wa-btn-label">{children}</span>
      {arrow && <ChevronRight className="wa-btn-icon h-4 w-4" strokeWidth={2} aria-hidden="true" />}
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
      <span className="wa-btn-label">{label || `Call ${COMPANY_PHONE}`}</span>
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
    <div className={`flex flex-col gap-4 sm:flex-row sm:flex-wrap ${className}`.trim()}>
      <Button to={primary.to} arrow className="w-full sm:w-auto">
        {label || primary.label}
      </Button>
      <PhoneButton className="w-full sm:w-auto" place={place} />
    </div>
  )
}

/**
 * The top of a page, after whatsapp.com's first screen: one big rounded card
 * inset from the edges of the window, a deep blue wash across it, the headline
 * at the left with a sentence and the two pills, and `media` beside it on a
 * wide screen (under it on a phone) - a client site on a laptop and a phone, a
 * short list of facts, a photo. The copy settles in on load, a word at a time.
 */
export function PageIntro({
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
    <section className={`wa-hero px-4 pt-4 lg:px-8 lg:pt-8 ${className}`.trim()}>
      <div
        className={`wa-hero-card ${size === 'hero' ? 'wa-hero-card-lg' : ''} relative flex items-center overflow-hidden rounded-[15px] lg:rounded-[25px]`}
      >
        <Container
          className={`relative py-12 sm:py-16 lg:py-24 ${media ? 'grid items-center gap-10 lg:grid-cols-[minmax(0,435px)_minmax(0,1fr)] lg:gap-[64px]' : ''}`}
        >
          {/* With nothing beside it the copy is centred in the card, as
              whatsapp.com sets a text-only first screen, rather than held to
              the left with the right of the card empty. */}
          <div
            className={`wa-hero-copy min-w-0 ${media ? 'max-w-[640px]' : 'mx-auto max-w-[820px] text-center'}`}
          >
            <h1 className={size === 'hero' ? TYPE.hero : TYPE.display}>{title}</h1>
            {lead && (
              <p
                className={`${TYPE.lead} mt-6 text-white ${media ? 'max-w-[403px]' : 'mx-auto max-w-[560px]'}`}
              >
                {lead}
              </p>
            )}
            {actions && (
              <Actions
                className={`mt-8 ${media ? '' : 'sm:justify-center'}`}
                label={actionLabel}
                place="intro"
              />
            )}
            {note && <p className={`${TYPE.small} mt-5`}>{note}</p>}
            {children}
          </div>
          {media && <div className="wa-hero-media min-w-0">{media}</div>}
        </Container>
      </div>
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
      <figure className="overflow-hidden rounded-[14px] bg-[var(--card)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-1.5 bg-[var(--card-hi)] px-4 py-2.5">
          <span className="h-[9px] w-[9px] rounded-full bg-white/[0.16]" aria-hidden="true" />
          <span className="h-[9px] w-[9px] rounded-full bg-white/[0.16]" aria-hidden="true" />
          <span className="h-[9px] w-[9px] rounded-full bg-white/[0.16]" aria-hidden="true" />
          <span className="ml-2 truncate rounded-md bg-white/[0.06] px-3 py-1 text-[12px] text-ink-mute">
            {project.displayUrl}
          </span>
        </div>
        <SiteShot project={project} eager={eager} />
      </figure>
      <div className="absolute bottom-0 right-0 w-[26%] min-w-[96px] max-w-[170px] rounded-[26px] bg-[#0b0b0b] p-[5px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.65)]">
        <SiteShot project={project} device="phone" className="rounded-[21px]" />
      </div>
      {mobile && (
        <div className="absolute -bottom-1 left-4 flex items-center gap-2.5 rounded-[12px] bg-[var(--card-hi)] px-3.5 py-2.5 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6)] sm:left-[-1.25rem]">
          <ScoreRing score={mobile} />
          <span>
            <span className="block text-[15px] font-semibold leading-tight text-ink">
              {mobile} / 100
            </span>
            <span className="block text-[12px] leading-tight text-ink-mute">Google speed</span>
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * A client's live site on a phone, the way whatsapp.com stands a phone beside
 * each feature: a rounded handset with a soft shadow, and the speed it was
 * measured at on a chip beside it when there is one.
 */
export function PhoneShot({ project, score = false, className = '' }) {
  const mobile = project.pagespeed?.mobile
  return (
    <div className={`relative mx-auto w-full max-w-[300px] ${className}`.trim()}>
      <div className="rounded-[40px] bg-[#0b0b0b] p-[7px] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.08]">
        <SiteShot project={project} device="phone" className="rounded-[33px]" />
      </div>
      {score && mobile && (
        <div className="absolute -left-6 bottom-16 flex items-center gap-2.5 rounded-[16px] bg-[var(--card-hi)] px-4 py-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.65)] sm:-left-16">
          <ScoreRing score={mobile} />
          <span>
            <span className="block text-[16px] font-medium leading-tight text-ink">
              {mobile} / 100
            </span>
            <span className="block text-[12px] leading-tight text-ink-mute">
              Google speed, mobile
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
      className={`wa-stagger grid grid-cols-2 gap-x-6 gap-y-10 rounded-[15px] bg-[var(--card)] px-6 py-8 sm:rounded-[25px] sm:px-14 sm:py-14 lg:grid-cols-4 ${className}`.trim()}
    >
      {items.map(({ value, label }) => (
        <div key={label}>
          <dt className="sr-only">{label}</dt>
          <dd>
            <span className={`${TYPE.figure} block`}>{value}</span>
            <span className={`${TYPE.small} mt-3 block`}>{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A section's heading, with a link across from it when there is one. No line
 * under it: the heading says what the section is and the section says the rest.
 */
export function SectionHead({ title, link, className = '' }) {
  return (
    <div
      className={`mb-10 flex flex-col gap-6 sm:mb-14 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}
    >
      <div className="max-w-[720px]">
        <h2 className={TYPE.h2}>{title}</h2>
      </div>
      {link && <TextLink to={link.to} href={link.href} label={link.label} />}
    </div>
  )
}

/**
 * The whatsapp.com text link: the words over a 2px brand underline, and a
 * chevron that steps right when pointed at. "See all work", "Learn more".
 */
export function TextLink({ to, href, label, className = '' }) {
  const style = `wa-textlink group ${className}`.trim()
  const inner = (
    <>
      <span className="wa-textlink-label">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
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
  return (
    <div className={`wa-stagger grid gap-5 lg:gap-6 ${tracks} ${className}`.trim()}>{children}</div>
  )
}

/** One client site as a card: the screenshot, the name, and what and where. */
export function WorkCard({ project, to, detail, eager = false }) {
  const body = (
    <>
      <SiteShot project={project} eager={eager} />
      <span className="block px-7 pb-7 pt-6">
        <span className="block text-[20px] font-normal leading-snug tracking-[-0.015em] text-ink">
          {project.name}
        </span>
        {detail && <span className={`${TYPE.small} mt-0.5 block`}>{detail}</span>}
      </span>
    </>
  )
  const style = `${CARD} block overflow-hidden`
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
      <span className={`${TYPE.h3} ${meta ? 'mt-4' : '-mt-1'} block pr-6`}>{title}</span>
      {body && <span className={`${TYPE.small} mt-3 block`}>{body}</span>}
    </>
  )
  const style = `${CARD} group flex h-full flex-col p-8 lg:p-10 ${className}`.trim()
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
    <ol className={`wa-stagger grid gap-5 lg:gap-6 ${columns} ${className}`.trim()}>
      {items.map((item, index) => (
        <li key={item.title} className={`${CARD} p-8 sm:p-10`}>
          <span className="block text-[44px] font-normal leading-none tracking-[-0.04em] text-[color:var(--blue-hi)]">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className={`${TYPE.h3} mt-8`}>{item.title}</h3>
          {item.body && <p className={`${TYPE.body} mt-3`}>{item.body}</p>}
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
            <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-white">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[17px] leading-[1.5] text-ink">{title}</span>
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
    <dl className={`${CARD} space-y-4 px-6 py-5 ${className}`.trim()}>
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className={TYPE.small}>{label}</dt>
          <dd className="mt-0.5 text-[16px] font-medium leading-[1.4] text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Questions that open on a tap, each in its own card with space between them
 * rather than a rule. Native disclosure, so it works before any script has run
 * and a search engine reads every answer.
 */
export function Questions({ items, className = '' }) {
  return (
    <div className={`space-y-2.5 ${className}`.trim()}>
      {items.map(({ q, a }) => (
        <details key={q} className={`${CARD} wa-faq group px-7 sm:px-9`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[18px] font-normal leading-[1.4] tracking-[-0.01em] text-ink sm:text-[20px] [&::-webkit-details-marker]:hidden">
            <span>{q}</span>
            <Plus
              className="h-5 w-5 shrink-0 text-ink transition-transform duration-300 ease-out-soft group-open:rotate-45"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </summary>
          <div className={`${TYPE.body} -mt-1 pb-6 [&_p+p]:mt-3`}>
            {typeof a === 'string' ? <p>{a}</p> : a}
          </div>
        </details>
      ))}
    </div>
  )
}

/**
 * The ask at the foot of a page: one big blue rounded card, the line of what
 * to do set as large as a section heading, and the two pills - the filled one
 * inverted to ink so it holds its own against the blue.
 */
export function CallToAction({ title = 'Tell me about the business.', label, className = '' }) {
  return (
    <section
      className={`wa-section px-4 py-12 sm:py-16 lg:px-8 lg:py-[96px] ${className}`.trim()}
      aria-label="Get a price"
      data-reveal
    >
      <div className="wa-cta-card mx-auto max-w-[1376px] overflow-hidden rounded-[15px] lg:rounded-[25px]">
        <Container className="flex flex-col gap-8 py-14 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:py-[96px]">
          <div className="max-w-[620px]">
            <h2 className={`${TYPE.h2} !text-white`}>{title}</h2>
          </div>
          <Actions className="wa-on-blue shrink-0" label={label} place="cta" />
        </Container>
      </div>
    </section>
  )
}

/**
 * One wide two-column row after whatsapp.com's feature bands: a big headline,
 * a paragraph and a text link on one side, a picture on the other, swapping
 * sides when `flip` is set. `accent` colours one word of the headline blue,
 * the way "freely" is green on whatsapp.com. `deep` sets the row on the darker
 * slab, full width.
 */
export function FeatureRow({ title, accent, body, link, media, flip = false, deep = false, id }) {
  const words = accent && title.includes(accent) ? title.split(accent) : null
  return (
    <section
      id={id}
      // whatsapp.com breaks its page with one slab in the opposite tone ("Speak
      // freely", dark on the cream). On TaylorURL's dark ground the opposite is
      // the light sheet, so a deep row is a white slab with dark ink.
      data-ground={deep ? 'paper' : undefined}
      className={`wa-section ${deep ? 'wa-slab bg-[var(--paper)] text-ink' : ''} py-14 sm:py-20 lg:flex lg:min-h-[810px] lg:items-center lg:py-[76px]`}
      data-reveal
    >
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-[182px]">
        <div className={`max-w-[449px] ${flip ? 'lg:order-2 lg:justify-self-start' : ''}`}>
          <h2 className={TYPE.h2}>
            {words ? (
              <>
                {words[0]}
                <span
                  className={
                    deep ? 'text-[color:var(--accent-fill)]' : 'text-[color:var(--blue-hi)]'
                  }
                >
                  {accent}
                </span>
                {words[1]}
              </>
            ) : (
              title
            )}
          </h2>
          {body && <p className={`${TYPE.body} mt-[18px] !text-ink`}>{body}</p>}
          {link && (
            <TextLink className="mt-[34px]" to={link.to} href={link.href} label={link.label} />
          )}
        </div>
        <div className={`wa-feature-media min-w-0 ${flip ? 'lg:order-1' : ''}`}>{media}</div>
      </Container>
    </section>
  )
}

/**
 * The centred statement under a first screen, set large, with small speech
 * bubbles drifting around it - whatsapp.com's "With private messaging..." band,
 * with the words of TaylorURL's own clients in the bubbles.
 */
export function Statement({ children, bubbles = [] }) {
  return (
    <section
      className="wa-section wa-statement relative overflow-hidden py-[120px] sm:py-[180px] lg:py-[240px]"
      data-reveal
    >
      <ul className="wa-bubbles pointer-events-none absolute inset-0" aria-hidden="true">
        {bubbles.map((text, index) => (
          <li
            key={text}
            className="wa-bubble"
            style={{ '--i': index }}
            data-side={index % 2 ? 'in' : 'out'}
          >
            {text}
          </li>
        ))}
      </ul>
      <Container narrow className="relative">
        <p className={`${TYPE.statement} text-center`}>{children}</p>
      </Container>
    </section>
  )
}

/**
 * A full-width tinted band with its lower corners rounded, the way
 * whatsapp.com sets "Stay up to date" on pale green over the footer.
 */
export function Band({ children, className = '', label, last = false }) {
  const band = (
    <section
      aria-label={label}
      className={`wa-section wa-band ${last ? '' : 'rounded-b-[25px]'} bg-[var(--tint)] pb-[96px] pt-14 sm:py-[96px] ${className}`
        .replace(/\s+/g, ' ')
        .trim()}
      data-reveal
    >
      {children}
    </section>
  )
  // The last band on a page needs no corners of its own: the page's column is
  // rounded where it meets the footer (`.wa-main`), and the band is clipped to
  // that curve.
  return band
}

/** Body copy for reading. */
export function Prose({ className = '', children }) {
  return <div className={`${PROSE} ${className}`.trim()}>{children}</div>
}

/** Label/value pairs across one panel: the facts under a case study. */
export function FactRow({ items, className = '' }) {
  return (
    <dl
      className={`grid grid-cols-2 gap-6 rounded-[16px] bg-[var(--card)] px-6 py-5 sm:grid-cols-4 ${className}`.trim()}
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
