import { Fragment } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CallToAction,
  FactList,
  Grid,
  LinkCard,
  PageIntro,
  Prose,
  Section,
  SectionHead,
} from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import ClientExample from '@views/portfolio/ClientExample'
import { LAUNCH_FACTS, asHeading, joinNames } from '@views/portfolio/work'
import { areaBySlug, townSlug, workInTown, workNear } from '@data/towns-and-trades/areas'
import { TRADES } from '@data/towns-and-trades/trades'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

// How many more sites in the same town run under the one the page leads with,
// before the block stops reading as proof and starts reading as a directory.
// Houston is the town that needs the third: two clients of its own, plus the
// concrete platform and the tire product whose work runs there as well.
const ALSO_LIMIT = 3

/**
 * The places a town's page also answers for, as a sentence, with each one that
 * has a page of its own linked to it.
 */
function Coverage({ places }) {
  return (
    <p>
      This page also covers{' '}
      {places.map((place, index) => (
        <Fragment key={place.name}>
          {index > 0 && (index === places.length - 1 ? ' and ' : ', ')}
          {place.to ? <Link to={place.to}>{place.name}</Link> : place.name}
        </Fragment>
      ))}
      .
    </p>
  )
}

/**
 * One town's page, in the landing layout: the point and the town's facts, the
 * client work live there (or the nearest worth showing), what the work around
 * it looks like, and the trades it most often calls for.
 *
 * A town whose profile names a client leads with that work; a town without one
 * shows one site from the towns around it, under the heading every such town
 * shares, because a line of its own per town for the same absent fact is one
 * sentence copied five ways. A slug no town answers to renders the not-found
 * state rather than a page about nowhere.
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
  // The sites the facts beside the headline say are live here: the ones filed
  // under this town, leaving out work that only reaches it, such as a studio
  // product used in Houston, so the line names businesses that trade here.
  const filedHere = local.filter(
    project => project.town === area.name || project.slug === profile?.client
  )
  // Where that site is. Most entries carry a town; one carries only the
  // "Pasadena, Texas" it prints, so the town is read off that rather than
  // guessed, and a sentence that would have to guess is not written at all.
  // The sentence says where rather than how near: workNear picks on trade and
  // on measured speed, so the site it lands on is not always the closest one.
  const leadTown = lead && (lead.town || lead.location?.split(',')[0])
  const trades = area.trades.map(id => TRADES.find(trade => trade.id === id)).filter(Boolean)
  const counties = profile?.local.counties || []
  // Twelve of the thirteen rails name at least one town with a page of its own,
  // so the names resolve to links here.
  const nearby = (profile?.local.nearby || []).map(name => {
    const town = areaBySlug(townSlug(name))
    return town && town.name !== area.name ? { name, to: `/areas/${town.slug}` } : { name }
  })
  const description =
    profile?.search ||
    `Custom websites for small businesses in ${area.name}, Texas. Design, build, hosting, and getting found on Google, built in Baytown.`

  const facts = [
    counties.length > 0 && {
      label: counties.length > 1 ? 'Counties' : 'County',
      value: joinNames(counties),
    },
    filedHere.length > 0
      ? { label: 'Live here', value: joinNames(filedHere.map(project => project.name)) }
      : lead && { label: 'Example site', value: [lead.name, leadTown].filter(Boolean).join(', ') },
    LAUNCH_FACTS[0],
  ].filter(Boolean)

  const workTitle =
    profile?.work?.title ||
    (local.length ? `Work already live in ${area.name}` : `Work already live near ${area.name}`)
  const workBody =
    profile?.work?.description ||
    (leadTown
      ? `I built the site for ${lead.name} in ${leadTown}, and I still host it and look after it.`
      : lead?.description)

  return (
    <>
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

      <PageIntro
        title={`Websites for ${area.name} businesses.`}
        lead={
          profile?.lede ||
          `Custom sites for the shops, trades, restaurants, and independent pros working in ${area.name}, built and looked after from Baytown.`
        }
        media={<FactList items={facts} />}
      />

      {lead && (
        <ClientExample
          label="Live work"
          project={lead}
          title={asHeading(workTitle)}
          body={workBody}
          more={alsoLocal}
          moreTitle={`More work in ${area.name}`}
        />
      )}

      {profile && (
        <Section label={`The work in ${area.name}`}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
            <h2 className={TYPE.h2}>{asHeading(profile.local.title)}</h2>
            <Prose className="min-w-0 [&>p:first-child]:mt-0">
              {profile.local.body.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {nearby.length > 0 && <Coverage places={nearby} />}
            </Prose>
          </div>
        </Section>
      )}

      <Section label="Trades">
        <SectionHead title={`Common work around ${area.name}`} />
        <Grid cols={3}>
          {trades.map(trade => (
            <LinkCard
              key={trade.id}
              to={`/industries/${trade.id}`}
              title={trade.name}
              body={trade.needs[0]}
            />
          ))}
        </Grid>
      </Section>

      <CallToAction title={`Start a site for ${area.name}.`} />
    </>
  )
}
