/**
 * site-audit - the public reading behind the Google Presence Check.
 *
 *   GET ?site=<host or url>   what Google can measure and read on that address
 *
 * The console's own PageSpeed route is session-gated and works from a stored
 * site id, so it cannot answer for an address a stranger typed. This one takes
 * the address itself, which is why everything below is arranged around not
 * trusting it.
 *
 * What it reads: PageSpeed Insights for both strategies, which carries the lab
 * scores and, where Google holds enough traffic for the origin, the field
 * record real visitors produced; the page's own HTML for the things a crawler
 * reads out of it; and robots.txt and sitemap.xml at the origin.
 *
 * What it returns: measurements and facts, never sentences. The wording a
 * visitor reads is composed in the browser from this, so the copy can be
 * rewritten without redeploying a function and the same reading can be shown
 * more than one way.
 *
 * What stops it: a caller gets five readings a quarter hour, an address that
 * resolves anywhere other than the public internet is refused before a single
 * request is made, and the answer is cached at the edge for a day per address.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { target } from '../lib/http/target.js'

// Held on the endpoint as well so `scripts/free-tools/check-site-audit.js` can hold the
// address guard to the list it must refuse without a network between the two.
export { target }

const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const API_KEY = process.env.GOOGLE_PAGESPEED_API_KEY || ''

// The two strategies are asked for one after the other rather than together.
// Google queues concurrent Lighthouse runs behind each other and charges the
// wait to both: measured against one client site, the phone reading alone came
// back in 22 seconds and the same reading alongside a desktop one took 144.
// In turn, each is quick and only the second can be late.
const PSI_TIMEOUT_MS = 60_000
// The desktop reading is the one nothing is written from, so it waits less and
// is dropped rather than allowed to hold up a report that is already complete.
const PSI_EXTRA_TIMEOUT_MS = 30_000
const PAGE_TIMEOUT_MS = 8000
const FILE_TIMEOUT_MS = 5000

// Characters of a page read. A document past this is one whose head has long
// since gone by, and the head is all this reads.
const PAGE_LIMIT = 300_000

const USER_AGENT =
  'Mozilla/5.0 (compatible; TaylorURLTools/1.0; +https://www.taylorurl.com/tools/google-presence-check)'

// What one address may ask for inside one window, held on this endpoint alone.
const READS = callerWindow({ limit: 5, windowMs: 15 * 60 * 1000 })

export const config = { maxDuration: 300 }

/** The score out of a hundred, from Lighthouse's fraction of one. */
function score(categories, key) {
  const raw = categories?.[key]?.score
  return typeof raw === 'number' ? Math.round(raw * 100) : null
}

function millis(audits, key) {
  const raw = audits?.[key]?.numericValue
  return typeof raw === 'number' ? Math.round(raw) : null
}

/** Whether an audit passed, failed, or was not applicable to the page. */
function audited(audits, key) {
  const audit = audits?.[key]
  if (!audit || typeof audit.score !== 'number') return null
  return audit.score >= 0.9
}

/**
 * What the page is carrying in pictures beyond what it displays them at.
 *
 * The figure sits one level further down than the other savings: the insight
 * audit reports a row per image and the waste on each of its sub-items, so a
 * reading taken off the top level comes back empty on a page that is in fact
 * carrying megabytes it never shows.
 */
function wastedImageBytes(audits) {
  const items = audits?.['image-delivery-insight']?.details?.items
  if (!Array.isArray(items)) return null
  let wasted = 0
  for (const item of items) {
    for (const sub of item?.subItems?.items ?? []) {
      if (typeof sub?.wastedBytes === 'number') wasted += sub.wastedBytes
    }
  }
  return Math.round(wasted)
}

/**
 * One PageSpeed reading. A quota refusal is passed on with its own sentence
 * rather than turned into a fault, because it is a state the reader can do
 * something about: wait.
 */
