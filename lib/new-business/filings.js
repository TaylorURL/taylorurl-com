/**
 * Every company Texas registers, read off the Comptroller's list of active
 * franchise taxpayers on data.texas.gov.
 *
 * A company formed with the Secretary of State lands on that list with the day
 * it was chartered, so the list read by charter date is the register of new
 * companies. It is published through Socrata and answers without a key. It
 * trails the filings by about two weeks, which is why a run reads back past the
 * last day it saw rather than from it: a day that was thin the last time it was
 * read fills in later.
 *
 * Nothing is left out. A holding company, a chain's new entity and a company
 * based in another state all file here, and every one of them goes on the list.
 *
 * Strings and pure functions only, apart from the one read the job hands a
 * fetch to.
 */

export const FILINGS_ENDPOINT = 'https://data.texas.gov/resource/9cir-efmm.json'

/** Rows one request asks for. Socrata serves up to fifty thousand. */
export const PAGE_SIZE = 10_000

/** Days a run reads back behind its cursor, to take in the days that filled in late. */
export const REREAD_DAYS = 7

/** How far the very first run reaches back. */
export const FIRST_RUN_DAYS = 21

/** Words a company name carries that no domain does. */
const SUFFIXES = new Set([
  'llc',
  'l',
  'c',
  'inc',
  'incorporated',
  'corp',
  'corporation',
  'co',
  'company',
  'ltd',
  'limited',
  'pllc',
  'pc',
  'lp',
  'llp',
  'plc',
  'the',
])

/**
 * The words of a name that identify the business, lowercased, with the legal
 * suffix and punctuation gone. "STINKY'S COOKIES, L.L.C." is stinkys and
 * cookies.
 */
export function nameWords(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(word => word && !SUFFIXES.has(word))
}

/**
 * The name as a domain would spell it: its words run together, with "and"
 * dropped where the name used an ampersand. Null where too little is left to
 * be anybody's in particular.
 */
export function slugOf(name) {
  const words = nameWords(String(name ?? '').replace(/&/g, ' '))
  const slug = words.join('')
  return slug.length >= 4 && slug.length <= 60 ? slug : null
}

/** Small words that stay lowercase inside a title. */
const SMALL = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to'])

/**
 * The name as a person would write it in a sentence: title case, the legal
 * suffix gone. The register holds it in capitals, and "MADE BY CREATORS LLC"
 * in the middle of an email reads as a form letter. A word with a digit in it
 * or no vowel at all is an initialism and keeps its capitals.
 */
export function displayName(name) {
  const raw = String(name ?? '')
    .replace(
      /[,.\s]+(?:l\.?\s?l\.?\s?c\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|ltd\.?|limited|p\.?l\.?l\.?c\.?|p\.?c\.?|l\.?p\.?|l\.?l\.?p\.?)\s*$/i,
      ''
    )
    .replace(/[,\s]+$/, '')
    .trim()
  const words = raw.split(/\s+/).filter(Boolean)
  return words
    .map((word, index) => {
      if (/\d/.test(word) || !/[aeiouy]/i.test(word.replace(/[^a-z]/gi, '')))
        return word.toUpperCase()
      const lower = word.toLowerCase()
      if (index > 0 && SMALL.has(lower)) return lower
      return lower.replace(/(^|[-/(])([a-z])/g, (_, lead, letter) => lead + letter.toUpperCase())
    })
    .join(' ')
}

/** The day a run starts reading from, as YYYY-MM-DD. */
export function readFrom(cursor, now = new Date()) {
  const day = 24 * 60 * 60 * 1000
  const base = cursor
    ? new Date(`${cursor}T00:00:00Z`).getTime() - REREAD_DAYS * day
    : now.getTime() - FIRST_RUN_DAYS * day
  return new Date(base).toISOString().slice(0, 10)
}

/** The query for one page of companies chartered on or after a day. */
export function filingsUrl(since, offset = 0) {
  const params = new URLSearchParams({
    $where: `sos_charter_date >= '${since}T00:00:00'`,
    $order: 'sos_charter_date, taxpayer_number',
    $limit: String(PAGE_SIZE),
    $offset: String(offset),
  })
  return `${FILINGS_ENDPOINT}?${params}`
}

/** One register row as a lead, or null where it has no number or no name. */
export function leadOf(row) {
  const number = String(row?.taxpayer_number ?? '').trim()
  const name = String(row?.taxpayer_name ?? '').trim()
  if (!number || !name) return null
  return {
    taxpayer_number: number,
    sos_file_number: row.secretary_of_state_sos_or_coa_file_number ?? null,
    name,
    org_type: row.taxpayer_organizational_type ?? null,
    formed_on: row.sos_charter_date ? String(row.sos_charter_date).slice(0, 10) : null,
    address: row.taxpayer_address ?? null,
    city: row.taxpayer_city ?? null,
    state: row.taxpayer_state ?? null,
    zip: row.taxpayer_zip ?? null,
    slug: slugOf(name),
  }
}
