import {
  CallToAction,
  FactList,
  Grid,
  LinkCard,
  PageIntro,
  Section,
  SectionHead,
} from '@components/kit/Kit'
import Seo from '@components/Seo'
import { SERVICE_LINES } from '@data/pages/services'
import {
  INCLUDED_SERVICE_PAGES,
  SERVICE_PAGES,
  SOFTWARE_SERVICE_PAGES,
} from '@data/pages/serviceDetail'
import { AREA_SERVED, BUSINESS_ID, SERVICE_AREAS, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { CoverList, NameList } from './ServiceLanding'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/**
 * The page around the lists, for whichever site is building.
 *
 * Everything here is a claim about the offer rather than about the layout: what
 * the page is called in a search result, what the service node publishes, what
 * holds on every job, and what each way to buy is in a line. The studio sells
 * websites to the towns around Baytown and quotes each one; the subsidiary sells
 * three services to companies anywhere and states each price on the service's
 * own page.
 *
 * `IS_SECOND_SITE` folds to a literal at build time, so the record that loses
 * is dropped from the bundle rather than shipped inside the other site.
 */
const STUDIO = {
  seoTitle: 'Small Business Websites in Baytown, TX',
  seoDescription:
    'Small business websites in Baytown, TX: custom sites and redesigns with booking, company email, ad tracking, SEO, and hosting included, plus apps and automation.',
  serviceType: 'Web Development',
  serviceName: 'Small business websites, apps, and software',
  catalogName: 'Small business website and software services',
  title: 'I build it, host it, and answer when you call.',
  lead: 'A website for shops, restaurants, trades, and pros around Baytown and the Houston area.',
  facts: [
    { label: 'With every site', value: 'Booking, company email, ad tracking, SEO, and hosting' },
    { label: 'Quoted on their own', value: 'Apps and automation' },
    { label: 'Before any work starts', value: 'A plan and a price, in writing' },
  ],
  linesTitle: 'Two ways to buy a site',
  // What each way to buy is, in a line, keyed by the slug the line carries in
  // `@data/services`. The name and the link come from the line itself, so a
  // card cannot name a service the menu and the pages do not.
  lines: {
    'new-website':
      'Designed from scratch around your business and the customers you want walking in.',
    redesign:
      'A dated site that isn’t bringing in business, rebuilt from the ground up so you look as good online as you do in person.',
  },
  // The two groups under the lines, each a list the menu also draws as a
  // column. The first says what every site comes with, because five pages
  // under a plain heading read as five more bills.
  groups: [
    { title: 'Included with every site', pages: INCLUDED_SERVICE_PAGES },
    {
      title: 'Separate projects',
      lead: 'Apps and automation, each one a project I quote on its own.',
      pages: SOFTWARE_SERVICE_PAGES,
    },
  ],
  holds: {
    title: 'Six things you never have to ask for',
    items: [
      'Works on every phone',
      'Built for Google to read',
      'Backed up and kept secure',
      'Domain set up for you',
      'Changes any time, no fee',
      'Quick page loads',
    ],
  },
  cta: 'Get a plan and a price.',
}

const SECOND_SITE = {
  seoTitle: 'Software, Tracking Repair, and Outbound',
  seoDescription:
    'Custom software built to order, conversion tracking repaired so it reports the leads that came in, and outbound email run from a sending domain of your own.',
  serviceType: 'Software Development',
  serviceName: 'Software engineering, tracking repair, and outbound email',
  catalogName: 'Engineering, tracking, and outbound services',
  title: 'Software built to order, tracking repaired, outbound run.',
  lead: 'Three services, for companies anywhere.',
  facts: [
    {
      label: 'After the first call',
      value: 'The scope, the price, and the finish date, in writing',
    },
    { label: 'Before anything starts', value: 'What is not included, named' },
    { label: 'Term', value: 'None to sign' },
  ],
  linesTitle: 'Three services',
  lines: {
    'software-engineering':
      'A job that runs on spreadsheets and email, or two systems that never pass anything between them, built into software that is yours to keep.',
    'tracking-repair':
      'Conversions moved off page loads and onto a booked job or a form that reached your inbox, so the ad platform counts the work that came in.',
    outbound:
      'The list, the writing, the sending, and the replies, all run from a domain registered for you and warmed up before it sends at full rate.',
  },
  groups: [],
  holds: {
    title: 'Six things that are true of all three',
    items: [
      'A scope and a price in writing',
      'A finish date before work starts',
      'What is not included, named first',
      'A direct line, no ticket queue',
      'A reply usually within the hour',
      'No term to sign',
    ],
  },
  cta: 'Say which one you need.',
}

const DOC = IS_SECOND_SITE ? SECOND_SITE : STUDIO

/**
 * Everything on offer: the ways to buy, what comes with them, what is quoted
 * on its own, what holds on every job, and where the work reaches.
 */
export default function Services() {
  return (
    <div>
      <Seo
        title={DOC.seoTitle}
        description={DOC.seoDescription}
        path="/services"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Services', path: '/services' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: DOC.serviceType,
            name: DOC.serviceName,
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: DOC.catalogName,
              itemListElement: SERVICE_PAGES.map(line => ({
                '@type': 'Offer',
                itemOffered: {
                  '@type': 'Service',
                  '@id': `${SITE_URL}${line.path}#service`,
                  name: line.name,
                  description: line.summary,
                  url: `${SITE_URL}${line.path}`,
                },
              })),
            },
          },
        ]}
      />

      <PageIntro
        title={DOC.title}
        lead={DOC.lead}
        media={<FactList items={DOC.facts} className="lg:ml-auto lg:max-w-[420px]" />}
      />

      {/* Each card carries the line's slug as its id, so `/services#<slug>`
          still lands on the service it names. */}
      <Section label={DOC.linesTitle} className="!pt-4 sm:!pt-6">
        <SectionHead title={DOC.linesTitle} />
        <Grid cols={SERVICE_LINES.length === 2 ? 2 : 3}>
          {SERVICE_LINES.map(line => (
            <div key={line.slug} id={line.slug} className="scroll-mt-28">
              <LinkCard to={line.path} title={line.name} body={DOC.lines[line.slug]} />
            </div>
          ))}
        </Grid>
      </Section>

      {DOC.groups
        .filter(group => group.pages.length > 0)
        .map(group => (
          <Section key={group.title} label={group.title}>
            <SectionHead title={group.title} />
            <Grid cols={group.pages.length === 4 ? 4 : 3}>
              {group.pages.map(page => (
                <LinkCard key={page.slug} to={page.path} title={page.name} body={page.summary} />
              ))}
            </Grid>
          </Section>
        ))}

      <Section label={DOC.holds.title}>
        <SectionHead title={DOC.holds.title} />
        <CoverList items={DOC.holds.items} />
      </Section>

      {/*
        Where the work reaches, which is a claim only the studio makes: the
        subsidiary sells to companies anywhere and `SERVICE_AREAS` is empty for
        it. The gate is a comparison against the site key rather than against
        that list's length, because only the first folds at build time - a
        length check is opaque to the bundler, and the section's town copy would
        ship inside the other site's chunk having never been rendered.
      */}
      {IS_SECOND_SITE ? null : (
        <Section label="Where I work">
          <SectionHead title="Local businesses across the Houston area" />
          <NameList items={SERVICE_AREAS} />
        </Section>
      )}

      <CallToAction title={DOC.cta} />
    </div>
  )
}
