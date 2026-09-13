/**
 * The feed, held to RSS 2.0 and to the route table it is written from.
 *
 * A feed fails in a way nothing on the site shows: readers stop updating, the
 * document still returns 200, and the pages it describes look fine. So the
 * document is parsed here rather than eyeballed, and every entry is put back
 * through the router that has to serve it. An article the site does not mount
 * reaching the feed is the failure worth catching, because a subscriber
 * follows the link months after the deploy that broke it.
 *
 *   npm run check:feed
 */
import { readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { expect as check, fail, finish } from '../harness/checks.js'

// The data modules import each other without extensions, which the bundler
// resolves and bare Node does not.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('.')
    const spelled = relative && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.js` : specifier
    return nextResolve(spelled, context)
  },
})

const { BLOG_ROUTES, publishedAt, SITE_URL, SITEMAP_ROUTES } =
  await import('../../vite/site-routes.js')
const { FEED_PATH, renderFeed } = await import('../../vite/feed-plugin.js')
const { BLOG_POSTS } = await import('../../src/app/data/blog/index.js')
const { matchViewKeys } = await import('../../src/app/constants/routes.js')

const document = renderFeed()

/**
 * Every tag and text run in order, or the offset where the scan stopped.
 *
 * A hand-written generator produces malformed XML by leaving a character
 * unescaped, which no test of the strings that went in can see. Walking the
 * output and refusing to skip anything is what turns that into a failure:
 * a byte the grammar does not cover leaves the cursor behind the match.
 */
function scan(text) {
  const token =
    /<\?[^>]*\?>|<!--[\s\S]*?-->|<\/([A-Za-z][\w:.-]*)>|<([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<>]*")*)\s*(\/?)>|([^<]+)/g
  const stack = []
  const tokens = []
  let cursor = 0
  for (const match of text.matchAll(token)) {
    if (match.index !== cursor) return { stopped: cursor }
    cursor = match.index + match[0].length
    const [, closed, opened, attributes, selfClosing, run] = match
    if (closed) {
      if (stack.pop() !== closed) return { stopped: match.index }
    } else if (opened) {
      tokens.push({ tag: opened, attributes: attributes || '', path: [...stack, opened] })
      if (!selfClosing) stack.push(opened)
    } else if (run !== undefined) {
      tokens.push({ text: run, path: [...stack] })
    }
  }
  if (cursor !== text.length || stack.length) return { stopped: cursor }
  return { tokens }
}

const scanned = scan(document)
if (scanned.stopped !== undefined) {
  fail(`the feed is not well-formed XML, from character ${scanned.stopped}`)
  console.error(document.slice(Math.max(0, scanned.stopped - 80), scanned.stopped + 80))
  process.exit(1)
}
const { tokens } = scanned

const ENTITY = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/
for (const token of tokens) {
  if (token.text === undefined) continue
  check(!ENTITY.test(token.text), `an unescaped ampersand in <${token.path.at(-1)}>`)
  check(!/[<>]/.test(token.text), `an unescaped angle bracket in <${token.path.at(-1)}>`)
}

// Elements and the text inside them are counted apart: the whitespace laying
// the document out is a text run at the same path as the element it sits in,
// so one lookup over both reads every indent as an entry.
const at = path => tokens.filter(token => token.tag && token.path.join('/') === path)
const textIn = path =>
  tokens
    .filter(token => token.text !== undefined && token.path.join('/') === path)
    .map(token => token.text)
const first = path => textIn(path)[0]

const root = tokens.find(token => token.tag)
check(root?.tag === 'rss', `the document's root is <${root?.tag}>, not <rss>`)
check(/ version="2\.0"/.test(root?.attributes ?? ''), 'the feed does not declare RSS version 2.0')
check(
  /xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom"/.test(root?.attributes ?? ''),
  'the feed uses an atom: prefix it never declares'
)
check(at('rss/channel').length === 1, 'the feed does not carry exactly one channel')

// RSS 2.0 requires all three of these on a channel, and a reader shows the
// first two wherever it lists a subscription.
for (const element of ['title', 'link', 'description']) {
  check(Boolean(first(`rss/channel/${element}`)), `the channel carries no <${element}>`)
}

// The three places the feed's address is written, held against each other
// rather than each against itself. A feed nothing links to is a feed nothing
// finds, and moving the address in one place alone is how that happens: the
// document would still be valid, the page would still link somewhere, and the
// two would be different files.
const shell = await readFile(new URL('../../index.html', import.meta.url), 'utf8')
const served = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'))

const advertised = /<link\b[^>]*rel="alternate"[^>]*>/s.exec(shell)?.[0] ?? ''
check(Boolean(advertised), 'no page on the site links to a feed')
check(
  /type="application\/rss\+xml"/.test(advertised),
  'the autodiscovery link does not declare the feed type'
)
check(
  advertised.includes(`href="${FEED_PATH}"`),
  `the page links to a feed at somewhere other than ${FEED_PATH}`
)
check(
  /title="[^"]+"/.test(advertised),
  'the autodiscovery link carries no title for a reader to subscribe under'
)

