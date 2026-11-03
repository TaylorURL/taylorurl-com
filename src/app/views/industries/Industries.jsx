import { CallToAction, Grid, LinkCard, PageIntro, Section, SectionHead } from '@components/kit/Kit'
import Seo from '@components/Seo'
import { TRADES } from '@data/towns-and-trades/trades'
import { groupsWith } from '@data/towns-and-trades/industries'
import { AREAS } from '@data/towns-and-trades/areas'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

const DESCRIPTION =
  'Website work by trade around Baytown and Houston. What each kind of site has to do, the software it runs beside, and the local work already live.'

/**
 * The trades index, in the list layout: the point, then each group of trades
 * under its own heading as a grid of cards, each card naming the first thing
 * that trade's site has to do; then the towns; then the ask.
 */
export default function Industries() {
  const groups = groupsWith(TRADES)
  const listed = groups.flatMap(group => group.trades)

  return (
    <>
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

      <PageIntro
        title="Websites built around your trade."
        lead="Each trade has a page: what the site has to do, the software it runs beside, and the work already live nearby."
      />

      {groups.map((group, index) => (
        <Section
          key={group.id}
          id={group.id}
          label={group.name}
          tight
          className={index === 0 ? '!pt-4' : ''}
        >
          <SectionHead title={group.name} />
          <Grid cols={3}>
            {group.trades.map(trade => (
              <LinkCard
                key={trade.id}
                to={`/industries/${trade.id}`}
                title={trade.name}
                body={trade.needs[0]}
              />
            ))}
          </Grid>
        </Section>
      ))}

      <Section id="industries-towns" label="Towns" tight>
        <SectionHead title="Towns these sites get built for" />
        <Grid cols={4} className="grid-cols-2">
          {AREAS.map(area => (
            <LinkCard key={area.slug} to={`/areas/${area.slug}`} title={area.name} />
          ))}
        </Grid>
      </Section>

      <CallToAction title="Tell me about your shop." />
    </>
  )
}
