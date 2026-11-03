import { CallToAction, Grid, PageIntro, Section, WorkCard } from '@components/kit/Kit'
import Seo from '@components/Seo'
import { PORTFOLIO_PROJECTS, formatMeasuredDate } from '@data/portfolio'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { detailOf, studyHref } from './work'

/**
 * What a card says under the site's name: what and where, then what Google
 * scored it and when.
 *
 * The page promises a measured figure against every entry, in the description
 * search engines quote, so the score sits on the card itself rather than only
 * on the case study behind it. Both numbers, the run count and the date come
 * off the committed entry, so a card cannot quote a score the study behind it
 * disagrees with, and the date reaches a reader only through the formatter.
 */
function Detail({ project }) {
  return (
    <>
      {detailOf(project)}
      <span className="mt-3 block text-ink-soft">
        PageSpeed {project.pagespeed.mobile} mobile · {project.pagespeed.desktop} desktop
      </span>
      <span className="block">
        Median of {project.pagespeed.runs} runs, {formatMeasuredDate(project.pagespeed.measured)}
      </span>
    </>
  )
}

/**
 * The portfolio, in the list layout: the point, every site as a card that
 * opens its case study, and the ask.
 */
export default function Portfolio() {
  return (
    <>
      <Seo
        title="Recent Client Websites in Baytown, TX"
        description="Websites built for small businesses around Baytown and Houston. Every entry links to the live site and shows its measured Google PageSpeed score."
        path="/portfolio"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Portfolio', path: '/portfolio' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'TaylorURL portfolio',
            url: `${SITE_URL}/portfolio`,
            hasPart: PORTFOLIO_PROJECTS.map(project => ({
              '@type': 'WebSite',
              name: project.name,
              url: project.url,
              description: project.description,
            })),
          },
        ]}
      />

      <PageIntro
        title="Every site here is live."
        lead="Businesses around Baytown and Houston, each site built from scratch, hosted, and looked after by me."
      />

      <Section label="Work" className="!pt-4">
        <Grid cols={3}>
          {PORTFOLIO_PROJECTS.map((project, index) => (
            <WorkCard
              key={project.slug}
              project={project}
              to={studyHref(project)}
              detail={<Detail project={project} />}
              eager={index < 3}
            />
          ))}
        </Grid>
      </Section>

      <CallToAction title="Want your business in this list?" />
    </>
  )
}
