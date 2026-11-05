/**
 * Whether a business sells the work the studio sells: websites, apps or
 * marketing.
 *
 * A web designer, a marketing agency or a software shop rung off the call list
 * is a competitor hearing the pitch, and the call costs the afternoon it was
 * placed in. The email pipeline already turns these away on the agency words
 * in chainwork's rules, but the call list is reached through other doors - a
 * listing with no site, and a company found off the state's filings - and the
 * filings are where most of them were getting through. On 2026-11-05 the list
 * was offering Idea Web Agency, Chisholm Digital, Synergy Core Digital,
 * Willfully Digital, Mederos Marketing Group, Dfw-Marketing Solutions, Hales
 * Market & Media, Maria Joaquina Creative Strategies, Kslugs Software
 * Solutions and Tidewater Ads, every one of them a new company with no trade
 * on its row.
 *
 * So three readings, from the surest down:
 *
 * - The name or the trade names the work outright: chainwork's agency words,
 *   and the ones its list was missing ('web' on its own, 'marketing group',
 *   'software solutions', 'social media marketing' and the rest below).
 * - The site's own address does: ideawebagency.com, smithwebdesign.com.
 * - A company off the state's filings carries no trade to say otherwise, so a
 *   looser word is enough there: 'marketing', 'software', 'advertising' or
 *   'ads' anywhere in the name - Tidewater Ads builds contractors' websites
 *   and runs their Google Ads - or a name that ends in 'Digital' or 'Media'. A
 *   listing off the map was found under a trade the studio sells to, and that
 *   trade outranks a loose word - Digital HVAC Repair is an air-conditioning
 *   firm and By George Realty's 'Technology Enhanced Marketing' is a realtor.
 *
 * Strings and pure functions only: `calls.js` reads this, and the console
 * bundles that file into the browser.
 */

import { UNSELLABLE } from 'chainwork/core/prospects/exclusions.js'
import { hostOf } from './platforms.js'

/** What a business turned away here is told it was, as the call list says it. */
export const COMPETITOR_REASON =
  'the business sells websites or marketing, the same work the studio sells'

/** chainwork's own agency rule, the one the email pipeline turns these away on. */
export const AGENCY_TERMS = Object.freeze(
  UNSELLABLE.find(rule => rule.reason.startsWith('competitor'))?.terms ?? []
)

/** Words that name the work on any listing, beside chainwork's. */
export const WORK_TERMS = Object.freeze([
  'web',
  'website',
  'websites',
  'webdesign',
  'webdev',
  'webmaster',
  'app development',
  'app developer',
  'app developers',
  'software development',
  'software developer',
  'software developers',
  'software solutions',
  'software company',
  'marketing group',
  'marketing solutions',
  'marketing services',
  'marketing company',
  'marketing consultant',
  'marketing consultants',
  'marketing consulting',
  'marketing studio',
  'marketing strategies',
  'social media marketing',
  'social media management',
  'social media agency',
  'media agency',
  'digital media',
  'digital solutions',
  'digital studio',
  'digital services',
  'digital strategies',
  'creative strategies',
  'creative studio',
  'creative studios',
  'creative marketing',
  'creative media',
  'brand studio',
  'branding studio',
  'google ads',
  'pay per click',
  'ppc',
  'lead generation',
])

/** What a site's own address carries when it is a web or marketing shop's. */
export const HOST_SIGNS = Object.freeze([
  'webdesign',
  'webdevelop',
  'websitedesign',
  'webagency',
  'websolutions',
  'webstudio',
  'digitalmarketing',
  'marketingagency',
  'seoagency',
  'seoservices',
  'socialmediamarketing',
])

/** Looser words, read only on a name with no trade beside it. */
export const FILING_WORDS = Object.freeze([
  'marketing',
  'software',
  'advertising',
  'branding',
  'ads',
])

/** A name ending in one of these, before its company words, is a filing's agency. */
export const FILING_ENDINGS = Object.freeze(['digital', 'media'])

/** The words a company name trails off in, which say nothing about the work. */
const COMPANY_WORDS = new Set([
  'llc',
  'inc',
  'co',
  'company',
  'corp',
  'corporation',
  'ltd',
  'pllc',
  'lp',
  'llp',
  'group',
  'agency',
  'solutions',
  'studio',
  'studios',
  'services',
  'the',
])

/** A value as spaced lowercase words, bounded so a term matches whole ones. */
function spaced(value) {
  return ` ${String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `
}

const named = (text, terms) => terms.some(term => text.includes(spaced(term)))

/** The last word of a name that is not one of its company words. */
function lastWord(name) {
  const words = spaced(name).trim().split(' ').filter(Boolean)
  while (words.length > 1 && COMPANY_WORDS.has(words.at(-1))) words.pop()
  return words.at(-1) ?? ''
}

/**
 * Whether a business sells websites, apps or marketing.
 *
 * @param {{ name?: string|null, trade?: string|null, website?: string|null }} prospect
 * @returns {boolean}
 */
export function isCompetitor(prospect) {
  if (!prospect) return false
  const text = `${spaced(prospect.name)}${spaced(prospect.trade)}`
  if (named(text, AGENCY_TERMS) || named(text, WORK_TERMS)) return true

  const host = String(hostOf(prospect.website) ?? '').replace(/[^a-z0-9]+/g, '')
  if (host && HOST_SIGNS.some(sign => host.includes(sign))) return true

  if (String(prospect.trade ?? '').trim()) return false
  return (
    named(spaced(prospect.name), FILING_WORDS) || FILING_ENDINGS.includes(lastWord(prospect.name))
  )
}
