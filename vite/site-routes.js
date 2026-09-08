import { BLOG_POSTS, BLOG_SERIES_INDEX } from '../src/app/data/blog/index.js'
import { fetchIssues, ISSUE_COLUMNS } from '../src/app/data/newsletter/newsletterIssues.js'
import { INDUSTRY_SLUGS } from '../src/app/data/towns-and-trades/industries.js'
import { INDUSTRY_DETAIL } from '../src/app/data/towns-and-trades/industryDetail.js'
import { AREAS } from '../src/app/data/towns-and-trades/areas.js'
import { SERVICE_LINES } from '../src/app/data/pages/services.js'
import { TOOLS_INDEX } from '../src/app/data/pages/tools.js'
import { PORTFOLIO_STUDIES } from '../src/app/data/portfolioStudies.js'
import { SITE } from '../lib/site/current.js'
import * as taylorwebsite from '../lib/site/routes/taylorwebsite.js'

// The origin every generated file states: sitemap entries, feed links, llms.txt
// and the canonical each prerendered page carries. It used to be declared here,
// in src/app/constants/seo.js and in src/app/components/Seo.jsx independently,
// three strings that happened to agree. One site could survive that; two cannot,
// because the failure is a second domain publishing the first one's canonical
// and nothing in the output looking wrong.
export const SITE_URL = SITE.origin

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * An article's date, read as midnight UTC.
 *
 * The dates are written the way a person writes one, and `new Date` reads that
 * as midnight wherever the build happens to run, so a laptop in Texas and a
 * build server on UTC stamp the same article six hours apart. A sitemap states
 * a day and survives that; a feed states an instant and does not, so the parts
 * are read and the date rebuilt against UTC. A date the pattern cannot read
 * stops the build, because a feed carrying `Invalid Date` is one no reader
 * will take.
 *
 * @param {string} date - An article's `date`, e.g. `August 29, 2026`.
 * @returns {Date} Midnight UTC on that day.
 */
export function publishedAt(date) {
  const parts = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(date)
  const month = parts ? MONTHS.indexOf(parts[1]) : -1
  if (month < 0) throw new Error(`site-routes: "${date}" is not a date an article can carry`)
  return new Date(Date.UTC(Number(parts[3]), month, Number(parts[2])))
}

/**
 * The series each article belongs to, by slug. A route names the series a
 * reader is following and points at the page collecting it, and neither is
 * knowable from the slug the article itself carries.
 */
const SERIES_BY_SLUG = new Map(BLOG_SERIES_INDEX.map(series => [series.slug, series]))

/**
 * One entry per service line, read from the same list the pages render, so a
 * line added or renamed there is built and published without a second edit
 * here. The name and the one-line summary come from that list too, so the
 * words a menu row shows and the words llms.txt carries are the same words.
 */
const SERVICE_ROUTES = SERVICE_LINES.map(line => ({
  path: line.path,
  name: line.name,
  summary: line.summary,
  group: 'services',
  changefreq: 'monthly',
  priority: '0.8',
}))

/**
 * The routes that are not derived from a data module, in the order the
 * generated sitemap preserves - most important first.
 *
 * `name` and `summary` are what llms.txt lists the page as. Every other family
 * below takes both from the data its pages render, and these have no such data
 * to read, so they carry it here rather than in a second list that could name a
 * page this one no longer routes. `group` is the section of llms.txt the page
 * belongs to; the build refuses a route carrying none of the three, which is
 * what stops a page being added to the site and left out of the guide.
 */
