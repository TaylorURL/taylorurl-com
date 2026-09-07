/**
 * Looks for a site a listing does not mention, before anything is said about
 * not having one.
 *
 * A Google listing with no website field means Google was not told about a
 * site. It does not mean there is no site. Plenty of businesses have one and
 * never added it to their profile, and a message that opens by reporting no
 * site to somebody whose site is the first result for their own name has lost
 * its reader in its first sentence.
 *
 * So the claim is checked before it is made. Domains are derived from the
 * business name the way a small business actually registers one, fetched, and
 * then proved to belong to that business rather than to whoever else holds the
 * name: the page has to carry the listing's own phone number, or enough of the
 * name to be unambiguous. A domain that answers but proves nothing belongs to
 * somebody else, which is the common case for a short name.
 *
 * The request identifies itself the way the enricher's own page reads do. A
 * host that turns away a client with no name refuses the search in exactly the
 * way a domain nobody has registered refuses it, and nothing here can tell the
 * two apart, so going out anonymous reads every wall it meets as a business
 * with no site and files the strongest lead on the list as the weakest.
 */
import { hostOf, platformOf } from './platforms.js'

// A parked domain answers 200 with a page of advertising, and a registrar's
// holding page carries none of the business's own details, so the proof test
// rejects it on its own. These are the phrases that make it cheap to reject
// before reading further.
const PARKED = [
  'domain is for sale',
  'buy this domain',
  'parked free',
  'godaddy.com/domainsearch',
  'this domain may be for sale',
  'sedoparking',
  'hugedomains',
]

// Words that carry no identity, dropped before a name becomes a domain. A
// business named "Baytown Plumbing LLC" registers baytownplumbing.com, never
// baytownplumbingllc.com.
const NOISE = new Set([
  'llc',
  'inc',
  'pllc',
  'pc',
  'co',
  'company',
  'corp',
  'incorporated',
  'the',
  'and',
  'of',
  'a',
])

const TLDS = ['com', 'net', 'org']

// How long one candidate is given.
//
// Six of these run in sequence, inside the turn one prospect gets in a job
// capped at two minutes, so the whole search has to fit several times over in
// what that turn can afford. The figure is the one the enrich job gives its own
// page reads, because the workload is the same one: a small business's own
// website, answering or not.
const FETCH_TIMEOUT_MS = 6000

/**
 * What this and the enricher's own page reads both call themselves.
 *
 * It names the studio and points at the page that says what the requests are
 * for, so a business whose logs somebody actually reads can see who came by
 * and go and ask. It lives here rather than in the job because this is the
 * module both sides already share, and a name written out twice is two names
 * from the first day one of them is corrected.
 */
export const USER_AGENT =
  'Mozilla/5.0 (compatible; TaylorURLOutreach/1.0; +https://www.taylorurl.com/contact)'

/** The digits of a phone number, which is how two spellings of one are compared. */
export function digitsOf(phone) {
  return String(phone ?? '')
    .replace(/\D/g, '')
    .slice(-10)
}

/** The identity-carrying words of a business name, lowercased. */
export function nameWords(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word && !NOISE.has(word))
}

/**
 * The domains a business of this name would plausibly hold.
 *
 * The whole name joined up first, since that is what most register. Then the
 * name with the town dropped, for a business whose listing includes a town it
 * does not put in its domain.
 *
 * @param {string} name The business name.
 * @param {string} town The town the listing gives.
 * @returns {string[]} Hostnames, most likely first.
 */
export function candidateDomains(name, town) {
  const words = nameWords(name)
  if (!words.length) return []
  const withoutTown = words.filter(word => word !== String(town ?? '').toLowerCase())
  const stems = [...new Set([words.join(''), withoutTown.join('')])].filter(
    stem => stem.length >= 4 && stem.length <= 40
  )
  return stems.flatMap(stem => TLDS.map(tld => `${stem}.${tld}`))
}

/**
 * Whether a page proves it belongs to this business.
 *
 * The phone number settles it outright: a page carrying the same ten digits the
 * listing does is that business's page.
 *
 * A name on its own settles nothing. Trade names repeat across the country, and
 * matching on one alone finds an electrician in Hawaii and a garage in Los
 * Angeles holding the same two words as a business in Baytown. So without the
 * phone the page has to carry the whole name and the town it trades in, which
 * is a pair a stranger does not hold by coincidence.
 */
export function pageProves(html, { name, town, phone }) {
  const text = String(html ?? '').toLowerCase()
  if (!text) return false
  if (PARKED.some(mark => text.includes(mark))) return false

  const digits = digitsOf(phone)
  if (digits && text.replace(/\D/g, '').includes(digits)) return true

  const where = String(town ?? '')
    .toLowerCase()
    .trim()
  if (!where || !text.includes(where)) return false

  const words = nameWords(name)
  return words.length > 1 && words.every(word => text.includes(word))
}

/**
 * The site a business has that its listing does not mention, if any.
 *
 * @param {{ name: string, town?: string, phone?: string }} prospect The listing.
 * @param {(url: string) => Promise<Response>} [get] The fetch to use.
 * @returns {Promise<string|null>} The site's URL, or null when none is proved.
 */
export async function findSite(prospect, get = fetch) {
  for (const domain of candidateDomains(prospect.name, prospect.town)) {
    const url = `https://${domain}`
    let response
    try {
      response = await get(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
      })
    } catch {
      continue
    }
    if (!response?.ok) continue

    // A redirect onto a platform is a business whose site is a profile page,
    // which is the case the message already has words for.
    const landed = hostOf(response.url || url)
    if (platformOf(landed)) continue

    const html = await response.text().catch(() => '')
    if (pageProves(html, prospect)) return response.url || url
  }
  return null
}
