/**
 * Which scored businesses the Call List actually offers, in what order, and
 * the plain words for why each one is on it.
 *
 * The order is `callScore.js`. The rules here are older, and each is a failure
 * the list has already made. Of the first 31 calls placed off the review
 * ranking that came before the scores, 12 were marked Bad Lead, and 10 of
 * those 12 were Google listings with no reviews at all - a chair renter's own
 * mobile, a home stylist, a listing nobody runs. The two wrong numbers were a
 * city park on the county's 311 line and a shopping mall's directory, both
 * with thousands of reviews filed under a small trade.
 *
 * So the list drops, before anybody sees it:
 *
 * - a business already called, unless a call back on it is due (those lead the
 *   list from their own read) or its last call reached a front desk (those
 *   wait at the foot of the list for the owner);
 * - any listing whose number has been called under another listing;
 * - anything Google says is closed;
 * - a Google listing with no reviews at all - but not a new company, which was
 *   found off the state's filings and has no Google listing to be reviewed on;
 * - a chain or franchise: the same business name, read without the agent or
 *   branch after a dash or a store number, on three or more listings in two or
 *   more towns (Farmers Insurance, State Farm, Texas Farm Bureau, and the lead
 *   networks that file one name in every town);
 * - a number shared by three or more listings under different names, which is
 *   a head office, a city department or a lead network rather than an owner;
 * - a listing with twenty times the reviews its trade normally has, read with
 *   the reviews smoothed - a mall, a park, a flea market or a chain filed under
 *   a small trade;
 * - a number that is not a full ten-digit number;
 * - and a second listing of a number already on the list.
 *
 * Pure: the endpoint reads the rows and the index, and this decides.
 */

import { PHONE_ONLY_REASON, CALL_FIRST_REASON } from '../../new-business/mirror.js'
import { hostOf, platformName } from './platforms.js'
import { engagedWords } from './engaged.js'
import { isOperating } from './youth.js'
import { FRONT_DESK, isNewBusiness, pullOf, reviewsOf } from './calls.js'
import { LOCATIONS_STAFFED, OFFICERS_STAFFED, siteOf } from './callScore.js'
import { INDUSTRY_LABELS } from './companies.js'

/** How many listings one name has to be on before it reads as a chain. */
export const CHAIN_LISTINGS = 3
/** And in how many different towns. */
export const CHAIN_TOWNS = 2
/** How many listings one number has to be on before it is not an owner's line. */
export const SHARED_NUMBER_LISTINGS = 3
/** Reviews against the trade, smoothed, past which a listing is not a small business. */
export const OUTLIER_PULL = 20
/** Listings with a review count a trade needs before its middle count is read. */
export const MEDIAN_LISTINGS = 8

/** Numbers that are a placeholder rather than a line: the 32-bit integer ceiling, written into a phone column. */
const PLACEHOLDER_NUMBERS = new Set(['2147483647', '2147483648'])

/** A brand shorter than this is a word, not a name, and is never read as a chain. */
const BRAND_MIN = 4

/**
 * A number as its ten digits, or null where it is not a whole US number.
 *
 * @param {string|null} phone
 * @returns {string|null}
 */
export function phoneKey(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return ten.length === 10 ? ten : null
}

