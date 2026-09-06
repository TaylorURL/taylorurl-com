import { SITE } from '../lib/site/current.js'

/** `%SITE_X%` in index.html, filled from the record. */
const TOKEN = /%SITE_([A-Z_]+)%/g

/** `<!--site:flag-->…<!--/site:flag-->`, kept or cut by the record's flag. */
const FENCE = /[ \t]*<!--site:([a-zA-Z]+)-->\n?([\s\S]*?)[ \t]*<!--\/site:\1-->\n?/g

/**
 * What each token resolves to. Held here rather than read off the record by name
 * so a token cannot reach a field that was never meant for the document head.
 */
const values = site => ({
  ORIGIN: site.origin,
  BRAND: site.brandName,
  SHORT_NAME: site.shortName,
  ERROR_LABEL: site.errorLabel,
  FEED_TITLE: site.feedTitle ?? '',
  // No `??` on these four. Each sits inside a fence its own flag controls, so
  // a null only ever reaches the substitution when the flag says the region is
  // being published, and a site publishing a tag block with no property to send
  // to is exactly the mistake the throw exists for.
  ANALYTICS_SITE_KEY: site.analyticsSiteKey,
  GA_ID: site.gaId,
  META_PIXEL_ID: site.metaPixelId,
  ADS_ID: site.adsId,
})

/**
 * One index.html, filled in for whichever site is being built.
 *
 * There is exactly one of these files and there has to be. The prerender slices
 * a single built `<head>` out of it and reuses that head verbatim on all ~139
 * routes, so a second copy per site would be a second copy of the error
 * reporter, the pre-paint theme script and the font preloads, three things that
 * are hard to notice going stale. What differs between the sites is filled in
 * instead: a handful of scalars, and whole regions that one site claims and the
 * other does not.
 *
 * A fence is cut, not blanked. The studio's LocalBusiness node names a town, a
 * phone number and an owner, and publishing it on a domain that sells to anyone
 * anywhere would be claiming a locality the second site does not have. Same for
 * the geo metas and the blog's feed link.
 *
 * It throws on a token nobody filled and on a fence nobody closed. Both would
 * otherwise ship: a literal `%SITE_ORIGIN%` in a meta tag is invisible until a
 * crawler reads it, and an unclosed fence silently swallows the rest of the head
 * up to the next marker. The review-schema plugin already makes this argument in
 * writing at its own throw, and it is the same argument — a build that quietly
 * shipped the wrong head looks exactly like one that shipped the right head.
 */
export function withSiteHead(html, site = SITE) {
  const table = values(site)

  const fenced = html.replace(FENCE, (whole, flag, body) => (site[flag] ? body : ''))

  // A marker left behind means one side of a pair was misspelled, so the region
  // was never recognised as a fence and its content is still in the document.
  const stray = fenced.match(/<!--\/?site:[a-zA-Z]+-->/)
  if (stray) {
    throw new Error(
      `site-head: unmatched fence marker ${stray[0]} in index.html — ` +
        'the region it opens is being published unconditionally'
    )
  }

  const filled = fenced.replace(TOKEN, (whole, name) => {
    const value = table[name]
    if (value === undefined || value === null) {
      throw new Error(`site-head: ${whole} has no value for site "${site.key}"`)
    }
    return String(value)
  })

  const survivor = filled.match(TOKEN)
  if (survivor) throw new Error(`site-head: ${survivor[0]} was never filled in`)

  return filled
}

/**
 * Registered FIRST in the plugin array, ahead of the review-schema plugin.
 *
 * Order matters concretely. The review-schema plugin looks for the business node
 * by `@id` and throws when it cannot find one; this plugin is what puts the right
 * origin in that `@id`, and what removes the node entirely for a site that
 * publishes no business. Run second, it would be correcting a document the other
 * plugin had already refused.
 *
 * No `apply` key, so dev and build get the same document. A token that only fails
 * in production is a token nobody sees fail.
 */
export default function siteHeadPlugin() {
  return {
    name: 'taylorurl-site-head',
    transformIndexHtml: {
      order: 'pre',
      handler: html => withSiteHead(html),
    },
  }
}
