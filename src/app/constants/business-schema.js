/**
 * The Trustpilot standing and the quoted reviews, in the shape the business
 * node publishes them.
 *
 * A module of their own, and that is the whole point of the file. They are read
 * by exactly one caller - `vite/review-schema-plugin.js`, which writes them into
 * `index.html` at build time - and by nothing in the browser. Held in
 * `@constants/seo` they were dragged into the main chunk of both sites by every
 * page that wanted `SITE_URL`, because `Seo.jsx` imports that on every route:
 * the studio shipped its own reviews twice, once baked into the HTML and once as
 * JavaScript nobody read, and the subsidiary shipped a rating and a set of
 * client quotes belonging to a business it is not, on a domain whose registry
 * record says `reviews: false`.
 *
 * Nothing on the browser path may import this file. That is the same rule, for
 * the same reason, as the one on `lib/site/sites.js`.
 */

import { CLIENT_REVIEW_LIST, reviewSource } from '../data/reputation/reviews.js'
import { TRUSTPILOT_STANDING } from '../data/reputation/trustpilot-standing.js'

/**
 * The Trustpilot standing, in the shape the business node publishes it.
 *
 * Read from the committed standing rather than from `/api/trustpilot`, because
 * this is baked into the HTML at build time and a crawler reading the served
 * page never runs the fetch the badge makes. `npm run refresh:trustpilot`
 * moves both at once.
 *
 * `ratingCount` is how many ratings stand behind the score, which is what
 * Trustpilot's total counts. It is deliberately not the number of reviews
 * quoted below: those are a subset of the profile, and a count that matched
 * them would understate what the score is drawn from.
 */
export const BUSINESS_AGGREGATE_RATING = {
  '@type': 'AggregateRating',
  ratingValue: TRUSTPILOT_STANDING.rating,
  bestRating: 5,
  worstRating: 1,
  ratingCount: TRUSTPILOT_STANDING.reviewCount,
}

/**
 * The reviews the home page quotes, as review nodes on the business.
 *
 * Each carries the words and the star count as they stand on the network they
 * were left on, and names that network as the publisher: a review node with no
 * publisher reads as one written on this site, which is a different claim from
 * the one the page makes beside it. The publisher is read off the same registry
 * the card draws its mark from, so the organisation a crawler is told about and
 * the one a reader sees in the corner of the card are the same answer.
 *
 * There is no `itemReviewed`. These nest inside the business node, which is
 * the item, and naming it again points each node back at its own parent.
 *
 * A review from a network that collects no score carries no `reviewRating`
 * either. Facebook asks whether somebody recommends a business rather than for
 * a number out of five, and a node that answered with five would be publishing
 * a rating the reviewer never gave. Schema.org allows a review without one, so
 * the field is absent rather than filled.
 */
export const BUSINESS_REVIEWS = CLIENT_REVIEW_LIST.map(review => ({
  '@type': 'Review',
  author: { '@type': 'Person', name: review.name },
  ...(typeof review.rating === 'number' && {
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
  }),
  reviewBody: review.quote,
  publisher: { '@type': 'Organization', ...reviewSource(review.source).publisher },
}))
