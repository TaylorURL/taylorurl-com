import { Link, useParams } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, Gauge, MapPin, Layers } from 'lucide-react'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import Seo from '@components/Seo'
import ClientTestimonialCard from '@components/ClientTestimonialCard'
import CtaSection from '@components/CtaSection'
import { DesktopMockup, PhoneMockup } from '@components/DevicePreview'
import NotFound from '@views/NotFound'
import { formatMeasuredDate, portfolioPreviewSrc } from '@data/portfolio'
import { portfolioStudyBySlug } from '@data/portfolioStudies'
import { reviewFor } from '@data/reviews'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { fadeInUp, fadeInUpMount, staggerChild } from '@constants/animations'
import { useScrollParallax } from '@hooks/useScrollParallax'
import { AccentGradient } from '@reactbits/kit'

function kindLabel(kind) {
  return kind === 'product' ? 'Studio Product' : 'Client'
}

function SectionHeading({ eyebrow, title }) {
  return (
    <m.div {...fadeInUp} className="mb-10">
      <p className="section-label mb-5 text-accent">{eyebrow}</p>
      <h2 className="display-4 max-w-2xl font-semibold leading-[1.08] tracking-tightest text-ink-paper [text-wrap:balance]">
        {title}
      </h2>
    </m.div>
  )
}

function DetailCard({ item, index }) {
  return (
    <m.article {...staggerChild(index, 0.05)} className="panel-static bg-paper p-7">
      <p className="text-paper-faint mb-4 font-mono text-[12px] tabular-nums">
        {String(index + 1).padStart(2, '0')}
      </p>
      <h3 className="text-[18px] font-semibold leading-snug tracking-tight text-ink-paper">
        {item.title}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-paper-soft">{item.body}</p>
    </m.article>
  )
}

// The icon arrives as a node rather than as a component, so the mark and the
// label it stands for are written next to each other at the call site.
function MetaRow({ label, value, children }) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <span className="sr-only">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function ScoreFigure({ label, score }) {
  return (
    <div className="panel-static bg-bg px-7 py-8">
      <p className="section-label-sm text-ink-faint">{label}</p>
      <p className="display-2 mt-3 font-mono font-semibold leading-none tracking-tightest text-ink">
        <AccentGradient>{score}</AccentGradient>
      </p>
    </div>
  )
}

