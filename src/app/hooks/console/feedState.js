/**
 * What a feed is holding, and whether it answers the question being asked.
 *
 * A console feed re-reads whenever the question changes - a different window, a
 * different site, a different filter or page - and the payload from the last
 * question is not a partial answer to this one. Holding the two apart is the
 * whole of it: a payload is filed under the query that produced it, and it
 * reads back as nothing until the query it was filed under is the query being
 * asked.
 *
 * Without this a feed reports itself as loaded the moment anything has ever
 * landed, and the section draws last week's figures, or a table of zeros
 * assembled from defaults, and fills them in when the real read arrives.
 */

/** Nothing held, under a query nothing can match. */
export const NOTHING_HELD = { key: null, value: null }

/**
 * The held value if it answers this query, and null otherwise.
 *
 * Null is what makes a feed report itself as loading again, so this is the one
 * place the rule lives: every console feed reads its payload and its failure
 * back through here.
 *
 * @param {{key: string|null, value: unknown}} held - what came back, and for what
 * @param {string} key - the query being asked now
 * @returns {unknown} the value, or null if it belongs to a different question
 */
export function answerFor(held, key) {
  return held.key === key ? held.value : null
}
