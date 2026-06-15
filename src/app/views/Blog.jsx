import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  Search,
  Tag,
  X,
  TrendingUp,
} from 'lucide-react'
import Seo from '@components/Seo'
import { fadeInUp } from '@constants/animations'
import { BTN_PRIMARY, INPUT } from '@constants/ui'
import { BLOG_POSTS } from '@data/blog'

const POSTS_PER_PAGE = 8

const CATEGORIES = ['All', ...Array.from(new Set(BLOG_POSTS.map(p => p.category)))]

const CATEGORY_COLORS = {
  Business: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  SEO: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Design: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  'Web Performance': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Industry Tips': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
}

function getCategoryStyle(category) {
  return (
    CATEGORY_COLORS[category] || {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200',
    }
  )
}

function FeaturedPost({ post }) {
  const style = getCategoryStyle(post.category)
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-950 to-gray-900"
    >
      <div className="grid-pattern-blue absolute inset-0 opacity-[0.04]" />
      <div className="relative grid gap-0 lg:grid-cols-2">
        <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/20 px-3 py-1 text-xs font-semibold text-blue-400">
              <TrendingUp className="h-3 w-3" />
              Latest
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full ${style.bg} px-3 py-1 text-xs font-medium ${style.text}`}
            >
              {post.category}
            </span>
          </div>

          <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
            <Link to={`/blog/${post.slug}`} className="transition-colors hover:text-blue-400">
              {post.title}
            </Link>
          </h2>

          <p className="mb-6 text-base leading-relaxed text-gray-400 sm:text-lg">{post.excerpt}</p>

          <div className="mb-6 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {post.date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </span>
          </div>

          <Link to={`/blog/${post.slug}`} className={`${BTN_PRIMARY} group/btn w-fit`}>
            Read Article
            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Link>
        </div>

        <div className="hidden items-center justify-center p-12 lg:flex">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="relative grid h-48 w-48 place-items-center rounded-2xl border border-gray-800 bg-gray-900/80">
              <BookOpen className="h-20 w-20 text-blue-500/30" />
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function PostCard({ post, index }) {
  const style = getCategoryStyle(post.category)
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-surface-raised transition-all duration-300 hover:border-gray-300 hover:shadow-lg"
    >
      <Link to={`/blog/${post.slug}`} className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border ${style.border} ${style.bg} px-2.5 py-0.5 text-xs font-medium ${style.text}`}
          >
            {post.category}
          </span>
          <span className="text-xs text-gray-400">{post.readTime}</span>
        </div>

        <h3 className="mb-2 text-base font-bold leading-snug text-gray-900 transition-colors group-hover:text-blue-600 sm:text-lg">
          {post.title}
        </h3>

        <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-500">{post.excerpt}</p>

        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {post.date}
          </span>
          <span className="flex items-center gap-1 font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
            Read
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.article>
  )
}

