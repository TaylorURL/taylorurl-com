import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import PortfolioPreview from '@components/mockups/PortfolioPreview'
import { formatMeasuredDate } from '@data/portfolio'
import { GROUNDS } from '@constants/grounds'

/**
 * What a site measured, and when. The figures are the ones the portfolio and
 * the case studies print, read off the same entry, so a re-measurement moves
 * all three together.
 */
function Measured({ pagespeed, tone }) {
  const rows = [
    { label: 'Mobile', value: pagespeed.mobile },
    { label: 'Desktop', value: pagespeed.desktop },
  ]

  return (
    <div className={`border-t pt-5 ${tone.rule}`}>
      <p className={`section-label-sm ${tone.meta}`}>Google PageSpeed</p>
      <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-3">
        {rows.map(row => (
          <div key={row.label}>
            <dt className={`text-[13px] leading-none ${tone.body}`}>{row.label}</dt>
            <dd
              className={`display-5 mt-2 font-mono font-semibold tabular-nums leading-none tracking-tight ${tone.title}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className={`mt-3 max-w-[46ch] text-[13px] leading-relaxed ${tone.meta}`}>
        Performance out of 100, each the median of {pagespeed.runs} runs taken on{' '}
        {formatMeasuredDate(pagespeed.measured)}.
      </p>
    </div>
  )
}

/**
 * One live client site, given the whole width of the band: the real capture,
 * what the site does, what it measured, and the two ways to check it.
 *
 * This is what a page about a place has that nothing else on the site has, and
 * it is the reason the band leads with one site rather than a row of three.
 * Three unrelated cards is the portfolio page, and on the five towns with no
 * client of their own it was the same three cards every time, so the most
 * prominent band on those pages was the one that varied least.
 *
 * The measurement is the part that cannot be written rather than taken. A score
 * out of a hundred, a count of runs and the day they were run is a claim
 * somebody can go and check in a minute, which is the opposite of a paragraph
 * about what a town is like.
 *
 * @param {object} props
 * @param {object} props.project - An entry from `@data/portfolio`.
 * @param {'paper' | 'sheet' | 'dark' | 'band'} [props.ground] - The ground the
 *   band stands on, which is where the two weights of ink come from.
 * @param {boolean} [props.showIdentity] - Whether the panel prints the site's
 *   name and what it does. False where the band's own heading is already about
 *   this site, which is the case on every town with a client of its own: those
 *   headings were written to name the client, so a panel repeating it put the
 *   name and a description of the same site twice in six inches. There the
 *   panel is the evidence and the heading is the claim.
 */
export default function WorkProof({ project, ground = 'paper', showIdentity = true }) {
  const tone = GROUNDS[ground]

  return (
    <article className={`grid lg:grid-cols-[1.35fr_1fr] ${tone.shell}`}>
      <div
        className={`bg-surface-1 aspect-[16/10] overflow-hidden border-b lg:border-b-0 lg:border-r ${tone.rule}`}
      >
        <PortfolioPreview project={project} />
      </div>

      <div className="flex flex-col gap-5 p-6 sm:p-8 lg:justify-center lg:p-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="section-label text-accent">{project.tagline}</p>
          {project.location && (
            <p className={`section-label-sm ${tone.meta}`}>{project.location}</p>
          )}
        </div>

        {showIdentity && (
          <>
            <h3
              className={`display-5 font-semibold leading-tight tracking-tightest ${tone.title} [text-wrap:balance]`}
            >
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
            </h3>

            <p className={`max-w-[50ch] text-[15px] leading-relaxed sm:text-[16px] ${tone.body}`}>
              {project.description}
            </p>
          </>
        )}

        <Measured pagespeed={project.pagespeed} tone={tone} />

        <div className={`flex flex-col gap-3 border-t pt-5 ${tone.rule}`}>
          {project.hasStudy && (
            <Link
              to={`/portfolio/${project.slug}`}
              aria-label={`Read the ${project.name} case study`}
              className="section-label group inline-flex min-h-[44px] items-center gap-2 text-accent transition-colors hover:text-accent-hi"
            >
              Read the Case Study
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          )}
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${project.name} in a new tab`}
            className={`section-label group inline-flex min-h-[44px] items-center gap-2 transition-colors hover:text-accent ${tone.body}`}
          >
            {project.displayUrl}
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </article>
  )
}
