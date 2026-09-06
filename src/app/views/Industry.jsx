import { Link, useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import PageHero from '@components/PageHero'
import CtaSection from '@components/CtaSection'
import RuledSection from '@components/RuledSection'
import Mesh from '@components/Mesh'
import ToolMesh from '@components/ToolMesh'
import TradeMesh from '@components/TradeMesh'
import WorkMesh from '@components/WorkMesh'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import FactMesh from './services/FactMesh'
import { toolsForTrade, tradeById } from '@data/trades'
import { groupForIndustry, INDUSTRY_SLUGS } from '@data/industries'
import { industryCopyFor } from '@data/industryDetail'
import { AREAS } from '@data/areas'
import { LOCAL_PORTFOLIO, portfolioProofFor } from '@data/portfolio'
import { draftAt, RINGS } from '@constants/drafting'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

// How many client sites the work block holds before it stops reading as proof
// and starts reading as a directory.
const WORK_LIMIT = 3

// The jobs a visitor turns up to get done sit two to a row from the first
// breakpoint with room for the pair, and every trade names four of them.
const NEEDS_COLUMNS = { base: 1, sm: 2 }

// The bands alternate down the page, so a trade with siblings to show takes a
// different arrangement from one without and the closing panel follows
// whichever ground the last band left.
const groundAt = index => (index % 2 === 0 ? 'paper' : 'band')

/**
 * The local work a trade with no client of its own shows instead.
 *
 * Taking the first three every time would print one identical block across most
 * of the register, so the window opens at the trade's own place in that
 * register and wraps around the end.
 *
 * @param {number} index Where the trade sits in `INDUSTRY_SLUGS`.
 * @returns {Array<object>} Portfolio entries, in the order they are drawn.
 */
function localProofAt(index) {
  const total = LOCAL_PORTFOLIO.length
  if (total <= WORK_LIMIT) return LOCAL_PORTFOLIO
  const start = ((index % total) + total) % total
  return Array.from({ length: WORK_LIMIT }, (_, step) => LOCAL_PORTFOLIO[(start + step) % total])
}

/**
 * One trade's page: the problem its own site has to solve, the jobs a visitor
 * turns up to do, what gets built for it, the software it runs beside, the
 * client work that stands as proof, and the towns it gets built for.
 *
 * The trade, its tools, and its portfolio proof are read from the shared data,
 * and everything written for this trade alone comes from `@data/industryDetail`
 * against the same slug. A slug no group names renders the not-found state
 * rather than a half-built page.
 */
export default function Industry() {
  const { slug } = useParams()
  const index = INDUSTRY_SLUGS.indexOf(slug)
  const trade = index >= 0 ? tradeById(slug) : null
  const copy = trade ? industryCopyFor(trade.id) : null

  if (!trade || !copy) return <NotFound />

  const tools = toolsForTrade(trade)
  const group = groupForIndustry(trade.id)
  const siblings = (group?.trades || [])
    .filter(id => id !== trade.id)
    .map(tradeById)
    .filter(Boolean)

  const matches = portfolioProofFor(trade.id)
  const work = matches.length ? matches.slice(0, WORK_LIMIT) : localProofAt(index)
  const workScope = matches.length ? trade.name : 'Southeast Texas'

  const bandCount = siblings.length ? 5 : 4
  const townGround = groundAt(bandCount)

  return (
    <div>
      <Seo
        title={`${trade.name} Websites in Baytown, TX`}
        description={copy.metaDescription}
        path={`/industries/${trade.id}`}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Industries', path: '/industries' },
            { name: trade.name, path: `/industries/${trade.id}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: `${trade.name} website design`,
            name: `${trade.name} websites`,
            description: copy.metaDescription,
            url: `${SITE_URL}/industries/${trade.id}`,
            provider: { '@id': BUSINESS_ID },
            audience: { '@type': 'BusinessAudience', name: trade.name },
            areaServed: AREAS.map(area => ({
              '@type': 'City',
              name: area.name,
              containedInPlace: { '@type': 'State', name: 'Texas' },
            })),
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: `${trade.name} website work`,
              itemListElement: [...trade.needs, ...copy.build.map(item => item.title)].map(
                need => ({
                  '@type': 'Offer',
                  itemOffered: { '@type': 'Service', name: need },
                })
              ),
            },
          },
        ]}
      />

      <PageHero
        draft="column"
        eyebrow={`Industry · ${trade.name}`}
        title={copy.heroTitle}
        description={copy.heroDescription}
      />

      <RuledSection
        id="industry-needs"
        ground={groundAt(0)}
        draft={draftAt(0, RINGS.build)}
        eyebrow="What the Site Does"
        title={copy.needsTitle}
        description={copy.needsDescription}
        meta={trade.name}
      >
        <Mesh items={trade.needs} ground="paper" columns={NEEDS_COLUMNS} as="ul">
          {(need, needIndex, cell) => (
            <li
              key={need}
              className={`flex items-start gap-4 p-6 text-[15px] leading-snug text-ink-paper ${cell}`}
            >
              <Check
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                strokeWidth={2}
                aria-hidden="true"
              />
              {need}
            </li>
          )}
        </Mesh>
      </RuledSection>

      <RuledSection
        id="industry-build"
        ground={groundAt(1)}
        draft={draftAt(1, RINGS.build)}
        eyebrow="What Gets Built"
        title={copy.buildTitle}
        description={copy.buildDescription}
        meta={`${copy.build.length} pieces`}
      >
        <FactMesh items={copy.build} ground="band" />
      </RuledSection>

      <RuledSection
        id="industry-tools"
        ground={groundAt(2)}
        draft={draftAt(2, RINGS.build)}
        eyebrow="Works Alongside"
        title={copy.toolsTitle}
        description={copy.toolsDescription}
        meta={`${tools.length} tools`}
      >
        <ToolMesh tools={tools} ground="paper" />
      </RuledSection>

      <RuledSection
        id="industry-work"
        ground={groundAt(3)}
        draft={draftAt(3, RINGS.build)}
        eyebrow="Live Work"
        title={copy.workTitle}
        description={copy.workDescription}
        meta={workScope}
      >
        <WorkMesh projects={work} ground="band" />
      </RuledSection>

      {siblings.length > 0 && (
        <RuledSection
          id="industry-related"
          ground={groundAt(4)}
          draft={draftAt(4, RINGS.build)}
          eyebrow="Nearby Trades"
          title={`More under ${group.name.toLowerCase()}.`}
          description="Trades whose sites are judged on much the same things, each with a page of its own."
          meta={`${siblings.length} trades`}
        >
          <TradeMesh trades={siblings} ground="paper" />
        </RuledSection>
      )}

      <RuledSection
        id="industry-towns"
        ground={townGround}
        draft="node"
        eyebrow="Where"
        title={`${trade.name} sites, town by town.`}
        description={copy.townsDescription}
        meta={`${AREAS.length} towns`}
      >
        <ul className="flex flex-wrap gap-x-3 gap-y-2">
          {AREAS.map(area => (
            <li key={area.slug}>
              <Link to={`/areas/${area.slug}`} className="chip">
                {area.name}
              </Link>
            </li>
          ))}
        </ul>
      </RuledSection>

      <CtaSection
        draft="plan"
        ground={townGround === 'paper' ? 'dark' : 'paper'}
        eyebrow="Start"
        title={
          <>
            Start your <span className="text-accent">{trade.name}</span> site.
          </>
        }
        description={copy.ctaDescription}
      />
    </div>
  )
}
