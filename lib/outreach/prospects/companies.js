/**
 * One company however many listings it has, and the kind of business it
 * really is.
 *
 * The Call List scores a business by what its trade says: most concrete
 * contractors have no employees, so a concrete contractor's owner answers. That
 * reading is wrong for a company that only files under the trade. A concrete
 * supplier with yards in three towns listed itself under two spellings and one
 * phone number, and ranked near the top as a one-man contractor: the chain rule
 * wants three listings of one name and the shared-number rule three listings of
 * one number, and it had two of each. This file reads it as what it is.
 *
 * A company is every listing on the table, at any stage, joined to another by
 * any one of:
 *
 * - the same phone number, its ten digits;
 * - the same website host, where the site is the business's own rather than a
 *   platform's, and the two names open on the same word (two agents' pages on
 *   one franchise's host are two businesses);
 * - the same trade and the same first two significant words of the name -
 *   "Dorsett Brothers" - where the first of those words is one no more than
 *   ten listings on the table use. Without that last part every "Gulf Coast",
 *   "Bay Area" and "Lone Star" business in a trade would be one company.
 *
 * The words of a name are read without the agent or branch after a spaced
 * dash, a store number, the words "the", "and", "of" and the like, and the
 * legal suffix.
 *
 * A company's locations are its distinct street addresses: a listing with no
 * street number on it - a service area, a PO box - is not a second location,
 * and neither is a new company's filing address, which is wherever its papers
 * were sent. Two listings at one address are one location listed twice.
 *
 * A company's industry is the one its listings say they are, where any does:
 * Google's own category for the place (`place_type`) first, then the words of
 * its name. A supplier, a wholesaler and a manufacturer employ people far more
 * often than the contractors they file among, and `call_trade_metrics` holds a
 * row for each.
 *
 * Pure: the endpoint reads the listings, and this decides.
 */

import { hostOf, platformOf } from './platforms.js'

/** Listings that may use a word before it is too common to identify a company by. */
export const RARE_WORD_LISTINGS = 10

/** Numbers that are a placeholder rather than a line: the 32-bit integer ceiling. */
const PLACEHOLDER_NUMBERS = new Set(['2147483647', '2147483648'])

/** Words that say nothing about which company a name is. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'in',
  'no',
  'of',
  'on',
  'the',
  'to',
  'co',
  'company',
  'corp',
  'corporation',
  'inc',
  'incorporated',
  'llc',
  'llp',
  'lp',
  'ltd',
  'pc',
  'pllc',
])

/** The four industries a listing can be read as, in the order one wins over another. */
export const INDUSTRIES = Object.freeze([
  'concrete plant',
  'building supply',
  'wholesale supplier',
  'manufacturer',
])

/** What each industry is called in a sentence. */
export const INDUSTRY_LABELS = Object.freeze({
  'concrete plant': 'Supplier',
  'building supply': 'Supplier',
  'wholesale supplier': 'Wholesaler',
  manufacturer: 'Manufacturer',
})

/**
 * Google's primary types that mean a supplier, a wholesaler or a manufacturer
 * rather than the trade a listing was searched under. A type not named here
 * says nothing about the industry and leaves the trade's reading in place.
 */
export const GOOGLE_INDUSTRIES = Object.freeze({
  building_materials_store: 'building supply',
  building_materials_supplier: 'building supply',
  hardware_store: 'building supply',
  home_improvement_store: 'building supply',
  lumber_store: 'building supply',
  garden_center: 'building supply',
  concrete_supplier: 'concrete plant',
  concrete_contractor_supplier: 'concrete plant',
  wholesaler: 'wholesale supplier',
  wholesale_store: 'wholesale supplier',
  warehouse_store: 'wholesale supplier',
  supplier: 'wholesale supplier',
  distributor: 'wholesale supplier',
  manufacturer: 'manufacturer',
  factory: 'manufacturer',
})

/** Words in a name that say the business sells materials. */
const SUPPLY = /\b(supply|supplies|materials|aggregates?|ready ?mix|readymix|redi ?mix|redimix)\b/
/** And that say it makes concrete. */
const CONCRETE = /\b(concrete|cement|ready ?mix|readymix|redi ?mix|redimix)\b/
/** Ready mix on its own is a concrete plant whatever else the name says. */
const READY_MIX = /\b(ready ?mix|readymix|redi ?mix|redimix)\b/
/** Words that say it sells to the trade rather than doing the trade. */
const WHOLESALE = /\b(wholesale|wholesalers?|distributors?|distributing)\b/
/** And that say it makes things. */
const MAKES = /\b(manufacturing|manufacturers?|mfg)\b|\bfabrication plant\b/

/**
 * A name's significant words, in order: lowercase, without apostrophes, the
 * branch or agent after a spaced dash, store numbers, small words or the legal
 * suffix.
 *
 * @param {string|null} name
 * @returns {string[]}
 */
export function nameWords(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\s+[-–—|:]\s+.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(word => word && !STOP_WORDS.has(word) && !/^\d+$/.test(word))
}

/** A name read for the industry words: lowercase, hyphens and punctuation as spaces. */
function plainName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
}

/**
 * The industry one listing says it is, or null where it says nothing beyond
 * its trade. Google's category first; then the name.
 *
 * @param {{name?: string, place_type?: string|null}} listing
 * @returns {string|null} One of `INDUSTRIES`.
 */
