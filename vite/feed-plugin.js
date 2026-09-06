import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SITE } from '../lib/site/current.js'
import { BLOG_ROUTES, SITE_URL } from './site-routes.js'

/**
 * Where the feed answers. The autodiscovery link in `index.html` and the
 * `atom:link` inside the document both name this, and a feed whose self link
 * disagrees with its address is one an aggregator will not follow back.
 */
export const FEED_PATH = '/feed.xml'

const CHANNEL = {
  title: 'TaylorURL Blog',
  link: `${SITE_URL}/blog`,
  description:
    'Websites, search and speed for local businesses in Baytown and the Houston area, written from the work.',
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }

/**
 * Article text, escaped for XML.
 *
 * No article carries a bare ampersand today. The one written tomorrow that
 * does would otherwise produce a document no reader can parse, at the next
 * deploy, with nothing on screen to say so.
 */
const xml = text => String(text).replace(/[&<>"']/g, character => ESCAPES[character])

/**
 * One entry. The description is the article's own summary rather than its
 * body: the summary is written to stand alone, the bodies together run twenty
 * times longer than the summaries do, and an article is written to be read on
 * its page, where the series it belongs to and the pieces either side of it
 * are.
 *
 * Both categories are stated because they answer different questions. The
 * topic is what an article is about; the series, carrying the address of the
 * page that collects it, is the thread a reader follows from one entry to the
 * next.
 *
 * A route missing any of the four things an entry is made of stops the build.
 * An entry with an empty title or no date is one a reader's list silently
 * drops, and a feed is read by nobody who would notice.
 */
function renderItem({ path, name, summary, topic, series, published }) {
  const url = `${SITE_URL}${path}`
  for (const [field, value] of [
    ['title', name],
    ['summary', summary],
    ['topic', topic],
    ['date', published],
  ]) {
    if (!value) throw new Error(`feed: ${path} carries no ${field}`)
  }
  const lines = [
    `      <title>${xml(name)}</title>`,
    `      <link>${xml(url)}</link>`,
    `      <guid isPermaLink="true">${xml(url)}</guid>`,
    `      <pubDate>${published.toUTCString()}</pubDate>`,
    `      <category>${xml(topic)}</category>`,
  ]
  if (series) {
    const collection = `${SITE_URL}/blog/series/${series.slug}`
    lines.push(`      <category domain="${xml(collection)}">${xml(series.name)}</category>`)
  }
  lines.push(`      <description>${xml(summary)}</description>`)
  return `    <item>\n${lines.join('\n')}\n    </item>`
}

/**
 * The whole document, from the articles the route table mounts.
 *
 * It takes no argument, and that is the point: a list passed in is a list the
 * build could pass and a check could not, so what a reader receives would stop
 * being the thing anything verified. The route table decides what the feed
 * carries, here and nowhere else.
 *
 * `lastBuildDate` is the newest article rather than the moment of the build.
 * Deploys are frequent and most of them do not touch the blog, and a date
 * moving on every one of them tells every reader polling the feed that
 * something changed each time nothing did.
 *
 * @returns {string} An RSS 2.0 document.
 */
export function renderFeed() {
  const articles = BLOG_ROUTES
  const head = [
    `    <title>${xml(CHANNEL.title)}</title>`,
    `    <link>${xml(CHANNEL.link)}</link>`,
    `    <description>${xml(CHANNEL.description)}</description>`,
    '    <language>en-us</language>',
    '    <docs>https://www.rssboard.org/rss-specification</docs>',
    `    <atom:link href="${xml(`${SITE_URL}${FEED_PATH}`)}" rel="self" type="application/rss+xml" />`,
  ]
  if (articles.length) {
    const newest = new Date(Math.max(...articles.map(article => article.published)))
    head.push(`    <pubDate>${newest.toUTCString()}</pubDate>`)
    head.push(`    <lastBuildDate>${newest.toUTCString()}</lastBuildDate>`)
  }
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    ...head,
    ...articles.map(renderItem),
    '  </channel>',
    '</rss>',
  ]
  return `${lines.join('\n')}\n`
}

// Written from the shared route list, the same source the sitemap is written
// from, so the two never disagree about which articles the site publishes.
//
// Only for a site that publishes articles, which is what `SITE.blog` says.
// `BLOG_ROUTES` is the studio's thirty-four articles whichever site is building,
// because it is derived from the blog's data module rather than from the route
// table's per-site lists, so the second site was writing a twenty-three kilobyte
// feed titled "TaylorURL Blog", describing itself as being about local
// businesses in the Houston area, whose every entry linked to a taylor.website
// address that answers 404. `index.html` already cuts the autodiscovery link on
// the same flag, so nothing pointed at the file - which is worse rather than
// better, because a document nobody links to is one nobody looks at either, and
// it was still there for anything that guessed the address.
export default function feedPlugin() {
  let outDir = 'dist'
  return {
    name: 'taylorurl-feed',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async closeBundle() {
      if (!SITE.blog) return
      await writeFile(join(outDir, FEED_PATH.slice(1)), renderFeed(), 'utf8')
    },
  }
}
