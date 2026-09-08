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

/**
 * What a section should draw: the answer to the question being asked, the last
 * answer while that one is on its way, and which of those two it is.
 *
 * `answerFor` above says a payload filed under one question is not the answer
 * to another, and that is right. What it does not say is that the rows should
 * come off the screen while the right answer is fetched - and drawing "not the
 * answer" as "no answer" is what made every filter, every sort, every page and
 * every recorded call replace a correct table with placeholder bars for as long
 * as the endpoint took.
 *
 * So there are three states rather than two. `loading` is the first read of
 * all, where placeholders are the truth because there is nothing to keep.
 * `behind` is every read after it, where the rows on screen are a question out
 * of date and stay up saying so. And when neither is set, what is on screen is
 * the answer to what was asked.
 *
 * @param {{key: string|null, value: unknown}} held what landed, and for what
 * @param {{key: string|null, value: unknown}} failed what refused, and for what
 * @param {string} key the query being asked now
 */
export function feedShows(held, failed, key) {
  const data = answerFor(held, key)
  const error = answerFor(failed, key)
  const retained = held.value
  const behind = !data && !error && Boolean(retained)
  return {
    data,
    error,
    retained,
    loading: !data && !error && !retained,
    behind,
    // The rows to put on screen: this question's answer, or the last one while
    // this question is being read.
    shown: data ?? (behind ? retained : null),
  }
}
