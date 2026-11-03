import { useParams } from 'react-router-dom'
import Seo from '@components/Seo'
import { CallToAction } from '@components/kit/Kit'
import { toolBySlug } from '@data/pages/tools'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import NotFound from '../NotFound'
import GooglePresenceCheck from './GooglePresenceCheck'
import LogoCleaner from './LogoCleaner'
import QrCodeGenerator from './QrCodeGenerator'

// The flow each tool runs, keyed on the slug its route ends in. A tool in the
// registry with nothing here has no page, which is what stops a half-built
// tool from reaching the navigation and the sitemap.
const FLOWS = {
  'google-presence-check': GooglePresenceCheck,
  'logo-background-remover': LogoCleaner,
  'qr-code-generator': QrCodeGenerator,
}

/**
 * A free tool's page.
 *
 * One view answers for every tool, the way `ServiceDetail` answers for every
 * service line. The flow is the page rather than something under a hero: it
 * carries the heading and puts the tool in a card straight under it, so a
 * visitor arrives with the box to type in already on the screen.
 */
export default function ToolPage() {
  const { slug } = useParams()
  const tool = toolBySlug(slug)
  const Flow = tool && FLOWS[tool.slug]
  if (!tool || !Flow) return <NotFound />

  return (
    <div>
      <Seo
        title={tool.title}
        description={tool.description}
        path={tool.path}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Tools', path: '/tools' },
            { name: tool.name, path: tool.path },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            '@id': `${SITE_URL}${tool.path}#tool`,
            name: tool.name,
            url: `${SITE_URL}${tool.path}`,
            description: tool.description,
            applicationCategory: 'BusinessApplication',
            browserRequirements: 'Requires JavaScript.',
            operatingSystem: 'Any',
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
          },
        ]}
      />

      <Flow tool={tool} />

      <CallToAction title="Want this handled for you?" />
    </div>
  )
}
