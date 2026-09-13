/**
 * The business node, read back the way a crawler reads it.
 *
 * The rating is the one part of this node nobody types: it is merged in at
 * build time from the committed Trustpilot standing, so the failure worth
 * catching is a page that still validates while carrying a score, a count or a
 * quote the profile does not support. Each is checked against the file it is
 * supposed to have come from rather than against a number written here.
 *
 * The identity half of the node is held to the opposite rule. Address, area
 * served and the profiles the business vouches for are settled facts, and the
 * transform has no business touching any of them, so they are compared before
 * and after and any difference is a failure.
 *
 * Nothing here touches the network, so this runs anywhere.
 *
 *   npm run check:review-schema
 */
import { readFileSync } from 'node:fs'
import { withBusinessRating } from '../../vite/review-schema-plugin.js'
import { BUSINESS_ID } from '../../src/app/constants/seo.js'
import { CLIENT_REVIEWS, reviewSource } from '../../src/app/data/reputation/reviews.js'
import { TRUSTPILOT_STANDING } from '../../src/app/data/reputation/trustpilot-standing.js'
import { withSiteHead } from '../../vite/site-head-plugin.js'
import { fail, finish, is } from '../harness/checks.js'

const LD_JSON = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g

/** Every JSON-LD node in a page, in the order the page carries them. */
function nodesIn(html) {
  return [...html.matchAll(LD_JSON)].map(([, body]) => JSON.parse(body))
}

// index.html is a template, not a document: it carries %SITE_X% tokens and
// <!--site:flag--> regions that the head plugin resolves before Vite ever parses
// it, and one of those fences sits inside a JSON-LD object, so the raw file is
// not valid JSON by design. What ships is the transform's output, so that is
// what gets checked - the same reason this file already asserts against
// withBusinessRating rather than against the source.
const page = withSiteHead(readFileSync(new URL('../../index.html', import.meta.url), 'utf8'))
const before = nodesIn(page).find(node => node['@id'] === BUSINESS_ID)
if (!before) {
  fail(`index.html carries no JSON-LD node with @id ${BUSINESS_ID}`)
  process.exit(1)
}

const served = nodesIn(withBusinessRating(page))
const business = served.filter(node => node['@id'] === BUSINESS_ID)
is('the built page', business.length, 1)
const node = business[0]

// The identity the node published before the rating was merged in, unchanged.
// A transform that reworded a city or dropped a profile would be a claim the
// business did not make, and it would pass every check about the rating.
for (const [key, value] of Object.entries(before)) {
  const after = JSON.stringify(node[key])
  if (after !== JSON.stringify(value)) fail(`the transform changed ${key}: now ${after}`)
}

// The Yelp listing is unclaimed and filed under a city the business does not
// trade in, so it is left out on purpose rather than by oversight. `sameAs` is
// the list the business vouches for.
const vouchedFor = JSON.stringify(node.sameAs ?? [])
if (vouchedFor.includes('yelp.com')) {
  fail('sameAs names the Yelp listing, which is unclaimed')
}

const rating = node.aggregateRating
if (!rating) {
  fail('the business node carries no aggregateRating')
} else {
  is('aggregateRating: @type', rating['@type'], 'AggregateRating')
  is('aggregateRating: ratingValue', rating.ratingValue, TRUSTPILOT_STANDING.rating)
  is('aggregateRating: ratingCount', rating.ratingCount, TRUSTPILOT_STANDING.reviewCount)
  is('aggregateRating: bestRating', rating.bestRating, 5)
  is('aggregateRating: worstRating', rating.worstRating, 1)

  // Google takes either count, and takes neither as a reason to ignore the
  // node, so the one that is published has to be a whole number above zero.
  if (!Number.isInteger(rating.ratingCount) || rating.ratingCount < 1) {
    fail(`aggregateRating: ratingCount ${rating.ratingCount} is not a count`)
  }
  if (!(rating.ratingValue > 0 && rating.ratingValue <= rating.bestRating)) {
    fail(`aggregateRating: ratingValue ${rating.ratingValue} is outside the scale`)
  }
}

// The network the committed standing was read from, which is the network the
// aggregateRating on the node belongs to.
const AGGREGATE_SOURCE = 'trustpilot'

const held = Object.values(CLIENT_REVIEWS)
const reviews = node.review ?? []
is('the review nodes', reviews.length, held.length)

// The aggregate is one network's score, and only that network's reviews are
// drawn from it. Quoting fewer of them than it counts is honest, because it
// keeps counting the ones that are not here. Counting reviews left somewhere
// else against it is not, and it is the failure this turns into once the page
// quotes more than one network.
const inAggregate = held.filter(review => review.source === AGGREGATE_SOURCE).length
if (rating && inAggregate > rating.ratingCount) {
  fail(
    `${inAggregate} ${AGGREGATE_SOURCE} reviews published against a count of ${rating.ratingCount}`
  )
}

