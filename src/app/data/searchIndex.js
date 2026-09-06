/**
 * Every page on the public site, in one list a search box can rank.
 *
 * This module is reached through `import()` rather than an import at the top of
 * the bar, for the same reason the assistant is: the blog alone is thirty-odd
 * articles of prose, and putting it in the first bundle charges every visitor
 * for a box most of them will never open. The chunk arrives the first time
 * somebody actually searches, and a reader who has already been to the blog has
 * most of it cached.
 *
 * The list is built from the same data the pages themselves are built from, so
 * a page cannot fall out of the search by being renamed or moved -- there is no
 * second copy of the site's shape here to go stale. What is written down is
 * only which sections exist and which ones a reader most likely means.
 */

import { LEGAL_LINKS, NAV_GROUPS, PRIMARY_LINKS } from '@constants/navigation'
import { AREAS } from '@data/areas'
import { BLOG_POSTS, BLOG_SERIES_INDEX } from '@data/blog'
import { PORTFOLIO_STUDIES } from '@data/portfolioStudies'
import { TRADES } from '@data/trades'
import { IS_SECOND_SITE } from '../../../lib/site/current.js'

// A standing nudge per kind of page, added to every query rather than to a
// particular one. It settles the case where a word fits two pages equally: a
// reader typing "roofing" wants the roofing page, not the article that happens
// to open with the word. It is deliberately small -- large enough to break a
// tie, too small to put a section above a page that carries the word in its
// name.
const WEIGHT = {
  section: 14,
  service: 12,
  tool: 12,
  industry: 8,
  work: 6,
  series: 4,
  area: 3,
  article: 0,
  legal: 0,
}

// The section a row says it belongs to. A row reading "Roofing" alone is a word
// the reader has to place; "Roofing, Industries" is an answer.
const SECTION = {
  service: 'Services',
  tool: 'Tools',
  industry: 'Industries',
  work: 'Work',
  series: 'Resources',
  area: 'Areas',
  article: 'Blog',
  legal: 'Legal',
}

// The last segment of the route, which is the word the address uses for the
// page. It is frequently not the word the page calls itself, and a reader who
// types it is naming the page as exactly as anyone can.
const slugOf = to => (to ? to.split('/').filter(Boolean).pop() || '' : '')

const entry = (kind, { to, href, label, summary, keywords, mark, section }) => ({
  id: to || href,
  kind,
  section: section || SECTION[kind] || 'Pages',
  label,
  slug: slugOf(to),
  summary: summary || '',
  keywords: (keywords || []).filter(Boolean),
  to,
  href,
  mark,
  weight: WEIGHT[kind] ?? 0,
})

// Which kind a nav destination is, read off the route it points at rather than
// off the column it was listed under: a page reachable from two panels is one
// page, and it should say the same thing about itself either way.
const kindOfRoute = to => {
  if (!to) return 'section'
  if (to.startsWith('/services/')) return 'service'
  if (to.startsWith('/tools/')) return 'tool'
  if (to.startsWith('/industries/')) return 'industry'
  if (to.startsWith('/portfolio/')) return 'work'
  return 'section'
}

// The bar's own destinations: every feature and every row of every panel. These
// come first because they carry the wording the site already uses for itself,
// and the enrichment below is only allowed to fill in what they leave blank.
const fromNavigation = () =>
  NAV_GROUPS.flatMap(group => {
    const rows = [
      ...(group.feature ? [group.feature] : []),
      ...group.columns.flatMap(column => column.items),
    ]
    return rows.map(row =>
      entry(row.href ? 'section' : kindOfRoute(row.to), {
        to: row.to,
        href: row.href,
        label: row.label,
        summary: row.summary,
        mark: row.mark,
        section: group.label,
      })
    )
  })

// The trades carry no summary in the bar, because a panel column of twenty-two
// names reads as a directory rather than as twenty-two pitches. A search row is
// not a column, so the trade's own list of what its site has to do becomes the
// words the page can be found by.
const fromTrades = () =>
  TRADES.map(trade =>
    entry('industry', {
      to: `/industries/${trade.id}`,
      label: trade.name,
      keywords: trade.needs,
      mark: trade.mark,
    })
  )

