import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import ToolMesh from '@components/mesh/ToolMesh'
import { ToolPaypal, ToolSquare, ToolStripe } from '@components/marks/toolMarks'
import { START_LINK, serves } from '@constants/navigation'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { otherServices, servicePage } from '@data/pages/serviceDetail'
import ServiceSection from './ServiceSection'
import FactMesh from './FactMesh'
import MoreServices from './MoreServices'
import SectionLink from './SectionLink'

/**
 * Booking and ordering on its own page.
 *
 * The other website lines answer three questions - what the work covers, how
 * long it takes, what it runs - and `ServiceDetail` renders all three from the
 * content held against their slug. This one also has to name the accounts the
 * money and the bookings run through, which is a mesh of marks the shared view
 * has no shape for, so it takes a view of its own the way company email and the
 * apps do.
 *
 * `@data/serviceDetail` still holds the line's name, summary and mark, because
 * a card, a menu row and the sitemap all read them there and none of them
 * should have to know which service pages are bespoke.
 */
const SLUG = 'online-tools'
const PAGE = servicePage(SLUG)

// What the work is, in the order a customer meets it: the booking, the order,
// the payment, the questions before a quote, the account afterwards, and the
// screens on your side of it.
const COVERS = [
  {
    title: 'Booking from a Phone',
    body: 'A slot booked at ten at night, on the hours and services you actually offer, with the reminder sent the morning of.',
  },
  {
    title: 'Ordering Ahead',
    body: 'The menu or the catalog on the site, an order placed and paid for, and a note to the kitchen or the counter when it lands.',
  },
  {
    title: 'Payment That Lands',
    body: 'Checkout through Stripe, Square, or PayPal, with the money going into your account and not through ours.',
  },
  {
    title: 'Quote and Intake Forms',
    body: 'Everything you need to know before a job can be priced, asked once and sent to your inbox.',
  },
  {
    title: 'Customer Accounts',
    body: 'Logins for the people who need to see their bookings, invoices, or history without calling to ask.',
  },
  {
    title: 'Your Side of It',
    body: 'Back-office screens showing today’s work rather than every record you own, on the phone or the machine at the counter.',
  },
]

// The honest question, answered before the quote: a link to somebody else's
// booking page does the job for plenty of businesses, and the page says so
// rather than selling the built-in one to everybody who lands.
const FIT = [
  {
    title: 'A Booking Link Is Enough When',
    body: 'One person takes one kind of appointment, and a link to a calendar somebody else hosts does not cost you customers.',
  },
  {
    title: 'Built-In Booking Earns Its Place When',
    body: 'Customers leave when they are sent off the site, the services and the staff need their own rules, or the booking has to reach the software the business already runs.',
  },
]

/**
 * The accounts the bookings and the money run through, drawn the way a trade
 * page draws the software a trade runs on: a mark where the vendor publishes
 * one, the name alone everywhere else.
 */
const PLATFORMS = [
  { id: 'stripe', name: 'Stripe', mark: ToolStripe },
  { id: 'square', name: 'Square', mark: ToolSquare },
  { id: 'paypal', name: 'PayPal', mark: ToolPaypal },
  { id: 'jobber', name: 'Jobber' },
  { id: 'housecall-pro', name: 'Housecall Pro' },
  { id: 'service-titan', name: 'ServiceTitan' },
  { id: 'quickbooks', name: 'QuickBooks' },
  { id: 'toast', name: 'Toast' },
  { id: 'custom-integration', name: 'Anything else with an API', generic: true },
]

// What naming this many companies on one page means, and what it does not.
// `ToolMesh` carries the trades' own note by default, and that one is about
// software a shop already pays for rather than about a payment account.
const PLATFORM_NOTE =
  'Product names and marks belong to their owners. Naming one here is not a partnership, an endorsement, or an official integration, and what each of them charges is billed by them.'

const TERMS = [
  {
    title: 'How Long It Takes',
    body: 'The site runs two to four weeks. Booking and ordering built into it add to that, and the date is agreed with the plan before any work starts.',
  },
  {
    title: 'What It Costs to Run',
    body: 'Booking, ordering, and payment are built into the price of the site rather than billed on top of it. What moves that price is how big the whole project is, so you get the number in writing and agree to it before anything starts. What a payment processor charges per transaction is billed by them, not through us.',
  },
]

// A link written into this page by hand still has to be a page this site
// serves, so the route table answers for it rather than whoever edits the list.
const ASIDES = [{ to: '/process', label: 'How a Build Runs' }].filter(aside => serves(aside.to))

export default function OnlineTools() {
  return (
    <div>
      <Seo
        title="Online Booking and Ordering in Baytown, TX"
        description="Online booking, ordering ahead, and payment built into a small business website, with checkout through Stripe, Square, or PayPal, wired to the software you run."
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
              'Booking, ordering, payment, and customer accounts built onto a small business website and wired to the software the business already runs.',
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
          },
        ]}
      />
      <PageHero
        eyebrow="Booking and Ordering"
        title="Take the booking while you are on a job."
        description="A slot booked from a phone at night, an order placed ahead, a quote form that asks the right questions, and the money landing in your account. Built into the site and wired to the software you already run."
      />

      <ServiceSection
        id="covers"
        ground="paper"
        eyebrow="What It Covers"
        title="What you get."
        lede="Everything below is part of the build. Nothing here is an upgrade."
      >
        <FactMesh items={COVERS} ground="paper" columns={{ base: 1, sm: 2, lg: 3 }} />
      </ServiceSection>

      <ServiceSection
        id="platforms"
        ground="band"
        eyebrow="What It Connects To"
        title="The accounts the money and the bookings run through."
        lede="Each of them is opened in your business’s name, set up inside your own account, and left there. Nothing here holds a site hostage to an account somebody else owns."
      >
        <ToolMesh tools={PLATFORMS} ground="band" note={PLATFORM_NOTE} />
      </ServiceSection>

      <ServiceSection
        id="fit"
        ground="paper"
        eyebrow="Link or Built In"
        title="When you need it built in, and when a link will do."
        lede="Plenty of businesses are fine with a booking link. We settle which you need on the first call, before we quote anything."
      >
        <FactMesh items={FIT} ground="paper" columns={{ base: 1, sm: 2 }} />
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

      <MoreServices pages={otherServices(SLUG)} />

      <CtaBanner
        eyebrow="Let’s Talk"
        heading="Take the booking"
        accentText="on the site."
        description="Tell us what the business runs on now and what a customer should be able to do without calling. You get the plan and the price before any work starts."
        primaryLabel={START_LINK.label}
        primaryTo={START_LINK.to}
        secondaryLabel="Ask a Question"
        secondaryTo="/contact"
      />
    </div>
  )
}