const STUDIO_STATIC_ROUTES = [
  {
    path: '/',
    name: 'Home',
    summary: 'What TaylorURL builds and who it is for.',
    group: 'company',
    changefreq: 'weekly',
    priority: '1.0',
  },
  // The assistant that answers in the corner of every page, and the page that
  // introduces it.
  {
    path: '/live',
    name: 'Live',
    summary:
      'An assistant on hand day and night for questions about a build, and the way through to the team when the answer needs a person.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.7',
  },
  // Where every Start a Project button on the site lands: the configurator
  // that carries the offer and the price.
  {
    path: '/start',
    name: 'Start a Project',
    summary:
      'Pick a trade and see the matching work, the software a site runs beside, business email, and the price.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.9',
  },
  {
    path: '/services',
    name: 'Services',
    summary: 'Every service TaylorURL sells, each with a page of its own.',
    group: 'services',
    changefreq: 'monthly',
    priority: '0.9',
  },
  ...SERVICE_ROUTES,
  // Business email and the search work: services in their own right, each with
  // a page rather than a step inside another one.
  {
    path: '/services/business-email',
    name: 'Business Email',
    summary: 'Mail on your own domain, set up and looked after alongside the site.',
    group: 'services',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/services/seo',
    name: 'Local Search Visibility',
    summary: 'Being found in local search: the profile, the listings, and the pages behind them.',
    group: 'services',
    changefreq: 'monthly',
    priority: '0.8',
  },
  // The price. Searched for by name, so it is a page of its own.
  {
    path: '/pricing',
    name: 'Pricing',
    summary: 'What a site costs to build, and what it costs to keep running.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.9',
  },
  {
    path: '/contact',
    name: 'Contact',
    summary: 'Phone, email, and a message form.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.9',
  },
  {
    path: '/about',
    name: 'About',
    summary: 'The small team behind TaylorURL, and how a project runs with them.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/process',
    name: 'Process',
    summary: 'How a project runs from the first call to launch.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.7',
  },
  {
    path: '/portfolio',
    name: 'Portfolio',
    summary: 'Every client site, and the case studies behind them.',
    group: 'work',
    changefreq: 'monthly',
    priority: '0.8',
  },
  // The two landing families' index pages. Their detail routes follow below,
  // derived from the same data the pages render.
  {
    path: '/industries',
    name: 'Industries',
    summary: 'Trade by trade: what a website has to do for each one.',
    group: 'industries',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/areas',
    name: 'Service Areas',
    summary: 'The towns these sites get built for.',
    group: 'areas',
    changefreq: 'monthly',
    priority: '0.8',
  },
  // The free tools index. The tools themselves follow below, derived from the
  // same registry the pages render from.
  {
    path: '/tools',
    name: 'Free Tools',
    summary: 'Tools that run in the browser, with no account and no fee.',
    group: 'tools',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/speed-check',
    name: 'Speed Check',
    summary: "Google's mobile PageSpeed reading of any address, with the band the score lands in.",
    group: 'tools',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/blog',
    name: 'Blog',
    summary: 'Articles on websites, search, speed, and running a business online.',
    group: 'articles',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/notes',
    name: 'Notes',
    summary: 'The newsletter archive, every issue as it was sent.',
    group: 'newsletter',
    changefreq: 'weekly',
    priority: '0.7',
  },
  {
    path: '/faq',
    name: 'FAQ',
    summary: 'Common questions about pricing, timelines, and ownership.',
    group: 'company',
    changefreq: 'monthly',
    priority: '0.7',
  },
  // The public half of the console: uptime anyone can read.
  {
    path: '/console/status',
    name: 'System Status',
    summary: 'Live uptime for every site TaylorURL hosts.',
    group: 'standing',
    changefreq: 'always',
    priority: '0.3',
  },
  {
    path: '/privacy',
    name: 'Privacy Policy',
    summary: 'What the site collects, and what happens to it.',
    group: 'standing',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/terms',
    name: 'Terms of Service',
    summary: 'The terms covering the site and the work.',
    group: 'standing',
    changefreq: 'yearly',
    priority: '0.3',
  },
]

/**
 * One entry per portfolio case study, derived from the same data the pages
 * render from. No `lastmod`: a study changes when the work it describes does,
 * and nothing in the data records that date.
 */
export const CASE_STUDY_ROUTES = PORTFOLIO_STUDIES.map(project => ({
  path: `/portfolio/${project.slug}`,
  name: project.name,
  summary: project.study.summary,
  group: 'work',
  changefreq: 'monthly',
  priority: '0.7',
}))

/**
 * One entry per blog article, derived from the same data source the blog
 * routes render.
 *
 * `published` is the instant, `lastmod` the day it falls on, and the two are
 * read once rather than twice so a sitemap line and a feed entry can never
 * date the same article differently. `topic` and `series` are the two axes an
 * article is filed under: what it is about, and which running body of work it
 * belongs to.
 */
export const BLOG_ROUTES = BLOG_POSTS.map(post => {
  const published = publishedAt(post.date)
  return {
    path: `/blog/${post.slug}`,
    name: post.title,
    summary: post.excerpt,
    group: 'articles',
    topic: post.category,
    series: SERIES_BY_SLUG.get(post.series) || null,
    published,
    lastmod: published.toISOString().slice(0, 10),
    changefreq: 'monthly',
    priority: '0.6',
  }
})

