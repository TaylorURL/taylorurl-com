import { useParams } from 'react-router-dom'
import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { START_LINK, serves } from '@constants/navigation'
import { otherServices, servicePage } from '@data/pages/serviceDetail'
import ServiceSection from './ServiceSection'
import FactMesh from './FactMesh'
import MoreServices from './MoreServices'
import SectionLink from './SectionLink'
import { IS_SECOND_SITE, SITE } from '../../../../lib/site/current.js'

/**
 * The page around one service's content, for whichever site is building.
 *
 * The studio's build is a one-off fee and a monthly that keeps the site
 * published, both quoted for the project, so its time-and-cost section asks
 * what the thing runs and sends a reader on to the six steps a build takes.
 * The subsidiary quotes each service on its own page, has no process page to
 * send anyone to, and ends at the enquiry form.
 */
const STUDIO = {
  termsTitle: 'How long it takes, and what it runs.',
  costTitle: 'What It Costs to Run',
  asides: [{ to: '/process', label: 'How a Build Runs' }],
  cta: {
    heading: 'Tell us what',
    accentText: 'you need.',
    description:
      'Say what the business does and what the site has to do. We read every message and answer it ourselves, usually within the hour, and you get the plan and the price before any work starts.',
    secondary: { label: 'Ask a Question', to: '/contact' },
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
      'Tell us what the work is and what it has to do when it is done. We read it and answer it ourselves, usually within the hour, and you get the scope and the price in writing before anything is charged.',
    secondary: null,
  },
}

const DOC = IS_SECOND_SITE ? SECOND_SITE : STUDIO

const CTA_SECONDARY = DOC.cta.secondary && serves(DOC.cta.secondary.to) ? DOC.cta.secondary : null

const COVERS_HEADING = {
  eyebrow: 'What It Covers',
  title: 'What you get.',
  lede: 'Everything below is part of the work. Nothing here is an upgrade.',
}

// The page alternates its grounds down its length, so a section is never the
// same colour as the one above it whatever the page holds between what the
// work covers and what it costs.
const GROUND = ['paper', 'band']
const groundAt = index => GROUND[index % GROUND.length]

/**
 * One service's own page. The services share a shape - what the work covers,
 * what it is for, how long it takes, what it runs - so they share a view and
 * differ only in the content `@data/serviceDetail` holds against their slug.
 *
 * A slug no service carries reaches the 404 page, and so does a slug whose page
 * is bespoke: those are routed to their own views ahead of this one, so this
 * only sees them from a hand-typed address on a site that never built them.
 * Only the services this site sells are prerendered.
 */
export default function ServiceDetail() {
  const { service } = useParams()
  const page = servicePage(service)

  if (!page?.covers) return <NotFound />

  const terms = [
    { title: 'How Long It Takes', body: page.timeline },
    { title: DOC.costTitle, body: page.running },
  ]

  const coversHeading = page.coversHeading ?? COVERS_HEADING
  const cta = { ...DOC.cta, ...page.cta }
  const sections = page.sections ?? []
  const termsGround = groundAt(sections.length + 1)

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
      <PageHero eyebrow={page.eyebrow} title={page.title ?? page.name} description={page.lede} />

      <ServiceSection
        id="covers"
        ground={groundAt(0)}
        eyebrow={coversHeading.eyebrow}
        title={coversHeading.title}
        lede={coversHeading.lede}
      >
        <FactMesh items={page.covers} ground={groundAt(0)} columns={{ base: 1, sm: 2, lg: 3 }} />
      </ServiceSection>

      {sections.map((section, index) => {
        const ground = groundAt(index + 1)
        return (
          <ServiceSection
            key={section.id}
            id={section.id}
            ground={ground}
            eyebrow={section.eyebrow}
            title={section.title}
            lede={section.lede}
          >
            <FactMesh items={section.items} ground={ground} columns={section.columns} />
          </ServiceSection>
        )
      })}

      <ServiceSection
        id="terms"
        ground={termsGround}
        eyebrow="Time and Cost"
        title={DOC.termsTitle}
      >
        <FactMesh items={terms} ground={termsGround} columns={{ base: 1, sm: 2 }} />
        {asides.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {asides.map(aside => (
              <SectionLink key={aside.to} to={aside.to} label={aside.label} ground={termsGround} />
            ))}
          </div>
        )}
      </ServiceSection>

      <MoreServices pages={otherServices(page.slug)} />

      <CtaBanner
        eyebrow="Let’s Talk"
        heading={cta.heading}
        accentText={cta.accentText}
        description={cta.description}
        primaryLabel={START_LINK.label}
        primaryTo={START_LINK.to}
        secondaryLabel={CTA_SECONDARY?.label}
        secondaryTo={CTA_SECONDARY?.to}
      />
    </div>
  )
}
