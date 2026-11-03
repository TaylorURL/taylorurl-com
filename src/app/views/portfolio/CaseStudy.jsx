import { useParams } from 'react-router-dom'
import {
  CallToAction,
  DeviceShowcase,
  FactRow,
  PageIntro,
  Prose,
  Section,
} from '@components/kit/Kit'
import Seo from '@components/Seo'
import ClientTestimonialCard from '@components/reviews/ClientTestimonialCard'
import NotFound from '@views/NotFound'
import { formatMeasuredDate, portfolioPreviewSrc } from '@data/portfolio'
import { portfolioStudyBySlug } from '@data/portfolioStudies'
import { reviewFor } from '@data/reputation/reviews'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { placeOf } from './work'

// The review's heading, at the size the prose headings above it are set at.
const STUDY_HEADING = 'text-[24px] font-medium leading-[1.3] tracking-[-0.02em] text-ink'

/** The study's `{ title, body }` entries as headed paragraphs. */
function Entries({ items }) {
  return items.map(item => (
    <div key={item.title}>
      <h3>{item.title}</h3>
      <p className="!mt-2">{item.body}</p>
    </div>
  ))
}

/**
 * One case study, in the reading layout: the site on a laptop and a phone
 * beside what it is, the facts in one row, then the study itself as short
 * sections of prose, the client's own words where there are any, and the ask.
 *
 * A studio product is labelled one in the facts, so it is never presented as
 * a client engagement.
 */
function Study({ project }) {
  const { study, pagespeed, slug } = project

  const studyUrl = `${SITE_URL}/portfolio/${slug}`
  const measured = formatMeasuredDate(pagespeed.measured)
  const review = reviewFor(project.displayUrl)
  const place = project.kind === 'product' ? null : placeOf(project)

  const facts = [
    { label: project.kind === 'product' ? 'Studio product' : 'Business', value: study.sector },
    place && { label: 'Town', value: place },
    { label: 'Google speed', value: `${pagespeed.mobile} mobile · ${pagespeed.desktop} desktop` },
    { label: 'Live site', value: project.displayUrl, href: project.url },
  ].filter(Boolean)

  return (
    <>
      <Seo
        title={study.title}
        description={study.description}
        path={`/portfolio/${slug}`}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Portfolio', path: '/portfolio' },
            { name: project.name, path: `/portfolio/${slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: `${project.name} website`,
            headline: study.title,
            description: study.description,
            url: studyUrl,
            mainEntityOfPage: studyUrl,
            image: `${SITE_URL}${portfolioPreviewSrc(project, 'desktop')}`,
            genre: study.sector,
            inLanguage: 'en-US',
            creator: {
              '@type': 'Organization',
              name: 'TaylorURL LLC',
              url: SITE_URL,
            },
            about: {
              '@type': 'Organization',
              name: project.name,
              url: project.url,
              ...(project.location ? { address: project.location } : {}),
            },
          },
        ]}
      />

      <PageIntro
        title={project.name}
        lead={study.summary}
        media={<DeviceShowcase project={project} eager />}
      />

      <Section tight label="The facts" className="!pt-0">
        <FactRow
          items={facts}
          className={`max-sm:!grid-cols-1 sm:max-lg:!grid-cols-2 ${facts.length < 4 ? 'lg:!grid-cols-3' : ''}`.trim()}
        />
      </Section>

      <Section narrow label="The study" className="!pt-6">
        <Prose className="[&>h2:first-child]:mt-0">
          <h2>What the business does</h2>
          {study.business.map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>What a visitor can do here</h2>
          <Entries items={study.site} />

          <h2>How it is put together</h2>
          <Entries items={study.build} />
          <p>Built with {study.stack.join(', ')}.</p>

          <h2>How fast it loads</h2>
          <p>
            {project.displayUrl} scores {pagespeed.mobile} on mobile and {pagespeed.desktop} on
            desktop in Google PageSpeed Insights, out of 100, measured on {measured}. A single
            Lighthouse run moves by several points between calls, so each figure is the median of{' '}
            {pagespeed.runs} runs.
          </p>
        </Prose>

        {review && (
          <div className="mt-14">
            <h2 className={`${STUDY_HEADING} mb-6`}>What the client said</h2>
            <ClientTestimonialCard review={review} />
          </div>
        )}
      </Section>

      <CallToAction title="Want your business built like this?" />
    </>
  )
}

export default function CaseStudy() {
  const { slug } = useParams()
  const project = portfolioStudyBySlug(slug)

  // A slug no entry carries renders the not-found state. The prerender only
  // builds the slugs the data holds, so this is what a mistyped or retired URL
  // reaches in the browser.
  if (!project) return <NotFound />

  return <Study project={project} />
}
