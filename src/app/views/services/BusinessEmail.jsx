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
//
// Read as optional because the subsidiary compiles this view too, and its
// prerender evaluates the module even though its route table never mounts it.
// There the service does not exist, the record is null, and a bare `.path` at
// the top level stopped that site's build.
const SLUG = 'business-email'
const PAGE = servicePage(SLUG)
const PAGE_PATH = PAGE?.path
const PAGE_NAME = PAGE?.name

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

const TERMS = [
  {
    title: 'How Long It Takes',
    body: 'Set up before the site goes live, with the move run on a date you pick so nothing lands in a mailbox nobody is watching.',
  },
  {
    title: 'What It Costs to Run',
    body: 'Setup and the move are part of the build. After that the only cost beyond the monthly is what the provider charges per mailbox, and the provider bills you for it.',
  },
]

/**
 * Business email on its own page. It is real work with its own decisions, and
 * the pages that mention it elsewhere name it in a list rather than explain
 * it.
 */
export default function BusinessEmail() {
  return (
    <div>
      <Seo
        title="Company Email Setup in Baytown, TX"
        description="Company email on your own domain: mailboxes, forwarding, aliases, and migration to Google Workspace or Microsoft 365, set up for Houston-area businesses."
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
            serviceType: 'Company email setup and migration',
            name: 'Company email on your own domain',
            description:
              'Mailboxes, forwarding, aliases, and migration onto Google Workspace, Microsoft 365, or another provider, on the business’s own domain.',
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
          },
        ]}
      />
      <PageHero
        eyebrow="Company Email"
        title="Mail that reads as the business."
        description="An address at your own domain instead of yourbusiness@gmail.com. Mailboxes, forwarding, aliases, and the move off whatever runs it today."
      />

      <ServiceSection
        id="covers"
        ground="paper"
        eyebrow="What It Covers"
        title="What you get."
        lede="Set up, handed over working, and left in your name."
      >
        <FactMesh items={COVERS} ground="paper" columns={{ base: 1, sm: 2, lg: 3 }} />
      </ServiceSection>

      <ServiceSection
        id="providers"
        ground="band"
        eyebrow="Providers"
        title="Where your email lives now."
        lede="Whatever the answer is, we handle the move the same way."
      >
        <FactMesh items={PROVIDERS} ground="band" columns={{ base: 1, sm: 2, lg: 4 }} />
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
        heading="Get the address"
        accentText="set up."
        description="We set up company email alongside the site. Tell us what the business runs on now and we will handle the move."
        primaryLabel="Start a Project"
        primaryTo="/start"
        secondaryLabel="Ask a Question"
        secondaryTo="/contact"
      />
    </div>
  )
}
