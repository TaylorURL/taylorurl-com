import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { otherServices, servicePage } from '@data/pages/serviceDetail'
import ServiceSection from './ServiceSection'
import FactMesh from './FactMesh'
import MoreServices from './MoreServices'
import SectionLink from './SectionLink'

// The name, the path and the mark come from the same data the menu and the
// cards read, so this page cannot be called one thing in the bar and another
// in its own breadcrumb.
const SLUG = 'mobile-apps'
const PAGE = servicePage(SLUG)
const PAGE_PATH = PAGE.path
const PAGE_NAME = PAGE.name

// What the work is, in the order it lands: the stores, the screens, the site
// underneath, the sign-in, the notifications, and the listing.
const COVERS = [
  {
    title: 'Both Stores',
    body: 'Built once and shipped to the App Store and Google Play, so an iPhone customer and an Android customer open the same app.',
  },
  {
    title: 'Drawn for a Thumb',
    body: 'Screens laid out for one hand on a phone, not a website squeezed into a frame.',
  },
  {
    title: 'Wired to the Site',
    body: 'The app and the website read the same bookings, orders, and customer records, so nothing is entered twice.',
  },
  {
    title: 'Sign-In and Accounts',
    body: 'Customers sign in with Apple, Google, or a phone number. Staff get their own access, set per person.',
  },
  {
    title: 'Push Notifications',
    body: 'A reminder the morning of an appointment, or a note when an order is ready, sent to the phone in their pocket.',
  },
  {
    title: 'Listed and Approved',
    body: 'The developer accounts opened in your name, the store listings written, and the review handled until both stores say yes.',
  },
]

// What a local business puts an app in front of, and who opens it.
const USES = [
  {
    title: 'Booking and Ordering',
    body: 'Customers book a chair, a table, or a visit, or order ahead, from an icon on their home screen.',
  },
  {
    title: 'Repeat Business',
    body: 'Points, punch cards, and offers that live in the app instead of in a wallet.',
  },
  {
    title: 'A Tool for the Crew',
    body: 'Job sheets, photos, checklists, and time on site, filled in on the phone the technician already carries.',
  },
  {
    title: 'A Customer Portal',
    body: 'Invoices, appointment history, and documents in one place a customer can open without calling.',
  },
]

// The honest question, answered before the quote: most businesses do not need
// one, and the page says so rather than selling one to everybody who lands.
const FIT = [
  {
    title: 'The Site Is Enough When',
    body: 'A customer visits once or twice a year. A website that works well on a phone does that job, and nobody installs an app for it.',
  },
  {
    title: 'An App Earns Its Place When',
    body: 'The same people come back every week, staff work from the field, or a reminder on the lock screen is worth more than an email.',
  },
]

const TERMS = [
  {
    title: 'How Long It Takes',
    body: 'Longer than a website, because there are two stores to satisfy and a back end to build. You get the finish date in writing with the price, and at the end, store review adds a few days nobody controls.',
  },
  {
    title: 'What It Costs',
    body: 'One fee to build it, paid once before the work begins, then a monthly to host the back end, publish updates, and keep it on both stores. The App Store and Google Play charge their own yearly developer fees, which you pay them directly.',
  },
]

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
      <PageHero
        eyebrow="Mobile Apps"
        title="An iOS and Android app for the customers who keep coming back."
        description="iOS and Android apps for your business around Baytown: booking, ordering, loyalty, or the tool your crew carries on the job. Built by the same team that builds the site, and you get the price in writing before any work starts."
      />

      <ServiceSection
        id="covers"
        ground="paper"
        eyebrow="What It Covers"
        title="What you get."
        lede="Built, published on both stores, and left in your name."
      >
        <FactMesh items={COVERS} ground="paper" columns={{ base: 1, sm: 2, lg: 3 }} />
      </ServiceSection>

      <ServiceSection
        id="uses"
        ground="band"
        eyebrow="What It Is For"
        title="What a local business puts in an app."
        lede="Four jobs an app does better than a website, because the phone is already in hand."
      >
        <FactMesh items={USES} ground="band" columns={{ base: 1, sm: 2, lg: 4 }} />
      </ServiceSection>

      <ServiceSection
        id="fit"
        ground="paper"
        eyebrow="Site or App"
        title="When you need one, and when the site is enough."
        lede="Most businesses do not need an app. The first call settles which you need before we quote anything."
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
        <div className="mt-8">
          <SectionLink to="/contact" label="Ask What Yours Would Run" ground="band" />
        </div>
      </ServiceSection>

      <MoreServices pages={otherServices(SLUG)} />

      <CtaBanner
        eyebrow="Let’s Talk"
        heading="Get your app"
        accentText="on both stores."
        description="Tell us what it has to do and who will open it. You get a plan and a price before any work starts, and a straight answer if the site would do the job."
        primaryLabel="Start a Project"
        primaryTo="/start"
        secondaryLabel="Ask a Question"
        secondaryTo="/contact"
      />
    </div>
  )
}