const fromPortfolio = () =>
  PORTFOLIO_STUDIES.map(project =>
    entry('work', {
      to: `/portfolio/${project.slug}`,
      label: project.name,
      summary: project.study?.summary || project.description,
      keywords: [project.tagline, project.study?.sector, project.location, project.town],
    })
  )

// Towns are not in the bar at all -- the panel offers the one index page -- so
// a reader who knows the name of their own town has no way to that town's page
// short of the index. This is the half of the search that is not a faster route
// to something already reachable.
const fromAreas = () =>
  AREAS.map(area =>
    entry('area', {
      to: `/areas/${area.slug}`,
      label: area.name,
      summary: area.profile?.search || area.profile?.lede,
      keywords: [area.profile?.client],
    })
  )

const fromBlog = () => [
  ...BLOG_SERIES_INDEX.map(series =>
    entry('series', {
      to: `/blog/series/${series.slug}`,
      label: series.name,
      summary: series.tagline,
      keywords: [series.description],
    })
  ),
  ...BLOG_POSTS.map(post =>
    entry('article', {
      to: `/blog/${post.slug}`,
      label: post.title,
      summary: post.excerpt,
      keywords: [post.category],
    })
  ),
]

// The footer reaches pages the panels do not, and the two legal columns reach
// pages nothing else links from the top of the site.
const fromFooter = () => [
  ...PRIMARY_LINKS.map(link => entry(kindOfRoute(link.to), { to: link.to, label: link.label })),
  ...LEGAL_LINKS.map(link => entry('legal', { to: link.to, label: link.label })),
]

// One route is one row. Where the same page arrives twice the first wording
// wins, because the earlier sources are the ones that name the page the way the
// site names it; a later arrival may still fill in a summary, keywords or a
// mark the first one had none of.
const merge = candidates => {
  const byRoute = new Map()
  for (const candidate of candidates) {
    if (!candidate.id || !candidate.label) continue
    const held = byRoute.get(candidate.id)
    if (!held) {
      byRoute.set(candidate.id, candidate)
      continue
    }
    held.summary ||= candidate.summary
    held.mark ||= candidate.mark
    held.keywords = [...held.keywords, ...candidate.keywords]
    held.weight = Math.max(held.weight, candidate.weight)
  }
  return [...byRoute.values()]
}

/**
 * The whole list, built once. Nothing here reads the DOM or the network, so it
 * is safe to build at module scope: the cost is paid when the chunk lands,
 * which is already the moment the reader asked for it.
 *
 * Two of the six sources read lists that are already keyed to the site, so they
 * come back nearly empty on the subsidiary without being told anything. The
 * other four read `@data` directly and answer for the studio whatever site is
 * building, which put twenty-two trade pages, every town around Baytown, the
 * client case studies -- by client name and by town -- and thirty-four articles
 * in the box on a domain that publishes none of them, each row a client-side
 * navigation to a page that only exists somewhere else. So the second site takes
 * the two that describe it and leaves the four that describe the studio.
 *
 * Written as a comparison against `IS_SECOND_SITE` rather than as a filter over
 * the six, so the four calls fold away and the bindings they read go with them.
 * That is as far as it reaches: three of the four data modules build their lists
 * with expressions the bundler cannot prove free of side effects, so their
 * imports survive as bare ones and their chunks are still fetched when the box
 * is opened. Nothing is read out of them and nothing is drawn from them, but the
 * weight is there until those modules can be dropped outright.
 */
export const SEARCH_ENTRIES = merge(
  IS_SECOND_SITE
    ? [...fromNavigation(), ...fromFooter()]
    : [
        ...fromNavigation(),
        ...fromTrades(),
        ...fromPortfolio(),
        ...fromAreas(),
        ...fromBlog(),
        ...fromFooter(),
      ]
)

/**
 * What an empty box offers. A search that shows nothing until something is
 * typed asks the reader to guess what it holds, and a hand-written list of
 * suggestions is a second copy of the site's shape that goes stale the first
 * time a section is renamed. These are the panels' own feature cards, which is
 * the site already saying what each part of it is for.
 */
export const SEARCH_STARTERS = NAV_GROUPS.map(group => group.feature)
  .filter(Boolean)
  .map(feature =>
    entry(feature.href ? 'section' : kindOfRoute(feature.to), {
      to: feature.to,
      href: feature.href,
      label: feature.label,
      summary: feature.summary,
      mark: feature.mark,
    })
  )