/** Ten digits as a person writes them: (281) 862-9968. */
export function spokenNumber(ten) {
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

/**
 * A business name as the brand it trades under, as a key.
 *
 * What comes after a spaced dash, bar or colon is the agent or the branch
 * ("Farmers Insurance - Joseph Pugh"), and a store number on the end is the
 * branch too ("Alvarez Tire Repair # 2"). Everything that is not a letter or a
 * digit goes, so "RE/MAX" and "Re Max" are one brand.
 *
 * @param {string|null} name
 * @returns {string}
 */
export function brandOf(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\s+[-–—|:]\s+.*$/, '')
    .replace(/\s*(#|no\.?|number)\s*\d+\s*$/, '')
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Every listing on the table, read by brand and by number, so a candidate can
 * be asked how many others share either; and every number a call has gone to,
 * with the businesses it was called under.
 *
 * @param {Array<{name: string, phone: string, town: string}>} listings
 * @param {Array<{phone: string, prospect_id?: string}>} called Every call on record.
 */
export function indexOf(listings, called = []) {
  const brands = new Map()
  const numbers = new Map()
  for (const one of listings) {
    const brand = brandOf(one?.name)
    if (brand.length >= BRAND_MIN) {
      const held = brands.get(brand) ?? { listings: 0, towns: new Set() }
      held.listings += 1
      if (one?.town) held.towns.add(String(one.town).toLowerCase())
      brands.set(brand, held)
    }
    const number = phoneKey(one?.phone)
    if (number) {
      const held = numbers.get(number) ?? { listings: 0, names: new Set() }
      held.listings += 1
      held.names.add(brand)
      numbers.set(number, held)
    }
  }
  const rung = new Map()
  for (const one of called) {
    const number = phoneKey(one?.phone)
    if (!number) continue
    if (!rung.has(number)) rung.set(number, new Set())
    rung.get(number).add(one?.prospect_id ?? null)
  }
  return { brands, numbers, rung }
}

/**
 * The middle review count for each trade, read across the businesses on offer
 * where a trade has enough of them to have a middle. It is what a listing far
 * busier than its trade is measured against.
 *
 * @param {object[]} rows
 * @returns {Map<string, number>}
 */
export function tradeMedians(rows) {
  const counts = new Map()
  for (const row of rows) {
    const reviews = reviewsOf(row)
    if (!row?.trade || reviews === null) continue
    if (!counts.has(row.trade)) counts.set(row.trade, [])
    counts.get(row.trade).push(reviews)
  }
  const medians = new Map()
  for (const [trade, held] of counts) {
    if (held.length < MEDIAN_LISTINGS) continue
    const sorted = held.sort((one, two) => one - two)
    const middle = Math.floor(sorted.length / 2)
    medians.set(
      trade,
      sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    )
  }
  return medians
}

/**
 * Whether the newest call to a business reached its front desk, which is the
 * one call that leaves it on the list: the owner has not been spoken to yet.
 * `calls` is newest first.
 */
export function atFrontDesk(row) {
  return (row?.calls ?? [])[0]?.outcome === FRONT_DESK
}

/**
 * Why a business is not offered, or null where it is.
 *
 * @param {object} row A business carrying its listing columns, `calls` newest
 *   first, and `trade_median` where its trade has one.
 * @param {ReturnType<typeof indexOf>} index
 * @returns {string|null}
 */
export function droppedFor(row, index) {
  if ((row?.calls ?? []).length && !atFrontDesk(row)) return 'already called'
  if (!isOperating(row)) return 'closed'
  const number = phoneKey(row?.phone)
  if (!number || PLACEHOLDER_NUMBERS.has(number)) return 'not a full phone number'
  const callers = index.rung.get(number)
  if (callers && [...callers].some(id => id !== row?.id)) {
    return 'number already called under another listing'
  }
  if (!isNewBusiness(row) && reviewsOf(row) === 0) return 'no reviews on Google'
  const shared = index.numbers.get(number)
  if (shared && shared.listings >= SHARED_NUMBER_LISTINGS && shared.names.size >= 2) {
    return 'number shared by several businesses'
  }
  const brand = index.brands.get(brandOf(row?.name))
  if (brand && brand.listings >= CHAIN_LISTINGS && brand.towns.size >= CHAIN_TOWNS) {
    return 'chain or franchise'
  }
  const pull = pullOf(row, row?.trade_median ?? null)
  if (pull !== null && pull >= OUTLIER_PULL) return 'far more reviews than its trade'
  return null
}

/**
 * The rows that survive, in the order they came, with a second listing of a
 * number already offered dropped. Handed the list in its order, so it is the
 * better-placed listing of a number that stays.
 *
 * @param {object[]} rows
 * @param {ReturnType<typeof indexOf>} index
 * @param {Set<string>} [taken] Numbers already on the list above these.
 */
export function kept(rows, index, taken = new Set()) {
  const out = []
  for (const row of rows) {
    if (droppedFor(row, index)) continue
    const number = phoneKey(row.phone)
    if (taken.has(number)) continue
    taken.add(number)
    out.push(row)
  }
  return out
}

/**
 * The order the never-called businesses are offered in: the highest score
 * first, then the newest registration, then the id, so two reads of the same
 * table always agree.
 */
export function byScore(one, two) {
  return (
    (two.score?.total ?? 0) - (one.score?.total ?? 0) ||
    String(two.formed_on ?? '').localeCompare(String(one.formed_on ?? '')) ||
    String(one.id).localeCompare(String(two.id))
  )
}

/**
 * The order the businesses waiting on their owner are offered in, at the foot
 * of the list: the one the front desk said would be in soonest first, and one
 * nobody put a time on last.
 */
export function byOwnerDue(one, two) {
  const at = row => Date.parse(row.calls?.[0]?.callback_at ?? '') || Infinity
  return at(one) - at(two) || String(one.id).localeCompare(String(two.id))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A calendar date as it is said, without a clock to put it in the wrong day. */
function saidDate(date) {
  const [year, month, day] = String(date ?? '')
    .split('-')
    .map(Number)
  if (!year || !month || !day) return null
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

/** A platform's name without the article a sentence would put before it. */
function bare(name) {
  return String(name ?? '').replace(/^the\s+/i, '')
}

/** What a new company's own site, and the letter to it, come to in a line. */
function letterLine(row) {
  if (row?.stage === 'bounced') return 'Its email bounced'
  if (row?.stage === 'contacted') return 'Emailed, no reply yet'
  if (row?.skip_reason === CALL_FIRST_REASON) return 'Not emailed yet'
  if (row?.skip_reason === PHONE_ONLY_REASON || !row?.email) return 'No email address on its site'
  return null
}

/** Reasons a row carries at most. */
export const REASONS_MAX = 4

/** What a business really is, in a line, where it is not its trade. */
function industryLine(industry, trade) {
  const label = INDUSTRY_LABELS[industry]
  if (!label) return null
  return /contractor|electrician|plumber/i.test(String(trade ?? ''))
    ? `${label}, not a contractor`
    : label
}

/**
 * Why a business is where it is on the list, in the words somebody would use
 * for it.
 *
 * At most four, the strongest first: the business having answered the mail
 * (`engaged.js`), a chain asking for the call, a new
 * company, what says the business is bigger than its trade (its locations,
 * its industry, its age on the state record, its officers), what it has
 * instead of a website, the owner's cell or name being confirmed (or the name
 * being known at all), how many in its trade
 * have a site, no storefront, and a slow site.
 *
 * @param {object} row A business carrying its listing columns, `score` from
 *   `scoreOf`, `new_business` with `formed_on`, `engaged` and
 *   `call_due_reason` where they apply.
 * @returns {string[]}
 */
export function reasonsFor(row) {
  const said = []
  const answered = engagedWords(row?.engaged)
  if (answered) said.push(answered)
  if (row?.call_due_reason) said.push(String(row.call_due_reason))
  if (row?.new_business) {
    const formed = saidDate(row.formed_on)
    said.push(formed ? `New business, registered ${formed}` : 'New business')
  }

  const size = row?.score?.size
  if (size?.locations >= LOCATIONS_STAFFED) said.push(`${size.locations} locations`)
  const industry = industryLine(row?.score?.industry, row?.trade)
  if (industry) said.push(industry)
  if (size?.old && size.registered) said.push(`Registered ${size.registered}`)
  if (size?.officers >= OFFICERS_STAFFED) said.push(`${size.officers} officers on file`)

  const site = row?.score?.site ?? siteOf(row)
  const name = bare(platformName(hostOf(row?.website)))
  if (site === 'none') said.push('No website')
  else if (site === 'social') said.push(`Only a ${name || 'social media'} page`)
  else if (site === 'booking') said.push(`Only a ${name || 'booking'} booking page`)
  else if (site === 'portal') said.push(`Only a ${name || 'directory'} listing`)
  else if (row?.new_business) {
    const letter = letterLine(row)
    if (letter) said.push(letter)
  }

  if (row?.score?.cell === 'confirmed') said.push('Owner’s cell confirmed')
  if (row?.score?.nameConfirmed) said.push('Owner’s name confirmed')
  else if (row?.score?.named) said.push('Owner’s name known')

  const share = row?.score?.share
  if (site !== 'own' && typeof share === 'number' && share >= 0.5) {
    said.push(`${Math.round(share * 100)}% of its trade have a website`)
  }
  if (row?.score?.storefront === false) said.push('No storefront address')

  const speed = Number(row?.audit_score)
  if (row?.audit_score !== null && row?.audit_score !== undefined && speed < 50) {
    said.push(`Slow site, speed ${speed} of 100`)
  }

  return said.slice(0, REASONS_MAX)
}