function PostListItem({ post, index }) {
  const style = getCategoryStyle(post.category)
  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className="group"
    >
      <Link
        to={`/blog/${post.slug}`}
        className="flex items-start gap-4 rounded-xl border border-transparent px-4 py-4 transition-all hover:border-gray-200 hover:bg-gray-50"
      >
        <div className="flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border ${style.border} ${style.bg} px-2 py-0.5 text-[10px] font-medium ${style.text}`}
            >
              {post.category}
            </span>
            <span className="text-xs text-gray-400">{post.date}</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
            {post.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-gray-500">{post.excerpt}</p>
        </div>
        <span className="mt-2 flex-shrink-0 text-gray-300 transition-colors group-hover:text-blue-500">
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </motion.article>
  )
}

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const activeCategory = searchParams.get('category') || 'All'
  const currentPage = parseInt(searchParams.get('page') || '1', 10)

  const setCategory = cat => {
    const params = new URLSearchParams(searchParams)
    if (cat === 'All') params.delete('category')
    else params.set('category', cat)
    params.delete('page')
    setSearchParams(params)
  }

  const setPage = page => {
    const params = new URLSearchParams(searchParams)
    if (page <= 1) params.delete('page')
    else params.set('page', String(page))
    setSearchParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = e => {
    setSearch(e.target.value)
    const params = new URLSearchParams(searchParams)
    if (e.target.value) params.set('q', e.target.value)
    else params.delete('q')
    params.delete('page')
    setSearchParams(params, { replace: true })
  }

  const clearSearch = () => {
    setSearch('')
    const params = new URLSearchParams(searchParams)
    params.delete('q')
    params.delete('page')
    setSearchParams(params, { replace: true })
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

  // Split paginated into main grid (first 4) and sidebar list (rest)
  const mainGridPosts = paginated.slice(0, 4)
  const sidebarPosts = paginated.slice(4)

  return (
    <div>
      <Seo
        title="Blog"
        description="Web development tips, SEO advice, and growth strategies written for local businesses in Baytown, Houston, and beyond. Real advice about getting your shop, restaurant, or service business found online."
        path="/blog"
      />

      {/* Compact header */}
      <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white pb-8 pt-32 sm:pt-40">
        <div className="grid-pattern absolute inset-0 opacity-[0.03]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp}>
            <h1 className="mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              The <span className="logo-wave-dark">Blog</span>
            </h1>
            <p className="mb-6 text-gray-500">Real advice for local businesses. No fluff.</p>

            {/* Search + categories inline */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(cat => {
                  const isActive = activeCategory === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      aria-pressed={isActive}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                      <span
                        className={`ml-1 text-[10px] ${isActive ? 'text-gray-400' : 'text-gray-400'}`}
                      >
                        {categoryCounts[cat] || 0}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={handleSearch}
                  placeholder="Search..."
                  aria-label="Search articles"
                  className={`${INPUT} py-2 pl-9 pr-8 text-sm`}
                />
                {search && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-surface-base py-12">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          {/* Results count when filtering */}
          {!isDefaultView && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 text-sm text-gray-500"
            >
              {filtered.length} article{filtered.length !== 1 ? 's' : ''}
              {activeCategory !== 'All' && ` in ${activeCategory}`}
              {search && ` matching "${search}"`}
            </motion.p>
          )}

          {/* Featured post (only on default view) */}
          {featuredPost && (
            <div className="mb-10">
              <FeaturedPost post={featuredPost} />
            </div>
          )}

          {/* Main content area */}
          {paginated.length > 0 ? (
            <AnimatePresence mode="popLayout">
              <div className="grid gap-8 lg:grid-cols-3">
                {/* Left: card grid */}
                <div className="lg:col-span-2">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {mainGridPosts.map((post, i) => (
                      <PostCard key={post.slug} post={post} index={i} />
                    ))}
                  </div>
                </div>

                {/* Right: compact list sidebar */}
                {sidebarPosts.length > 0 && (
                  <div className="lg:col-span-1">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-2 lg:sticky lg:top-28">
                      <h3 className="mb-1 px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        More Articles
                      </h3>
                      <div className="divide-y divide-gray-100">
                        {sidebarPosts.map((post, i) => (
                          <PostListItem key={post.slug} post={post} index={i} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center"
            >
              <p className="text-lg text-gray-500">No articles found.</p>
              <button
                onClick={() => {
                  clearSearch()
                  setCategory('All')
                }}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            </motion.div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setPage(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                  className={`h-9 w-9 rounded-lg text-sm font-medium transition-all ${
                    page === currentPage
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gray-950 py-12 sm:py-20">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
              Ready to Fix Your <span className="logo-wave">Website</span>?
            </h2>
            <p className="mb-8 text-base text-gray-400 sm:text-lg">
              Stop reading about it and let&apos;s actually do something about it.
            </p>
            <Link to="/contact" className={`${BTN_PRIMARY} group`}>
              Get in Touch
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
