import {
  BUSINESS_AGGREGATE_RATING,
  BUSINESS_REVIEWS,
} from '../src/app/constants/business-schema.js'
import { BUSINESS_ID } from '../src/app/constants/seo.js'
import { SITE } from '../lib/site/current.js'

const LD_JSON = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g

/**
 * Puts the Trustpilot rating and the quoted reviews on the business node.
 *
 * The rating has to be in the HTML that is served. A crawler does not run the
 * fetch the badge makes, so the live endpoint reaches a visitor and nothing
 * else; the committed standing is the reading that can be there before anyone
 * asks for the page. Writing it into `index.html` by hand would put the same
 * number in two files and let one of them drift, which is why the node here
 * carries the identity and this carries the score.
 *
 * The prerender reuses this file's `<head>` for every route, so the node lands
 * on all of them from the one transform.
 *
 * @param {string} html The page source.
 * @returns {string} The same page, with the business node scored.
 */
export function withBusinessRating(html) {
  let found = false
  const out = html.replace(LD_JSON, (whole, body) => {
    let node
    try {
      node = JSON.parse(body)
    } catch {
      return whole
    }
    if (node['@id'] !== BUSINESS_ID) return whole
    found = true
    return `<script type="application/ld+json">${JSON.stringify({
      ...node,
      aggregateRating: BUSINESS_AGGREGATE_RATING,
      review: BUSINESS_REVIEWS,
    })}</script>`
  })

  // A build that quietly shipped the node without its rating would look exactly
  // like one that shipped it, and the only place the difference shows is a
  // search result weeks later.
  if (!found) throw new Error(`No JSON-LD node with @id ${BUSINESS_ID} in index.html`)
  return out
}

export default function reviewSchemaPlugin() {
  // A site that publishes no business node has nothing to score, and the throw
  // above would refuse its build for the absence of a node it was right not to
  // have. The flag is what the head plugin reads to cut the node, so the two
  // answer the same question and cannot disagree.
  //
  // The throw is not loosened for the site that does publish one. Silence here
  // would mean shipping the business without its rating, and the only place that
  // difference shows is a search result weeks later.
  if (!SITE.reviews) {
    return { name: 'taylorurl-review-schema' }
  }

  return {
    name: 'taylorurl-review-schema',
    transformIndexHtml: {
      order: 'pre',
      handler: html => withBusinessRating(html),
    },
  }
}
