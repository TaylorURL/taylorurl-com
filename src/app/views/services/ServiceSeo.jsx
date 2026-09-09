import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import { AREA_SERVED, BUSINESS_ID, SERVICE_AREAS, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { MONTHLY_PRICE } from '@data/checkout/pricing'
import { EXTRA_SERVICES, SERVICE_PAGES } from '@data/pages/serviceDetail'
import ServiceSection from './ServiceSection'
import FactMesh from './FactMesh'
import ServiceCards from './ServiceCards'
import SectionLink from './SectionLink'

const PAGE_PATH = '/services/seo'
const PAGE_NAME = 'Getting Found on Google'

// The work itself, in the order it lands: the pages, the place, the markup,
// the speed, the words, and the months after.
const COVERS = [
  {
    title: 'Pages Built to Be Found',
    body: 'Titles, descriptions, headings, and clean addresses set on every page while it is being built.',
  },
  {
    title: 'Local Search',
    body: 'Where you are and what you cover, stated on the site: address, hours, phone, and the towns you actually work in.',
  },
  {
    title: 'Structured Data',
    body: 'The markup that tells Google what the business is, what it sells, and what each page answers.',
  },
  {
    title: 'Speed',
    body: 'Pages that open quickly on a phone on mobile data. A slow page loses the reader before it can lose the ranking.',
  },
  {
    title: 'Written for What People Type',
    body: 'Copy in the words customers search with, not the words the trade uses in-house.',
  },
  {
    title: 'Kept Up',
    body: 'Worked on month after month, with the results deciding what changes on the site.',
  },
]

const LOCAL = [
  {
    title: 'Named, Not Implied',
    body: 'Every town you work in is written on the site, so a search from that town has something to match.',
  },
  {
    title: 'The Same Details Everywhere',
    body: 'Name, address, and phone number written the same way on the site as they read on your map listing.',
  },
  {
    title: 'Questions People Ask',
    body: 'What a customer types before they call, answered on the page they land on.',
  },
]

const NOT_INCLUDED = [
  {
    title: 'Paid Ads',
    body: 'This is organic search. Google Ads and social ads are not bought or managed here.',
  },
  {
    title: 'A Promised Position',
    body: 'Nobody can promise a spot on page one. Anyone who does is guessing with your money.',
  },
  {
    title: 'Bought Links',
    body: 'No paid links and no directory schemes. Google penalizes the sites that buy them.',
  },
  {
    title: 'Reviews',
    body: 'Reviews come from your customers. Nothing here writes them, buys them, or removes them.',
  },
]

const TERMS = [
  {
    title: 'How Long It Takes',
    body: 'Search moves over months, not days. The work starts the day the site goes live and carries on every month after it.',
  },
  {
    title: 'What It Costs',
    body: `Nothing on top. It sits inside the ${MONTHLY_PRICE} a month, beside hosting, monitoring, backups, and changes.`,
  },
]

/**
 * The search work on its own page. It is part of the monthly rather than a
 * service sold beside it, so the page says what is done and where it sits in
 * the price instead of quoting for it.
 */
export default function ServiceSeo() {
  return (
    <div>
      <Seo
        title="Getting Found on Google in Baytown, TX"
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
            isRelatedTo: { '@id': `${SITE_URL}/pricing#offer` },
          },
        ]}
      />
      <PageHero
        eyebrow="Getting Found"
        title="Getting found on Google, every month."
        description={`The search work sits inside the ${MONTHLY_PRICE} a month. There is no separate SEO bill, and no promise about where you land.`}
      />

      <ServiceSection
        id="covers"
        ground="paper"
        eyebrow="The Work"
        title="What actually gets done."
        lede="Most of it happens while the site is being built. The rest happens every month after."
      >
        <FactMesh items={COVERS} ground="paper" columns={{ base: 1, sm: 2, lg: 3 }} />
      </ServiceSection>

      <ServiceSection
        id="local"
        ground="band"
        eyebrow="Local Search"
        title="Found by the people nearest you."
        lede="A local business is searched for by town. The site has to answer in those terms."
      >
        <FactMesh items={LOCAL} ground="band" columns={{ base: 1, sm: 3 }} />
        <div className="border-hair mt-10 flex flex-wrap gap-x-3 gap-y-2 border-t pt-8">
          {SERVICE_AREAS.map(area => (
            <span key={area} className="chip-static">
              {area}
            </span>
          ))}
        </div>
      </ServiceSection>

      <ServiceSection
        id="limits"
        ground="paper"
        eyebrow="What It Does Not"
        title="What it does not cover."
        lede="Anyone who leaves these four off the page is selling you something else."
      >
        <FactMesh items={NOT_INCLUDED} ground="paper" columns={{ base: 1, sm: 2 }} />
      </ServiceSection>

      <ServiceSection
        id="terms"
        ground="band"
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
        eyebrow="Let’s Talk"
        heading="Get found where"
        accentText="you work."
        description="Tell us about the business and the towns it serves. The search work starts with the build and does not stop at launch."
        primaryLabel="Start a Project"
        primaryTo="/start"
        secondaryLabel="See the Price"
        secondaryTo="/pricing"
      />
    </div>
  )
}
