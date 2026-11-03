import Seo from '@components/Seo'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { relatedServices, servicePage } from '@data/pages/serviceDetail'
import ServiceLanding, { ItemAnswer } from './ServiceLanding'

// The name and the path come from the same data the menu and the cards read,
// so this page cannot be called one thing in the bar and another in its own
// breadcrumb.
//
// Read as optional because the subsidiary compiles this view too, and its
// prerender evaluates the module even though its route table never mounts it.
// There the service does not exist, the record is null, and a bare `.path` at
// the top level stopped that site's build.
const SLUG = 'mobile-apps'
const PAGE = servicePage(SLUG)
const PAGE_PATH = PAGE?.path
const PAGE_NAME = PAGE?.name

const FACTS = [
  { label: 'Published on', value: 'The App Store and Google Play' },
  { label: 'Price', value: 'One build fee, then a monthly' },
  { label: 'Store fees', value: 'Paid by you, straight to the stores' },
]

// What the work is, in the order it lands: the stores, the screens, the site
// underneath, the sign-in, the notifications, and the listing.
const COVERS = [
  {
    title: 'Both stores',
    body: 'Built once and shipped to the App Store and Google Play, so an iPhone customer and an Android customer open the same app.',
  },
  {
    title: 'Drawn for a thumb',
    body: 'Screens laid out for one hand on a phone, not a website squeezed into a frame.',
  },
  {
    title: 'Wired to the site',
    body: 'The app and the website read the same bookings, orders, and customer records, so nothing is entered twice.',
  },
  {
    title: 'Sign-in and accounts',
    body: 'Customers sign in with Apple, Google, or a phone number. Staff get their own access, set per person.',
  },
  {
    title: 'Push notifications',
    body: 'A reminder the morning of an appointment, or a note when an order is ready, sent to the phone in their pocket.',
  },
  {
    title: 'Listed and approved',
    body: 'The developer accounts opened in your name, the store listings written, and the review handled until both stores say yes.',
  },
]

// What a local business puts an app in front of, and who opens it.
const USES = [
  {
    title: 'Booking and ordering',
    body: 'Customers book a chair, a table, or a visit, or order ahead, from an icon on their home screen.',
  },
  {
    title: 'Repeat business',
    body: 'Points, punch cards, and offers that live in the app instead of in a wallet.',
  },
  {
    title: 'A tool for the crew',
    body: 'Job sheets, photos, checklists, and time on site, filled in on the phone the technician already carries.',
  },
  {
    title: 'A customer portal',
    body: 'Invoices, appointment history, and documents in one place a customer can open without calling.',
  },
]

const SECTIONS = [{ id: 'uses', title: 'What a local business puts in an app', items: USES }]

// The honest question, answered before the quote: most businesses do not need
// one, and the page says so rather than selling one to everybody who lands.
const FIT = [
  {
    title: 'The site is enough when',
    body: 'A customer visits once or twice a year. A website that works well on a phone does that job, and nobody installs an app for it.',
  },
  {
    title: 'An app earns its place when',
    body: 'The same people come back every week, staff work from the field, or a reminder on the lock screen is worth more than an email.',
  },
]

const QUESTIONS = [
  {
    q: 'Do I need an app, or is the site enough?',
    a: (
      <ItemAnswer
        lede="Most businesses do not need an app. The first call settles which you need before I quote anything."
        items={FIT}
      />
    ),
  },
  {
    q: 'How long does it take?',
    a: 'Longer than a website, because there are two stores to satisfy and a back end to build. You get the finish date in writing with the price, and at the end, store review adds a few days nobody controls.',
  },
  {
    q: 'What does it cost?',
    a: 'One fee to build it, paid once before the work begins, then a monthly to host the back end, publish updates, and keep it on both stores. The App Store and Google Play charge their own yearly developer fees, which you pay them directly.',
  },
]

const RELATED = ['desktop-apps', 'online-tools', 'automation']

/**
 * The apps on their own page. An app is a project with its own decisions and
 * its own gatekeepers, and the pages that mention it elsewhere name it in a
 * list rather than explain it.
 */
export default function MobileApps() {
  return (
    <div>
      <Seo
        title="iOS and Android App Development in Baytown, TX"
        description="iOS and Android apps for Baytown, TX businesses: booking, ordering, loyalty, and tools for staff, wired to the website and published on both stores."
        path={PAGE_PATH}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Services', path: '/services' },
            { name: PAGE_NAME, path: PAGE_PATH },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': `${SITE_URL}${PAGE_PATH}#service`,
            serviceType: 'Mobile application development',
            name: 'iOS and Android apps for local businesses',
            description:
              'Apps for iPhone and Android, built beside the website they share data with, and published on the App Store and Google Play in the business’s own name.',
            url: `${SITE_URL}${PAGE_PATH}`,
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
          },
        ]}
      />
      <ServiceLanding
        title="An iOS and Android app for the customers who keep coming back."
        lead="Booking, ordering, loyalty, or the tool your crew carries on the job. Built alongside the site, wired to it, and priced in writing before any work starts."
        facts={FACTS}
        covers={COVERS}
        sections={SECTIONS}
        questions={QUESTIONS}
        related={relatedServices(SLUG, RELATED)}
        cta="Get your app on both stores."
      />
    </div>
  )
}
