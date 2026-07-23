import { BLOG_POSTS } from '../src/app/data/blog/index.js'

/** Canonical origin for the production site. */
export const SITE_URL = 'https://taylorurl.com'

/**
 * Static content routes paired with their sitemap metadata. Ordered by
 * importance so the generated sitemap reads sensibly top to bottom.
 */
export const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/services', changefreq: 'monthly', priority: '0.9' },
  { path: '/contact', changefreq: 'monthly', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/process', changefreq: 'monthly', priority: '0.7' },
  { path: '/portfolio', changefreq: 'monthly', priority: '0.8' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/faq', changefreq: 'monthly', priority: '0.7' },
  { path: '/status', changefreq: 'always', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
]

/**
 * One sitemap entry per blog article, derived from the same data source the
 * blog routes render. `lastmod` is the article's publish date (W3C date).
 */
export const BLOG_ROUTES = BLOG_POSTS.map(post => ({
  path: `/blog/${post.slug}`,
  lastmod: new Date(post.date).toISOString().slice(0, 10),
  changefreq: 'monthly',
  priority: '0.6',
}))

/** Every route the sitemap should list. */
export const SITEMAP_ROUTES = [...STATIC_ROUTES, ...BLOG_ROUTES]

/**
 * Every route to prerender to static HTML. Includes `/license` (a real page
 * that is intentionally kept out of the sitemap) so shared links still preview
 * correctly, every blog article, and `/404` which is emitted as the top-level
 * `404.html` Vercel auto-serves for unknown URLs (real 404 status instead of a
 * soft-200 SPA fallback) — both are noindex.
 */
export const PRERENDER_ROUTES = [
  ...STATIC_ROUTES.map(route => route.path),
  '/license',
  // Unlisted Spigot plugin-work page. Prerendered so a shared link previews and
  // renders real SEO markup, but deliberately absent from STATIC_ROUTES (and
  // therefore the sitemap) and from the primary nav — a soft launch.
  '/spigot',
  '/404',
  ...BLOG_ROUTES.map(route => route.path),
]