/**
 * One entry per running series, taken from the published index rather than the
 * register, so a series that has been named but not yet written to has no route
 * and no sitemap line. `lastmod` is the newest article in it.
 */
export const BLOG_SERIES_ROUTES = BLOG_SERIES_INDEX.map(series => ({
  path: `/blog/series/${series.slug}`,
  name: series.name,
  summary: series.description,
  group: 'series',
  lastmod: publishedAt(series.posts[0].date).toISOString().slice(0, 10),
  changefreq: 'weekly',
  priority: '0.7',
}))

/**
 * How a trade slug is spelled when it is written out as a name.
 *
 * The trade names live in `@data/trades` beside the icon components, which the
 * route list cannot import: it is read under plain Node, where a React
 * component does not resolve. Title-casing the slug recovers every name but the
 * initialisms, and those are spelled here. This is spelling rather than data -
 * a slug absent from the map is written out word by word, and a label that no
 * longer folds back to its own slug fails `npm run check:llms`.
 */
const TRADE_SPELLINGS = { hvac: 'HVAC', seo: 'SEO' }

function tradeName(slug) {
  return (
    TRADE_SPELLINGS[slug] ||
    slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  )
}

/**
 * One entry per industry page, taken from the register of groups rather than
 * from the trade data, so a trade with no group named for it has no route and
 * no sitemap line. The summary is the page's own headline, so the guide says
 * what the page says rather than a second description of it.
 */
export const INDUSTRY_ROUTES = INDUSTRY_SLUGS.map(slug => ({
  path: `/industries/${slug}`,
  name: tradeName(slug),
  summary: INDUSTRY_DETAIL[slug]?.heroTitle ?? null,
  group: 'industries',
  changefreq: 'monthly',
  priority: '0.7',
}))

/**
 * One entry per town, in the order `/areas` lays the towns out. A town on the
 * shared copy has no line of its own to publish, and is listed by name.
 */
export const AREA_ROUTES = AREAS.map(area => ({
  path: `/areas/${area.slug}`,
  name: area.name,
  summary: area.profile?.search ?? area.profile?.lede ?? null,
  group: 'areas',
  changefreq: 'monthly',
  priority: '0.7',
}))

/**
 * One entry per free tool, read from the registry the pages render from, so a
 * tool added there is routed, published and prerendered without a second edit.
 */
export const TOOL_ROUTES = TOOLS_INDEX.map(tool => ({
  path: tool.path,
  name: tool.name,
  summary: tool.summary,
  group: 'tools',
  changefreq: 'monthly',
  priority: '0.7',
}))

const STUDIO_SITEMAP_ROUTES = [
  ...STUDIO_STATIC_ROUTES,
  ...TOOL_ROUTES,
  ...INDUSTRY_ROUTES,
  ...AREA_ROUTES,
  ...CASE_STUDY_ROUTES,
  ...BLOG_SERIES_ROUTES,
  ...BLOG_ROUTES,
]

/**
 * Every route to prerender to static HTML, which is a longer list than the
 * sitemap: nothing rewrites an unknown path to the shell, so any route that is
 * not built answers 404 on a direct load or a refresh. The sitemap's routes
 * come first, and the ones below them are the pages that have to answer
 * without being pages to rank. Each group says why it is here.
 *
 * `/404` is the exception in shape rather than in reason: it is written to the
 * top-level `404.html` Vercel serves for an unknown URL, which is what gets a
 * real 404 status instead of a soft-200 shell.
 */
