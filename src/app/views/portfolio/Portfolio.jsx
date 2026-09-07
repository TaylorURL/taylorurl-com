import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import PageHero from '@components/page-bands/PageHero'
import CtaSection from '@components/conversion/CtaSection'
import Seo from '@components/Seo'
import { DesktopMockup, PhoneMockup } from '@components/mockups/DevicePreview'
import { CLIENT_PROJECTS, PORTFOLIO_PROJECTS, formatMeasuredDate } from '@data/portfolio'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { EASE, fadeInUp } from '@constants/animations'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'

// The frames come in from the side the row has set them on, a beat behind the
// copy beside them, so a row reads as one thing arriving rather than as two
// halves racing. Transform and opacity only, which is what keeps the run on the
// compositor instead of laying the row out again on every frame.
const MOCKUP_REVEAL = fromLeft => ({
  initial: { opacity: 0, x: fromLeft ? -36 : 36 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: '0px 0px 15% 0px' },
  transition: { duration: 0.42, delay: 0.05, ease: EASE },
})

// A count small enough to read as a word in a sentence rather than as a figure
// in a table. Anything past what is spelled here falls back to the numeral,
// which is wrong-looking rather than wrong.
const COUNT_WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
]

const spellCount = count => COUNT_WORDS[count] ?? String(count)

/**
 * What Google scored the row's site, on the row itself.
 *
 * The page has always promised a measured figure against every entry, and the
 * figures only ever appeared on the case study behind it: a reader who did not
 * click through was given a claim about speed with nothing to check it against,
 * and the entries with no study to click through to showed none at all. The
 * pair sits above the two links rather than below them, so the score is read
 * with the site it belongs to instead of after the invitation to leave.
 *
 * Label above figure, in the same shape the front door's score card uses, so a
 * reader who arrives here from that card is reading the same object twice
 * rather than two designs of one. Both numbers and the sentence under them come
 * off the committed entry, so a row cannot quote a score the study behind it
 * disagrees with.
 */
function RowScore({ pagespeed }) {
  const rows = [
    { label: 'Mobile', value: pagespeed.mobile },
    { label: 'Desktop', value: pagespeed.desktop },
  ]
  return (
    <div className="border-hair-paper border-t pt-5">
      <p className="text-paper-faint section-label-sm">Google PageSpeed</p>
      <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-4">
        {rows.map(row => (
          <div key={row.label}>
            <dt className="text-[13px] leading-none text-paper-soft">{row.label}</dt>
            <dd className="display-5 mt-2 font-mono font-semibold tabular-nums leading-none tracking-tight text-ink-paper">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-paper-faint mt-4 max-w-[46ch] text-[13px] leading-relaxed">
        Performance out of 100, each the median of {pagespeed.runs} runs taken on{' '}
        {formatMeasuredDate(pagespeed.measured)}.
      </p>
    </div>
  )
}

function PortfolioRow({ project, index }) {
  // Scroll-driven mockup parallax — the device frames drift up across the row's
  // own scroll window so the imagery feels alive against the static copy. The
  // hook handles reduced-motion (range collapses to 0).
  const { ref: parallaxRef, transform: mockupTransform } = useScrollParallax({
    range: [70, -70],
  })

  const mockupsOnLeft = index % 2 === 1

  return (
    <article className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
      <m.div
        {...fadeInUp}
        className={`flex flex-col gap-6 lg:col-span-5 ${mockupsOnLeft ? 'lg:order-2 lg:pl-4' : 'lg:order-1 lg:pr-4'}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-paper-faint section-label-sm">
            {project.kind === 'product' ? 'Studio Product' : 'Client'}
          </p>
          <h2 className="display-3 font-semibold leading-[1.05] tracking-tight text-ink-paper [text-wrap:balance]">
            {project.hasStudy ? (
              <Link
                to={`/portfolio/${project.slug}`}
                className="transition-colors hover:text-accent"
              >
                {project.name}
              </Link>
            ) : (
              project.name
            )}
          </h2>
          {project.tagline && <p className="section-label text-accent">{project.tagline}</p>}
        </div>
        <p className="max-w-[46ch] text-[15px] leading-relaxed text-paper-soft sm:text-[16px]">
          {project.description}
        </p>
        <RowScore pagespeed={project.pagespeed} />
        <div className="border-hair-paper flex flex-col gap-4 border-t pt-5">
          {project.hasStudy && (
            <Link
              to={`/portfolio/${project.slug}`}
              aria-label={`Read the ${project.name} case study`}
              className="section-label group inline-flex min-h-[44px] items-center gap-2 text-accent transition-colors hover:text-ink-paper"
            >
              Read the Case Study
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          )}
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${project.name} in a new tab`}
            className="section-label group inline-flex min-h-[44px] items-center gap-2 text-paper-soft transition-colors hover:text-ink-paper"
          >
            Visit Live Site
            <span className="text-paper-faint truncate font-normal group-hover:text-paper-soft">
              {project.displayUrl}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </m.div>

      <m.div
        {...MOCKUP_REVEAL(mockupsOnLeft)}
        className={`lg:col-span-7 ${mockupsOnLeft ? 'lg:order-1' : 'lg:order-2'}`}
      >
        <m.div
          ref={parallaxRef}
          style={{ transform: mockupTransform }}
          className="relative will-change-transform"
        >
          <DesktopMockup project={project} index={index} />
          <div
            className={`mt-6 flex justify-center lg:absolute lg:bottom-[-48px] lg:mt-0 ${
              mockupsOnLeft ? 'lg:right-[-28px] lg:justify-end' : 'lg:left-[-28px] lg:justify-start'
            }`}
          >
            <PhoneMockup project={project} />
          </div>
        </m.div>
      </m.div>
    </article>
  )
}

export default function Portfolio() {
  return (
    <div>
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
      <PageHero
        draft="iso"
        eyebrow="Portfolio"
        title="Every site on this page is live."
        description={`${spellCount(CLIENT_PROJECTS.length)} businesses around Baytown and Houston, each site built, hosted, and looked after by one person. Open any of them, then read how it was put together.`}
      />

      <section className="section-y-lg relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.plan}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <div className="flex flex-col gap-32 sm:gap-40 lg:gap-56">
            {PORTFOLIO_PROJECTS.map((project, index) => (
              <PortfolioRow key={project.url} project={project} index={index} />
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        draft="iso"
        eyebrow="Next: Your Site"
        title={
          <>
            Want your business <span className="text-accent">in this list</span>?
          </>
        }
        description="Tell me what your business needs and get a plan and a price back before any work starts. Most sites are live in two to four weeks."
      />
    </div>
  )
}
