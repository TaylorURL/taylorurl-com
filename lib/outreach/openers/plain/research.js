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
import { spokenName } from '../../previews.js'
import { bareHost } from './shared.js'

/** Fewer reviews than this and a rating is not worth naming. */
const REVIEWS_WORTH_NAMING = 5

/** A rating this high or better is one a letter can praise. */
const PRAISED_FROM = 4.3

/** The business as a person says it: no company form, no town in brackets, no shouting. */
export function plainName(name) {
  return spokenName(name).slice(0, 60) || 'your business'
}

/**
 * A stable pick from a few ways of saying the same thing, chosen by the
 * business's name, so two businesses on the same day are not sent the same
 * sentences while one business always reads the same letter.
 */
export function pick(seed, options) {
  let hash = 0
  for (const char of String(seed ?? '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return options[hash % options.length]
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

/** A short, offhand line about the reviews, where they are worth mentioning, or null. */
export function reviewsLine(prospect) {
  const reviews = reviewsOf(prospect)
  if (!reviews || reviews.rating < PRAISED_FROM) return null
  return pick(prospect?.name, [
    `${reviews.rating} stars over ${reviews.count} reviews is no joke, people clearly like you.`,
    `${reviews.count} reviews at ${reviews.rating} stars says a lot about the work.`,
    `Your reviews are great by the way, ${reviews.rating} stars from ${reviews.count} people.`,
  ])
}

/** How long the main part of the page took on a phone, in seconds, or null. */
export function phoneSeconds(prospect) {
  const ms = prospect?.audit_raw?.metrics?.largest_contentful_paint?.numeric
  if (typeof ms !== 'number' || !(ms > 0)) return null
  const seconds = ms / 1000
  return seconds >= 5 ? Math.round(seconds) : Math.round(seconds * 10) / 10
}

/**
 * The one thing noticed about the business's web presence, said the way a
 * person would mention it in passing, or null where nothing was measured.
 */
export function siteFinding(prospect) {
  const seed = prospect?.name
  if (hasNoSite(prospect)) {
    return pick(seed, [
      `I noticed you don't have a website yet, just the Google listing.`,
      `Couldn't find a website for you, only the Google listing.`,
    ])
  }
  const host = bareHost(prospect?.website) ?? 'your site'
  const seconds = phoneSeconds(prospect)
  if (seconds !== null && seconds >= 3) {
    return pick(seed, [
      `I pulled up ${host} on my phone and it took about ${seconds} seconds to load. Most people give up around 3.`,
      `${host} took about ${seconds} seconds to load on my phone, which is long enough for people to back out and call someone else.`,
    ])
  }
  if (typeof prospect?.seo_score === 'number' && prospect.seo_score < 90) {
    return `Your site looks fine, but Google's own checker gives it ${prospect.seo_score} out of 100 on the stuff it uses to decide who shows up first.`
  }
  if (seconds !== null) {
    return `${host} loads fast, so the bones are there. It's more about getting the people who land on it to pick up the phone.`
  }
  return null
}
