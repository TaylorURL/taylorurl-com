/**
 * Which ranked businesses the Call List actually offers, and the plain words
 * for why each one is on it.
 *
 * The ranking (`call_list_page` in the database) leads with the businesses that
 * are hardest to find, and on its own that put the wrong ones first. Of the
 * first 31 calls placed off it, 12 were marked Bad Lead, and 10 of those 12
 * were Google listings with no reviews at all - a chair renter's own mobile, a
 * home stylist, a listing nobody runs - which the ranking scored as the least
 * findable businesses on the table and so put at the very top. The two wrong
 * numbers were a city park on the county's 311 line and a shopping mall's
 * directory, both with thousands of reviews filed under a small trade.
 *
 * So the list drops, before anybody sees it:
 *
 * - a business already called, unless a call back on it is due (those lead the
 *   list from their own read);
 * - any listing whose number has been called under another listing;
 * - anything Google says is closed;
 * - a listing Google has no reviews for at all;
 * - a chain or franchise: the same business name, read without the agent or
 *   branch after a dash or a store number, on three or more listings in two or
 *   more towns (Farmers Insurance, State Farm, Texas Farm Bureau, and the lead
 *   networks that file one name in every town);
 * - a number shared by three or more listings under different names, which is
 *   a head office, a city department or a lead network rather than an owner;
 * - a listing with twenty times the reviews its trade normally has, read with
 *   the same smoothing the ranking uses - a mall, a park, a flea market or a
 *   chain filed under a small trade;
 * - a number that is not a full ten-digit number;
 * - and a second listing of a number already on the list.
 *
 * Pure: the endpoint reads the rows and the index, and this decides.
 */

import { hostOf, platformName } from './platforms.js'
import { isOperating } from './youth.js'
import { presenceOf, pullBand, pullOf, reviewsOf } from './calls.js'

/** How many listings one name has to be on before it reads as a chain. */
export const CHAIN_LISTINGS = 3
/** And in how many different towns. */
export const CHAIN_TOWNS = 2
/** How many listings one number has to be on before it is not an owner's line. */
export const SHARED_NUMBER_LISTINGS = 3
/** Reviews against the trade, smoothed as the ranking smooths them, past which a listing is not a small business. */
export const OUTLIER_PULL = 20

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
 * be asked how many others share either.
 *
 * @param {Array<{name: string, phone: string, town: string}>} listings
 * @param {Array<{phone: string}>} called The listings with a call on record.
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
  const rung = new Set(called.map(one => phoneKey(one?.phone)).filter(Boolean))
  return { brands, numbers, rung }
}

/**
 * Why a business is not offered, or null where it is.
 *
 * @param {object} row A business carrying its listing columns, `calls`, and
 *   `trade_median` where the ranking read one.
 * @param {ReturnType<typeof indexOf>} index
 * @returns {string|null}
 */
export function droppedFor(row, index) {
  if ((row?.calls ?? []).length) return 'already called'
  if (!isOperating(row)) return 'closed'
  const number = phoneKey(row?.phone)
  if (!number || PLACEHOLDER_NUMBERS.has(number)) return 'not a full phone number'
  if (index.rung.has(number)) return 'number already called under another listing'
  if (reviewsOf(row) === 0) return 'no reviews on Google'
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
 * number already offered dropped.
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

/**
 * Why a business is on the list, in the words somebody would use for it.
 *
 * At most three, the strongest first: a chain asking for the call, a new
 * company, what it has instead of a website, how few reviews it has against
 * its trade, a slow site, and work of ours to name.
 *
 * @param {object} row A business carrying its listing columns, `trade_median`,
 *   `proof`, `new_business` with `formed_on`, and `call_due_reason` where they
 *   apply.
 * @returns {string[]}
 */
export function reasonsFor(row) {
  const said = []
  if (row?.call_due_reason) said.push(String(row.call_due_reason))
  if (row?.new_business) {
    // Found by the new-business pipeline off the state's filings: it has a
    // site, and the site gave no address to write to, which is why it is here.
    const formed = saidDate(row.formed_on)
    said.push(formed ? `New business, registered ${formed}` : 'New business')
    said.push('No email address on its site')
  } else {
    const name = platformName(hostOf(row?.website))
    const presence = presenceOf(row)
    if (presence === 'none' && !row?.website) said.push('No website')
    else if (presence === 'social') said.push(`Only a ${bare(name) || 'social media'} page`)
    else if (presence === 'booking') said.push(`Only a ${bare(name) || 'booking'} booking page`)
    else if (presence === 'portal') said.push(`Only a ${bare(name) || 'directory'} listing`)
  }

  const reviews = reviewsOf(row)
  const median = row?.trade_median
  if (reviews !== null && reviews > 0) {
    const counted = reviews === 1 ? '1 review' : `${reviews} reviews`
    if (pullBand(row, median) === 'quiet') {
      said.push(`Only ${counted}, most nearby have ${Math.round(median)}`)
    } else if (median === null || median === undefined) {
      if (reviews <= 5) said.push(`Only ${counted}`)
    }
  }

  const speed = Number(row?.audit_score)
  if (row?.audit_score !== null && row?.audit_score !== undefined && speed < 50) {
    said.push(`Slow site, speed ${speed} of 100`)
  }

  if (row?.proof === 'trade') said.push('We have built for its trade')
  else if (row?.proof === 'town') said.push('We have work in its town')

  return said.slice(0, 3)
}
