import { Check } from 'lucide-react'
import { m } from 'framer-motion'
import PageHero from '@components/page-bands/PageHero'
import BrowserMockup from '@components/mockups/BrowserMockup'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import ToolMesh from '@components/mesh/ToolMesh'
import { MarkCanvass, MarkFunnel, MarkPanel, MarkPulse } from '@components/marks/marks'
import { MarkFacebook, MarkGoogle, MarkInstagram, MarkLinkedIn } from '@components/marks/brandMarks'
import { ToolPaypal, ToolSquare, ToolStripe } from '@components/marks/toolMarks'
import { staggerChild } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { START_LINK, serves } from '@constants/navigation'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { BUILD_PRICE, MONTHLY_PRICE, PRICE_OFFERS } from '@data/checkout/pricing'
import { EXTRA_SERVICES, otherServices, servicePage } from '@data/pages/serviceDetail'
import ServiceSection from './ServiceSection'
import FactMesh from './FactMesh'
import ServiceCards from './ServiceCards'
import SectionLink from './SectionLink'

/**
 * The one service line that is not the shared service shape.
 *
 * The other three lines answer four questions - what the work covers, what it
 * leaves out, how long it takes, what it runs - and `ServiceDetail` renders all
 * three from the content held against their slug. This one answers a fifth
 * question that none of them ask: why the machinery under a site is built in at
 * the start rather than sold as a second project later. That argument is the
 * page, and it needs sections the shared view has no shape for, so this line
 * takes a view of its own the way business email and the search work do.
 *
 * `@data/serviceDetail` still holds the line's name, summary and mark, because
 * a card, a menu row and the sitemap all read them there and none of them
 * should have to know which service pages are bespoke.
 */
const SLUG = 'online-tools'
const PAGE = servicePage(SLUG)

/**
 * What is already running by the time each of these is true.
 *
 * The three read as one sentence about the same machinery at three ages, which
 * is the whole argument: none of it is worth much the day it is installed, and
 * all of it is worth more every month it has been running. A site sold without
 * it has to buy that history back later at the price of starting from zero.
 */
const STAGES = [
  {
    when: 'Launch Day',
    body: 'The pixel fires on the first visitor. The conversion events already have their names. The monitor is already watching. None of it is waiting on a second project or a second invoice.',
  },
  {
    when: 'Six Months In',
    body: 'The retargeting audience holds six months of real visitors. The ad platforms have a conversion history to read. The sending domain has been sending clean mail long enough that Gmail and Outlook let it carry more.',
  },
  {
    when: 'The Day You Advertise',
    body: 'There is nothing to install and nothing to fill in after the fact, and nobody spends a month teaching the ad platforms what the site already knows. The first campaign runs against data the site has been collecting since it went live.',
  },
]

/**
 * The four systems, in the order a business meets them: what a customer touches,
 * what counts what the customer did, what goes out looking for the next one, and
 * what says when any of it stops working.
 *
 * `pieces` is the part of the page that has to stay specific. A system named
 * without its parts is a claim; the parts are what a reader can check against
 * whatever they have been sold before.
 */
const SYSTEMS = [
  {
    mark: MarkPanel,
    name: 'Booking, Ordering, and Payment',
    short: 'Booking and Payment',
    lede: 'Everything a customer can finish on the site without calling you and waiting for someone to pick up.',
    pieces: [
      'A slot booked from a phone at ten at night, on the hours and services you actually offer',
      'Checkout through Stripe, Square, or PayPal, with the money landing in your account',
      'Quote and intake forms asking everything you need before a job can be priced',
      'Customer logins for the people who need to see bookings, invoices, or history',
      'Back-office screens showing today’s work rather than every record you own',
      'Tied into Jobber, Housecall Pro, ServiceTitan, QuickBooks, or Toast wherever they allow it',
    ],
  },
  {
    mark: MarkFunnel,
    name: 'Ad Tracking and Audiences',
    short: 'Ad Tracking',
    lede: 'The plumbing every paid campaign runs on, put in before there is a campaign to run on it.',
    pieces: [
      'The Meta Pixel installed and firing on real events rather than on page loads alone',
      'Meta’s Conversions API sending the same events from the server, so a blocked browser does not lose them',
      'The Google Ads tag with enhanced conversions switched on and sending',
      'Google Tag Manager, so a tag added next year needs no code change',
      'Google Analytics 4 reporting against the same events the ads are counting',
      'Google Ad Manager where the site carries advertising of its own',
      'Retargeting audiences filling from the first visitor onward',
      'The campaign, the ad, and the click carried through the form, so a lead says what brought it in',
      'Closed jobs sent back to the platforms, so they count the work that came in and not the clicks',
      'Audiences and events written into the site’s code, not pasted into a dashboard where a page change breaks them',
    ],
  },
  {
    mark: MarkCanvass,
    name: 'Cold Email and Outbound',
    short: 'Outbound Email',
    lede: 'A sending domain of your own, warmed up over weeks, so the mail reaches an inbox instead of a spam folder.',
    pieces: [
      'A sending domain registered in your name, kept apart from the one your customers write to',
      'SPF, DKIM, and DMARC set correctly before the first message goes out',
      'A handful of messages a day at first, climbing to full rate over several weeks',
      'A list built one company at a time, from businesses that fit what you sell',
      'Every message written for the companies it goes to',
      'Replies landing in your own inbox, and an unsubscribe on every message',
    ],
  },
  {
    mark: MarkPulse,
    name: 'Monitoring and Uptime',
    short: 'Monitoring',
    lede: 'What tells you the booking form broke, before the customer who found it broken decides to call somebody else.',
    pieces: [
      'Every fault the site throws in a visitor’s browser reaching us as it happens',
      'Uptime checked from outside the site, minute by minute, day and night',
      'Page speed re-measured on Google’s own report and read every morning',
      'Certificates and domain registrations watched well ahead of their dates',
      'A status page anybody can open, showing what is up and what is not',
    ],
  },
]

