import { Link } from 'react-router-dom'
import { m, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUpRight, Calendar, Clock, Search, X } from 'lucide-react'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import SeriesMark, { CategoryMark } from '@components/marks/SeriesMark'
import SocialLinks from '@components/article/SocialLinks'
import NewsletterSignup from '@components/conversion/NewsletterSignup'
import Seo from '@components/Seo'
import { fadeInUp, fadeInUpMount, staggerChild } from '@constants/animations'
import { BLOG_POSTS, BLOG_SERIES_INDEX } from '@data/blog'
import { breadcrumbSchema, BUSINESS_ID, SITE_URL } from '@constants/seo'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import { useBlogFilters } from '@hooks/reading/useBlogFilters'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'

const POSTS_PER_PAGE = 8

function CategoryChip({ category, active, onSelect, count }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={active} className="chip group">
      <CategoryMark
        category={category}
        className={`h-3.5 w-3.5 ${active ? 'text-[color:var(--on-accent)]' : 'text-accent'}`}
      />
      {category}
      {count !== undefined && (
        <span className={active ? 'text-[color:var(--on-accent)] opacity-70' : 'text-paper-faint'}>
          {count}
        </span>
      )}
    </button>
  )
}

function FeaturedPost({ post }) {
  // Scroll-driven backdrop — the blueprint grid drifts inside the featured
  // card as the band scrolls past, plus a gentle parallax on the right-hand
  // meta panel. Both are decorative, so the article copy stays readable.
  const { ref, transform: gridTransform } = useScrollParallax({ range: [0, -60] })
  const { ref: metaRef, transform: metaTransform } = useScrollParallax({
    range: [50, -50],
  })

  return (
    <m.article
      ref={ref}
      {...fadeInUpMount}
      data-ground="dark"
      className="card-lift relative overflow-hidden bg-bg text-ink"
    >
      <m.div
        style={{ transform: gridTransform }}
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.column} ${SEAMS.card}`}
        aria-hidden="true"
      />
      <div className="relative grid gap-12 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16 lg:p-16">
        <div>
          <div className="section-label mb-6 text-accent">Featured · {post.category}</div>

          <h2 className="display-3 font-semibold leading-[1.05] tracking-tightest text-ink [text-wrap:balance]">
            <Link to={`/blog/${post.slug}`} className="transition-colors hover:text-accent">
              {post.title}
            </Link>
          </h2>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
            {post.excerpt}
          </p>

          <div className="section-label-sm mt-8 flex flex-wrap items-center gap-5 text-ink-faint">
            <span className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-accent" />
              {post.date}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-accent" />
              {post.readTime}
            </span>
          </div>

          <Link to={`/blog/${post.slug}`} className="btn btn-primary group mt-10">
            Read Article
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <m.div
          ref={metaRef}
          style={{ transform: metaTransform }}
          className="relative hidden will-change-transform lg:block"
        >
          <div className="panel-static p-6">
            <span aria-hidden className="section-label-sm block text-ink-faint">
              Meta
            </span>
            <dl className="mt-5 space-y-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Category</dt>
                <dd className="text-ink">{post.category}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Published</dt>
                <dd className="text-ink">{post.date}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Length</dt>
                <dd className="text-ink">{post.readTime}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Author</dt>
                <dd className="text-accent">Trenton Taylor</dd>
              </div>
            </dl>
          </div>
        </m.div>
      </div>
    </m.article>
  )
}

function PostCard({ post, index }) {
  return (
    <m.article layout {...staggerChild(index)} exit={{ opacity: 0 }} className="h-full">
      <SpotlightCard className="panel h-full bg-paper" spotlightColor="var(--spotlight-soft)">
        <Link
          className="group flex h-full flex-col gap-5 p-7 transition-colors duration-200 hover:bg-[color:var(--wash-paper)]"
          to={`/blog/${post.slug}`}
        >
          <div className="border-hair-paper text-paper-faint section-label-sm flex items-center justify-between border-b pb-3">
            <span className="text-accent">{post.category}</span>
            <span>{post.readTime}</span>
          </div>

          <h3 className="text-[19px] font-semibold leading-[1.25] tracking-tight text-ink-paper transition-colors group-hover:text-accent sm:text-[22px]">
            {post.title}
          </h3>

          <p className="flex-1 text-[14px] leading-relaxed text-paper-soft">{post.excerpt}</p>

          <div className="border-hair-paper text-paper-faint section-label-sm flex items-center justify-between border-t pt-4">
            <span>{post.date}</span>
            <span className="flex items-center gap-1 text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Read
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </Link>
      </SpotlightCard>
    </m.article>
  )
}

function PostListItem({ post, index }) {
  return (
    <m.article layout {...staggerChild(index)} exit={{ opacity: 0 }} className="bg-paper">
      <Link
        className="group flex items-start gap-4 px-4 py-4 transition-colors duration-200 hover:bg-[color:var(--wash-paper)]"
        to={`/blog/${post.slug}`}
      >
        <div className="flex-1">
          <div className="text-paper-faint section-label-sm mb-1.5 flex items-center gap-3">
            <span className="text-accent">{post.category}</span>
            <span>·</span>
            <span>{post.date}</span>
          </div>
          <h3 className="text-[13px] font-semibold leading-snug text-ink-paper transition-colors group-hover:text-accent">
            {post.title}
          </h3>
        </div>
        <ArrowUpRight className="text-paper-faint mt-2 h-3.5 w-3.5 flex-shrink-0 transition-colors group-hover:text-accent" />
      </Link>
    </m.article>
  )
}

function SeriesCard({ series }) {
  return (
    <Link
      to={`/blog/series/${series.slug}`}
      className="panel group flex h-full flex-col gap-4 bg-paper p-6 transition-colors duration-200 hover:bg-[color:var(--wash-paper)]"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="edge p-2.5 text-accent">
          <SeriesMark mark={series.mark} className="h-5 w-5" />
        </span>
        <span className="text-paper-faint font-mono text-[12px] tabular-nums">
          {series.posts.length.toString().padStart(2, '0')}
        </span>
      </div>
      <div>
        <h3 className="text-[17px] font-semibold leading-snug tracking-tight text-ink-paper transition-colors group-hover:text-accent">
          {series.name}
        </h3>
        <p className="text-paper-faint section-label-sm mt-2">{series.tagline}</p>
      </div>
      <p className="flex-1 text-[13px] leading-relaxed text-paper-soft">{series.description}</p>
      <span className="section-label-sm flex items-center gap-1.5 text-accent">
        Read the Series
        <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

function Pagination({ currentPage, totalPages, onChange }) {
  return (
    <div className="mt-12 flex items-center justify-center gap-2">
      <button
        className="btn btn-secondary"
        type="button"
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <ArrowLeft className="h-3 w-3" />
        Prev
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
        <button
          className={`btn w-11 px-0 tabular-nums ${page === currentPage ? 'btn-primary' : 'btn-secondary'}`}
          key={page}
          type="button"
          onClick={() => onChange(page)}
          aria-label={`Page ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {String(page).padStart(2, '0')}
        </button>
      ))}

      <button
        className="btn btn-secondary"
        type="button"
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        Next
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  )
}