export function industryOf(listing) {
  const name = plainName(listing?.name)
  const google =
    GOOGLE_INDUSTRIES[
      String(listing?.place_type ?? '')
        .trim()
        .toLowerCase()
    ]
  if (google) return google === 'building supply' && CONCRETE.test(name) ? 'concrete plant' : google
  if (READY_MIX.test(name) || (SUPPLY.test(name) && CONCRETE.test(name))) return 'concrete plant'
  if (SUPPLY.test(name)) return 'building supply'
  if (WHOLESALE.test(name)) return 'wholesale supplier'
  if (MAKES.test(name)) return 'manufacturer'
  return null
}

/** The one of two industries that wins, by the order in `INDUSTRIES`. */
function strongest(one, two) {
  if (!one) return two ?? null
  if (!two) return one
  return INDUSTRIES.indexOf(one) <= INDUSTRIES.indexOf(two) ? one : two
}

/**
 * Whether the address has a street number on it: true, false, or null where
 * there is no address to read.
 *
 * A listing that hides its street ("Gardenia Trail, Pasadena, TX") is a
 * service-area business working out of a truck or a home, and so is a PO box.
 * A part that opens on a number ("1001 W H St Ste f") is a door somebody can
 * walk through, and so is a suite or a unit. A part that is only a zip code is
 * neither.
 *
 * @param {string|null} address
 * @returns {boolean|null}
 */
export function storefrontOf(address) {
  const parts = String(address ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  if (!parts.length) return null
  return parts.some(part => /^\d+[a-z]?\s+\S/i.test(part) || /\b(suite|ste|unit)\b/i.test(part))
}

/**
 * The place a listing stands, as a key two listings of one location share, or
 * null where the listing names no street to stand on.
 */
export function locationOf(listing) {
  if (listing?.source === 'new-business') return null
  const parts = String(listing?.address ?? '')
    .split(',')
    .map(part => part.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
  const street = parts.find(part => /^\d+[a-z]?\s+\S/.test(part))
  if (!street) return null
  const town = String(listing?.town ?? parts[parts.indexOf(street) + 1] ?? '')
    .trim()
    .toLowerCase()
  return `${street}|${town}`
}

/** A number as its ten digits, or null where it is not a whole one or is a placeholder. */
function numberKey(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return ten.length === 10 && !PLACEHOLDER_NUMBERS.has(ten) ? ten : null
}

/** The host of a site that is the business's own, or null. */
function ownHost(listing) {
  if (listing?.site_kind !== 'own' && listing?.source !== 'new-business') return null
  const host = hostOf(listing?.website)
  return host && !platformOf(host) ? host : null
}

/** An earlier of two calendar dates, either possibly missing. */
function earlier(one, two) {
  if (!one) return two ?? null
  if (!two) return one
  return String(one) <= String(two) ? one : two
}

/**
 * Every listing's company.
 *
 * @param {Array<{id: string, name?: string, phone?: string, website?: string,
 *   site_kind?: string, source?: string, trade?: string, address?: string,
 *   town?: string, place_type?: string, registered_on?: string,
 *   officer_count?: number}>} listings Every listing on the table.
 * @returns {Map<string, {listings: number, locations: number, industry: string|null,
 *   registeredOn: string|null, officers: number|null}>} By listing id; listings of
 *   one company share one object.
 */
export function companiesOf(listings) {
  const words = listings.map(one => nameWords(one?.name))
  const used = new Map()
  for (const held of words) {
    for (const word of new Set(held)) used.set(word, (used.get(word) ?? 0) + 1)
  }

  const parent = listings.map((_, at) => at)
  const find = at => {
    while (parent[at] !== at) {
      parent[at] = parent[parent[at]]
      at = parent[at]
    }
    return at
  }
  const seen = new Map()
  const join = (key, at) => {
    if (!key) return
    const first = seen.get(key)
    if (first === undefined) seen.set(key, at)
    else parent[find(at)] = find(first)
  }

  listings.forEach((one, at) => {
    const held = words[at]
    join(numberKey(one?.phone) && `phone:${numberKey(one.phone)}`, at)
    const host = ownHost(one)
    if (host && held[0]) join(`site:${host}|${held[0]}`, at)
    if (held.length >= 2 && one?.trade && (used.get(held[0]) ?? 0) <= RARE_WORD_LISTINGS) {
      join(`name:${String(one.trade).toLowerCase()}|${held[0]} ${held[1]}`, at)
    }
  })

  const groups = new Map()
  listings.forEach((one, at) => {
    const root = find(at)
    const group = groups.get(root) ?? {
      listings: 0,
      places: new Set(),
      locations: 1,
      industry: null,
      registeredOn: null,
      officers: null,
      ids: [],
    }
    group.listings += 1
    group.ids.push(one?.id)
    const place = locationOf(one)
    if (place) group.places.add(place)
    group.industry = strongest(group.industry, industryOf(one))
    group.registeredOn = earlier(group.registeredOn, one?.registered_on ?? null)
    const officers = Number.isInteger(one?.officer_count) ? one.officer_count : null
    if (officers !== null) group.officers = Math.max(group.officers ?? 0, officers)
    groups.set(root, group)
  })

  const byId = new Map()
  for (const group of groups.values()) {
    const company = {
      listings: group.listings,
      locations: Math.max(1, group.places.size),
      industry: group.industry,
      registeredOn: group.registeredOn,
      officers: group.officers,
    }
    for (const id of group.ids) if (id) byId.set(id, company)
  }
  return byId
}

/**
 * The company a listing would be on its own, for a business the index has not
 * read yet: its own industry and its own state record, one location.
 */
export function companyOfOne(listing) {
  return {
    listings: 1,
    locations: 1,
    industry: industryOf(listing),
    registeredOn: listing?.registered_on ?? null,
    officers: Number.isInteger(listing?.officer_count) ? listing.officer_count : null,
  }
}