/**
 * The accounts the work is done inside, drawn the way the configurator draws
 * the software a trade runs on: a mark where the vendor publishes one, the name
 * alone everywhere else. `ToolMesh` carries the note about whose trademarks
 * these are, which is the sentence that has to sit under any page naming this
 * many of them.
 */
const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', mark: MarkFacebook },
  { id: 'instagram', name: 'Instagram', mark: MarkInstagram },
  { id: 'google', name: 'Google', mark: MarkGoogle },
  { id: 'linkedin', name: 'LinkedIn', mark: MarkLinkedIn },
  { id: 'stripe', name: 'Stripe', mark: ToolStripe },
  { id: 'square', name: 'Square', mark: ToolSquare },
  { id: 'paypal', name: 'PayPal', mark: ToolPaypal },
  { id: 'meta-pixel', name: 'Meta Pixel' },
  { id: 'conversions-api', name: 'Meta Conversions API' },
  { id: 'google-ads', name: 'Google Ads' },
  { id: 'ad-manager', name: 'Google Ad Manager' },
  { id: 'tag-manager', name: 'Google Tag Manager' },
  { id: 'ga4', name: 'Google Analytics 4' },
  { id: 'business-profile', name: 'Google Business Profile' },
  { id: 'jobber', name: 'Jobber' },
  { id: 'housecall-pro', name: 'Housecall Pro' },
  { id: 'service-titan', name: 'ServiceTitan' },
  { id: 'quickbooks', name: 'QuickBooks' },
  { id: 'toast', name: 'Toast' },
  { id: 'custom-integration', name: 'Anything else with an API', generic: true },
]

// What naming this many companies on one page means, and what it does not.
// `ToolMesh` carries the trades' own note by default, and that one is about
// software a shop already pays for rather than about an advertising account.
const PLATFORM_NOTE =
  'Product names and marks belong to their owners. Naming one here is not a partnership, an endorsement, or an official integration, and what each of them charges is billed by them.'

const NOT_INCLUDED = [
  {
    title: 'Ad Spend',
    body: 'The build puts the tracking in and leaves it running. What you spend with Meta or Google is billed by them, and buying and running the campaigns is separate work with its own price.',
  },
  {
    title: 'Replacing What You Run',
    body: 'The tools sit beside Jobber or Housecall Pro. You keep running whatever you run now, and nothing here asks you to move off it.',
  },
  {
    title: 'Holding Card Numbers',
    body: 'Payments run through Stripe, Square, or PayPal. Card details never sit on the site, and nothing here stores them.',
  },
  {
    title: 'A Bought List',
    body: 'Outbound goes to companies picked one at a time. Nothing here sends to a list somebody sold us, because sending to one is the quickest way there is to burn a sending domain.',
  },
  {
    title: 'A Promised Number',
    body: 'Tracking tells you what a campaign did. Nobody can tell you in advance what it will do, and anyone quoting you a return is guessing at it.',
  },
  {
    title: 'A Phone App',
    body: 'All of it is built for the browser, which is what your customers already have open.',
  },
]

