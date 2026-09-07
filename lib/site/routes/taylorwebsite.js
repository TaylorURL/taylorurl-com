/**
 * Every page taylor.website publishes.
 *
 * Written out rather than filtered from the studio's list. A filter would mean
 * the second site's pages were whatever survived a rule, and the failure of a
 * rule is quiet: a route family added to the studio a year from now would appear
 * here too, and nobody would find out until a Baytown area page turned up on a
 * domain that sells to anyone anywhere. A list is the opposite — a page exists
 * here because it was named here.
 *
 * The shape is the studio's shape exactly, because the same sitemap, llms.txt
 * and prerender plugins read both. `name` and `summary` are what llms.txt lists
 * the page as, and the build refuses a route carrying neither.
 *
 * There is no blog, no portfolio, no industries, no areas, no trades, no free
 * tools and no console. There is no `/start` and no `/pricing`, because two of
 * the three services are quoted after a call and the third is a floor rather
 * than a button — every page ends at the enquiry form instead.
 */

/** The service lines this site sells, and the order the services page shows them. */
export const SERVICE_SLUGS = ['software-engineering', 'tracking-repair', 'outbound']

export const STATIC_ROUTES = [
  {
    path: '/',
    name: 'Home',
    summary: 'Software engineering, conversion tracking repair, and done-for-you outbound.',
    group: 'company',
    changefreq: 'weekly',
    priority: '1.0',
  },
  {
    path: '/services',
    name: 'Services',
    summary: 'The three things this site sells, and what each one costs.',
    group: 'services',
    changefreq: 'monthly',
    priority: '0.9',
  },
  {
    path: '/services/software-engineering',
    name: 'Software Engineering',
    summary: 'Custom applications, integrations, automations and internal tools.',
    group: 'services',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/services/tracking-repair',
    name: 'Tracking Repair',
    summary:
      'Fixing conversion tracking that reports the wrong thing, so ad spend stops being wasted.',
    group: 'services',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/services/outbound',
    name: 'Outbound',
    summary: 'Done-for-you cold email, run from your own sending domain.',
    group: 'services',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/about',
    name: 'About',
    summary: 'Who does the work.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.6',
  },
  {
    path: '/contact',
    name: 'Contact',
    summary: 'Start a conversation about a project.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.9',
  },
  {
    path: '/privacy',
    name: 'Privacy',
    summary: 'What this site collects and what happens to it.',
    group: 'standing',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/terms',
    name: 'Terms',
    summary: 'The terms the work is carried out under.',
    group: 'standing',
    changefreq: 'yearly',
    priority: '0.3',
  },
]

/**
 * Everything rendered to static HTML, which is longer than the sitemap by the
 * pages that have to answer without being pages to rank.
 *
 * Nothing rewrites an unknown path to the shell, so a route that is not built
 * answers 404 on a direct load or a refresh. `/404` is written to the top-level
 * 404.html Vercel serves for an unknown URL, which is what returns a real 404
 * rather than a soft 200.
 */
export const PRERENDER_ROUTES = [...STATIC_ROUTES.map(route => route.path), '/404']

/**
 * Every view this site mounts, written out for the same reason the pages are.
 *
 * The router is the other half of the list above, and it was the half nobody
 * kept: the second site carried the studio's whole route table for as long as
 * the table had no answer for it, and shipped a chunk for every page it does
 * not have. A rule derived from the pages would have closed it, and does not,
 * because a chunk leaves only when the `import()` that names it sits in a
 * branch the bundler can fold, and a set computed at runtime is not one. So
 * the keys are named here, next to the pages, and `scripts/site/check-route-coverage.js`
 * holds the two to each other.
 *
 * `NotFound` is named because it has no page of its own. It answers `/404`,
 * which is written to the top-level 404.html Vercel serves for an unknown URL,
 * and it is what an unmatched in-app navigation lands on.
 */
export const VIEW_KEYS = [
  'Home',
  'About',
  'Services',
  'ServiceDetail',
  'Contact',
  'Privacy',
  'Terms',
  'NotFound',
]

/**
 * The sections llms.txt lays this site out in, and the order they appear.
 *
 * The studio's list is eleven sections describing a portfolio, a blog, a
 * newsletter, trade pages and town pages. This site has none of those, and the
 * plugin refuses a section no page reached — correctly, because an empty section
 * on the studio means a route family quietly stopped producing routes. So the
 * list travels with the site rather than being one list both have to satisfy.
 */
export const LLMS_SECTIONS = [
  {
    id: 'company',
    heading: 'About',
    line: 'Who does the work, how to reach them, and the terms it is carried out under.',
  },
  {
    id: 'services',
    heading: 'Services',
    line:
      'Three things: custom software built to order, conversion tracking repaired so ad spend ' +
      'is measured against what actually happened, and outbound email run from your own domain. ' +
      'Each has a page of its own.',
  },
  {
    id: 'standing',
    heading: 'Standing Pages',
    line: 'Privacy and terms.',
  },
]
