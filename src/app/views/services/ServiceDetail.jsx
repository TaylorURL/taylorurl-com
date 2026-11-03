import { useParams } from 'react-router-dom'
import Seo from '@components/Seo'
import { TextLink } from '@components/kit/Kit'
import NotFound from '@views/NotFound'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { serves } from '@constants/navigation'
import { relatedServices, servicePage } from '@data/pages/serviceDetail'
import ServiceLanding, { ItemAnswer } from './ServiceLanding'
import { IS_SECOND_SITE, SITE } from '../../../../lib/site/current.js'

/**
 * The page around one service's content, for whichever site is building.
 *
 * The studio's build is a one-off fee and a monthly that keeps the site
 * published, both quoted for the project, so its cost question asks what the
 * thing runs and its timeline sends a reader on to the six steps a build
 * takes. The subsidiary quotes each service on its own page, has no process
 * page to send anyone to, and ends at the enquiry form.
 */
const STUDIO = {
  ask: { timeline: 'How long does it take?', running: 'What does it cost to run?' },
  process: { to: '/process', label: 'How a Build Runs' },
  cta: 'Tell me what you need.',
}

const SECOND_SITE = {
  ask: { timeline: 'How long does it take?', running: 'What does it cost?' },
  process: null,
  cta: 'Start with a call.',
}

const DOC = IS_SECOND_SITE ? SECOND_SITE : STUDIO

// A link written by hand still has to be a page this site serves, so `serves`
// reads the route table rather than leaving the answer to whoever edits it.
const PROCESS = DOC.process && serves(DOC.process.to) ? DOC.process : null

/**
 * The page's questions: how long, what it costs, and any section the content
 * asks as a question rather than shows as cards.
 */
function questionsFor(page) {
  const ask = { ...DOC.ask, ...page.ask }
  const timeline = PROCESS ? (
    <>
      <p>{page.timeline}</p>
      <p>
        <TextLink to={PROCESS.to} label={PROCESS.label} />
      </p>
    </>
  ) : (
    page.timeline
  )
  return [
    { q: ask.timeline, a: timeline },
    { q: ask.running, a: page.running },
    ...(page.sections ?? [])
      .filter(section => section.as === 'question')
      .map(section => ({
        q: section.question,
        a: <ItemAnswer lede={section.lede} items={section.items} />,
      })),
  ]
}

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
      <ServiceLanding
        title={page.title ?? page.name}
        lead={page.lede}
        facts={page.facts}
        covers={page.covers}
        coversTitle={page.coversHeading?.title}
        sections={(page.sections ?? []).filter(section => section.as !== 'question')}
        example={page.example}
        questions={questionsFor(page)}
        related={relatedServices(page.slug, page.related)}
        cta={page.cta ?? DOC.cta}
      />
    </div>
  )
}