reviews.forEach((review, index) => {
  const source = held[index]
  const where = `review ${index + 1} (${source?.name ?? 'unheld'})`
  is(`${where}: @type`, review['@type'], 'Review')
  is(`${where}: author`, review.author?.name, source?.name)
  is(`${where}: author type`, review.author?.['@type'], 'Person')

  // Word for word, or it is a quote attributed to somebody who did not write it.
  is(`${where}: reviewBody`, review.reviewBody, source?.quote)

  // A network that collects no score publishes no rating. Facebook asks for a
  // recommendation rather than a number, and a node carrying five stars for one
  // would be a rating the reviewer never left.
  const stars = review.reviewRating
  if (typeof source?.rating === 'number') {
    is(`${where}: reviewRating type`, stars?.['@type'], 'Rating')
    is(`${where}: ratingValue`, stars?.ratingValue, source.rating)
    is(`${where}: bestRating`, stars?.bestRating, 5)
    is(`${where}: worstRating`, stars?.worstRating, 1)
    if (!(stars?.ratingValue >= 1 && stars.ratingValue <= 5)) {
      fail(`${where}: ratingValue ${stars?.ratingValue} is outside the five-star scale`)
    }
  } else if (stars) {
    fail(`${where}: publishes a rating for a review that was left without one`)
  }

  // Where the review was written, read off the same registry the card draws
  // its mark from. Without it the node reads as a review left on this site,
  // which is not where any of these were published, and hardcoding one network
  // here is how a Google review ends up published as a Trustpilot one.
  const network = reviewSource(source?.source)
  if (!network) fail(`${where}: names a network no registry entry holds`)
  is(`${where}: publisher`, review.publisher?.name, network?.publisher.name)
  is(`${where}: publisher url`, review.publisher?.url, network?.publisher.url)

  // The item is the node this sits inside. Naming it again points the review
  // back at its own parent.
  if (review.itemReviewed) fail(`${where}: names an itemReviewed inside the item it reviews`)
})

// Every held review needs a star count, or the node it produces carries a
// rating of nothing and Google drops the review rather than the field.
for (const [displayUrl, review] of Object.entries(CLIENT_REVIEWS)) {
  // Either the reviewer left a score, or the network never asked for one and
  // says so by naming the word it uses instead. A review with neither is an
  // entry somebody started and did not finish.
  if (!Number.isFinite(review.rating) && !reviewSource(review.source)?.endorses) {
    fail(`${displayUrl}: the held review has no rating and its network collects one`)
  }
  if (!review.quote?.trim()) fail(`${displayUrl}: the held review has no quote`)
  if (!review.name?.trim()) fail(`${displayUrl}: the held review has no author`)
  if (!reviewSource(review.source)) {
    fail(`${displayUrl}: the held review names no network the registry holds`)
  }
}

// The card draws the same star count the node publishes. Two sources for one
// claim is how a page ends up showing five stars beside a node saying four.
const card = readFileSync(
  new URL('../../src/app/components/reviews/ClientTestimonialCard.jsx', import.meta.url),
  'utf8'
)
if (!/<ReviewStars\s+rating=\{review\.rating\}\s+source=\{review\.source\}/.test(card)) {
  fail('the testimonial card draws its stars from something other than the review it shows')
}
// A card that drew stars unconditionally would draw five of them for a
// recommendation, since that is what the component falls back to with no rating
// passed. The branch is the thing that stops it.
if (!/typeof review\.rating === 'number' \?/.test(card)) {
  fail('the testimonial card draws stars without first checking the review carries a rating')
}

// One card, drawn by the rail on the home page and by the case study of the
// build the review is about. A second copy is what puts the same quote on the
// site twice with two different star counts, which is the state the check above
// cannot see. The home page is checked through the rail rather than directly,
// because the rail is what holds the cards.
const home = readFileSync(
  new URL('../../src/app/views/home/TestimonialsSection.jsx', import.meta.url),
  'utf8'
)
if (!/<ReviewCarousel\s+reviews=\{CLIENT_REVIEW_LIST\}/.test(home)) {
  fail('the home page shows something other than every held review')
}
for (const page of ['components/reviews/ReviewCarousel.jsx', 'views/portfolio/CaseStudy.jsx']) {
  const source = readFileSync(new URL(`../../src/app/${page}`, import.meta.url), 'utf8')
  if (
    !/import ClientTestimonialCard from '@components\/reviews\/ClientTestimonialCard'/.test(source)
  ) {
    fail(`${page}: draws a review from a card of its own rather than the shared one`)
  }
  if (/<(Trustpilot|Review)Stars/.test(source)) {
    fail(`${page}: draws review stars itself rather than through the shared card`)
  }
}

// A page with no business node in it is a build that must stop rather than one
// that ships an unscored node nobody looks at again.
let refused = false
try {
  withBusinessRating('<html><head></head><body></body></html>')
} catch {
  refused = true
}
if (!refused) fail('the transform accepted a page with no business node')

await finish()

console.log(
  `Business node publishes ${rating.ratingValue}/5 from ${rating.ratingCount} ratings ` +
    `and ${reviews.length} reviews, each word for word from the profile`
)
