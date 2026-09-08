import { useParams } from 'react-router-dom'
import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { START_LINK, serves } from '@constants/navigation'
import { EXTRA_SERVICES, otherServices, servicePage } from '@data/pages/serviceDetail'
import ServiceSection from './ServiceSection'
import FactMesh from './FactMesh'
import ServiceCards from './ServiceCards'
import SectionLink from './SectionLink'
import { IS_SECOND_SITE, SITE } from '../../../../lib/site/current.js'

/**
 * The page around one service's content, for whichever site is building.
 *
 * The studio's build is a one-off fee and a monthly that keeps the site
 * published, so its time-and-cost section asks what the thing runs and sends a
 * reader on to the whole price and the six steps a build takes. The subsidiary
 * quotes each service on its own page, has no pricing page and no process page
 * to send anyone to, and ends at the enquiry form.
 */
const STUDIO = {
  termsTitle: 'How long it takes, and what it runs.',
  costTitle: 'What It Costs to Run',
  asides: [
    { to: '/pricing', label: 'The Whole Price' },
    { to: '/process', label: 'How a Build Runs' },
  ],
  cta: {
    heading: 'Tell us what',
    accentText: 'you need.',
    description:
      'Pick your trade and the page fills in around it, price included. Or send a message. We read it and answer it ourselves, usually within the hour.',
    secondary: { label: 'See the Price', to: '/pricing' },
  },
}

const SECOND_SITE = {
  termsTitle: 'How long it takes, and what it costs.',
  costTitle: 'What It Costs',
  asides: [],
  cta: {
    heading: 'Start with',
    accentText: 'a call.',
    description:
      'Tell us what the work is and what it has to do when it is done. We read it and answer it ourselves, usually within the hour, and the scope and the price come back in writing before anything is charged.',
    secondary: null,
  },
}

const DOC = IS_SECOND_SITE ? SECOND_SITE : STUDIO

const CTA_SECONDARY = DOC.cta.secondary && serves(DOC.cta.secondary.to) ? DOC.cta.secondary : null

/**
 * One service line's own page. The lines share a shape — what the work covers,
 * what it does not, how long it takes, what it costs — so they share a view and
 * differ only in the content `@data/serviceDetail` holds against their slug.
 *
 * A slug no line carries reaches the 404 page. Only the lines this site sells
 * are prerendered, so this is the answer to a hand-typed address rather than to
 * a link.
 */
export default function ServiceDetail() {
  const { service } = useParams()
  const page = servicePage(service)

  if (!page) return <NotFound />

  const terms = [
    { title: 'How Long It Takes', body: page.timeline },
    { title: DOC.costTitle, body: page.running },
  ]

  // The pages this one sends a reader on to, beside its own price. A link
  // written by hand still has to be a page this site serves, so `serves` reads
  // the route table rather than leaving the answer to whoever edits the list.
  const asides = [...DOC.asides, ...(page.beside ? [page.beside] : [])].filter(aside =>
    serves(aside.to)
  )

  return (
    <div>
      <Seo
        title={SITE.location ? `${page.name} in ${SITE.locationShort}` : page.name}
        description={page.description}
        path={page.path}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Services', path: '/services' },
            { name: page.name, path: page.path },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': `${SITE_URL}${page.path}#service`,
            serviceType: page.name,
            name: page.name,
            description: page.lede,
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
            offers: page.offers,
          },
        ]}
      />
      <PageHero draft="column" eyebrow={page.eyebrow} title={page.name} description={page.lede} />

      <ServiceSection
        id="covers"
        ground="paper"
        draft="plan"
        eyebrow="What It Covers"
        title="What you get."
        lede="Everything below is part of the work. Nothing here is an upgrade."
      >
        <FactMesh items={page.covers} ground="paper" columns={{ base: 1, sm: 2, lg: 3 }} />
      </ServiceSection>

      <ServiceSection
        id="limits"
        ground="band"
        draft="hatch"
        eyebrow="What It Does Not"
        title="What it does not cover."
        lede="You find this out now, not halfway through the work."
      >
        <FactMesh items={page.excludes} ground="band" columns={{ base: 1, sm: 2 }} />
      </ServiceSection>

      <ServiceSection
        id="terms"
        ground="paper"
        draft="ledger"
        eyebrow="Time and Cost"
        title={DOC.termsTitle}
      >
        <FactMesh items={terms} ground="paper" columns={{ base: 1, sm: 2 }} />
        {asides.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {asides.map(aside => (
              <SectionLink key={aside.to} to={aside.to} label={aside.label} ground="paper" />
            ))}
          </div>
        )}
      </ServiceSection>

      <ServiceSection
        id="more"
        ground="paper"
        draft="quiet"
        eyebrow="The Rest of It"
        title="Everything else on offer."
      >
        <ServiceCards
          pages={[...otherServices(page.slug), ...EXTRA_SERVICES]}
          ground="paper"
          columns={{ base: 1, sm: 2, lg: 3 }}
        />
      </ServiceSection>

      <CtaBanner
        draft="column"
        eyebrow="Let’s Talk"
        heading={DOC.cta.heading}
        accentText={DOC.cta.accentText}
        description={DOC.cta.description}
        primaryLabel={START_LINK.label}
        primaryTo={START_LINK.to}
        secondaryLabel={CTA_SECONDARY?.label}
        secondaryTo={CTA_SECONDARY?.to}
      />
    </div>
  )
}
