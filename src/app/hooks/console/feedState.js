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
 * A feed's filters as the query string that asks for them, which is also the
 * key what comes back is filed under.
 *
 * The string rather than the object is the identity of a read: a new filter or
 * a new page is a new request, but an object literal rebuilt on every render
 * is not. A filter left empty is left off, so it asks the same question as one
 * that was never set.
 *
 * @param {Record<string, unknown>|null|undefined} filters
 * @returns {string}
 */
export function queryOf(filters) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters || {})) {
    if (value) search.set(key, String(value))
  }
  return search.toString()
}

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
