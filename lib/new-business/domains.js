/**
 * The domains registered each day, from WhoisDS's free daily list.
 *
 * A new company usually registers its domain within weeks of registering
 * itself, and the free list names up to seventy thousand of the domains
 * registered the day before. A company whose name runs together into one of
 * them has, very likely, just bought its own site's address: that is the
 * strongest free sign there is that a business has a site coming, and the
 * check reads a matched domain before it guesses at any other.
 *
 * The list is a zip holding one text file, a domain a line, at a URL whose
 * last path segment is the date's file name in base64.
 */

import { inflateRawSync } from 'node:zlib'

const LISTS = 'https://www.whoisds.com//whois-database/newly-registered-domains'

/** How far back a list is read for a company that has just arrived. */
export const LOOKBACK_DAYS = 30

/** The URL of the list of domains registered on a day, YYYY-MM-DD. */
export function listUrl(day) {
  const file = Buffer.from(`${day}.zip`).toString('base64')
  return `${LISTS}/${file}/nrd`
}

/**
 * The text of the one file inside a zip.
 *
 * Read through the central directory rather than the local header, because a
 * zip written as a stream puts its sizes after the data and leaves the local
 * header's at zero. Stored and deflated are the two methods a list has ever
 * come in.
 *
 * @param {Buffer} zip
 * @returns {string}
 */
export function unzipOne(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) throw new Error('not a zip: no end of central directory')
  const directory = zip.readUInt32LE(end + 16)
  if (zip.readUInt32LE(directory) !== 0x02014b50) throw new Error('not a zip: no central directory')
  const method = zip.readUInt16LE(directory + 10)
  const size = zip.readUInt32LE(directory + 20)
  const local = zip.readUInt32LE(directory + 42)
  if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error('not a zip: no local header')
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
  const data = zip.subarray(start, start + size)
  if (method === 0) return data.toString('utf8')
  if (method === 8) return inflateRawSync(data).toString('utf8')
  throw new Error(`a zip compressed with method ${method}, which this does not read`)
}

/**
 * The domains in a list, keyed by the label a company name would run into.
 *
 * Only a registrable name is kept, which is a label and one suffix
 * ("jetlino.com") or a label and a two-part country suffix ("fiber.co.uk"). A
 * name deeper than that is somebody's subdomain rather than a registration.
 *
 * @param {string} text One domain a line.
 * @returns {Map<string, string[]>}
 */
export function byLabel(text) {
  const labels = new Map()
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const domain = line.trim().toLowerCase()
    if (!domain) continue
    const parts = domain.split('.')
    const registrable =
      parts.length === 2 || (parts.length === 3 && parts[1].length <= 3 && parts[2].length === 2)
    if (!registrable) continue
    const label = parts[0].replace(/-/g, '')
    if (!labels.has(label)) labels.set(label, [])
    labels.get(label).push(domain)
  }
  return labels
}

/**
 * The domains a company's slug matches in a list: the slug itself, and the two
 * spellings a Texas company most often adds to a name already taken.
 *
 * @param {string} slug
 * @param {Map<string, string[]>} labels
 */
export function matchesFor(slug, labels) {
  if (!slug) return []
  const found = []
  for (const label of [slug, `${slug}tx`, `${slug}llc`]) {
    for (const domain of labels.get(label) ?? []) found.push(domain)
  }
  return found
}

/** Every day from `from` to `to`, inclusive, as YYYY-MM-DD. */
export function daysBetween(from, to) {
  const days = []
  const step = 24 * 60 * 60 * 1000
  for (
    let at = new Date(`${from}T00:00:00Z`).getTime();
    at <= new Date(`${to}T00:00:00Z`).getTime();
    at += step
  ) {
    days.push(new Date(at).toISOString().slice(0, 10))
  }
  return days
}

/**
 * One day's list, read and keyed, or null where the day has none to give.
 *
 * A day not yet published, and one the site refuses, both come back null: a
 * missing list is a day with nothing matched rather than a failed run.
 */
export async function listFor(day, get = fetch) {
  let response
  try {
    response = await get(listUrl(day), {
      signal: AbortSignal.timeout(30_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TaylorURL/1.0; +https://www.taylorurl.com/contact)',
      },
    })
  } catch {
    return null
  }
  if (!response?.ok) return null
  const zip = Buffer.from(await response.arrayBuffer())
  try {
    return byLabel(unzipOne(zip))
  } catch {
    return null
  }
}
