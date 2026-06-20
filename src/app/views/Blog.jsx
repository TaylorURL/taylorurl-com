import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Clock,
  Search,
  X,
} from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp } from '@constants/animations'
import { INPUT } from '@constants/ui'
import { BLOG_POSTS } from '@data/blog'
import { breadcrumbSchema } from '@constants/seo'

const POSTS_PER_PAGE = 8

const CATEGORIES = ['All', ...Array.from(new Set(BLOG_POSTS.map(p => p.category)))]

function CategoryChip({ category, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`group inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-all ${
        active
          ? 'border-accent bg-accent text-white'
          : 'border-hair-paper-strong text-paper-soft hover:border-ink-paper hover:text-ink-paper'
      }`}
    >
      <span className={active ? 'text-white' : 'text-accent'}>●</span>
      {category}
      {count !== undefined && (
        <span className={active ? 'text-white/70' : 'text-paper-faint'}>{count}</span>
      )}
    </button>
  )
}

function FeaturedPost({ post }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden border border-hair bg-bg text-ink"
    >
      <div className="grid-blueprint absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative grid gap-12 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16 lg:p-16">
        <div>
          <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            <span className="h-px w-8 bg-accent" />
            Featured · {post.category}
          </div>

          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
            <Link to={`/blog/${post.slug}`} className="transition-colors hover:text-accent">
              {post.title}
            </Link>
          </h2>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
            {post.excerpt}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            <span className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-accent" />
              {post.date}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-accent" />
              {post.readTime}
            </span>
          </div>

          <Link
            to={`/blog/${post.slug}`}
            className="group mt-10 inline-flex items-center gap-2.5 rounded-sm bg-accent px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
          >
            Read article
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="relative hidden lg:block">
          <div className="border border-hair p-6">
            <span
              aria-hidden
              className="absolute -top-px left-4 bg-bg px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
            >
              Meta
            </span>
            <dl className="space-y-3 font-mono text-[11px] uppercase tracking-[0.18em]">
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
        </div>
      </div>
    </motion.article>
  )
}

function PostCard({ post, index }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="group bg-paper transition-colors duration-300 hover:bg-ink-paper/[0.02]"
    >
      <Link to={`/blog/${post.slug}`} className="flex h-full flex-col gap-5 p-7">
        <div className="flex items-center justify-between border-b border-hair-paper pb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
          <span className="text-accent">// {post.category}</span>
          <span>{post.readTime}</span>
        </div>

        <h3 className="text-[18px] font-semibold leading-[1.25] tracking-tight text-ink-paper transition-colors group-hover:text-accent sm:text-[20px]">
          {post.title}
        </h3>

        <p className="flex-1 text-[14px] leading-relaxed text-paper-soft">{post.excerpt}</p>

        <div className="flex items-center justify-between border-t border-hair-paper pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
          <span>{post.date}</span>
          <span className="flex items-center gap-1 text-accent opacity-0 transition-opacity group-hover:opacity-100">
            Read
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.article>
  )
}

