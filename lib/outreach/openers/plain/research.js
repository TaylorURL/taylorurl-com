/**
 * The lines that show a business it was looked at, read off its own row.
 *
 * A letter that could have gone to anybody is read as one that went to
 * everybody. So each cold letter names what was actually found about the one
 * business it goes to: how its customers rate it, how its own site behaves on
 * a phone, what a searcher in its town is looking for. Every line here is
 * built from a figure the row holds, and where the row holds nothing a line
 * says nothing rather than something that might not be true.
 */

import { segmentOf } from '../../segments.js'
import { bareHost } from './shared.js'

/** Fewer reviews than this and a rating is not worth naming. */
const REVIEWS_WORTH_NAMING = 5

/** A rating this high or better is one a letter can praise. */
const PRAISED_FROM = 4.3

/** The business as a person says it, without the company form on the end. */
export function plainName(name) {
  return (
    String(name ?? '')
      .replace(
        /,?\s+(?:LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Ltd\.?|LP|L\.P\.|PLLC)\.?$/i,
        ''
      )
      .trim()
      .slice(0, 60) || 'your business'
  )
}

/** Whether the row says the business has no website of its own. */
export const hasNoSite = prospect => segmentOf(prospect ?? {}) === 'no-site'

/** The rating and count, where there are enough reviews to say them. */
export function reviewsOf(prospect) {
  const rating = Number(prospect?.rating)
  const count = Number(prospect?.rating_count)
  if (!(rating > 0) || !(count >= REVIEWS_WORTH_NAMING)) return null
  return { rating: Math.round(rating * 10) / 10, count }
}

/**
 * The sentence about what customers say, where it is something to be proud
 * of, or null.
 */
export function reviewsLine(prospect) {
  const reviews = reviewsOf(prospect)
  if (!reviews || reviews.rating < PRAISED_FROM) return null
  return `${reviews.rating} stars across ${reviews.count} Google reviews doesn't happen by accident. Your customers clearly trust you.`
}

/** How long the main part of the page took on a phone, in seconds, or null. */
export function phoneSeconds(prospect) {
  const ms = prospect?.audit_raw?.metrics?.largest_contentful_paint?.numeric
  if (typeof ms !== 'number' || !(ms > 0)) return null
  const seconds = ms / 1000
  return seconds >= 5 ? Math.round(seconds) : Math.round(seconds * 10) / 10
}

/** What a searcher in this business's town types, as "roofer Baytown", or null. */
export function searchOf(prospect) {
  const words = [prospect?.trade, prospect?.town].filter(Boolean).join(' ').trim()
  return words || null
}

/**
 * The one finding about the business's web presence, in the words a person
 * would use, or null where there is nothing measured to say.
 */
export function siteFinding(prospect) {
  const name = plainName(prospect?.name)
  const search = searchOf(prospect)
  if (hasNoSite(prospect)) {
    return search
      ? `When I searched "${search}", ${name} came up on Google Maps, but there's no website behind it. The businesses next to you on that list that do have one are the ones getting the click.`
      : `${name} shows up on Google Maps, but there's no website behind the listing, and that's usually where a customer goes to decide who to call.`
  }
  const host = bareHost(prospect?.website) ?? 'your site'
  const seconds = phoneSeconds(prospect)
  if (seconds !== null && seconds >= 3) {
    return `When I pulled up ${host} on my phone, it took ${seconds} seconds before the main part of the page showed. Most people give up around three, so some of the customers who already found you are leaving before they see what you do.`
  }
  if (typeof prospect?.seo_score === 'number' && prospect.seo_score < 90) {
    return `I also ran ${host} through Google's own checks. It scores ${prospect.seo_score} out of 100 on the basics Google looks at before deciding who to show, which is a fixable gap.`
  }
  if (seconds !== null) {
    return `I pulled up ${host} on my phone too. It loads quickly, so the foundation is there. What it isn't doing yet is turning the people who land on it into calls.`
  }
  return null
}
