import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * URL-synced state for the /blog index: search query, category, current page.
 * The URL is the source of truth for `category` and `page` so deep links and
 * back/forward navigation work, while `search` is mirrored as `?q=` with
 * `replace` history so each keystroke does not stack history entries.
 *
 * @param {{ posts: Array<{ category: string }>, postsPerPage: number }} options
 * @returns {{
 *   posts: Array,                 // posts filtered by category + search
 *   pagePosts: Array,             // page slice from `posts`
 *   featuredPost: object|null,    // the highlighted post (only in default view)
 *   gridPosts: Array,             // posts shown in the grid (excludes featured)
 *   categories: string[],         // ['All', ...all distinct categories]
 *   categoryCounts: Record<string, number>,
 *   activeCategory: string,
 *   search: string,
 *   currentPage: number,
 *   totalPages: number,
 *   isDefaultView: boolean,       // no filters, page 1 — show the hero card
 *   setCategory: (cat: string) => void,
 *   setPage: (page: number) => void,
 *   setSearch: (value: string) => void,
 *   clearSearch: () => void,
 *   clearAll: () => void,
 * }}
 */
export function useBlogFilters({ posts, postsPerPage }) {
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

  const setCategory = category =>
    updateParams({ category: category === 'All' ? '' : category, page: '' })

  const setPage = page => {
    updateParams({ page: page <= 1 ? '' : String(page) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const setSearchValue = value => {
    setSearch(value)
    updateParams({ q: value, page: '' }, { replace: true })
  }

  const clearSearch = () => setSearchValue('')

  const clearAll = () => {
    setSearch('')
    updateParams({ q: '', category: '', page: '' }, { replace: true })
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return posts.filter(post => {
      if (activeCategory !== 'All' && post.category !== activeCategory) return false
      if (!query) return true
      return (
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.category.toLowerCase().includes(query)
      )
    })
  }, [posts, activeCategory, search])

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(posts.map(p => p.category)))],
    [posts],
  )

  const categoryCounts = useMemo(() => {
    const counts = { All: posts.length }
    for (const post of posts) {
      counts[post.category] = (counts[post.category] || 0) + 1
    }
    return counts
  }, [posts])

  const isDefaultView =
    activeCategory === 'All' && !search.trim() && currentPage === 1
  const featuredPost = isDefaultView ? filtered[0] || null : null
  const gridPosts = isDefaultView ? filtered.slice(1) : filtered

  const totalPages = Math.max(1, Math.ceil(gridPosts.length / postsPerPage))
  const pagePosts = gridPosts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage,
  )

  return {
    posts: filtered,
    pagePosts,
    featuredPost,
    gridPosts,
    categories,
    categoryCounts,
    activeCategory,
    search,
    currentPage,
    totalPages,
    isDefaultView,
    setCategory,
    setPage,
    setSearch: setSearchValue,
    clearSearch,
    clearAll,
  }
}