const headers = served.headers.find(rule => rule.source === FEED_PATH)?.headers ?? []
check(
  headers.some(
    header => header.key === 'Content-Type' && header.value.startsWith('application/rss+xml')
  ),
  `${FEED_PATH} is not served as a feed`
)

const self = at('rss/channel/atom:link')[0]
check(Boolean(self), 'the feed does not state its own address')
check(
  self?.attributes.includes(`href="${SITE_URL}${FEED_PATH}"`),
  `the feed's self link is not ${SITE_URL}${FEED_PATH}`
)
check(self?.attributes.includes('rel="self"'), 'the self link is not marked rel="self"')
check(
  self?.attributes.includes('type="application/rss+xml"'),
  'the self link does not declare the feed type'
)

const items = at('rss/channel/item')
check(
  items.length === BLOG_POSTS.length,
  `the feed carries ${items.length} entries against ${BLOG_POSTS.length} articles`
)

const links = textIn('rss/channel/item/link')
const guids = textIn('rss/channel/item/guid')
const titles = textIn('rss/channel/item/title')
const dates = textIn('rss/channel/item/pubDate')
const summaries = textIn('rss/channel/item/description')

for (const element of ['title', 'link', 'guid', 'pubDate', 'description']) {
  check(
    at(`rss/channel/item/${element}`).length === items.length,
    `${items.length - at(`rss/channel/item/${element}`).length} entries carry no <${element}>`
  )
}
check(new Set(guids).size === guids.length, 'two entries share an identifier')
check(
  guids.every((guid, index) => guid === links[index]),
  'an entry identifies itself as something other than its own address'
)
check(
  at('rss/channel/item/guid').every(token => token.attributes.includes('isPermaLink="true"')),
  'an entry identifies itself by an address it does not declare to be one'
)
check(
  titles.every(title => title.trim().length > 0),
  'an entry carries an empty title'
)
check(
  summaries.every(summary => summary.trim().length > 0),
  'an entry carries an empty summary'
)

// The route table is the only thing that decides what the feed carries: every
// address in it resolves through the router the site mounts, and the set is
// the set the sitemap publishes.
const blogRoutes = SITEMAP_ROUTES.filter(route => /^\/blog\/(?!series\/)/.test(route.path)).map(
  route => `${SITE_URL}${route.path}`
)
const missing = blogRoutes.filter(url => !links.includes(url))
const extra = links.filter(url => !blogRoutes.includes(url))
check(missing.length === 0, `the sitemap publishes ${missing.length} articles the feed omits`)
check(extra.length === 0, `the feed carries addresses the sitemap does not publish: ${extra[0]}`)

for (const url of links) {
  const keys = matchViewKeys(url.slice(SITE_URL.length))
  check(
    keys.at(-1) === 'BlogPost',
    `${url} is in the feed and the router answers it with ${keys.at(-1) || 'nothing'}`
  )
}

// RFC 822, which is what an RSS date is, and newest first, which is the order
// a reader's unread list is built in.
const RFC_822 = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/
for (const date of dates) {
  check(RFC_822.test(date), `"${date}" is not a date an RSS reader parses`)
}
const instants = dates.map(date => Date.parse(date))
check(
  instants.every(instant => Number.isFinite(instant)),
  'an entry carries a date that reads as nothing'
)
check(
  instants.every((instant, index) => index === 0 || instants[index - 1] >= instant),
  'the entries are not newest first'
)
check(
  first('rss/channel/lastBuildDate') === dates[0],
  'the channel dates itself to something other than its newest article'
)

// A dated document that changes on its own moves a reader's whole unread list
// every deploy. Two renders have to agree, and so do two timezones: the dates
// are written from parts against UTC, and reading them anywhere else would say
// otherwise.
check(document === renderFeed(), 'two renders of the feed disagree')
{
  const zone = process.env.TZ
  const here = publishedAt('August 29, 2026').toUTCString()
  process.env.TZ = 'Pacific/Kiritimati'
  const away = publishedAt('August 29, 2026').toUTCString()
  process.env.TZ = zone
  check(here === away, `an article dates itself ${here} in one timezone and ${away} in another`)
}

// Nothing the studio publishes carries one, and every string here is composed
// rather than written.
check(!/\p{Extended_Pictographic}/u.test(document), 'the feed carries an emoji')

await finish()

const series = new Set(BLOG_ROUTES.map(route => route.series?.slug).filter(Boolean))
console.log(
  `feed valid: ${items.length} entries across ${series.size} series, ` +
    `${(Buffer.byteLength(document) / 1024).toFixed(1)} KB, newest ${dates[0]}`
)
