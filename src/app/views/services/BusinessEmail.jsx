import Seo from '@components/Seo'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { relatedServices, servicePage } from '@data/pages/serviceDetail'
import ServiceLanding from './ServiceLanding'

// The name and the path come from the same data the menu and the cards read,
// so this page cannot be called one thing in the bar and another in its own
// breadcrumb.
//
// Read as optional because the subsidiary compiles this view too, and its
// prerender evaluates the module even though its route table never mounts it.
// There the service does not exist, the record is null, and a bare `.path` at
// the top level stopped that site's build.
const SLUG = 'business-email'
const PAGE = servicePage(SLUG)
const PAGE_PATH = PAGE?.path
const PAGE_NAME = PAGE?.name

const FACTS = [
  { label: 'Setup and the move', value: 'Part of the build' },
  { label: 'Mailboxes', value: 'Billed to you by the provider' },
  { label: 'The switch', value: 'On a date you pick' },
]

// What the work is, in the order it happens: the address, the mailboxes behind
// it, the routing on top of it, and the move onto it.
const COVERS = [
  {
    title: 'Your own address',
    body: 'Mail at yourbusiness.com, on the same domain as the website, so the two read as one business.',
  },
  {
    title: 'Mailboxes for your team',
    body: 'One for the shop and one for each person, created and handed over working.',
  },
  {
    title: 'Forwarding and aliases',
    body: 'Sales, service, and billing addresses all landing wherever they should land.',
  },
  {
    title: 'Records set right',
    body: 'SPF, DKIM, and DMARC in place, which is what keeps your mail out of a customer’s junk folder.',
  },
  {
    title: 'Signed in everywhere',
    body: 'Phones, tablets, and desktop mail programs, each one sending and receiving before it is handed back.',
  },
  {
    title: 'Moved across',
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
    title: 'Any other provider',
    body: 'GoDaddy, Yahoo, an old host’s mail server, or whatever the last person set up. It moves the same way.',
  },
  {
    title: 'Nothing set up yet',
    body: 'A clean set of mailboxes on the domain, with the free account left running until you are ready.',
  },
]

const SECTIONS = [{ id: 'providers', title: 'Where your email lives now', items: PROVIDERS }]

const QUESTIONS = [
  {
    q: 'How long does it take?',
    a: 'Set up before the site goes live, with the move run on a date you pick so nothing lands in a mailbox nobody is watching.',
  },
  {
    q: 'What does it cost to run?',
    a: 'Setup and the move are part of the build. After that the only cost beyond the monthly is what the provider charges per mailbox, and the provider bills you for it.',
  },
]

const RELATED = ['new-website', 'care', 'online-tools']

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
      <ServiceLanding
        title="Mail that reads as the business."
        lead="An address at your own domain instead of yourbusiness@gmail.com, with mailboxes, forwarding, aliases, and the move off whatever runs it today."
        facts={FACTS}
        covers={COVERS}
        sections={SECTIONS}
        questions={QUESTIONS}
        related={relatedServices(SLUG, RELATED)}
        cta="Get the address set up."
      />
    </div>
  )
}