function PostListItem({ post, index }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, delay: index * 0.02 }}
      className="group bg-paper transition-colors hover:bg-ink-paper/[0.02]"
    >
      <Link
        to={`/blog/${post.slug}`}
        className="flex items-start gap-4 px-4 py-4"
      >
        <div className="flex-1">
          <div className="mb-1.5 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.22em] text-paper-faint">
            <span className="text-accent">{post.category}</span>
            <span>·</span>
            <span>{post.date}</span>
          </div>
          <h3 className="text-[13px] font-semibold leading-snug text-ink-paper transition-colors group-hover:text-accent">
            {post.title}
          </h3>
        </div>
        <ArrowUpRight className="mt-2 h-3.5 w-3.5 flex-shrink-0 text-paper-faint transition-colors group-hover:text-accent" />
      </Link>
    </motion.article>
  )
}

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const activeCategory = searchParams.get('category') || 'All'
  const currentPage = parseInt(searchParams.get('page') || '1', 10)

  const updateParams = (updates, options) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setSearchParams(params, options)
  }

  const setCategory = cat => updateParams({ category: cat === 'All' ? '' : cat, page: '' })

  const setPage = page => {
    updateParams({ page: page <= 1 ? '' : String(page) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = e => {
    setSearch(e.target.value)
    updateParams({ q: e.target.value, page: '' }, { replace: true })
  }

  const clearSearch = () => {
    setSearch('')
    updateParams({ q: '', page: '' }, { replace: true })
  }

  const filtered = useMemo(() => {
    let posts = BLOG_POSTS

    if (activeCategory !== 'All') {
      posts = posts.filter(p => p.category === activeCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      posts = posts.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
    }

    return posts
  }, [activeCategory, search])

  const isDefaultView = activeCategory === 'All' && !search.trim() && currentPage === 1
  const featuredPost = isDefaultView ? filtered[0] : null
  const gridPosts = isDefaultView ? filtered.slice(1) : filtered

  const totalPages = Math.ceil(gridPosts.length / POSTS_PER_PAGE)
  const paginated = gridPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  )

  const categoryCounts = useMemo(() => {
    const counts = { All: BLOG_POSTS.length }
    BLOG_POSTS.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return counts
  }, [])

  const mainGridPosts = paginated.slice(0, 4)
  const sidebarPosts = paginated.slice(4)

  return (
    <div>
      <Seo
        title="Website & Google Tips for Baytown Businesses"
        description="Plain-English website, Google, and growth notes for Baytown, Houston, and Southeast Texas small businesses. Practical advice on getting more customers online."
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
            url: 'https://taylorurl.com/blog',
            description:
              'Plain-English website, Google, and growth notes for small businesses in Baytown and the Houston area.',
            publisher: { '@id': 'https://taylorurl.com/#business' },
          },
        ]}
      />
      <PageHero
        eyebrow="// 01 — Field notes"
        title="Notes from the workbench."
        description="Practical website, Google, and growth tips for local businesses. No buzzwords, no fluff — written by me, sent only when worth it."
      />

      {/* Filters strip */}
      <section className="border-b border-hair-paper bg-paper">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 lg:px-16">
          <motion.div {...fadeInUp} className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <CategoryChip
                  key={cat}
                  category={cat}
                  active={activeCategory === cat}
                  onClick={() => setCategory(cat)}
                  count={categoryCounts[cat] || 0}
                />
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <Search
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-faint"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Search articles…"
                aria-label="Search articles"
                className={`${INPUT} py-3 pl-10 pr-10 text-[14px]`}
              />
              {search && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-paper-faint hover:text-ink-paper"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-paper py-16 sm:py-20">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          {!isDefaultView && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-faint"
            >
              {filtered.length.toString().padStart(2, '0')} result
              {filtered.length !== 1 ? 's' : ''}
              {activeCategory !== 'All' && ` · ${activeCategory}`}
              {search && ` · "${search}"`}
            </motion.p>
          )}

          {featuredPost && (
            <div className="mb-16">
              <FeaturedPost post={featuredPost} />
            </div>
          )}

          {paginated.length > 0 ? (
            <AnimatePresence mode="popLayout">
              <div className="grid gap-px overflow-hidden border border-hair-paper bg-hair-paper lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="grid gap-px bg-hair-paper sm:grid-cols-2">
                    {mainGridPosts.map((post, i) => (
                      <PostCard key={post.slug} post={post} index={i} />
                    ))}
                  </div>
                </div>

                {sidebarPosts.length > 0 && (
                  <div className="bg-paper">
                    <p className="border-b border-hair-paper px-5 py-4 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                      // More articles
                    </p>
                    <div className="divide-y divide-hair-paper">
                      {sidebarPosts.map((post, i) => (
                        <PostListItem key={post.slug} post={post} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border border-hair-paper py-20 text-center"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper-faint">
                // No matches
              </p>
              <p className="mt-3 text-[16px] text-ink-paper">No articles found.</p>
              <button
                onClick={() => {
                  clearSearch()
                  setCategory('All')
                }}
                className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-accent hover:text-[color:var(--accent-hi)]"
              >
                Clear filters
              </button>
            </motion.div>
          )}

          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="inline-flex items-center gap-1.5 rounded-sm border border-hair-paper-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-soft transition-colors hover:bg-ink-paper hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-paper-soft"
              >
                <ArrowLeft className="h-3 w-3" />
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setPage(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-sm font-mono text-[11px] tracking-[0.18em] transition-colors ${
                    page === currentPage
                      ? 'bg-accent text-white'
                      : 'border border-hair-paper-strong text-paper-soft hover:bg-ink-paper hover:text-paper'
                  }`}
                >
                  {String(page).padStart(2, '0')}
                </button>
              ))}

              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="inline-flex items-center gap-1.5 rounded-sm border border-hair-paper-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-soft transition-colors hover:bg-ink-paper hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-paper-soft"
              >
                Next
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* CTA — dark band */}
      <section className="relative overflow-hidden border-t border-hair bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div
            {...fadeInUp}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              // Next
              <span className="h-px w-8 bg-accent" />
            </p>
            <h2 className="text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-[1.02] tracking-tightest text-ink">
              Ready to fix your <span className="text-accent">website</span>?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft sm:text-[18px]">
              Tell me about the business and what is not working. I will take it from there.
            </p>
            <Link
              to="/contact"
              className="group mt-10 inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
            >
              Get in touch
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
