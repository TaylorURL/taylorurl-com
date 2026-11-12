import { useParams } from 'react-router-dom'
import {
  CallToAction,
  CheckList,
  FactList,
  Grid,
  LinkCard,
  PageIntro,
  Questions,
  Section,
  SectionHead,
  WorkCard,
} from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import ClientExample from '@views/portfolio/ClientExample'
import {
  LAUNCH_FACTS,
  asHeading,
  detailOf,
  joinNames,
  sentenceCase,
  studyHref,
} from '@views/portfolio/work'
import { TOOL_NOTE, toolsForTrade, tradeById } from '@data/towns-and-trades/trades'
import { INDUSTRY_SLUGS } from '@data/towns-and-trades/industries'
import { industryCopyFor } from '@data/towns-and-trades/industryDetail'
import { AREAS } from '@data/towns-and-trades/areas'
import { LOCAL_PORTFOLIO, portfolioProofFor } from '@data/portfolio'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

// How many client sites the work block holds before it stops reading as proof
// and starts reading as a directory.
const WORK_LIMIT = 3

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

/** A trade's name inside a sentence: "barber shop", but "HVAC" as it is. */
function inSentence(name) {
  return name === name.toUpperCase() ? name : name.toLowerCase()
}

/** "a barber shop", "an HVAC", "an auto repair". */
function withArticle(word) {
  return `${/^(?:[aeiou]|HVAC)/i.test(word) ? 'an' : 'a'} ${word}`
}

/**
 * The towns a trade is most often called for in, as each town's own page names
 * them. A trade no town names, roofing for one, is built for in all of them.
 */
function townsFor(trade) {
  const named = AREAS.filter(area => area.trades.includes(trade.id))
  return named.length ? named : AREAS
}

/**
 * One trade's page, in the landing layout: what the site has to do for this
 * trade and the software it works beside, beside the two facts every page
 * opens on; then what it has to get right and what gets built, the client
 * site that stands as proof, the longer copy as questions, and the towns.
 *
 * The trade, its tools, and its portfolio proof are read from the shared data,
 * and everything written for this trade alone comes from
 * `@data/towns-and-trades/industryDetail` against the same slug. A slug no
 * group names renders the not-found state rather than a half-built page.
 */
export default function Industry() {
  const { slug } = useParams()
  const index = INDUSTRY_SLUGS.indexOf(slug)
  const trade = index >= 0 ? tradeById(slug) : null
  const copy = trade ? industryCopyFor(trade.id) : null

  if (!trade || !copy) return <NotFound />

  const tools = toolsForTrade(trade)
  const ownTools = tools.filter(tool => trade.tools.includes(tool.id))
  const named = inSentence(trade.name)
  const leading = named.charAt(0).toUpperCase() + named.slice(1)

  const matches = portfolioProofFor(trade.id)
  const towns = townsFor(trade)

  const facts = [
    {
      label: 'Works alongside',
      value: joinNames((ownTools.length ? ownTools : tools).map(tool => tool.name)),
    },
    ...LAUNCH_FACTS,
  ]

  const questions = [
    {
      q: `What does ${withArticle(named)} site have to get right?`,
      a: (
        <>
          <p>{copy.needsDescription}</p>
          <p>{copy.buildDescription}</p>
        </>
      ),
    },
    {
      q: 'Does it work with the software I already use?',
      a: (
        <>
          <p>{copy.toolsDescription}</p>
          <p>{TOOL_NOTE}</p>
        </>
      ),
    },
    { q: `Why does the town matter for ${withArticle(named)} site?`, a: copy.townsDescription },
    { q: 'What do you need from me to start?', a: copy.ctaDescription },
  ]

  return (
    <>
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

      <PageIntro
        title={copy.heroTitle}
        lead={copy.heroDescription}
        media={<FactList items={facts} />}
      />

      <Section label="What the site does" className="!pt-6">
        <SectionHead title={asHeading(copy.needsTitle)} />
        <div className="grid gap-5 md:grid-cols-2">
          <div className={`${CARD} p-6 sm:p-8`}>
            <h3 className={`${TYPE.h3} mb-6`}>What the site has to do</h3>
            <CheckList items={trade.needs} />
          </div>
          <div className={`${CARD} p-6 sm:p-8`}>
            <h3 className={`${TYPE.h3} mb-6`}>{asHeading(copy.buildTitle)}</h3>
            <CheckList
              items={copy.build.map(item => ({ ...item, title: sentenceCase(item.title) }))}
            />
          </div>
        </div>
      </Section>

      {matches.length > 0 ? (
        <ClientExample
          label="Live work"
          project={matches[0]}
          title={asHeading(copy.workTitle)}
          body={copy.workDescription}
          more={matches.slice(1, WORK_LIMIT)}
        />
      ) : (
        <Section label="Live work">
          <SectionHead title={asHeading(copy.workTitle)} />
          <Grid cols={3}>
            {localProofAt(index).map(project => (
              <WorkCard
                key={project.slug}
                project={project}
                to={studyHref(project)}
                detail={detailOf(project)}
              />
            ))}
          </Grid>
        </Section>
      )}

      <Section label="Questions">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
          <h2 className={TYPE.h2}>Questions</h2>
          <Questions items={questions} />
        </div>
      </Section>

      <Section label="Towns">
        <SectionHead title={`${leading} sites, town by town`} />
        <Grid cols={4} className="grid-cols-2">
          {towns.map(area => (
            <LinkCard key={area.slug} to={`/areas/${area.slug}`} title={area.name} />
          ))}
        </Grid>
      </Section>

      <CallToAction title={`Start your ${named} site.`} />
    </>
  )
}