const STUDIO_PRERENDER_ROUTES = [
  ...STUDIO_STATIC_ROUTES.map(route => route.path),
  '/license',
  // The console and every section behind an account. Each is rendered to a file
  // for the same reason as the rest: nothing here rewrites an unknown path to
  // the shell, so a route that is not built answers 404 on a direct load or a
  // refresh. They stay out of STATIC_ROUTES because they are noindex and
  // disallowed in robots.txt, which is also why `/console/status` is not among
  // them - it is the public one, and it is in the sitemap above. What gets
  // built is the shell; the figures arrive in the browser.
  '/console',
  '/console/onboarding',
  '/console/project',
  '/console/live',
  '/console/sites',
  '/console/pages',
  '/console/sources',
  '/console/visitors',
  '/console/vitals',
  '/console/outreach',
  '/console/settings',
  '/console/builds',
  '/console/leads',
  '/console/calls',
  '/console/payments',
  '/console/admin',
  // Sign-in, sign-up, and the two halves of a password reset, prerendered for
  // the same reason and kept out of the sitemap for the same one: reachable,
  // noindex, and not pages to rank.
  '/login',
  '/signup',
  // The short checkout, handed to a buyer rather than found. Built for the
  // reason the screens above are built - nothing rewrites an unknown path to
  // the shell, so a URL typed off a phone has to answer on a direct load - and
  // kept out of the sitemap because a page nobody is meant to arrive at from a
  // search result has no business being offered to one.
  '/payment',
  // The two pages a newsletter link opens. Built for the same reason as the
  // rest and kept out of the sitemap for the same one: a link arrives from an
  // inbox, so the URL has to answer on a direct load, and neither is a page to
  // rank.
  '/subscribe/confirm',
  '/unsubscribe',
  '/forgot-password',
  '/reset-password',
  '/404',
  ...TOOL_ROUTES.map(route => route.path),
  ...INDUSTRY_ROUTES.map(route => route.path),
  ...AREA_ROUTES.map(route => route.path),
  ...CASE_STUDY_ROUTES.map(route => route.path),
  ...BLOG_SERIES_ROUTES.map(route => route.path),
  ...BLOG_ROUTES.map(route => route.path),
]

/**
 * The routes for whichever site is building.
 *
 * The second site's pages are a written list rather than a filter over the
 * studio's. A filter fails quietly: a route family added to the studio later
 * would pass through it unnoticed, and the first anyone would know is a Baytown
 * area page answering on a domain that has no locality. A list only contains
 * what somebody put in it.
 *
 * Every export name above and below is the name it has always had, because five
 * Vite plugins and six check scripts import them.
 */
const SECOND_SITE = SITE.key === 'taylorwebsite'

export const STATIC_ROUTES = SECOND_SITE ? taylorwebsite.STATIC_ROUTES : STUDIO_STATIC_ROUTES

export const SITEMAP_ROUTES = SECOND_SITE ? taylorwebsite.STATIC_ROUTES : STUDIO_SITEMAP_ROUTES

export const PRERENDER_ROUTES = SECOND_SITE
  ? taylorwebsite.PRERENDER_ROUTES
  : STUDIO_PRERENDER_ROUTES

// How long the build waits on the newsletter table before going on without it.
const ISSUE_TIMEOUT_MS = 8000

let issuesRead = null

/**
 * Every sent newsletter issue, read once per build and shared by both plugins.
 *
 * The archive lives in the database rather than in a data module, so the routes
 * it produces are only knowable at build time. A table that is unreachable, or
 * not there yet, yields an empty list: the site builds with no issue routes
 * rather than failing, which is the same answer a reader gets from an archive
 * with nothing in it.
 *
 * The archive belongs to the newsletter, and the newsletter belongs to the
 * studio. A site that does not route /notes takes no issue routes and asks the
 * database for nothing: the three callers append what this returns without
 * gating it themselves, so a site answered here is a site answered everywhere.
 */
export function sentIssues() {
  if (issuesRead) return issuesRead
  if (SECOND_SITE) return (issuesRead = Promise.resolve([]))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ISSUE_TIMEOUT_MS)
  issuesRead = fetchIssues({ signal: controller.signal, columns: ISSUE_COLUMNS })
    .catch(cause => {
      console.warn('site-routes: newsletter issues unavailable (%s)', cause.message)
      return []
    })
    .finally(() => clearTimeout(timer))
  return issuesRead
}

/** One sitemap entry per sent issue, in the shape the blog routes take. */
export function issueRoutes(issues) {
  return issues.map(issue => ({
    path: `/notes/${issue.slug}`,
    name: issue.title,
    summary: issue.preheader,
    group: 'newsletter',
    lastmod: new Date(issue.published_at).toISOString().slice(0, 10),
    changefreq: 'yearly',
    priority: '0.6',
  }))
}

/**
 * What each route needs handed to it before it is rendered to static HTML,
 * keyed by path. Routes absent from the map render from an empty seed and
 * fetch for themselves in the browser.
 */
export function routeSeeds(issues) {
  const summary = ({ slug, title, preheader, published_at }) => ({
    slug,
    title,
    preheader,
    published_at,
  })
  const seeds = new Map([['/notes', { issues: issues.map(summary) }]])
  for (const issue of issues) {
    seeds.set(`/notes/${issue.slug}`, { issue })
  }
  return seeds
}
