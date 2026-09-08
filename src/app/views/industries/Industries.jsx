import { Link } from 'react-router-dom'
import PageHero from '@components/page-bands/PageHero'
import CtaSection from '@components/conversion/CtaSection'
import RuledSection from '@components/page-bands/RuledSection'
import TradeMesh from '@components/mesh/TradeMesh'
import Seo from '@components/Seo'
import { TRADES } from '@data/towns-and-trades/trades'
import { groupsWith, INDUSTRY_SLUGS } from '@data/towns-and-trades/industries'
import { AREAS } from '@data/towns-and-trades/areas'
import { draftAt, RINGS } from '@constants/drafting'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

const DESCRIPTION =
  'Website work by trade around Baytown and Houston. What each kind of site has to do, the software it runs beside, and the local work already live.'

// The grounds alternate band to band, so the ground the towns sit on is
// whichever one the last group did not take.
const groundAt = index => (index % 2 === 0 ? 'paper' : 'band')

export default function Industries() {
  const groups = groupsWith(TRADES)
  const listed = groups.flatMap(group => group.trades)
  const townGround = groundAt(groups.length)

  return (
    <div>
      <Seo
        title="Websites by Industry in Baytown, TX"
        description={DESCRIPTION}
        path="/industries"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Industries', path: '/industries' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Websites by industry',
            url: `${SITE_URL}/industries`,
            description: DESCRIPTION,
            about: { '@id': BUSINESS_ID },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: listed.map((trade, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: `${trade.name} websites`,
                url: `${SITE_URL}/industries/${trade.id}`,
              })),
            },
          },
        ]}
      />

      <PageHero
        draft="column"
        eyebrow="Industries"
        title="Websites built around your trade."
        description={`${INDUSTRY_SLUGS.length} trades, each with a page of its own: what the site has to do, the software it runs beside, and the work already live nearby.`}
      />

      {groups.map((group, index) => (
        <RuledSection
          key={group.id}
          id={group.id}
          ground={groundAt(index)}
          draft={draftAt(index, RINGS.survey)}
          eyebrow={group.name}
          title={`${group.name}.`}
          description={group.summary}
          meta={`${group.trades.length} trades`}
        >
          <TradeMesh trades={group.trades} ground={groundAt(index)} withSummary />
        </RuledSection>
      ))}

      <RuledSection
        id="industries-towns"
        ground={townGround}
        draft="node"
        eyebrow="Where"
        title="Towns these sites get built for."
        description="Every town has a page of its own carrying the work already live there and the trades it most often calls for."
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
            Tell us about <span className="text-accent">your shop</span>.
          </>
        }
        description="Pick the trade, check the software you already run, and get a plan and a price back. Most sites are live in two to four weeks."
      />
    </div>
  )
}
