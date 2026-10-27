import { CLIENT_PROJECTS, PORTFOLIO_AVERAGES } from '@data/portfolio'
import { CLIENT_REVIEW_LIST, reviewSource } from '@data/reputation/reviews'
import { BIO_NAME, BIO_TITLE } from '@lib/mail/bio.js'

/**
 * What the home page board says, read from the records that already hold it.
 *
 * Kept apart from the components in `./parts` so that file exports nothing but
 * components, which is what lets the dev server swap it in place on an edit.
 *
 * The voice is Trenton's, in the first person. None of it announces how many
 * people run the business, and none of it counts the clients. The page shows
 * who answers instead: his photo and name where a reader decides to get in
 * touch, whether he is available, a review that calls him by name, and a change
 * made by text.
 */

/** Who a reader is dealing with, as the bio every message already carries says it. */
export const PERSON = { name: BIO_NAME, title: BIO_TITLE }

/**
 * The client sites' average mobile PageSpeed score, read off the portfolio for
 * the reason `@data/pages/about` gives: a literal here would go on quoting a
 * score the portfolio no longer holds.
 */
export const MOBILE_SPEED = PORTFOLIO_AVERAGES.mobile

/** What the monthly pays for, as the FAQ lists it. */
export const MONTHLY = [
  'Hosting and SSL',
  'Daily backups',
  'Security and software updates',
  'Search work every month',
  'Changes whenever you need them',
]

/** A client site by the hostname the portfolio files it under. */
export function clientSite(host) {
  return CLIENT_PROJECTS.find(project => project.displayUrl === host)
}

/** Where a client site leads: its case study if it has one, the portfolio if not. */
export function workHref(project) {
  return project.hasStudy ? `/portfolio/${project.slug}` : '/portfolio'
}

/** The trade, as the first half of the portfolio's tagline names it. */
export function tradeOf(project) {
  return project.tagline.split('·')[0].trim()
}

/**
 * The town, or the first part of the location where no town is recorded. A
 * client the portfolio places nowhere gets a dash rather than a guess.
 */
export function townOf(project) {
  return project.town ?? project.location?.split(',')[0].trim() ?? '—'
}

/** A client's review by the site it was left about, with the network named. */
export function clientReview(host) {
  const review = CLIENT_REVIEW_LIST.find(entry => entry.displayUrl === host)
  return { ...review, network: reviewSource(review.source)?.label ?? '' }
}

/**
 * The opening sentences of a quote. A reader who skims takes one or two
 * sentences of a review, and cutting at the reviewer's own full stops keeps
 * the words theirs.
 */
export function leadOf(quote, count = 1) {
  const sentences = quote.match(/[^.!?]+[.!?]+(?=\s|$)/g)
  return sentences ? sentences.slice(0, count).join('').trim() : quote
}