async function measure(url, strategy, timeoutMs = PSI_TIMEOUT_MS) {
  const query = new URLSearchParams({ url, strategy })
  for (const category of CATEGORIES) query.append('category', category)
  if (API_KEY) query.set('key', API_KEY)

  let response
  try {
    response = await fetch(`${PSI}?${query}`, { signal: AbortSignal.timeout(timeoutMs) })
  } catch (cause) {
    // An abort arrives with a message written for a programmer, and this one
    // reaches a visitor, so the stage that gave up says so in its own words.
    const error = new Error(
      cause.name === 'TimeoutError' || cause.name === 'AbortError'
        ? 'Google took too long to load that address. It may be slow or refusing automated visits.'
        : 'The measurement service could not be reached.'
    )
    error.status = 504
    throw error
  }
  if (response.status === 429) {
    const error = new Error('Google is rate limiting the measurement. Try again in a few minutes.')
    error.status = 429
    throw error
  }
  if (!response.ok) {
    const said = await response.text().catch(() => '')
    const detail = API_KEY ? said.replaceAll(API_KEY, '[redacted]') : said
    const error = new Error(
      response.status === 400
        ? 'Google could not load that address. Check it opens in a browser.'
        : `The measurement service answered ${response.status}. ${detail.slice(0, 120)}`.trim()
    )
    error.status = response.status === 400 ? 400 : 502
    throw error
  }

  const payload = await response.json()
  const lighthouse = payload?.lighthouseResult
  const categories = lighthouse?.categories ?? {}
  const audits = lighthouse?.audits ?? {}

  return {
    scores: {
      performance: score(categories, 'performance'),
      accessibility: score(categories, 'accessibility'),
      bestPractices: score(categories, 'best-practices'),
      seo: score(categories, 'seo'),
    },
    lab: {
      fcpMs: millis(audits, 'first-contentful-paint'),
      lcpMs: millis(audits, 'largest-contentful-paint'),
      tbtMs: millis(audits, 'total-blocking-time'),
      siMs: millis(audits, 'speed-index'),
      cls: audits?.['cumulative-layout-shift']?.numericValue ?? null,
    },
    checks: {
      viewport: audited(audits, 'meta-viewport'),
      viewportSized: audited(audits, 'viewport-insight'),
      renderBlocking: audited(audits, 'render-blocking-insight'),
      unsizedImages: audited(audits, 'unsized-images'),
      responsiveImages: audited(audits, 'image-size-responsive'),
      https: audited(audits, 'is-on-https'),
      imageAlt: audited(audits, 'image-alt'),
    },
    imageBytes: wastedImageBytes(audits),
    field: fieldRecord(payload?.loadingExperience?.metrics),
    finalUrl: lighthouse?.finalUrl ?? lighthouse?.finalDisplayedUrl ?? null,
  }
}

/**
 * The field record at the 75th percentile, which is the figure Google's own
 * thresholds are written against. An origin Google holds too little traffic
 * for reports nothing, and nothing is what gets shown rather than a lab number
 * standing in for a reading of real visitors.
 */
function fieldRecord(metrics) {
  if (!metrics) return null
  const at = key => {
    const value = metrics?.[key]?.percentile
    return typeof value === 'number' ? value : null
  }
  const lcpMs = at('LARGEST_CONTENTFUL_PAINT_MS')
  const inpMs = at('INTERACTION_TO_NEXT_PAINT')
  const clsRaw = at('CUMULATIVE_LAYOUT_SHIFT_SCORE')
  if (lcpMs === null && inpMs === null && clsRaw === null) return null
  return { lcpMs, inpMs, cls: clsRaw === null ? null : clsRaw / 100 }
}

/** One page's HTML, or null when the address does not answer with any. */
async function readPage(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
    })
    if (!response.ok) return null
    if (!(response.headers.get('content-type') || '').includes('text/html')) return null
    return { html: (await response.text()).slice(0, PAGE_LIMIT), url: response.url }
  } catch {
    return null
  }
}

