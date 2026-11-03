import {
  CallToAction,
  Grid,
  LinkCard,
  PageIntro,
  Section,
  SectionHead,
  WorkCard,
} from '@components/kit/Kit'
import Seo from '@components/Seo'
import { detailOf, studyHref } from '@views/portfolio/work'
import { AREAS } from '@data/towns-and-trades/areas'
import { LOCAL_PORTFOLIO } from '@data/portfolio'
import { TRADES } from '@data/towns-and-trades/trades'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

const DESCRIPTION =
  'Towns around Baytown and Houston where I build and look after small business websites, with a page for each one showing the work already live there.'

// How many trades a town names before its card on the index stops reading as a
// summary. The rest are on the town's own page.
const TRADES_ON_CARD = 3

/**
 * The towns index, in the list layout: the point and the stretch of Southeast
 * Texas the work runs across, every town as a card naming the trades it most
 * often calls for, the client sites live in those towns, and the ask.
 */
export default function Areas() {
  const towns = AREAS.map(area => ({
    ...area,
    trades: area.trades
      .map(id => TRADES.find(trade => trade.id === id))
      .filter(Boolean)
      .slice(0, TRADES_ON_CARD),
  }))

  return (
    <>
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

      <PageIntro
        title="The towns I build websites in."
        lead="Work runs from Baytown outward, up SH 146 into Liberty County, along the ship channel, out to Lake Houston, and down the bay to Galveston."
      />

      <Section id="areas-towns" label="Towns" className="!pt-4">
        <SectionHead title="Towns" />
        <Grid cols={3}>
          {towns.map(town => (
            <LinkCard
              key={town.slug}
              to={`/areas/${town.slug}`}
              title={town.name}
              body={town.trades.map(trade => trade.name).join(' · ')}
            />
          ))}
        </Grid>
      </Section>

      <Section id="areas-work" label="Live work">
        <SectionHead
          title="Sites running in these towns"
          link={{ to: '/portfolio', label: 'See All Work' }}
        />
        <Grid cols={3}>
          {LOCAL_PORTFOLIO.map(project => (
            <WorkCard
              key={project.slug}
              project={project}
              to={studyHref(project)}
              detail={detailOf(project)}
            />
          ))}
        </Grid>
      </Section>

      <CallToAction title="Working in one of these towns?" />
    </>
  )
}
