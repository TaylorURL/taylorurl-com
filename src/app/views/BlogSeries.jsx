import { Link, useParams } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import Seo from '@components/Seo'
import CtaBanner from '@components/CtaBanner'
import NotFound from '@views/NotFound'
import SeriesMark from '@components/SeriesMark'
import SocialLinks from '@components/SocialLinks'
import { fadeInUpMount } from '@constants/animations'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { BLOG_SERIES_INDEX, findSeries } from '@data/blog'

export default function BlogSeries() {
  const { slug } = useParams()
  const series = findSeries(slug)

  if (!series) return <NotFound />

  const others = BLOG_SERIES_INDEX.filter(other => other.slug !== series.slug)

  return (
    <div>
      <Seo
        title={`${series.name}: ${series.tagline}`}
        description={series.description}
        path={`/blog/series/${series.slug}`}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: series.name, path: `/blog/series/${series.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: series.name,
            description: series.description,
            url: `${SITE_URL}/blog/series/${series.slug}`,
            isPartOf: { '@type': 'Blog', name: 'TaylorURL Blog', url: `${SITE_URL}/blog` },
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: series.posts.length,
              itemListElement: series.posts.map((post, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: `${SITE_URL}/blog/${post.slug}`,
                name: post.title,
              })),
            },
          },
        ]}
      />

      {/* The head carries a leading mark and a way back to the index, neither of
          which PageHero has a place for, so it is built here on PageHero's own
          slab, rail and measure rather than beside them. */}
      <section
        data-ground="dark"
        className="relative overflow-hidden bg-bg pb-20 pt-32 text-ink sm:pb-28 sm:pt-44"
      >
        <div
          className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.ledger} ${SEAMS.hero}`}
          aria-hidden="true"
        />
        <div className="container-rail-tight relative">
          <m.div {...fadeInUpMount}>
            <Link
              to="/blog"
              className="section-label-sm group inline-flex min-h-[44px] items-center gap-2 text-ink-soft transition-colors hover:text-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to the Blog
            </Link>

            <div className="mt-10 flex items-start gap-5">
              <span className="edge hidden shrink-0 p-3 text-accent sm:block">
                <SeriesMark mark={series.mark} className="h-7 w-7" />
              </span>
              <div>
                <p className="section-label text-accent">
                  Series · {series.posts.length.toString().padStart(2, '0')} article
                  {series.posts.length === 1 ? '' : 's'}
                </p>
                <h1 className="display-3 mt-4 font-semibold leading-[1.04] tracking-tightest text-ink [text-wrap:balance]">
                  {series.name}
                </h1>
                <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
                  {series.description}
                </p>
              </div>
            </div>
          </m.div>
        </div>
      </section>

      <section className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.plan}`}
          aria-hidden="true"
        />
        <div className="container-rail-tight relative">
          <ol className="panel-static divide-hair-paper divide-y overflow-hidden">
            {series.posts.map((post, index) => (
              <li key={post.slug}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="group flex items-start gap-5 px-5 py-6 transition-colors duration-200 hover:bg-[color:var(--wash-paper)] sm:px-7"
                >
                  <span className="text-paper-faint mt-1 font-mono text-[11px] tabular-nums">
                    {(series.posts.length - index).toString().padStart(2, '0')}
                  </span>
                  <span className="flex-1">
                    <span className="text-paper-faint section-label-sm flex flex-wrap items-center gap-3">
                      <span className="text-accent">{post.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.date}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.readTime}</span>
                    </span>
                    <span className="mt-2 block text-[19px] font-semibold leading-snug text-ink-paper transition-colors group-hover:text-accent sm:text-[21px]">
                      {post.title}
                    </span>
                    <span className="mt-2 block text-[14px] leading-relaxed text-paper-soft">
                      {post.excerpt}
                    </span>
                  </span>
                  <ArrowUpRight className="text-paper-faint mt-1 h-4 w-4 flex-shrink-0 transition-colors group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <SocialLinks />
          </div>

          {others.length > 0 && (
            <div className="mt-16">
              <p className="text-paper-faint section-label-sm mb-5">Other Series</p>
              <div className="flex flex-wrap gap-2">
                {others.map(other => (
                  <Link key={other.slug} to={`/blog/series/${other.slug}`} className="chip">
                    <SeriesMark mark={other.mark} className="h-3.5 w-3.5 text-accent" />
                    {other.name}
                    <span className="text-paper-faint">
                      {other.posts.length.toString().padStart(2, '0')}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <CtaBanner
        draft="ledger"
        heading="Want this done on"
        accentText="your site?"
        description="Tell me what the site does now and what it should do. I usually reply within the hour, and a plan and a price come back before any work starts."
        primaryLabel="Get a Plan and a Price"
        primaryTo="/contact"
      />
    </div>
  )
}
