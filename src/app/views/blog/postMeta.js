import { findSeries } from '@data/blog'

/**
 * The small line over an article's title wherever it is listed: the series it
 * belongs to, or its category where it is in none, and the day it went up.
 *
 * @param {{ series: (string | null), category: string, date: string }} post
 * @returns {string}
 */
export function postMeta(post) {
  const series = findSeries(post.series)
  return `${series ? series.name : post.category} · ${post.date}`
}
