import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight, Calendar } from 'lucide-react'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import PageHero from '@components/page-bands/PageHero'
import Seo from '@components/Seo'
import { BUILD_PRICE, MONTHLY_PRICE } from '@data/checkout/pricing'
import CtaSection from '@components/conversion/CtaSection'
import NewsletterSignup from '@components/conversion/NewsletterSignup'
import { fadeInUp, fadeInUpMount, staggerChild } from '@constants/animations'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { useNewsletterIssues } from '@hooks/reading/useNewsletterIssues'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
import { AccentGradient } from '@reactbits/kit'
import { SignalMark } from './NotesArt'
import { issueDate, issueDateIso } from './lib/format'

const DESCRIPTION =
  'Short letters from a Baytown web designer on getting found on Google and turning visitors into paying customers, sent when there’s something worth saying.'

function LatestIssue({ issue, index }) {
  const { ref, transform: gridTransform } = useScrollParallax({ range: [0, -60] })

  return (
    <m.article
      {...fadeInUpMount}
      ref={ref}
      data-ground="band"
      className="card-lift relative overflow-hidden bg-bg text-ink"
    >
      <m.div
        style={{ transform: gridTransform }}
        className={`absolute inset-0 ${GROUNDS.band.grid} ${DRAFTS.plan} ${SEAMS.card}`}
        aria-hidden="true"
      />
      <div className="relative grid gap-12 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16 lg:p-16">
        <div>
          <div className="section-label-sm mb-6 text-accent">
            Latest · No. {String(index).padStart(3, '0')}
          </div>

          <h2 className="display-3 font-semibold leading-[1.05] tracking-tightest text-ink [text-wrap:balance]">
            <Link to={`/notes/${issue.slug}`} className="transition-colors hover:text-accent">
              {issue.title}
            </Link>
          </h2>

          {issue.preheader && (
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
              {issue.preheader}
            </p>
          )}

          <div className="section-label-sm mt-8 flex flex-wrap items-center gap-5 text-ink-faint">
            <span className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-accent" />
              <time dateTime={issueDateIso(issue.published_at) || undefined}>
                {issueDate(issue.published_at)}
              </time>
            </span>
          </div>

          <Link to={`/notes/${issue.slug}`} className="btn btn-primary group mt-10">
            Read the Issue
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="relative hidden lg:block">
          <div className="panel-static p-6">
            <span aria-hidden className="section-label-sm block text-ink-faint">
              Meta
            </span>
            <dl className="mt-5 space-y-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Issue</dt>
                <dd className="text-ink">No. {String(index).padStart(3, '0')}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Sent</dt>
                <dd className="text-ink">{issueDate(issue.published_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Written by</dt>
                <dd className="text-accent">Trenton Taylor</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </m.article>
  )
}

function IssueCard({ issue, number, index }) {
  return (
    <m.article {...staggerChild(index)} className="group h-full">
      <SpotlightCard className="panel h-full bg-paper" spotlightColor="var(--spotlight-soft)">
        <Link
          className="flex h-full flex-col gap-5 p-7 transition-colors duration-200 hover:bg-ink-paper/[0.02]"
          to={`/notes/${issue.slug}`}
        >
          <div className="border-hair-paper text-paper-faint section-label-sm flex items-center justify-between border-b pb-3">
            <span className="text-accent">No. {String(number).padStart(3, '0')}</span>
            <time dateTime={issueDateIso(issue.published_at) || undefined}>
              {issueDate(issue.published_at)}
            </time>
          </div>

          <h3 className="text-[19px] font-semibold leading-[1.25] tracking-tight text-ink-paper transition-colors group-hover:text-accent sm:text-[22px]">
            {issue.title}
          </h3>

          {issue.preheader && (
            <p className="flex-1 text-[14px] leading-relaxed text-paper-soft">{issue.preheader}</p>
          )}

          <span className="section-label-sm mt-auto flex items-center gap-1 text-accent opacity-0 transition-opacity group-hover:opacity-100">
            Read
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </Link>
      </SpotlightCard>
    </m.article>
  )
}

/** The panel that stands where the archive goes while there is nothing in it. */
function ArchivePanel({ children }) {
  return (
    <div className="panel-static grid items-center gap-10 p-10 sm:p-14 lg:grid-cols-[1.2fr_1fr]">
      <div>{children}</div>
      <SignalMark className="mx-auto w-full max-w-[320px]" />
    </div>
  )
}

function Skeleton() {
  return (
    <div className="panel-static animate-pulse p-10 sm:p-14" aria-hidden="true">
      <div className="h-3 w-24 rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline)]" />
      <div className="mt-6 h-8 w-3/4 rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline)]" />
      <div className="mt-4 h-4 w-1/2 rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline)]" />
    </div>
  )
}

export default function Notes() {
  const { issues, error, loading } = useNewsletterIssues()
  const list = issues || []
  const [latest, ...rest] = list
  // Numbered from the first issue ever sent, so an issue keeps its number as
  // the archive grows past it.
  const latestNumber = list.length

  return (
    <div>
      <Seo
        title="Notes: The TaylorURL Newsletter"
        description={DESCRIPTION}
        path="/notes"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Notes', path: '/notes' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Notes',
            url: `${SITE_URL}/notes`,
            description: DESCRIPTION,
            publisher: { '@id': `${SITE_URL}/#business` },
          },
        ]}
      />

      <PageHero
        draft="ledger"
        eyebrow="Notes"
        title="Letters from the workbench."
        description={DESCRIPTION}
      />

      <section className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.plan}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          {/* Above the archive, because a reader who came to this page came for
              the letter itself, and the archive is what it has amounted to so
              far. It also stands clear of the three states below it. */}
          <div className="mb-16">
            <NewsletterSignup source="taylorurl-notes" />
          </div>

          {loading && <Skeleton />}

          {!loading && error && (
            <ArchivePanel>
              <p className="text-paper-faint section-label">Archive Unavailable</p>
              <p className="display-6 mt-4 font-semibold tracking-tight text-ink-paper">
                The archive is not loading right now.
              </p>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-paper-soft">
                Every issue is sent by email as well, so nothing here is the only copy.
              </p>
            </ArchivePanel>
          )}

          {!loading && !error && list.length === 0 && (
            <ArchivePanel>
              <p className="text-paper-faint section-label">Nothing Sent Yet</p>
              <p className="display-6 mt-4 font-semibold tracking-tight text-ink-paper">
                The first issue is still being written.
              </p>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-paper-soft">
                Every letter lands here the day it goes out.
              </p>
            </ArchivePanel>
          )}

          {!loading && latest && (
            <>
              <div className="mb-16">
                <LatestIssue issue={latest} index={latestNumber} />
              </div>

              {rest.length > 0 && (
                <>
                  <m.p {...fadeInUp} className="text-paper-faint section-label mb-8">
                    The Archive
                  </m.p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((issue, i) => (
                      <IssueCard
                        key={issue.slug}
                        issue={issue}
                        number={latestNumber - 1 - i}
                        index={i}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <CtaSection
        draft="ledger"
        title={
          <>
            Need help with <AccentGradient>your website</AccentGradient>?
          </>
        }
        description={`A build starts at ${BUILD_PRICE} once, then ${MONTHLY_PRICE} a month. Most sites are live in two to four weeks.`}
      />
    </div>
  )
}
