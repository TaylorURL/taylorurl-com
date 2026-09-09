import { m } from 'framer-motion'
import {
  CalendarCheck,
  Check,
  Clock,
  FileText,
  Globe,
  Handshake,
  ListChecks,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  UserRound,
  Zap,
} from 'lucide-react'
import {
  MarkFrame,
  MarkGauge,
  MarkGuard,
  MarkPanel,
  MarkReach,
  MarkRefit,
} from '@components/marks/marks'
import PageHero from '@components/page-bands/PageHero'
import BrowserMockup from '@components/mockups/BrowserMockup'
import CtaBanner from '@components/conversion/CtaBanner'
import Mesh from '@components/mesh/Mesh'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { START_LINK, serves } from '@constants/navigation'
import { SERVICE_LINES } from '@data/pages/services'
import { EXTRA_SERVICES } from '@data/pages/serviceDetail'
import { AREA_SERVED, BUSINESS_ID, SERVICE_AREAS, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
import { AccentGradient } from '@reactbits/kit'
import ServiceCards from './ServiceCards'
import SectionLink from './SectionLink'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

// What each service line's row says, keyed by the slug the line carries in
// `@data/services`. The name, the anchor, and the link on to the service's own
// page all come from the line itself, so a row cannot name a service the menu
// and the pages do not.
const STUDIO_ROWS = {
  'new-website': {
    mark: MarkFrame,
    description:
      'Designed from scratch around your business and the customers you want walking in. It looks like you, because it was drawn from what you told us on the first call.',
    features: [
      'Designed around your business, not a template',
      'Opened and checked on phones, tablets, and computers',
      'Type, spacing, and motion set by hand',
      'Written in the words your customers search with',
    ],
    mockup: 'default',
  },
  redesign: {
    mark: MarkRefit,
    description:
      'If your site looks dated or isn’t bringing in business, we rebuild it from the ground up so you finally look as good online as you do in person.',
    features: [
      'A new look, built on what the business actually sells',
      'Keep what’s working, drop the clutter',
      'Faster pages on a phone, where most of your visitors are',
      'Cleaned up so Google can read every page',
    ],
    mockup: 'code',
  },
  'online-tools': {
    mark: MarkPanel,
    description:
      'Booking, ordering, customer logins, and quote forms on the front, wired into Jobber, Housecall Pro, or whatever you already run. Ad tracking, a sending domain, and monitoring underneath, all of it put in while the site is built.',
    features: [
      'Online booking, ordering, and quote forms',
      'Checkout through Stripe, Square, or PayPal',
      'Meta Pixel, Google Ads, and Ad Manager wired in',
      'A sending domain of your own for cold email',
    ],
    mockup: 'analytics',
  },
  care: {
    mark: MarkGuard,
    description:
      'Hosting, backups, security, and monitoring, all handled without being asked. A change to a price, a photo, or a page costs nothing and takes a text message.',
    features: [
      'Changes any time, with no fee per change',
      'Security kept current in the background',
      'Watched around the clock with daily backups',
      'A direct line to the people who built it',
    ],
    mockup: 'dashboard',
  },
}

// The same rows for the three lines the subsidiary sells. The marks are the
// ones those pages already carry in `@data/serviceDetail`, so a service is
// drawn the same way in the menu, on its card, and in its row here.
const SECOND_SITE_ROWS = {
  'software-engineering': {
    mark: MarkPanel,
    description:
      'A job that runs on spreadsheets and email, or two systems that never pass anything between them. What gets built comes from a read of how the work runs now, and it is yours to keep at the end.',
    features: [
      'Applications, integrations, and automations',
      'Built around the steps the work already takes',
      'Screens for your staff, with access set per person',
      'The repository and the accounts in your name',
    ],
    mockup: 'code',
  },
  'tracking-repair': {
    mark: MarkGauge,
    description:
      'Conversions stop firing when a page loads and start firing on a booked job or a form that reached your inbox, so what the ad platform counts is the work that actually came in.',
    features: [
      'Conversions moved onto real leads',
      'Enhanced conversions switched on and sending',
      'Closed jobs sent back to the ad platform',
      'A written account of what was wrong',
    ],
    mockup: 'dashboard',
  },
  outbound: {
    mark: MarkReach,
    description:
      'The list, the writing, the sending, and the replies, all run from a domain registered for you. It warms up over several weeks before it sends at full rate, which is what keeps the mail out of spam.',
    features: [
      'A list built one company at a time',
      'Your own sending domain, with SPF, DKIM, and DMARC',
      'Every message written for the companies it goes to',
      'Replies read and answered, interested ones handed on',
    ],
    mockup: 'analytics',
  },
}

const ROWS = IS_SECOND_SITE ? SECOND_SITE_ROWS : STUDIO_ROWS

const BAND = GROUNDS.band

/**
 * The page around the rows, for whichever site is building.
 *
 * Everything here is a claim about the offer rather than about the layout: what
 * the page is called in a search result, what the service node publishes, what
 * holds on every job, and where the page sends a reader next. The studio sells
 * websites to the towns around Baytown and has a pricing page to send them to;
 * the subsidiary sells three services to companies anywhere, states each price
 * on the service's own page, and ends at the enquiry form.
 *
 * `IS_SECOND_SITE` folds to a literal at build time, so the record that loses
 * is dropped from the bundle rather than shipped inside the other site.
 */
const STUDIO = {
  seoTitle: 'Small Business Websites in Baytown, TX',
  seoDescription:
    'Small business websites in Baytown, TX: custom sites, redesigns, online booking, and hosting for shops, restaurants, trades, and local pros, from a small team.',
  serviceType: 'Web Development',
  serviceName: 'Small business websites and online tools',
  catalogName: 'Small business website services',
  hero: {
    eyebrow: 'What We Do',
    title: 'A small team builds it, hosts it, and answers when you call.',
    description:
      'Custom websites, redesigns, and online tools for shops, restaurants, trades, and pros around Baytown and the Houston area. You get a plan and a price before any work starts.',
  },
  // The URL the row's schematic is drawn under. A path is set only for the
  // lines whose work is easiest to show on one; the rest sit on the home page
  // of the site they stand for.
  mockupHost: 'yourbusiness.com',
  mockupPaths: { redesign: '/before-after', 'online-tools': '/performance' },
  extra: {
    eyebrow: 'Also on Offer',
    heading: 'Mail on your own domain, and getting found.',
  },
  band: {
    eyebrow: 'Comes with Every Site',
    heading: 'Six things you never have to ask for.',
    link: { to: '/pricing', label: 'What It Costs' },
    items: [
      { icon: Smartphone, label: 'Works on every phone' },
      { icon: Search, label: 'Built for Google to read' },
      { icon: Shield, label: 'Backed up and kept secure' },
      { icon: Globe, label: 'Domain set up for you' },
      { icon: RefreshCw, label: 'Changes any time, no fee' },
      { icon: Zap, label: 'Quick page loads' },
    ],
  },
  cta: {
    eyebrow: 'Let’s Talk',
    heading: 'Get a plan',
    accentText: 'and a price.',
    description:
      'Tell us what the business needs. We answer ourselves, usually within the hour, and you get the plan and the price before any work starts.',
    secondary: { label: 'See the Price', to: '/pricing' },
  },
}

const SECOND_SITE = {
  seoTitle: 'Software, Tracking Repair, and Outbound',
  seoDescription:
    'Custom software built to order, conversion tracking repaired so it reports the leads that came in, and outbound email run from a sending domain of your own.',
  serviceType: 'Software Development',
  serviceName: 'Software engineering, tracking repair, and outbound email',
  catalogName: 'Engineering, tracking, and outbound services',
  hero: {
    eyebrow: 'What We Do',
    title: 'Software built to order, tracking repaired, outbound run.',
    description:
      'Three services, for companies anywhere. The scope, the price, and the finish date come back in writing after the first call, and what is not included is named before anything starts.',
  },
  mockupHost: 'yourcompany.com',
  mockupPaths: {},
  extra: null,
  band: {
    eyebrow: 'Holds on Every Job',
    heading: 'Six things that are true of all three.',
    link: null,
    items: [
      { icon: FileText, label: 'A scope and a price in writing' },
      { icon: CalendarCheck, label: 'A finish date before work starts' },
      { icon: ListChecks, label: 'What is not included, named first' },
      { icon: UserRound, label: 'A small team on the work' },
      { icon: Clock, label: 'A reply usually within the hour' },
      { icon: Handshake, label: 'No term to sign' },
    ],
  },
  cta: {
    eyebrow: 'Let’s Talk',
    heading: 'Say which one',
    accentText: 'you need.',
    description:
      'Tell us what the work is and what it has to do when it is done. We answer ourselves, usually within the hour, and the scope and the price come back in writing before anything starts.',
    secondary: null,
  },
}

const DOC = IS_SECOND_SITE ? SECOND_SITE : STUDIO

// A link written into this page by hand rather than drawn from a menu still has
// to be a page this site serves. `serves` reads the route table, so a link is
// dropped where the page behind it was never built rather than rendered as a
// 404 in the middle of a live section.
const BAND_LINK = DOC.band.link && serves(DOC.band.link.to) ? DOC.band.link : null
const CTA_SECONDARY = DOC.cta.secondary && serves(DOC.cta.secondary.to) ? DOC.cta.secondary : null

// Scroll-driven row — the BrowserMockup column drifts up across the section's
// scroll window while the copy column stays fixed, which separates the two
// layers as the row passes through view. Each row owns its own scroll progress,
// so rows out of view stay quiet.
//
// The row carries the line's slug as its id, so `/services#<slug>` lands on the
// service it names, and it links on to that service's own page.
function ServiceRow({ line, index }) {
  const row = ROWS[line.slug]
  const Mark = row.mark
  const isReversed = index % 2 === 1
  const { ref, transform } = useScrollParallax({ range: [50, -50] })

  return (
    <m.div
      ref={ref}
      id={line.slug}
      {...staggerChild(index, 0.08)}
      className="grid scroll-mt-28 items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24"
    >
      <div className={`flex flex-col gap-8 ${isReversed ? 'lg:order-2' : ''}`}>
        <div className="border-hair-paper flex items-baseline justify-between border-b pb-4">
          <span className="font-mono text-[11px] tabular-nums tracking-tight text-accent">
            {String(index + 1).padStart(2, '0')} / {String(SERVICE_LINES.length).padStart(2, '0')}
          </span>
          <Mark className="h-7 w-7 text-accent" />
        </div>
        <div className="flex flex-col gap-5">
          <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink-paper [text-wrap:balance]">
            {line.name}
          </h2>
          <p className="text-[16px] leading-relaxed text-paper-soft sm:text-[17px]">
            {row.description}
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {row.features.map(feature => (
            <li
              key={feature}
              className="border-hair-paper flex items-start gap-3 border-t pt-3 text-[14px] leading-snug text-paper-soft"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" strokeWidth={2} />
              {feature}
            </li>
          ))}
        </ul>
        <div>
          <SectionLink to={line.path} label="What This Covers" ground="paper" />
        </div>
      </div>
      <m.div
        style={{ transform }}
        className={`will-change-transform ${isReversed ? 'lg:order-1' : ''}`}
      >
        <BrowserMockup
          url={`${DOC.mockupHost}${DOC.mockupPaths[line.slug] || ''}`}
          variant={row.mockup}
        />
      </m.div>
    </m.div>
  )
}

export default function Services() {
  return (
    <div>
      <Seo
        title={DOC.seoTitle}
        description={DOC.seoDescription}
        path="/services"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Services', path: '/services' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: DOC.serviceType,
            name: DOC.serviceName,
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: DOC.catalogName,
              itemListElement: SERVICE_LINES.map(line => ({
                '@type': 'Offer',
                itemOffered: {
                  '@type': 'Service',
                  '@id': `${SITE_URL}${line.path}#service`,
                  name: line.name,
                  description: line.summary,
                  url: `${SITE_URL}${line.path}`,
                },
              })),
            },
          },
        ]}
      />
      <PageHero
        eyebrow={DOC.hero.eyebrow}
        title={DOC.hero.title}
        description={DOC.hero.description}
      />

      <section className="section-y relative overflow-hidden bg-paper">
        <div className="container-rail relative">
          <div className="divide-hair-paper border-hair-paper divide-y border-y">
            {SERVICE_LINES.map((line, i) => (
              <ServiceRow key={line.slug} line={line} index={i} />
            ))}
          </div>

          {EXTRA_SERVICES.length > 0 && (
            <m.div {...fadeInUp} className="mt-24">
              <div className="border-hair-paper mb-10 border-b pb-8">
                <p className="section-label mb-4 text-accent">{DOC.extra.eyebrow}</p>
                <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink-paper [text-wrap:balance]">
                  {DOC.extra.heading}
                </h2>
              </div>
              <ServiceCards pages={EXTRA_SERVICES} ground="paper" columns={{ base: 1, sm: 2 }} />
            </m.div>
          )}
        </div>
      </section>

      <section
        data-ground="band"
        className="border-hair section-y relative overflow-hidden border-t bg-bg text-ink"
      >
        <div className="container-rail relative">
          <m.div {...fadeInUp} className="border-hair mb-12 border-b pb-8">
            <p className="section-label mb-4 text-accent">{DOC.band.eyebrow}</p>
            <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink [text-wrap:balance]">
              {DOC.band.heading}
            </h2>
          </m.div>
          <Mesh items={DOC.band.items} ground="band" columns={{ base: 2, md: 3, lg: 6 }}>
            {(cap, i, cell) => {
              const Icon = cap.icon
              return (
                <m.div
                  key={cap.label}
                  {...staggerChild(i, 0.04)}
                  className={`${BAND.surface} ${cell}`}
                >
                  <SpotlightCard
                    className="flex h-full flex-col gap-3 bg-transparent p-5 text-left"
                    spotlightColor="var(--spotlight)"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                      <span
                        className={`font-mono text-[11px] tabular-nums tracking-tight ${BAND.meta}`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <span className={`text-[13px] font-medium leading-snug ${BAND.title}`}>
                      {cap.label}
                    </span>
                  </SpotlightCard>
                </m.div>
              )
            }}
          </Mesh>
          {BAND_LINK && (
            <div className="mt-10">
              <SectionLink to={BAND_LINK.to} label={BAND_LINK.label} ground="band" />
            </div>
          )}
        </div>
      </section>

      {/*
        Where the work reaches, which is a claim only the studio makes: the
        subsidiary sells to companies anywhere and `SERVICE_AREAS` is empty for
        it. The gate is a comparison against the site key rather than against
        that list's length, because only the first folds at build time - a
        length check is opaque to the bundler, and the section's town copy would
        ship inside the other site's chunk having never been rendered.
      */}
      {IS_SECOND_SITE ? null : (
        <section className="border-hair-paper section-y relative overflow-hidden border-t bg-paper">
          <div className="container-rail relative">
            <m.div {...fadeInUp} className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="section-label mb-6 text-accent">Where We Work</p>
                <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink-paper [text-wrap:balance]">
                  Local businesses across <br />
                  <AccentGradient>the Houston area.</AccentGradient>
                </h2>
              </div>
              <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
                Based in Baytown, TX. We work with shops, restaurants, trades, contractors, and
                independent pros across the surrounding towns and neighborhoods.
              </p>
            </m.div>

            <m.div
              {...fadeInUp}
              transition={{ delay: 0.1 }}
              className="border-hair-paper mt-10 flex flex-wrap gap-x-3 gap-y-2 border-t pt-8"
            >
              {SERVICE_AREAS.map(area => (
                <span key={area} className="chip-static">
                  {area}
                </span>
              ))}
            </m.div>
          </div>
        </section>
      )}

      <CtaBanner
        eyebrow={DOC.cta.eyebrow}
        heading={DOC.cta.heading}
        accentText={DOC.cta.accentText}
        description={DOC.cta.description}
        primaryLabel={START_LINK.label}
        primaryTo={START_LINK.to}
        secondaryLabel={CTA_SECONDARY?.label}
        secondaryTo={CTA_SECONDARY?.to}
      />
    </div>
  )
}