const TERMS = [
  {
    title: 'How Long It Takes',
    body: 'The site runs two to four weeks. Tools built into it add to that, and the date is agreed with the plan before any work starts.',
  },
  {
    title: 'What It Costs to Run',
    body: `From ${BUILD_PRICE} for the site and from ${MONTHLY_PRICE} a month to run it, with the tools, the tracking, the sending domain, and the monitoring built into that price. What moves the price is how big the whole project is, and you agree to that number before anything starts. What a payment processor, an ad platform, or a sending service charges is billed by them, not through us.`,
  },
]

// A link written into this page by hand still has to be a page this site
// serves, so the route table answers for it rather than whoever edits the list.
const ASIDES = [
  { to: '/pricing', label: 'The Whole Price' },
  { to: '/process', label: 'How a Build Runs' },
  { to: '/tools', label: 'The Free Tools' },
].filter(aside => serves(aside.to))

const BAND = GROUNDS.band

/**
 * The cross-section: the page a visitor opens, and the four systems standing
 * under it.
 *
 * The page's whole argument is about a thing that cannot be seen - a customer
 * meets the top plate and nothing else - so the section that lists the four
 * systems opens by drawing where they sit. The footings carry the same numbers
 * the rows below carry, which is what makes this a key to the section rather
 * than an ornament at the top of it.
 *
 * The plate is the schematic the service rows on `/services` already draw for
 * this line, so a reader who met the line there meets the same drawing here
 * with what holds it up added underneath. The footings are rules and type
 * rather than a picture, so they reflow the way the rest of the page does: four
 * across a wide screen and two on a narrow one, where four would set each label
 * on its own line and turn a key into a list. The risers are drawn only where
 * the footings stand in one row, because a riser is a claim about what is
 * directly overhead and at two columns nothing is.
 */
function Foundation() {
  return (
    <figure className="mb-8">
      <BrowserMockup url="yourbusiness.com" variant="default" />

      <div className="bg-hair-paper mt-12 grid grid-cols-2 gap-px lg:grid-cols-4">
        {SYSTEMS.map((system, index) => {
          const Mark = system.mark
          return (
            <div
              key={system.short}
              className="before:bg-hair-paper relative flex flex-col gap-3 bg-paper p-5 lg:before:absolute lg:before:-top-12 lg:before:left-1/2 lg:before:h-12 lg:before:w-px lg:before:content-['']"
            >
              <div className="flex items-center justify-between">
                <Mark className="h-5 w-5 text-accent" />
                <span className="text-paper-faint font-mono text-[11px] tabular-nums tracking-tight">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <span className="text-[13px] font-medium leading-snug text-ink-paper">
                {system.short}
              </span>
            </div>
          )
        })}
      </div>

      <figcaption className="text-paper-faint mt-5 text-[14px] leading-relaxed">
        One build. The page on top, and the four systems holding it up, numbered as they are set out
        below.
      </figcaption>
    </figure>
  )
}

/**
 * One system: what it is on the left, the parts it is made of on the right.
 *
 * The two columns are not a decoration of one list. The left one is the claim
 * and stays short enough to be read standing up; the right one is the receipt,
 * and it is long on purpose, because the reason to believe the claim is the
 * length of it. On a narrow screen the receipt falls under the claim it belongs
 * to rather than beside it.
 */
function SystemRow({ system, index }) {
  const Mark = system.mark

  return (
    <m.div
      {...staggerChild(index, 0.08)}
      className="grid gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-16 lg:py-16"
    >
      <div className="flex flex-col gap-5">
        <div className="border-hair-paper flex items-center justify-between border-b pb-4">
          <span className="font-mono text-[11px] tabular-nums tracking-tight text-accent">
            {String(index + 1).padStart(2, '0')} / {String(SYSTEMS.length).padStart(2, '0')}
          </span>
          <Mark className="h-7 w-7 text-accent" />
        </div>
        <h3 className="display-6 font-semibold leading-[1.1] tracking-tight text-ink-paper [text-wrap:balance]">
          {system.name}
        </h3>
        <p className="max-w-[46ch] text-[15px] leading-relaxed text-paper-soft sm:text-[16px]">
          {system.lede}
        </p>
      </div>

      <ul className="grid content-start gap-3 sm:grid-cols-2 lg:gap-x-8">
        {system.pieces.map(piece => (
          <li
            key={piece}
            className="border-hair-paper flex items-start gap-3 border-t pt-3 text-[14px] leading-snug text-paper-soft"
          >
            <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" strokeWidth={2} />
            {piece}
          </li>
        ))}
      </ul>
    </m.div>
  )
}

