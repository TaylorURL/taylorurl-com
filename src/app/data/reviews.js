import { PORTFOLIO_PROJECTS } from './portfolio.js'
import { BBB_EVALUATE_URL, BBB_PROFILE_URL, bbbAccredited } from './bbb.js'
import { FACEBOOK_PAGE_URL } from './facebook.js'
import { TRUSTPILOT_EVALUATE_URL, TRUSTPILOT_PROFILE_URL } from './trustpilot.js'

/**
 * The tab on the Facebook page that holds recommendations.
 *
 * The page address itself is `@data/facebook`, on its own, and the note there
 * says what it cost to keep it here: the footer reads it on every page of both
 * sites, and that one edge pulled this entire file into the bundle a visitor
 * waits on before anything is drawn. The tab is built from it rather than
 * written out again, so a page that moves takes both with it.
 */
export const FACEBOOK_REVIEWS_URL = `${FACEBOOK_PAGE_URL}&sk=reviews`

/**
 * The Yelp listing, keyed on the name its page ends in the way Trustpilot's is
 * keyed on the domain. It is somewhere reviews are read rather than somewhere
 * they are asked for: Yelp suppresses reviews that were solicited and can
 * penalize a listing for the asking, so no address for leaving one is held
 * here.
 *
 * Yelp built the listing under Houston, so the key names a city that is not the
 * one the site claims. The key is the listing's own identifier rather than a
 * statement of where the work is, and Yelp redirects it to whatever the listing
 * is renamed to, so it survives the listing being corrected. The listing is
 * unclaimed, which is why it is absent from the `sameAs` in `index.html`.
 */
export const YELP_BUSINESS = 'taylor-url-houston'
export const YELP_PROFILE_URL = `https://www.yelp.com/biz/${YELP_BUSINESS}`

/**
 * The Google listing, and the box a review is written in.
 *
 * The short link is the one the Business Profile manager issues, so it names
 * the listing by its own id. What it replaces was a listing search, and a
 * search resolves to whatever Google decides is closest: the same query run
 * from a signed-out browser returned a warehouse a few miles up the road
 * trading under a similar name, carrying a review button of its own. A link
 * that lands on the wrong listing does not fail where anybody can see it. It
 * takes the review with it.
 *
 * The two addresses are one address with `/review` on the end, which opens the
 * write box rather than the profile it sits behind.
 */
export const GOOGLE_PROFILE_URL = 'https://g.page/r/CTlYcg1CXgG7EAI'
export const GOOGLE_EVALUATE_URL = `${GOOGLE_PROFILE_URL}/review`

/**
 * Every place this business is reviewed, held once.
 *
 * The menu builds both of its columns from this, the home page draws its cards
 * and its buttons from it, and the business node names a publisher out of it,
 * so a network is described the same way wherever it appears and adding one is
 * a row here rather than an edit in four files. The order is the order a reader
 * meets them in: the accreditation first, because it is the one a buyer checks
 * to find out whether a company is real, then the platforms that hold the words.
 *
 * `reads` is where reviews can be read and `writes` is where one can be left.
 * Either may be empty, and empty means the surface draws nothing rather than
 * drawing a row that leads nowhere: Yelp has no address for leaving a review
 * because soliciting one there can cost the listing, and BBB has neither until
 * the profile is published. A network is never described in copy as missing,
 * because a reader has no use for the absence.
 *
 * `holds` is what is on the other end, in a line, for the surfaces that set one
 * under the name. `featureLine` is the same fact said the way a card says it,
 * for the one network the menu promotes out of the column onto its own panel.
 *
 * `publisher` is the organisation a review node names, which is a different
 * fact from the profile address: the address moves when a listing is renamed
 * and the organisation does not.
 *
 * BBB is the one entry whose wording is not fixed, because BBB publishes two
 * different things about a company and only one of them is a credential. Every
 * listed business has a profile carrying a rating and whatever customers filed;
 * an accredited one has additionally applied, been vetted and been issued a
 * seal. The words follow which of those is actually true, so the site cannot
 * say "accredited" over a profile BBB is publishing as unaccredited.
 */
