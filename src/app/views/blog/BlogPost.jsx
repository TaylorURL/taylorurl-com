import { useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import CtaBanner from '@components/conversion/CtaBanner'
import SeriesMark from '@components/marks/SeriesMark'
import ShareBar from '@components/article/ShareBar'
import SocialLinks from '@components/article/SocialLinks'
import ArticleBody from '@components/article/ArticleBody'
import { ArticleDeck, ArticleRail, ArticleStatus } from '@components/article/ArticleRail'
import {
  ArticleFigures,
  RailPanel,
  ReadNext,
  SeriesStanding,
} from '@components/article/ArticleControls'
import { BLOG_POSTS, findSeries, relatedPosts } from '@data/blog'
import { articleFrame, DECK, RAIL_LEFT, RAIL_RIGHT, seriesNote } from '@utils/articleLayout'
import { useReadingProgress } from '@hooks/reading/useReadingProgress'
import { fadeInUpMount } from '@constants/animations'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'

const MAX_DESCRIPTION_LENGTH = 160

function clampDescription(text) {
  if (!text || text.length <= MAX_DESCRIPTION_LENGTH) return text
  const cut = text.slice(0, MAX_DESCRIPTION_LENGTH - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`
}

/**
 * The reading head.
 *
 * A post is a document rather than a page being sold, so it opens on the paper
 * ground the body is set on and takes none of the parallax the landing pages
 * open on: this is a page somebody came to read, and motion between them and
 * the first line is only in the way.
 *
 * What the head does take from the frame is its shape. A railed article opens
 * left, against the column its text will run in; a mirrored one splits the
 * headline from the standfirst so the two read as a spread; a decked one
 * centres on the measure it will be read at. Under all three is the same ruled
 * strip of figures, which is the line that makes the page read as a document
 * with a record rather than a title with a date under it.
 */
function Masthead({ post, series, words, layout }) {
  const headline = (
    <h1 className="display-3 font-semibold leading-[1.06] tracking-tightest text-ink-paper [overflow-wrap:anywhere] [text-wrap:balance]">
      {post.title}
    </h1>
  )
  const standfirst = (
    <p className="text-[17px] leading-relaxed text-paper-soft sm:text-[18px]">{post.excerpt}</p>
  )

  return (
    <section className="border-hair-paper border-b bg-paper pb-9 pt-32 sm:pb-11 sm:pt-40">
      <div className="container-rail">
        <div className="flex flex-wrap items-center justify-between gap-x-6">
          <Link
            to="/blog"
            className="section-label-sm group inline-flex min-h-[44px] items-center gap-2 text-paper-soft transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to the Blog
          </Link>

          {series && (
            <Link
              to={`/blog/series/${series.slug}`}
              className="section-label-sm group inline-flex min-h-[44px] items-center gap-2.5 text-paper-soft transition-colors hover:text-accent"
            >
              <SeriesMark mark={series.mark} className="h-3.5 w-3.5 text-accent" />
              {series.name}
              <span className="text-paper-faint font-mono text-[11px] tabular-nums">
                {seriesNote(series, post)}
              </span>
            </Link>
          )}
        </div>

        {layout === DECK && (
          <div className="mx-auto mt-8 w-full max-w-[var(--width-reading)] text-center">
            {headline}
            <div className="mx-auto mt-6 max-w-[58ch]">{standfirst}</div>
          </div>
        )}

        {layout === RAIL_LEFT && (
          <div className="mt-8 grid gap-7 lg:grid-cols-[1.45fr_1fr] lg:items-end lg:gap-14">
            {headline}
            <div className="border-hair-paper lg:border-l lg:pl-8">{standfirst}</div>
          </div>
        )}

        {layout === RAIL_RIGHT && (
          <div className="mt-8 max-w-[var(--width-reading)]">
            {headline}
            <div className="mt-6 max-w-[62ch]">{standfirst}</div>
          </div>
        )}

        <div className="mt-9">
          <ArticleFigures post={post} words={words} />
        </div>
      </div>
    </section>
  )
}

/**
 * An article in one of the three frames, and everything that reads the frame.
 *
 * The reading position is measured once here and handed to both the gauge and
 * the contents list, and the frame itself is measured once per article: the
 * sections are needed by the body for its anchors and by the rail for its
 * links, and two measurements of the same article are two chances to disagree
 * about what its third section is called.
 */
function Article({ post }) {
  const frame = useMemo(() => articleFrame(post), [post])
  const bodyRef = useRef(null)
  const reading = useReadingProgress(bodyRef, frame.sections)

  const series = findSeries(post.series)
  const related = relatedPosts(post)
  const railLeft = frame.layout === RAIL_LEFT
  const publishedTime = new Date(post.date).toISOString()

  const body = (
    <m.div {...fadeInUpMount}>
      <ArticleBody
        ref={bodyRef}
        post={post}
        sections={frame.sections}
        mark={series?.mark}
        quote={frame.quote}
        inlineQuote={!frame.railed}
      />
    </m.div>
  )

  const foot = (
    <>
      <div className="mt-14">
        <ShareBar title={post.title} path={`/blog/${post.slug}`} />
      </div>
      <div className="mt-8">
        <SocialLinks />
      </div>
    </>
  )

  return (
    <div>
      <Seo
        title={post.title}
        description={clampDescription(post.excerpt)}
        path={`/blog/${post.slug}`}
        ogType="article"
        article={{
          publishedTime,
          section: post.category,
        }}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            datePublished: publishedTime,
            articleSection: post.category,
            wordCount: frame.words,
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
            mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
            ...(series
              ? {
                  isPartOf: {
                    '@type': 'CreativeWorkSeries',
                    name: series.name,
                    url: `${SITE_URL}/blog/series/${series.slug}`,
                  },
                }
              : {}),
          },
        ]}
      />

      <Masthead post={post} series={series} words={frame.words} layout={frame.layout} />

      <article className="section-y relative overflow-hidden bg-paper">
        <div className="container-rail relative">
          {frame.railed ? (
            <div
              className={`grid gap-12 lg:gap-14 ${
                railLeft
                  ? 'lg:grid-cols-[20rem_minmax(0,1fr)]'
                  : 'lg:grid-cols-[minmax(0,1fr)_20rem]'
              }`}
            >
              <div className={`w-full max-w-[46rem] ${railLeft ? 'lg:order-2' : ''}`}>
                <ArticleDeck
                  sections={frame.sections}
                  activeId={reading.activeId}
                  className="mb-10 lg:hidden"
                />
                {body}
                {foot}
              </div>

              <ArticleRail
                post={post}
                series={series}
                sections={frame.sections}
                reading={reading}
                quote={frame.quote}
                related={related}
                className={railLeft ? 'lg:order-1' : ''}
              />
            </div>
          ) : (
            <>
              <div className="mx-auto w-full max-w-[var(--width-reading)]">
                <ArticleDeck sections={frame.sections} activeId={reading.activeId} open />
                <ArticleStatus reading={reading} sections={frame.sections} className="mt-4" />
                <div className="mt-12">{body}</div>
                {foot}
              </div>

              <div className="mt-14 grid gap-4 md:grid-cols-2">
                {series && (
                  <RailPanel label="Series" note={seriesNote(series, post)}>
                    <SeriesStanding series={series} post={post} />
                  </RailPanel>
                )}
                {related.length > 0 && (
                  <RailPanel label={series ? 'More from the Series' : 'Read Next'}>
                    <ReadNext posts={related} />
                  </RailPanel>
                )}
              </div>
            </>
          )}
        </div>
      </article>

      <CtaBanner
        heading="Need help with"
        accentText="your website?"
        description="We build custom websites for local businesses from scratch and look after them once they are live. Tell us about yours, and you get a plan and a price before any work starts."
        primaryLabel="Get a Plan and a Price"
        primaryTo="/contact"
      />
    </div>
  )
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find(entry => entry.slug === slug)

  if (!post) return <NotFound />

  // Keyed on the slug so that moving between two articles rebuilds the reading
  // state rather than carrying one article's position into the next.
  return <Article key={post.slug} post={post} />
}
