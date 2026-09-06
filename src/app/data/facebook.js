/**
 * The Facebook page, in a file with nothing else in it.
 *
 * The address is two things at once - somewhere the business posts, and
 * somewhere it is recommended - so the footer of every page on both sites reads
 * it and the review registry names it as a network. Holding it once is right;
 * one address in two places is a page that moves and only one copy following it.
 * Holding it in `@data/reviews`, where it used to sit, was not.
 *
 * A module is emitted into the chunk that reaches it, whole. `@constants/navigation`
 * is in the chrome of every page, so reading this one string off the registry
 * put the registry itself on the critical path, and with it went everything any
 * other page reads out of that file: five networks with their labels, publishers
 * and profile addresses, the client quotes filed on two of them, and the whole
 * portfolio behind the town each reviewer is placed by. taylor.website publishes
 * no reviews and lists no clients, and it downloaded all of it before drawing
 * anything.
 *
 * So the constant sits alone, the way `@data/bbb` and `@data/trustpilot` each
 * hold one network's addresses. A file with one string in it has nothing to drag
 * anywhere. It is deliberately not re-exported from `@data/reviews`: reading it
 * from there compiles, renders identically, and quietly puts the registry back
 * in front of the first paint with nothing to fail.
 */
export const FACEBOOK_PAGE_URL = 'https://www.facebook.com/profile.php?id=61591005089902'