export const REVIEW_SOURCES = [
  {
    key: 'bbb',
    label: 'BBB',
    longLabel: bbbAccredited() ? 'BBB Accredited Business' : 'Rated by BBB',
    reads: BBB_PROFILE_URL,
    writes: BBB_EVALUATE_URL,
    holds: bbbAccredited()
      ? 'The accreditation, and every review and complaint filed under it.'
      : 'The BBB rating, and every review and complaint filed under it.',
    featureLine: bbbAccredited()
      ? 'Accredited, and held to the standards that go with it.'
      : 'The rating BBB publishes, and what customers filed under it.',
    publisher: { name: 'Better Business Bureau', url: 'https://www.bbb.org' },
  },
  {
    key: 'trustpilot',
    label: 'Trustpilot',
    longLabel: 'Rated on Trustpilot',
    reads: TRUSTPILOT_PROFILE_URL,
    writes: TRUSTPILOT_EVALUATE_URL,
    holds: 'Every review clients have left, in their own words.',
    featureLine: 'Reviews from the businesses these sites were built for.',
    publisher: { name: 'Trustpilot', url: 'https://www.trustpilot.com' },
  },
  {
    key: 'google',
    label: 'Google',
    longLabel: 'Reviewed on Google',
    reads: GOOGLE_PROFILE_URL,
    writes: GOOGLE_EVALUATE_URL,
    holds: 'Ratings on the Google listing, as customers left them.',
    featureLine: 'Ratings left on the listing by people searching nearby.',
    publisher: { name: 'Google', url: 'https://www.google.com/maps' },
  },
  {
    key: 'yelp',
    label: 'Yelp',
    longLabel: 'Listed on Yelp',
    reads: YELP_PROFILE_URL,
    writes: '',
    holds: 'What clients wrote on the Yelp listing.',
    featureLine: 'What clients wrote on the Yelp listing.',
    publisher: { name: 'Yelp', url: 'https://www.yelp.com' },
  },
  {
    key: 'facebook',
    label: 'Facebook',
    longLabel: 'Recommended on Facebook',
    reads: FACEBOOK_REVIEWS_URL,
    writes: FACEBOOK_REVIEWS_URL,
    holds: 'Recommendations left on the page.',
    // Facebook asks whether somebody recommends a business rather than for a
    // score out of five, so this is the word that stands where a rating would.
    endorses: 'Recommends',
    featureLine: 'Recommendations left on the page by the people who read it.',
    publisher: { name: 'Facebook', url: 'https://www.facebook.com' },
  },
]

/**
 * One network, by the key a review names.
 *
 * @param {string} key A `REVIEW_SOURCES` key.
 * @returns {object | undefined} The network, or nothing for a key nobody holds.
 */
export function reviewSource(key) {
  return REVIEW_SOURCES.find(source => source.key === key)
}

/**
 * The networks a reader can be sent to, in registry order.
 *
 * @param {'reads' | 'writes'} link Which address has to be there.
 * @returns {object[]} The networks carrying one.
 */
export function reviewSourcesWith(link) {
  return REVIEW_SOURCES.filter(source => source[link])
}

/**
 * The reviews clients left, held once.
 *
 * The home page shows them and the outreach message quotes them, and a review
 * edited in one place and not the other is a quote attributed to somebody who
 * did not write it. So both read this file, and neither keeps a copy.
 *
 * Each entry is keyed by the site the reviewer is talking about, which is the
 * same key the portfolio uses, so a card can put the words beside the work
 * without a second mapping to keep in step. `name` is the reviewer's display
 * name on the network rather than a legal name, because that is the name a
 * visitor checking the profile will find.
 *
 * `source` is the network the words were published on, keyed into
 * `REVIEW_SOURCES`. The card draws that network's rating in that network's own
 * form and names it under the quote, and the business node cites it as the
 * publisher, so a reader and a crawler are told the same thing about where to
 * go and check.
 *
 * Nothing is written here that was not published there. A quote that cannot be
 * found on the profile is worse than no quote at all, and the mark beside it
 * says it can be. `rating` is the star count the reviewer left, which the card
 * draws and the business node publishes, so the tiles on the page and the
 * number a crawler reads are the same fact rather than two.
 *
 * `rating` is absent where the network does not collect one. Facebook asks
 * whether somebody recommends a business, not how many stars out of five, so a
 * recommendation carries no number and neither the card nor the business node
 * invents one for it. Five stars would be the easy fill and it would be a
 * rating nobody left.
 *
 * The order is the order the page lays them out, and it alternates networks on
 * purpose: three cards to a row, and a row of one platform's colours says the
 * proof came from one place. Adding a review means deciding where it sits.
 */
