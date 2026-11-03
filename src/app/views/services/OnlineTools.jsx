import Seo from '@components/Seo'
import { TextLink } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import { ToolPaypal, ToolSquare, ToolStripe } from '@components/marks/toolMarks'
import { serves } from '@constants/navigation'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { relatedServices, servicePage } from '@data/pages/serviceDetail'
import ServiceLanding, { ItemAnswer, NameList } from './ServiceLanding'

/**
 * Booking and ordering on its own page.
 *
 * The other website lines answer what the work covers, how long it takes and
 * what it runs, and `ServiceDetail` renders all three from the content held
 * against their slug. This one also has to name the accounts the money and the
 * bookings run through, so it takes a view of its own the way company email
 * and the apps do.
 *
 * `@data/serviceDetail` still holds the line's name, summary and path, because
 * a card, a menu row and the sitemap all read them there and none of them
 * should have to know which service pages are bespoke.
 */
const SLUG = 'online-tools'
const PAGE = servicePage(SLUG)

const FACTS = [
  { label: 'Price', value: 'Part of the price of the site' },
  { label: 'Checkout', value: 'Stripe, Square, or PayPal' },
  { label: 'Card fees', value: 'Billed by the processor, not through me' },
]

// What the work is, in the order a customer meets it: the booking, the order,
// the payment, the questions before a quote, the account afterwards, and the
// screens on your side of it.
const COVERS = [
  {
    title: 'Booking from a phone',
    body: 'A slot booked at ten at night, on the hours and services you actually offer, with the reminder sent the morning of.',
  },
  {
    title: 'Ordering ahead',
    body: 'The menu or the catalog on the site, an order placed and paid for, and a note to the kitchen or the counter when it lands.',
  },
  {
    title: 'Payment that lands',
    body: 'Checkout through Stripe, Square, or PayPal, with the money going into your account and not through mine.',
  },
  {
    title: 'Quote and intake forms',
    body: 'Everything you need to know before a job can be priced, asked once and sent to your inbox.',
  },
  {
    title: 'Customer accounts',
    body: 'Logins for the people who need to see their bookings, invoices, or history without calling to ask.',
  },
  {
    title: 'Your side of it',
    body: 'Back-office screens showing today’s work rather than every record you own, on the phone or the machine at the counter.',
  },
]

/**
 * The accounts the bookings and the money run through: a mark where the
 * vendor publishes one, the name alone everywhere else.
 */
const PLATFORMS = [
  { name: 'Stripe', mark: ToolStripe },
  { name: 'Square', mark: ToolSquare },
  { name: 'PayPal', mark: ToolPaypal },
  { name: 'Jobber' },
  { name: 'Housecall Pro' },
  { name: 'ServiceTitan' },
  { name: 'QuickBooks' },
  { name: 'Toast' },
  { name: 'Anything else with an API', quiet: true },
]

// What naming this many companies on one page means, and what it does not.
const PLATFORM_NOTE =
  'Product names and marks belong to their owners. Naming one here is not a partnership, an endorsement, or an official integration, and what each of them charges is billed by them.'

/** The platforms in one card, with the note on what naming them means. */
function Platforms() {
  return (
    <>
      <NameList items={PLATFORMS} className="lg:!grid-cols-3" />
      <p className={`${TYPE.small} mt-6 max-w-[640px]`}>{PLATFORM_NOTE}</p>
    </>
  )
}

const SECTIONS = [
  {
    id: 'platforms',
    title: 'The accounts the money and the bookings run through',
    lede: 'Each one is opened in your business’s name and set up inside your own account. Nothing holds the site hostage to an account somebody else owns.',
    content: <Platforms />,
  },
]

const EXAMPLE = {
  host: 'baytowngokarts.com',
  line: 'Kart heats, bounce houses, and a party room in Baytown. Ticket bundles and party rentals go into a cart and out through Stripe Checkout, so a parent planning Saturday can book without calling.',
}

// The honest question, answered before the quote: a link to somebody else's
// booking page does the job for plenty of businesses, and the page says so
// rather than selling the built-in one to everybody who lands.
const FIT = [
  {
    title: 'A booking link is enough when',
    body: 'One person takes one kind of appointment, and a link to a calendar somebody else hosts does not cost you customers.',
  },
  {
    title: 'Built-in booking earns its place when',
    body: 'Customers leave when they are sent off the site, the services and the staff need their own rules, or the booking has to reach the software the business already runs.',
  },
]

// A link written into this page by hand still has to be a page this site
// serves, so the route table answers for it rather than whoever edits the list.
const PROCESS = serves('/process') ? { to: '/process', label: 'How a Build Runs' } : null

const QUESTIONS = [
  {
    q: 'Do I need booking built in, or will a link do?',
    a: (
      <ItemAnswer
        lede="Plenty of businesses are fine with a booking link. I settle which you need on the first call, before I quote anything."
        items={FIT}
      />
    ),
  },
  {
    q: 'How long does it take?',
    a: (
      <>
        <p>
          The site runs two to four weeks. Booking and ordering built into it add to that, and the
          date is agreed with the plan before any work starts.
        </p>
        {PROCESS && (
          <p>
            <TextLink to={PROCESS.to} label={PROCESS.label} />
          </p>
        )}
      </>
    ),
  },
  {
    q: 'What does it cost to run?',
    a: 'Booking, ordering, and payment are built into the price of the site rather than billed on top of it. What moves that price is how big the whole project is, so you get the number in writing and agree to it before anything starts. What a payment processor charges per transaction is billed by them, not through me.',
  },
]

const RELATED = ['new-website', 'ad-tracking', 'mobile-apps']

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
      <ServiceLanding
        title="Take the booking while you are on a job."
        lead="A slot booked from a phone at night, an order placed ahead, and the money landing in your account. Built into the site and wired to the software you already run."
        facts={FACTS}
        covers={COVERS}
        sections={SECTIONS}
        example={EXAMPLE}
        questions={QUESTIONS}
        related={relatedServices(SLUG, RELATED)}
        cta="Take the booking on the site."
      />
    </div>
  )
}
