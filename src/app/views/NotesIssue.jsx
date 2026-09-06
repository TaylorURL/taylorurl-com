import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { m, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, Calendar, Mail } from 'lucide-react'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import Seo from '@components/Seo'
import CtaSection from '@components/CtaSection'
import { fadeInUpMount } from '@constants/animations'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { useNewsletterIssue } from '@hooks/useNewsletterIssues'
import { useScrollParallax } from '@hooks/useScrollParallax'
import { AccentGradient } from '@reactbits/kit'
import IssueBody from './notes/IssueBody'
import { issueDateIso, issueDateLong } from './notes/lib/format'

const MAX_DESCRIPTION_LENGTH = 155
const FALLBACK_DESCRIPTION =
  'An issue of Notes, the TaylorURL letter on websites, Google, and running a business online.'

function clampDescription(text) {
  if (!text) return FALLBACK_DESCRIPTION
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text
  return `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`
}

function articleSchema(issue, slug, published) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: issue.title,
    description: clampDescription(issue.preheader),
    ...(published ? { datePublished: published } : {}),
    author: {
      '@type': 'Person',
      name: 'Trenton Taylor',
      url: `${SITE_URL}/about`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'TaylorURL LLC',
      legalName: 'TaylorURL LLC',
      founder: {
        '@type': 'Person',
        name: 'Trenton Taylor',
      },
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/TaylorURL-Logo.png`,
      },
    },
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'Notes',
      url: `${SITE_URL}/notes`,
    },
    mainEntityOfPage: `${SITE_URL}/notes/${slug}`,
  }
}

/**
 * The dark band every issue opens on, and the panel that stands in for it.
 *
 * It carries a back link and a dateline that `@components/PageHero` has no
 * place for, and otherwise stands on the shared hero's own measurements: the
 * same slab depth, the same grid, and one parallax layer behind copy that only
 * fades. Two heroes a reader meets one page apart are one hero or they are a
 * seam.
 */
function IssueHero({ children }) {
  const reduced = useReducedMotion()
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const rawOpacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.2])
  const opacity = useSpring(rawOpacity, { stiffness: 140, damping: 32, mass: 0.4 })
  const { ref: gridRef, transform: gridTransform } = useScrollParallax({
    range: [0, reduced ? 0 : -40],
  })

  return (
    <section
      ref={heroRef}
      data-ground="dark"
      className="relative overflow-hidden bg-bg pb-20 pt-32 text-ink sm:pb-28 sm:pt-44"
    >
      <m.div
        ref={gridRef}
        style={{ transform: gridTransform }}
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.plan} ${SEAMS.hero}`}
        aria-hidden="true"
      />
      <m.div style={{ opacity }} className="container-rail-tight relative will-change-transform">
        <Link
          to="/notes"
          className="section-label-sm group inline-flex items-center gap-2 text-ink-soft transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Notes
        </Link>
        {children}
      </m.div>
    </section>
  )
}

function HeroSkeleton() {
  return (
    <div className="mt-10 animate-pulse space-y-4" aria-hidden="true">
      <div className="h-3 w-32 rounded-[var(--r-tiny)] bg-[color:var(--hairline-strong)]" />
      <div className="h-10 w-3/4 rounded-[var(--r-tiny)] bg-[color:var(--hairline)]" />
      <div className="h-10 w-1/2 rounded-[var(--r-tiny)] bg-[color:var(--hairline)]" />
    </div>
  )
}

/** The panel for a slug the archive does not carry, and for a failed read. */
function IssuePanel({ label, headline, body }) {
  return (
    <section className="section-y relative overflow-hidden bg-paper">
      <div
        className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.hatch}`}
        aria-hidden="true"
      />
      <div className="container-rail-prose relative">
        <div className="panel-static p-10 sm:p-14">
          <p className="text-paper-faint section-label">{label}</p>
          <p className="display-6 mt-4 font-semibold tracking-tight text-ink-paper">{headline}</p>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-paper-soft">{body}</p>
          <Link to="/notes" className="btn btn-primary group mt-8">
            Browse the Archive
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function NotesIssue() {
  const { slug } = useParams()
  const { issue, status } = useNewsletterIssue(slug)
  const published = issue ? issueDateIso(issue.published_at) : null

  if (status === 'missing' || status === 'error') {
    const missing = status === 'missing'
    return (
      <div>
        <Seo
          title={missing ? 'Issue Not Found' : 'Notes'}
          description={FALLBACK_DESCRIPTION}
          path={`/notes/${slug}`}
          noIndex
        />
        <IssueHero>
          <h1 className="display-3 mt-8 font-semibold leading-[1.04] tracking-tightest text-ink [text-wrap:balance]">
            {missing ? 'No issue at that address.' : 'This issue is not loading.'}
          </h1>
        </IssueHero>
        <IssuePanel
          label={missing ? 'Not Found' : 'Archive Unavailable'}
          headline={
            missing ? 'That letter is not in the archive.' : 'The archive is not answering.'
          }
          body={
            missing
              ? 'Every issue that has gone out is listed on the archive page.'
              : 'Every issue is sent by email as well, so nothing here is the only copy.'
          }
        />
      </div>
    )
  }

  return (
    <div>
      <Seo
        title={issue?.title || 'Notes'}
        description={clampDescription(issue?.preheader)}
        path={`/notes/${slug}`}
        ogType="article"
        article={published ? { publishedTime: published, section: 'Notes' } : undefined}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Notes', path: '/notes' },
            { name: issue?.title || 'Issue', path: `/notes/${slug}` },
          ]),
          ...(issue ? [articleSchema(issue, slug, published)] : []),
        ]}
      />

      <IssueHero>
        {issue ? (
          <m.div {...fadeInUpMount}>
            <div className="border-hair section-label-sm mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-6 text-ink-faint">
              <span className="flex items-center gap-2 text-accent">
                <Mail className="h-3 w-3" />
                Notes
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <time dateTime={published || undefined}>{issueDateLong(issue.published_at)}</time>
              </span>
            </div>

            {issue.title && (
              <h1 className="display-2 mt-8 break-words font-semibold leading-[1.04] tracking-tightest text-ink [text-wrap:balance]">
                {issue.title}
              </h1>
            )}

            {issue.preheader && (
              <p className="mt-7 max-w-2xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]">
                {issue.preheader}
              </p>
            )}
          </m.div>
        ) : (
          <HeroSkeleton />
        )}
      </IssueHero>

      <article className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.ledger}`}
          aria-hidden="true"
        />
        <div className="container-rail-prose relative">
          {issue ? (
            <IssueBody body={issue.body} />
          ) : (
            <div className="animate-pulse space-y-4" aria-hidden="true">
              <div className="h-4 w-full rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline)]" />
              <div className="h-4 w-11/12 rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline)]" />
              <div className="h-4 w-3/4 rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline)]" />
            </div>
          )}
        </div>
      </article>

      <CtaSection
        draft="quiet"
        title={
          <>
            Need help with <AccentGradient>your website</AccentGradient>?
          </>
        }
        description="I build custom websites for local businesses, look after them, and answer directly when something needs to change."
      />
    </div>
  )
}
