import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { EXTRA_SERVICES, SERVICE_PAGES } from '@data/pages/serviceDetail'
import ServiceSection from './ServiceSection'
import FactMesh from './FactMesh'
import ServiceCards from './ServiceCards'
import SectionLink from './SectionLink'

const PAGE_PATH = '/services/business-email'
const PAGE_NAME = 'Business Email'

// What the work is, in the order it happens: the address, the mailboxes behind
// it, the routing on top of it, and the move onto it.
const COVERS = [
  {
    title: 'Your Own Address',
    body: 'Mail at yourbusiness.com, on the same domain as the website, so the two read as one business.',
  },
  {
    title: 'Mailboxes for the Team',
    body: 'One for the shop and one for each person, created and handed over working.',
  },
  {
    title: 'Forwarding and Aliases',
    body: 'Sales, service, and billing addresses all landing wherever they should land.',
  },
  {
    title: 'Records Set Right',
    body: 'SPF, DKIM, and DMARC in place, which is what keeps your mail out of a customer’s junk folder.',
  },
  {
    title: 'Signed In Everywhere',
    body: 'Phones, tablets, and desktop mail programs, each one sending and receiving before it is handed back.',
  },
  {
    title: 'Moved Across',
    body: 'Old mail, contacts, and calendars carried over from whatever runs it today.',
  },
]

// Where the mail lives now, and what each answer means for the move. The two
// named providers are set up and migrated directly; everything else is handled
// the same way.
const PROVIDERS = [
  {
    title: 'Google Workspace',
    body: 'Set up, licensed, and migrated directly, with Gmail, Drive, and Calendar on your own domain.',
  },
  {
    title: 'Microsoft 365',
    body: 'Set up, licensed, and migrated directly, with Outlook, OneDrive, and Teams on your own domain.',
  },
  {
    title: 'Any Other Provider',
    body: 'GoDaddy, Yahoo, an old host’s mail server, or whatever the last person set up. It moves the same way.',
  },
  {
    title: 'Nothing Set Up Yet',
    body: 'A clean set of mailboxes on the domain, with the free account left running until you are ready.',
  },
]

const NOT_INCLUDED = [
  {
    title: 'The Provider’s Fee',
    body: 'Google and Microsoft charge per mailbox, per month, billed to you at their own rate.',
  },
  {
    title: 'Access to Your Mail',
    body: 'The account is in the business’s name and handed over. Nothing here keeps a way into the mailboxes.',
  },
  {
    title: 'Bulk Sending',
    body: 'Newsletters and campaigns belong on a sending service. Firing them from a mailbox is what gets a domain blocked.',
  },
  {
    title: 'Phone and Texting',
    body: 'Numbers, voicemail, and business texting are separate systems and are not set up here.',
  },
]

const TERMS = [
  {
    title: 'How Long It Takes',
    body: 'Set up before the site goes live, with the move run on a date you pick so nothing lands in a mailbox nobody is watching.',
  },
  {
    title: 'What It Costs to Run',
    body: 'Setup and the move are quoted with the rest of the work. After that the only ongoing cost is what the provider charges per mailbox.',
  },
]

/**
 * Business email on its own page. It is real work with its own decisions, and
 * the only other place it appears is a step inside the configurator, where it
 * is asked as a question rather than explained.
 */
export default function BusinessEmail() {
  return (
    <div>
      <Seo
        title="Business Email Setup in Baytown, TX"
        description="Business email on your own domain: mailboxes, forwarding, aliases, and migration to Google Workspace or Microsoft 365, set up for Houston-area businesses."
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
            serviceType: 'Business email setup and migration',
            name: 'Business email on your own domain',
            description:
              'Mailboxes, forwarding, aliases, and migration onto Google Workspace, Microsoft 365, or another provider, on the business’s own domain.',
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
          },
        ]}
      />
      <PageHero
        draft="ledger"
        eyebrow="Business Email"
        title="Mail that reads as the business."
        description="An address at your own domain instead of yourbusiness@gmail.com. Mailboxes, forwarding, aliases, and the move off whatever runs it today."
      />

      <ServiceSection
        id="covers"
        ground="paper"
        draft="plan"
        eyebrow="What It Covers"
        title="What you get."
        lede="Set up, handed over working, and left in your name."
      >
        <FactMesh items={COVERS} ground="paper" columns={{ base: 1, sm: 2, lg: 3 }} />
      </ServiceSection>

      <ServiceSection
        id="providers"
        ground="band"
        draft="column"
        eyebrow="Providers"
        title="Where your email lives now."
        lede="Whatever the answer is, I handle the move the same way."
      >
        <FactMesh items={PROVIDERS} ground="band" columns={{ base: 1, sm: 2, lg: 4 }} />
      </ServiceSection>

      <ServiceSection
        id="limits"
        ground="paper"
        draft="hatch"
        eyebrow="What It Does Not"
        title="What it does not cover."
        lede="Everything the setup does not touch, listed before it comes up."
      >
        <FactMesh items={NOT_INCLUDED} ground="paper" columns={{ base: 1, sm: 2 }} />
      </ServiceSection>

      <ServiceSection
        id="terms"
        ground="band"
        draft="ledger"
        eyebrow="Time and Cost"
        title="How long it takes, and what it runs."
      >
        <FactMesh items={TERMS} ground="band" columns={{ base: 1, sm: 2 }} />
        <div className="mt-8">
          <SectionLink to="/pricing" label="The Whole Price" ground="band" />
        </div>
      </ServiceSection>

      <ServiceSection
        id="more"
        ground="paper"
        draft="plan"
        eyebrow="The Rest of It"
        title="Everything else on offer."
      >
        <ServiceCards
          pages={[...SERVICE_PAGES, ...EXTRA_SERVICES.filter(page => page.path !== PAGE_PATH)]}
          ground="paper"
          columns={{ base: 1, sm: 2, lg: 3 }}
        />
      </ServiceSection>

      <CtaBanner
        draft="ledger"
        eyebrow="Let’s Talk"
        heading="Get the address"
        accentText="set up."
        description="Business email is set up alongside the site. Tell me what the business runs on now and I will handle the move."
        primaryLabel="Start a Project"
        primaryTo="/start"
        secondaryLabel="See the Price"
        secondaryTo="/pricing"
      />
    </div>
  )
}