export default function Blog() {
  const {
    pagePosts,
    featuredPost,
    posts: filtered,
    categories,
    categoryCounts,
    activeCategory,
    search,
    currentPage,
    totalPages,
    isDefaultView,
    setCategory,
    setPage,
    setSearch,
    clearSearch,
    clearAll,
  } = useBlogFilters({ posts: BLOG_POSTS, postsPerPage: POSTS_PER_PAGE })

  const mainGridPosts = pagePosts.slice(0, 4)
  const sidebarPosts = pagePosts.slice(4)

  return (
    <div>
      <Seo
        title="Website & Google Tips for Baytown Businesses"
        description="Plain-English notes on websites, Google, and getting more customers, written for small businesses around Baytown, Houston, and Southeast Texas."
        path="/blog"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'TaylorURL Blog',
            url: `${SITE_URL}/blog`,
            description:
              'Plain-English notes on websites, Google, and getting more customers, written for small businesses in Baytown and the Houston area.',
            publisher: { '@id': BUSINESS_ID },
          },
        ]}
      />
      <PageHero
        draft="ledger"
        eyebrow="Blog"
        title="Straight answers about websites and Google."
        description="Why customers can’t find you on Google, and what to fix first on the site they do land on. Written for shops and trades around Baytown."
      />

      {/* The filter strip is the hero's own furniture rather than a band of the
          page, so it sits tight under the headline instead of standing in the
          section rhythm the bands below it hold. */}
      <section className="border-hair-paper border-b bg-paper">
        <div className="container-rail py-8">
          <m.div
            {...fadeInUp}
            className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <CategoryChip
                  key={cat}
                  category={cat}
                  active={activeCategory === cat}
                  onSelect={() => setCategory(cat)}
                  count={categoryCounts[cat] || 0}
                />
              ))}
            </div>

            <div className="w-full lg:w-72">
              <label htmlFor="blog-search" className="text-paper-faint section-label-sm mb-2 block">
                Search
              </label>
              <div className="relative">
                <Search
                  className="text-paper-faint pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  strokeWidth={1.5}
                />
                <input
                  id="blog-search"
                  type="search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search articles…"
                  className="field py-3 pl-10 pr-10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="text-paper-faint absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 hover:text-ink-paper"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </m.div>
        </div>
      </section>

      <section className="border-hair-paper section-y border-b bg-paper">
        <div className="container-rail">
          <m.div {...fadeInUp}>
            <p className="section-label text-accent">Running Series</p>
            <h2 className="display-4 mt-3 max-w-2xl font-semibold leading-tight tracking-tight text-ink-paper [text-wrap:balance]">
              Each series keeps going. Pick the one that matches your problem.
            </h2>
          </m.div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BLOG_SERIES_INDEX.map(series => (
              <SeriesCard key={series.slug} series={series} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.plan}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          {!isDefaultView && (
            <m.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-paper-faint section-label mb-8"
            >
              {filtered.length.toString().padStart(2, '0')} result
              {filtered.length !== 1 ? 's' : ''}
              {activeCategory !== 'All' && ` · ${activeCategory}`}
              {search && ` · "${search}"`}
            </m.p>
          )}

          {featuredPost && (
            <div className="mb-16">
              <FeaturedPost post={featuredPost} />
            </div>
          )}

          {pagePosts.length > 0 ? (
            <AnimatePresence mode="popLayout">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {mainGridPosts.map((post, i) => (
                      <PostCard key={post.slug} post={post} index={i} />
                    ))}
                  </div>
                </div>

                {sidebarPosts.length > 0 && (
                  <div className="panel-static overflow-hidden bg-paper">
                    <p className="border-hair-paper text-paper-faint section-label-sm border-b px-5 py-4">
                      More Articles
                    </p>
                    <div className="divide-hair-paper divide-y">
                      {sidebarPosts.map((post, i) => (
                        <PostListItem key={post.slug} post={post} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AnimatePresence>
          ) : (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="panel-static py-20 text-center"
            >
              <p className="text-paper-faint section-label">Nothing Found</p>
              <p className="mt-3 text-[16px] text-ink-paper">
                No articles match that. Clear the filters to see every post.
              </p>
              <button type="button" onClick={clearAll} className="btn btn-quiet mt-6 text-accent">
                Clear Filters
              </button>
            </m.div>
          )}

          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onChange={setPage} />
          )}
        </div>
      </section>

      <section className="border-hair-paper section-y relative overflow-hidden border-t bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.ledger}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <NewsletterSignup source="taylorurl-blog" />
          <div className="mt-10">
            <SocialLinks />
          </div>
        </div>
      </section>

      <CtaBanner
        draft="quiet"
        heading="Ready to fix your"
        accentText="website?"
        description="Tell us about the business and what isn’t working. A plan and a price come back before any work starts."
        primaryLabel="Get a Plan and a Price"
        primaryTo="/contact"
      />
    </div>
  )
}
