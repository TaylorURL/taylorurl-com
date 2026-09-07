import { Link } from 'react-router-dom'
import PageHero from '@components/page-bands/PageHero'
import CtaSection from '@components/conversion/CtaSection'
import RuledSection from '@components/page-bands/RuledSection'
import Seo from '@components/Seo'
import { TOOLS_INDEX } from '@data/pages/tools'
import { NAV_GROUPS } from '@constants/navigation'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import ToolCards from './ToolCards'

const DESCRIPTION =
  'Free tools for running a business online: check what Google sees on your site, clear the background off a logo, and make a QR code. No account, no fee.'

// The marks the navigation already keys to each tool, so a card and a menu row
// carry the same drawing without a second list deciding it.
const TOOL_MARKS = Object.fromEntries(
  (NAV_GROUPS.find(group => group.key === 'tools')?.columns[0].items || []).map(item => [
    item.to,
    item.mark,
  ])
)

const TOOLS = TOOLS_INDEX.map(tool => ({ ...tool, mark: TOOL_MARKS[tool.path] }))

export default function Tools() {
  return (
    <div>
      <Seo
        title="Free Tools for Local Businesses"
        description={DESCRIPTION}
        path="/tools"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Tools', path: '/tools' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Free tools',
            url: `${SITE_URL}/tools`,
            description: DESCRIPTION,
            about: { '@id': BUSINESS_ID },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: TOOLS_INDEX.map((tool, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: tool.name,
                url: `${SITE_URL}${tool.path}`,
              })),
            },
          },
        ]}
      />

      <PageHero
        draft="column"
        eyebrow="Free Tools"
        title="Run one, get your answer, leave."
        description="No account, no fee, nothing to install. Each one runs in your browser and finishes on this page."
      />

      <RuledSection
        id="tools-list"
        ground="paper"
        draft="plan"
        eyebrow="The Tools"
        title="Pick the one you came for."
        description="Every field starts on a sensible default, so pressing next the whole way through still gets you a correct result."
        meta={`${TOOLS_INDEX.length} tools`}
      >
        <ToolCards tools={TOOLS} ground="paper" columns={{ base: 1, sm: 2 }} />
      </RuledSection>

      <RuledSection
        id="tools-custom"
        ground="band"
        draft="iso"
        eyebrow="Built to Order"
        title="When the free one is not the one you need."
        description="I build booking, ordering, quoting and the rest around how a business already runs rather than bending the business to fit a tool that came off a shelf."
      >
        <Link to="/services/online-tools" className="btn btn-secondary">
          What a Custom Tool Covers
        </Link>
      </RuledSection>

      <CtaSection
        draft="ledger"
        ground="paper"
        eyebrow="Start"
        title={
          <>
            Tell me about <span className="text-accent">your business</span>.
          </>
        }
        description="Pick the trade, check the software you already run, and get a plan and a price back. Most sites are live in two to four weeks."
      />
    </div>
  )
}