export const CLIENT_REVIEWS = {
  'baytowngokarts.com': {
    name: 'Bryan Venegas',
    business: 'Speedway 146',
    quote:
      'Taylor URL has been very professional and on time with all of our company website needs.',
    rating: 5,
    source: 'trustpilot',
  },
  'djrxexcellence.com': {
    name: 'Dylan Jordan',
    business: 'Dylan Jordan Real Estate',
    quote:
      'Exceptional performance and development when it comes to the quality of these websites. ' +
      'Will definitely be taking care of any and all of my website needs from here on out',
    rating: 5,
    source: 'google',
  },
  'ccscaleservices.com': {
    name: 'cmy',
    business: 'Compound Industrial Scale Services',
    quote:
      "Trent did an amazing job setting up our website he has also been very helpful with getting the company setup on goggle. If you're looking for someone that pays attention to detail then you have found him.",
    rating: 5,
    source: 'trustpilot',
  },
  'rootriseholdings.com': {
    name: 'Pedro',
    business: 'RootRise Holdings',
    quote:
      'Trenton did an amazing job with my project. He honestly exceeded my expectations and took ' +
      'my original idea much further than I imagined. I really appreciate the time, effort, ' +
      'communication, and attention he put into everything. I\u2019m very grateful for the work ' +
      'he\u2019s done and I definitely recommend him.',
    source: 'facebook',
  },
  'tiretracker.app': {
    name: 'TireTracker',
    business: 'TireTracker',
    quote:
      'Brought my website to the level and also gives you tips along the way. He responds quickly to issues and doesnt rush thing.',
    rating: 5,
    source: 'trustpilot',
  },
}

/**
 * Where a reviewer trades, read from the portfolio entry for their site.
 *
 * A local business is placed by its city, which is the fact a reader nearby is
 * weighing. A studio product has no city to give, so it is placed by what it
 * does rather than being handed one it does not have.
 *
 * @param {string} displayUrl The site the review is about.
 * @returns {string} A city, or the sector for something with no city.
 */
export function reviewPlace(displayUrl) {
  const project = PORTFOLIO_PROJECTS.find(entry => entry.displayUrl === displayUrl)
  const town = project?.town ?? project?.location?.split(',')[0].trim()
  if (town) return town
  return String(project?.tagline ?? '')
    .split('·')[0]
    .trim()
}

/**
 * The reviews in the order the home page shows them.
 *
 * Annotated pure, for the reason the note above `CLIENT_PROJECTS` in
 * `@data/portfolio` gives: a top-level call the bundler cannot see through makes
 * the file it stands in un-droppable, and a file that cannot be dropped is a
 * file every page of both sites carries. This one places each reviewer by
 * looking their site up in the portfolio, which is also how the client list came
 * along behind the quotes. It reads two literals in this project and returns a
 * new array; nothing outside it can tell that it ran.
 */
export const CLIENT_REVIEW_LIST = /*#__PURE__*/ Object.entries(CLIENT_REVIEWS).map(
  ([displayUrl, review]) => ({
    displayUrl,
    ...review,
    place: reviewPlace(displayUrl),
  })
)

/**
 * The networks the quoted reviews actually came from, in registry order.
 * Annotated for the reason the one above it is.
 */
export const QUOTED_SOURCES = /*#__PURE__*/ REVIEW_SOURCES.filter(source =>
  CLIENT_REVIEW_LIST.some(review => review.source === source.key)
)

/**
 * The review about one site, in the shape the card draws.
 *
 * A case study asks for the review of its own build, and most builds do not
 * have one. Nothing stands in for the ones that do not: an entry with no review
 * shows no review, because the alternative is a page implying somebody said
 * something about work they have never been asked about.
 *
 * It reads the list rather than the map so a card built from this and a card
 * built from the home page's row are the same object, `place` included.
 *
 * @param {string} displayUrl The site the review would be about.
 * @returns {object | null} The review, or null when nobody has left one.
 */
export function reviewFor(displayUrl) {
  return CLIENT_REVIEW_LIST.find(review => review.displayUrl === displayUrl) ?? null
}

/**
 * Where a reviewer's logo is committed, given the site it belongs to.
 *
 * The capture script writes to this path and the card reads from it, so a file
 * cannot land somewhere the page is not looking.
 *
 * @param {string} displayUrl The site the review is about.
 * @returns {string} Path from the site root.
 */
export function reviewLogoSrc(displayUrl) {
  return `/images/reviews/${displayUrl.replace(/[^a-z0-9]+/gi, '-')}.png`
}

export { BBB_EVALUATE_URL, BBB_PROFILE_URL, TRUSTPILOT_EVALUATE_URL, TRUSTPILOT_PROFILE_URL }