/** Whether a file exists at the origin, and its first bytes when it does. */
async function readFile(origin, path) {
  try {
    const response = await fetch(`${origin}${path}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!response.ok) return { present: false }
    return { present: true, body: (await response.text()).slice(0, 20_000) }
  } catch {
    return { present: false }
  }
}

const between = (html, pattern) => {
  const found = html.match(pattern)
  return found ? found[1].trim() : null
}

const attribute = (tag, name) => {
  const found = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return found ? found[1].trim() : null
}

/** The meta tag whose `name` or `property` is this one, as its content. */
function metaContent(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    const named = attribute(tag, 'name') || attribute(tag, 'property')
    if (named && named.toLowerCase() === key) return attribute(tag, 'content')
  }
  return null
}

/**
 * What a crawler reads out of the document.
 *
 * Regex rather than a parser, the way the rest of this project reads a page it
 * did not build: the handful of tags below sit in the head of documents that
 * are otherwise a megabyte of application, and pulling in a DOM to reach them
 * would cost the function more than the reading is worth.
 */
function inspect(html) {
  const headings = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || []
  const images = html.match(/<img\b[^>]*>/gi) || []
  const withAlt = images.filter(tag => {
    const alt = attribute(tag, 'alt')
    return alt !== null && alt.length > 0
  })

  // A business's own details, which is what puts hours, address and phone into
  // a search result rather than leaving Google to guess them off the page.
  //
  // What the finding turns on is whether the business is described, not
  // whether it picked a particular word for itself: schema.org carries about a
  // hundred LocalBusiness subtypes and a barber shop calling itself a HairSalon
  // is correctly described. So the properties are read alongside the types, and
  // an address or a phone number on a business-shaped node is the answer.
  const blocks = html.match(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || []
  const types = new Set()
  const carries = { address: false, telephone: false, hours: false, geo: false }

  for (const block of blocks) {
    const body = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '')
    try {
      const collect = node => {
        if (Array.isArray(node)) return node.forEach(collect)
        if (!node || typeof node !== 'object') return
        const type = node['@type']
        if (typeof type === 'string') types.add(type)
        if (Array.isArray(type)) type.forEach(one => types.add(one))
        if (node.address) carries.address = true
        if (node.telephone) carries.telephone = true
        if (node.openingHours || node.openingHoursSpecification) carries.hours = true
        if (node.geo) carries.geo = true
        for (const value of Object.values(node)) {
          if (value && typeof value === 'object') collect(value)
        }
      }
      collect(JSON.parse(body))
    } catch {
      // A block that will not parse is a block Google does not read either.
    }
  }

  const title = between(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const description = metaContent(html, 'description')

  return {
    title: title ? { text: title, length: title.length } : null,
    description: description ? { text: description, length: description.length } : null,
    h1Count: headings.length,
    imageCount: images.length,
    imagesWithAlt: withAlt.length,
    ogImage: Boolean(metaContent(html, 'og:image')),
    ogTitle: Boolean(metaContent(html, 'og:title')),
    ogDescription: Boolean(metaContent(html, 'og:description')),
    favicon: /<link\b[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/i.test(html),
    viewport: Boolean(metaContent(html, 'viewport')),
    canonical: /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.test(html),
    schemaTypes: [...types],
    schemaCarries: carries,
  }
}

/**
 * Whether both spellings of the host answer, and whether they end up in the
 * same place. A site reachable at two addresses that never agree is a site
 * whose standing is split between them.
 */
async function origins(url) {
  const bare = url.hostname.replace(/^www\./i, '')
  const pair = [`https://${bare}`, `https://www.${bare}`]

  const landed = await Promise.all(
    pair.map(async origin => {
      try {
        const response = await fetch(origin, {
          redirect: 'follow',
          signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
          headers: { 'User-Agent': USER_AGENT },
        })
        return response.ok ? new URL(response.url).host.toLowerCase() : null
      } catch {
        return null
      }
    })
  )

  const [plain, prefixed] = landed
  return {
    bare: plain,
    www: prefixed,
    agree: Boolean(plain && prefixed && plain === prefixed),
    reachable: Boolean(plain || prefixed),
  }
}

/**
 * A reading that is allowed to fail.
 *
 * The report speaks from the phone measurement, so that one is the check and
 * the desktop one is extra. Google answers slowly and sometimes not at all -
 * a 502 after four minutes on the desktop strategy is a thing it really does -
 * and losing the whole reading to the half nothing is written from would be
 * the tool failing at the one moment somebody is waiting on it.
 */
async function optional(url, strategy) {
  try {
    return await measure(url, strategy, PSI_EXTRA_TIMEOUT_MS)
  } catch {
    return null
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'GET only' })
    return
  }

  // Settled before the window is spent, so a mistyped address costs the
  // visitor a correction rather than one of their five readings.
  const chosen = target(request.query.site)
  if (chosen.fault) {
    response.status(400).json({ error: chosen.fault })
    return
  }

  if (!READS.allows(callerAddress(request))) {
    response.setHeader('Retry-After', String(READS.windowMs / 1000))
    response.status(429).json({ error: 'Too many checks from this connection. Try again later.' })
    return
  }

  const { url } = chosen
  const address = url.toString()

  try {
    // The phone reading and the reads of the site itself go together: those
    // are the visitor's own server rather than Google's, so nothing queues
    // behind anything. The desktop reading follows once Google is free again.
    const [mobile, page, robots, sitemap, hosts] = await Promise.all([
      measure(address, 'mobile'),
      readPage(address),
      readFile(url.origin, '/robots.txt'),
      readFile(url.origin, '/sitemap.xml'),
      origins(url),
    ])
    const desktop = await optional(address, 'desktop')

    // A day at the edge, keyed by the address the caller asked for, because a
    // site does not change between two people checking it the same afternoon.
    response.setHeader(
      'Cache-Control',
      'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400'
    )
    response.status(200).json({
      site: { requested: address, host: url.host, https: url.protocol === 'https:' },
      mobile,
      desktop,
      page: page ? inspect(page.html) : null,
      robots: { present: robots.present, sitemapNamed: /sitemap:/i.test(robots.body || '') },
      sitemap: { present: sitemap.present },
      hosts,
      readAt: new Date().toISOString(),
    })
  } catch (cause) {
    const status = cause.status && cause.status < 600 ? cause.status : 502
    response.status(status).json({ error: cause.message || 'The check could not be completed.' })
  }
}
