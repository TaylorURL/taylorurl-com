import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import PageHero from '@components/page-bands/PageHero'
import CtaSection from '@components/conversion/CtaSection'
import RuledSection from '@components/page-bands/RuledSection'
import ProseRail from '@components/page-bands/ProseRail'
import Mesh from '@components/mesh/Mesh'
import TradeMesh from '@components/mesh/TradeMesh'
import WorkMesh from '@components/mesh/WorkMesh'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import { areaBySlug, townSlug, workInTown } from '@data/towns-and-trades/areas'
import { LOCAL_PORTFOLIO } from '@data/portfolio'
import { TRADES } from '@data/towns-and-trades/trades'
import { SERVICE_LINES } from '@data/pages/services'
import { GROUNDS } from '@constants/grounds'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

// How many client sites the work block holds before it stops reading as proof
// and starts reading as a directory.
const WORK_LIMIT = 3

// The four ways the work starts sit two to a row from the first breakpoint
// with room for the pair, and four divides that exactly.
const PAIR_COLUMNS = { base: 1, sm: 2 }

// The bands alternate grounds down the page, so a town carrying a local band
// takes a different arrangement from a town without one and the closing panel
// follows whichever ground the last band left.
const groundAt = index => (index % 2 === 0 ? 'paper' : 'band')

/**
 * One town's page: the client work live there, what the work around it looks
 * like, the trades it most often calls for, and what a site includes.
 *
 * A town whose profile names a client leads with that work; a town without one
 * shows the nearest work under the heading every such town shares, because a
 * line of its own per town for the same absent fact is one sentence copied five
 * ways. A slug no town answers to renders the not-found state rather than a
 * page about nowhere.
 */
export default function Area() {
  const { slug } = useParams()
  const area = areaBySlug(slug)

  if (!area) return <NotFound />

  const profile = area.profile
  const local = workInTown(area.name)
  const work = (local.length ? local : LOCAL_PORTFOLIO).slice(0, WORK_LIMIT)
  const trades = area.trades.map(id => TRADES.find(trade => trade.id === id)).filter(Boolean)
  const counties = profile?.local.counties || []
  // Twelve of the thirteen rails name at least one town with a page of its own,
  // so the names resolve to links here rather than in the band, which has no
  // business reading the town list.
  const nearby = (profile?.local.nearby || []).map(name => {
    const town = areaBySlug(townSlug(name))
    return town && town.name !== area.name ? { name, to: `/areas/${town.slug}` } : { name }
  })
  const description =
    profile?.search ||
    `Custom websites for small businesses in ${area.name}, Texas. Design, build, hosting, and getting found on Google, from a small team in Baytown.`

  const bands = profile ? ['work', 'local', 'trades', 'services'] : ['work', 'trades', 'services']
  const groundFor = band => groundAt(bands.indexOf(band))
  const localGround = groundFor('local')
  const tradesGround = groundFor('trades')
  const servicesGround = groundFor('services')
  const servicesTone = GROUNDS[servicesGround]

  return (
    <div>
      <Seo
        title={`Web Design in ${area.name}, TX`}
        description={description}
        path={`/areas/${area.slug}`}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Service Areas', path: '/areas' },
            { name: area.name, path: `/areas/${area.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: 'Web design',
            name: `Website design in ${area.name}, Texas`,
            description,
            url: `${SITE_URL}/areas/${area.slug}`,
            provider: { '@id': BUSINESS_ID },
            areaServed: [
              {
                '@type': 'City',
                name: area.name,
                containedInPlace: counties.length
                  ? counties.map(county => ({
                      '@type': 'AdministrativeArea',
                      name: `${county} County`,
                      containedInPlace: { '@type': 'State', name: 'Texas' },
                    }))
                  : { '@type': 'State', name: 'Texas' },
              },
              ...nearby.map(place => ({ '@type': 'Place', name: place.name })),
            ],
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: `Website services in ${area.name}`,
              itemListElement: SERVICE_LINES.map(line => ({
                '@type': 'Offer',
                itemOffered: { '@type': 'Service', name: line.name, description: line.summary },
              })),
            },
          },
        ]}
      />

      <PageHero
        eyebrow={`Service Area · ${area.name}`}
        title={`Websites for ${area.name} businesses.`}
        description={
          profile?.lede ||
          `Custom sites for the shops, trades, restaurants, and independent pros working in ${area.name}, built and looked after by a small team.`
        }
      />

      <RuledSection
        id="area-work"
        ground={groundFor('work')}
        eyebrow="Live Work"
        title={
          profile?.work?.title ||
          (local.length
            ? `Work already live in ${area.name}.`
            : `Work already live near ${area.name}.`)
        }
        description={
          profile?.work?.description ||
          (local.length
            ? 'Client sites running now, each one built, hosted, and looked after from Baytown.'
            : `Client sites running now in the towns around ${area.name}, each one built, hosted, and looked after from Baytown.`)
        }
        meta={local.length ? `${area.name}, Texas` : `Near ${area.name}, Texas`}
      >
        <WorkMesh projects={work} ground={groundFor('work')} />
      </RuledSection>

      {profile && (
        <RuledSection
          id="area-local"
          ground={localGround}
          eyebrow="The Work Here"
          title={profile.local.title}
          meta={`${counties.join(' and ')} ${counties.length > 1 ? 'Counties' : 'County'}`}
        >
          <ProseRail body={profile.local.body} nearby={nearby} ground={localGround} />
        </RuledSection>
      )}

      <RuledSection
        id="area-trades"
        ground={tradesGround}
        eyebrow="Trades"
        title={`Common work around ${area.name}.`}
        description="Each trade has a page of its own covering what the site has to do and the software it runs beside."
        meta={`${trades.length} trades`}
      >
        <TradeMesh trades={trades} ground={tradesGround} />
      </RuledSection>

      <RuledSection
        id="area-services"
        ground={servicesGround}
        eyebrow="What Gets Built"
        title="Four ways the work starts."
        description="A new site, a rebuild of the one you have, the tools that sit behind it, or looking after what is already running."
        meta="Baytown, Texas"
      >
        <Mesh items={SERVICE_LINES} ground={servicesGround} columns={PAIR_COLUMNS}>
          {(line, index, cell) => (
            <Link
              key={line.slug}
              to={`/services#${line.slug}`}
              className={`group flex h-full flex-col gap-4 p-6 transition duration-200 ease-out-soft focus-visible:-outline-offset-2 ${cell} ${servicesTone.surface} ${servicesTone.wash}`}
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className="section-label-sm text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <ArrowUpRight
                  className={`h-4 w-4 ${servicesTone.meta} transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5`}
                  aria-hidden="true"
                />
              </span>
              <span className={`text-[19px] font-semibold leading-tight ${servicesTone.title}`}>
                {line.name}
              </span>
              <span className={`text-[14px] leading-relaxed ${servicesTone.body}`}>
                {line.summary}
              </span>
            </Link>
          )}
        </Mesh>
      </RuledSection>

      <CtaSection
        ground={servicesGround === 'paper' ? 'dark' : 'paper'}
        eyebrow="Start"
        title={
          <>
            Start a site for <span className="text-accent">{area.name}</span>.
          </>
        }
        description={
          profile?.close ||
          `Tell us what your ${area.name} business needs and you get a plan and a price back. Most sites are live in two to four weeks.`
        }
      />
    </div>
  )
}