function Study({ project }) {
  const { study, pagespeed, slug } = project

  // Scroll-driven hero, matching the article pages: the blueprint grid drifts
  // slower than the headline column so the two layers separate. The hook
  // collapses the range under reduced motion.
  const { ref: gridRef, transform: gridTransform } = useScrollParallax({ range: [0, -40] })

  const studyUrl = `${SITE_URL}/portfolio/${slug}`
  const measured = formatMeasuredDate(pagespeed.measured)
  const review = reviewFor(project.displayUrl)

  return (
    <div>
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

      <section
        data-ground="dark"
        className="relative overflow-hidden bg-bg pb-20 pt-32 text-ink sm:pb-28 sm:pt-44"
      >
        <m.div
          ref={gridRef}
          style={{ transform: gridTransform }}
          className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.iso} ${SEAMS.hero}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <m.div {...fadeInUpMount}>
            <div>
              <Link
                to="/portfolio"
                className="section-label-sm group inline-flex items-center gap-2 text-ink-soft transition-colors hover:text-accent"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                Back to the Portfolio
              </Link>
            </div>

            <p className="section-label mt-8 text-accent">Case Study · {kindLabel(project.kind)}</p>

            <h1 className="display-2 mt-6 max-w-3xl font-semibold leading-[0.98] tracking-tightest text-ink [text-wrap:balance]">
              {project.name}
            </h1>

            <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]">
              {study.summary}
            </p>

            <div className="border-hair section-label-sm mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-6 text-ink-faint">
              <MetaRow label="Sector" value={study.sector}>
                <Layers className="h-3 w-3 text-accent" strokeWidth={1.75} />
              </MetaRow>
              {project.location && (
                <MetaRow label="Location" value={project.location}>
                  <MapPin className="h-3 w-3 text-accent" strokeWidth={1.75} />
                </MetaRow>
              )}
              <MetaRow
                label="PageSpeed score"
                value={`PageSpeed ${pagespeed.mobile} mobile · ${pagespeed.desktop} desktop`}
              >
                <Gauge className="h-3 w-3 text-accent" strokeWidth={1.75} />
              </MetaRow>
            </div>

            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary group mt-10"
            >
              Visit Live Site
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </m.div>
        </div>
      </section>

      <section className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.plan}`}
          aria-hidden="true"
        />
        <div className="container-rail-tight relative">
          <m.div {...fadeInUp} className="relative">
            <DesktopMockup project={project} priority />
            <div className="mt-6 flex justify-center lg:absolute lg:bottom-[-48px] lg:right-[-28px] lg:mt-0 lg:justify-end">
              <PhoneMockup project={project} priority />
            </div>
          </m.div>
        </div>
      </section>

      <section className="border-hair-paper section-y relative overflow-hidden border-t bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.ledger}`}
          aria-hidden="true"
        />
        <div className="container-rail-tight relative">
          <SectionHeading eyebrow="The Business" title="What the business does." />
          <div className="max-w-[68ch] space-y-6">
            {study.business.map(paragraph => (
              <m.p
                key={paragraph}
                {...fadeInUp}
                className="text-[17px] leading-[1.65] text-paper-soft"
              >
                {paragraph}
              </m.p>
            ))}
          </div>
        </div>
      </section>

      <section className="border-hair-paper section-y relative overflow-hidden border-t bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.column}`}
          aria-hidden="true"
        />
        <div className="container-rail-tight relative">
          <SectionHeading eyebrow="The Site" title="What a visitor can do here." />
          <div className="grid gap-5 sm:grid-cols-2">
            {study.site.map((item, index) => (
              <DetailCard key={item.title} item={item} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-hair-paper section-y relative overflow-hidden border-t bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.iso}`}
          aria-hidden="true"
        />
        <div className="container-rail-tight relative">
          <SectionHeading eyebrow="The Build" title="How it is put together." />
          <div className="grid gap-5 sm:grid-cols-2">
            {study.build.map((item, index) => (
              <DetailCard key={item.title} item={item} index={index} />
            ))}
          </div>

          <m.div {...fadeInUp} className="border-hair-paper mt-12 border-t pt-8">
            <p className="text-paper-faint section-label-sm mb-5">Built With</p>
            <ul className="flex flex-wrap gap-2">
              {study.stack.map(item => (
                <li key={item} className="chip-static text-paper-soft">
                  {item}
                </li>
              ))}
            </ul>
          </m.div>
        </div>
      </section>

      {review && (
        <section className="border-hair-paper section-y relative overflow-hidden border-t bg-paper">
          <div
            className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.ledger}`}
            aria-hidden="true"
          />
          <div className="container-rail-tight relative">
            <SectionHeading eyebrow="The Client" title="What the client said." />
            <div className="max-w-[680px]">
              <ClientTestimonialCard review={review} />
            </div>
          </div>
        </section>
      )}

      <section
        data-ground="band"
        className="border-hair section-y relative overflow-hidden border-t bg-bg text-ink"
      >
        <div
          className={`absolute inset-0 ${GROUNDS.band.grid} ${DRAFTS.node}`}
          aria-hidden="true"
        />
        <div className="container-rail-tight relative">
          <m.div {...fadeInUp} className="mb-10">
            <p className="section-label mb-5 text-accent">The Score</p>
            <h2 className="display-4 max-w-2xl font-semibold leading-[1.08] tracking-tightest text-ink [text-wrap:balance]">
              How fast it loads.
            </h2>
          </m.div>

          <m.div {...fadeInUp} className="grid gap-6 sm:grid-cols-2">
            <ScoreFigure label="Mobile" score={pagespeed.mobile} />
            <ScoreFigure label="Desktop" score={pagespeed.desktop} />
          </m.div>

          <m.p
            {...fadeInUp}
            className="mt-8 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft"
          >
            Google PageSpeed Insights performance score for {project.displayUrl}, out of 100,
            measured on {measured}. A single Lighthouse run moves by several points between calls,
            so each figure is the median of {pagespeed.runs} runs.
          </m.p>
        </div>
      </section>

      <CtaSection
        draft="quiet"
        eyebrow="Next: Your Site"
        title={
          <>
            Want your business <span className="text-accent">built like this</span>?
          </>
        }
        description="Tell me what your business needs. You get a plan and a price back before anything gets built."
      />
    </div>
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
