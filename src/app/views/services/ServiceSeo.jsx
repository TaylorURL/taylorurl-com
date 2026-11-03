import Seo from '@components/Seo'
import { AREA_SERVED, BUSINESS_ID, SERVICE_AREAS, SITE_URL, breadcrumbSchema } from '@constants/seo'
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
const SLUG = 'seo'
const PAGE = servicePage(SLUG)
const PAGE_PATH = PAGE?.path
const PAGE_NAME = PAGE?.name

const FACTS = [
  { label: 'Price', value: 'Inside the monthly, nothing on top' },
  { label: 'Starts', value: 'The day the site goes live' },
  { label: 'Moves over', value: 'Months, not days' },
]

// The work itself, in the order it lands: the pages, the place, the markup,
// the speed, the words, and the months after.
const COVERS = [
  {
    title: 'Pages built to be found',
    body: 'Titles, descriptions, headings, and clean addresses set on every page while it is being built.',
  },
  {
    title: 'Local search',
    body: 'Where you are and what you cover, stated on the site: address, hours, phone, and the towns you actually work in.',
  },
  {
    title: 'Structured data',
    body: 'The markup that tells Google what the business is, what it sells, and what each page answers.',
  },
  {
    title: 'Speed',
    body: 'Pages that open quickly on a phone on mobile data. A slow page loses the reader before it can lose the ranking.',
  },
  {
    title: 'Written for what people type',
    body: 'Copy in the words customers search with, not the words the trade uses in-house.',
  },
  {
    title: 'Kept up',
    body: 'Worked on month after month, with the results deciding what changes on the site.',
  },
]

const LOCAL = [
  {
    title: 'Named, not implied',
    body: 'Every town you work in is written on the site, so a search from that town has something to match.',
  },
  {
    title: 'The same details everywhere',
    body: 'Name, address, and phone number written the same way on the site as they read on your map listing.',
  },
  {
    title: 'Questions people ask',
    body: 'What a customer types before they call, answered on the page they land on.',
  },
]

const SECTIONS = [{ id: 'local', title: 'Found by the people nearest you', items: LOCAL }]

const EXAMPLE = {
  host: 'ccscaleservices.com',
  line: 'Calibration, repair, and a parts counter for industrial weighing equipment, out of a family-owned shop in Huffman. Every part carries a page of its own, so a search for a failed load cell lands on the thing itself.',
}

const QUESTIONS = [
  {
    q: 'How long does it take?',
    a: 'Search moves over months, not days. The work starts the day the site goes live and carries on every month after it.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing on top. It sits inside the monthly, beside hosting, monitoring, backups, and changes.',
  },
  {
    q: 'Which towns does the work reach?',
    a: `${SERVICE_AREAS.join(', ')}.`,
  },
]

const RELATED = ['care', 'ad-tracking', 'new-website']

/**
 * The search work on its own page. It is part of the monthly rather than a
 * service sold beside it, so the page says what is done and where it sits in
 * the price instead of quoting for it.
 */
export default function ServiceSeo() {
  return (
    <div>
      <Seo
        title="SEO and Google Rankings in Baytown, TX"
        description="Local SEO for Baytown, TX businesses: pages built for search, local signals, structured data, and speed. Part of the monthly fee, not sold separately."
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
            serviceType: 'Search engine optimization',
            name: 'Organic and local search work',
            description:
              'Pages built to be found, local search signals, structured data, and page speed, carried out every month a site is under care.',
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
          },
        ]}
      />
      <ServiceLanding
        title="Found on Google, and I keep at it every month."
        lead="The search work sits inside the monthly fee that keeps the site running. There is no separate SEO bill, and no promise about where you land."
        facts={FACTS}
        covers={COVERS}
        coversTitle="What actually gets done"
        sections={SECTIONS}
        example={EXAMPLE}
        questions={QUESTIONS}
        related={relatedServices(SLUG, RELATED)}
        cta="Get found where you work."
      />
    </div>
  )
}