export default function OnlineTools() {
  return (
    <div>
      <Seo
        title="Booking, Ordering, and Tools in Baytown, TX"
        description="Booking, ordering, and payment built onto your site, with ad tracking, the Meta Pixel, Google Ads and Ad Manager, outbound email, and monitoring underneath."
        path={PAGE.path}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Services', path: '/services' },
            { name: PAGE.name, path: PAGE.path },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': `${SITE_URL}${PAGE.path}#service`,
            serviceType: PAGE.name,
            name: PAGE.name,
            description:
              'Booking, ordering, payment, and customer accounts built onto a small business website, with advertising tracking, outbound email, and monitoring wired in during the build.',
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
            offers: PRICE_OFFERS,
          },
        ]}
      />
      <PageHero
        eyebrow="What Runs Underneath"
        title="Booking, ordering, and tracking go in with the site."
        description="Booking, ordering, and payment at the front. Ad tracking, conversion events, a sending domain, and monitoring underneath. All of it goes in during the build, so none of it has to be retrofitted the day you decide to use it."
      />

      <ServiceSection
        id="why"
        ground="band"
        eyebrow="Why It Goes In Early"
        title="Worth more in year two than it was at launch."
        lede="A website is at its newest the week it goes live, and the pages themselves lose ground from there. What holds the value is the machinery underneath them, and every piece of it is worth more the longer it has already been running."
      >
        <div className="panel-static bg-hair grid gap-px overflow-hidden lg:grid-cols-3">
          {STAGES.map((stage, index) => (
            <m.div
              key={stage.when}
              {...staggerChild(index, 0.08)}
              className="flex flex-col gap-4 bg-bg p-7 sm:p-8"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="section-label-sm text-accent">{stage.when}</span>
                <span className="font-mono text-[11px] tabular-nums tracking-tight text-ink-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p className={`text-[15px] leading-relaxed ${BAND.body}`}>{stage.body}</p>
            </m.div>
          ))}
        </div>
        <p className={`mt-8 max-w-2xl text-[15px] leading-relaxed ${BAND.body}`}>
          It is the same reason the site is built rather than assembled out of a theme. Anything put
          in at the foundation goes on working while the site changes around it. Anything bolted on
          afterwards has to be put back every time it does.
        </p>
      </ServiceSection>

      <ServiceSection
        id="covers"
        ground="paper"
        eyebrow="What Gets Wired In"
        title="Four systems, built into the site itself."
        lede="Every one of them is part of the build rather than an upgrade sold on top of it. What each one connects to is named here, and what none of them do is named further down."
      >
        <Foundation />
        <div className="divide-hair-paper border-hair-paper divide-y border-y">
          {SYSTEMS.map((system, index) => (
            <SystemRow key={system.name} system={system} index={index} />
          ))}
        </div>
      </ServiceSection>

      <ServiceSection
        id="platforms"
        ground="band"
        eyebrow="What It Connects To"
        title="The accounts it all runs through."
        lede="Each of them is opened in your business’s name, set up inside your own account, and left there. Nothing here holds a site hostage to an account somebody else owns."
      >
        <ToolMesh tools={PLATFORMS} ground="band" note={PLATFORM_NOTE} />
      </ServiceSection>

      <ServiceSection
        id="limits"
        ground="paper"
        eyebrow="What It Does Not"
        title="What it does not cover."
        lede="You find this out now, not halfway through the work."
      >
        <FactMesh items={NOT_INCLUDED} ground="paper" columns={{ base: 1, sm: 2, lg: 3 }} />
      </ServiceSection>

      <ServiceSection
        id="terms"
        ground="band"
        eyebrow="Time and Cost"
        title="How long it takes, and what it runs."
      >
        <FactMesh items={TERMS} ground="band" columns={{ base: 1, sm: 2 }} />
        {ASIDES.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {ASIDES.map(aside => (
              <SectionLink key={aside.to} to={aside.to} label={aside.label} ground="band" />
            ))}
          </div>
        )}
      </ServiceSection>

      <ServiceSection
        id="more"
        ground="paper"
        eyebrow="The Rest of It"
        title="Everything else on offer."
      >
        <ServiceCards
          pages={[...otherServices(SLUG), ...EXTRA_SERVICES]}
          ground="paper"
          columns={{ base: 1, sm: 2, lg: 3 }}
        />
      </ServiceSection>

      <CtaBanner
        eyebrow="Let’s Talk"
        heading="Have it all"
        accentText="wired in."
        description="Tell us what the business runs on now and what you want to be able to turn on later. You get the plan and the price before any work starts."
        primaryLabel={START_LINK.label}
        primaryTo={START_LINK.to}
        secondaryLabel="See the Price"
        secondaryTo="/pricing"
      />
    </div>
  )
}
