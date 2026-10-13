/**
 * The Google listing, and the id a program reaches it by.
 *
 * The short link is the one the Business Profile manager issues, so it names
 * the listing by its own id. What it replaces was a listing search, and a
 * search resolves to whatever Google decides is closest: the same query run
 * from a signed-out browser returned a warehouse a few miles up the road
 * trading under a similar name, carrying a review button of its own. A link
 * that lands on the wrong listing does not fail where anybody can see it. It
 * takes the review with it.
 *
 * The place id is the same listing as the Places API knows it, and it is held
 * here rather than looked up for the same reason. The listing is a service-area
 * business with no street address on it, so a Places text search for the
 * studio in Baytown never returns it: it answers with the agencies and print
 * shops that do have an address in town, and a lookup that took the first of
 * them would read somebody else's rating. The id was taken from the listing
 * the short link opens instead, and `check-review-standings` holds the two
 * together by the one number both of them carry.
 *
 * Neither is a secret. The short link is on every page of the site, and a
 * place id is only a name for a public listing; reading anything through it
 * takes a key, which stays in the environment.
 */

/** The listing, as the Business Profile manager links it. */
export const GOOGLE_PROFILE_URL = 'https://g.page/r/CTlYcg1CXgG7EAI'

/** The box a review is written in, which is the same address with `/review` on the end. */
export const GOOGLE_EVALUATE_URL = `${GOOGLE_PROFILE_URL}/review`

/** The same listing as the Places API names it. */
export const GOOGLE_PLACE_ID = 'ChIJsVuuSjvcFWEROVhyDUJeAbs'
