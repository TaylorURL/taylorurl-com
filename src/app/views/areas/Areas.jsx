import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import PageHero from '@components/page-bands/PageHero'
import CtaSection from '@components/conversion/CtaSection'
import RuledSection from '@components/page-bands/RuledSection'
import Mesh from '@components/mesh/Mesh'
import WorkMesh from '@components/mesh/WorkMesh'
import Seo from '@components/Seo'
import { AREAS, workInTown } from '@data/towns-and-trades/areas'
import { LOCAL_PORTFOLIO } from '@data/portfolio'
import { TRADES } from '@data/towns-and-trades/trades'
import { GROUNDS } from '@constants/grounds'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

const DESCRIPTION =
  'Towns around Baytown and Houston where we build and look after small business websites, with a page for each one showing the work already live there.'

// How many trades a town names before its cell on the index stops reading as a
// summary. The rest are on the town's own page.
const TRADES_ON_CARD = 3

const TONE = GROUNDS.paper

// The towns run three across on a desktop, which is the density a cell naming
// a place and the trades it calls for reads at. No column count near that
// divides the list, so the last town takes the row it ends on.
const TOWN_COLUMNS = { base: 1, sm: 2, lg: 3 }

// The town cell is the trade cell with a place in it, so it is spelled the way
// TradeMesh spells one: the ring is the base one and only its side is stated,
// because the mesh sits in a clipping shell that would cut a ring standing off
// an edge cell in half.
const CELL =
  'flex h-full w-full flex-col justify-between gap-8 p-5 transition duration-200 ease-out-soft focus-visible:-outline-offset-2'

export default function Areas() {
  const towns = AREAS.map(area => ({
    ...area,
    work: workInTown(area.name),
    trades: area.trades
      .map(id => TRADES.find(trade => trade.id === id))
      .filter(Boolean)
      .slice(0, TRADES_ON_CARD),
  }))

  return (
    <div>
      <Seo
        title="Service Areas: Baytown and Houston, TX"
        description={DESCRIPTION}
        path="/areas"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Service Areas', path: '/areas' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Service areas',
            url: `${SITE_URL}/areas`,
            description: DESCRIPTION,
            about: { '@id': BUSINESS_ID },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: AREAS.map((area, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: `Web design in ${area.name}, Texas`,
                url: `${SITE_URL}/areas/${area.slug}`,
              })),
            },
          },
        ]}
      />

      <PageHero
        eyebrow="Service Areas"
        title="Where these sites get built."
        description={`${AREAS.length} towns across Southeast Texas, each with a page carrying the work already live there and the trades it most often calls for.`}
      />

      <RuledSection
        id="areas-towns"
        ground="paper"
        eyebrow="Towns"
        title="Towns on the list."
        description="Work runs from Baytown outward, up SH 146 into Liberty County, along the ship channel, out to Lake Houston, and down the bay to Galveston."
        meta={`${AREAS.length} towns`}
      >
        <Mesh items={towns} ground="paper" columns={TOWN_COLUMNS}>
          {(town, index, cell) => (
            <Link
              key={town.slug}
              to={`/areas/${town.slug}`}
              className={`${CELL} ${cell} ${TONE.surface} ${TONE.title} ${TONE.wash}`}
            >
              <span className="flex items-center justify-between">
                <MapPin className="h-5 w-5 text-accent" strokeWidth={1.5} aria-hidden="true" />
                <span aria-hidden="true" className={`section-label-sm ${TONE.meta}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
              </span>
              <span className="flex flex-col gap-2">
                <span className="text-[13px] font-medium leading-snug">{town.name}</span>
                {town.work.length > 0 && (
                  <span className="section-label-sm leading-snug text-accent">
                    {town.work.map(project => project.name).join(' · ')}
                  </span>
                )}
                <span className={`text-[12px] leading-snug ${TONE.body}`}>
                  {town.trades.map(trade => trade.name).join(' · ')}
                </span>
              </span>
            </Link>
          )}
        </Mesh>
      </RuledSection>

      <RuledSection
        id="areas-work"
        ground="band"
        eyebrow="Live Work"
        title="Sites running in these towns."
        description="Every one is live now, built for a business working the same stretch of Southeast Texas."
        meta={`${LOCAL_PORTFOLIO.length} sites`}
      >
        <WorkMesh projects={LOCAL_PORTFOLIO} ground="band" />
      </RuledSection>

      <CtaSection
        ground="paper"
        eyebrow="Start"
        title={
          <>
            Working in <span className="text-accent">one of these towns</span>?
          </>
        }
        description="Tell us what the business needs and you get a plan and a price back. Most sites are live in two to four weeks."
      />
    </div>
  )
}
