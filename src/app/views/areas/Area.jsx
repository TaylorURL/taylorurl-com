import { useParams } from 'react-router-dom'
import PageHero from '@components/page-bands/PageHero'
import CtaSection from '@components/conversion/CtaSection'
import RuledSection from '@components/page-bands/RuledSection'
import ProseRail from '@components/page-bands/ProseRail'
import WorkProof from '@components/areas/WorkProof'
import TradeMesh from '@components/mesh/TradeMesh'
import WorkMesh from '@components/mesh/WorkMesh'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import { areaBySlug, townSlug, workInTown, workNear } from '@data/towns-and-trades/areas'
import { TRADES } from '@data/towns-and-trades/trades'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

// How many more sites in the same town run under the one the page leads with,
// before the block stops reading as proof and starts reading as a directory.
// Houston is the town that needs the third: two clients of its own, plus the
// concrete platform and the tire product whose work runs there as well.
const ALSO_LIMIT = 3

// The bands alternate grounds down the page, so a town carrying a local band
// takes a different arrangement from a town without one and the closing panel
// follows whichever ground the last band left.
const groundAt = index => (index % 2 === 0 ? 'paper' : 'band')

/**
 * One town's page: the client work live there, what the work around it looks
 * like, and the trades it most often calls for.
 *
 * It used to close on the four ways a job starts, which was the same four cells
 * under the same heading on all thirteen pages, so the band a reader reached
 * last was the one that told them least about where they were. The service
 * lines are still a click away in the nav, and the offer catalog that described
 * that band went out with it rather than staying behind as markup for a band no
 * page draws. What they are not is the last thing a page about Dayton has to
 * say.
 *
 * A town whose profile names a client leads with that work; a town without one
 * shows one site from the towns around it, under the heading every such town
 * shares, because a line of its own per town for the same absent fact is one
 * sentence copied five ways. A slug no town answers to renders the not-found state rather than a
 * page about nowhere.
 */
export default function Area() {
  const { slug } = useParams()
  const area = areaBySlug(slug)

  if (!area) return <NotFound />

  const profile = area.profile
  const local = workInTown(area.name)
  // What the page leads with: this town's own work where there is any, and
  // otherwise the one nearest site that is worth showing it. A town with a
  // second client of its own runs that under the first.
  const lead = local[0] || workNear(area)
  const alsoLocal = local.slice(1, 1 + ALSO_LIMIT)
  // Where that site is. Most entries carry a town; one carries only the
  // "Pasadena, Texas" it prints, so the town is read off that rather than
  // guessed, and a sentence that would have to guess is not written at all.
  // The sentence says where rather than how near: workNear picks on trade and
  // on measured speed, so the site it lands on is not always the closest one.
  const leadTown = lead && (lead.town || lead.location?.split(',')[0])
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

  const bands = profile ? ['work', 'local', 'trades'] : ['work', 'trades']
  const groundFor = band => groundAt(bands.indexOf(band))
  const localGround = groundFor('local')
  const tradesGround = groundFor('trades')

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
          (leadTown
            ? `We built this one for a business in ${leadTown}, and we still host it and look after it.`
            : undefined)
        }
        meta={local.length ? `${area.name}, Texas` : `Near ${area.name}, Texas`}
      >
        {lead && (
          <div className="flex flex-col gap-10">
            <WorkProof
              project={lead}
              ground={groundFor('work')}
              showIdentity={!profile?.work?.title}
            />
            {alsoLocal.length > 0 && <WorkMesh projects={alsoLocal} ground={groundFor('work')} />}
          </div>
        )}
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

      <CtaSection
        ground={tradesGround === 'paper' ? 'dark' : 'paper'}
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
