/**
 * How a domain is written when a person reads it.
 *
 * The monitor records whatever host it checks, so the same list mixes
 * `www.taylorurl.com` with a bare apex and reads as though some sites were set
 * up differently from the others. Every apex domain is shown with its www
 * host, which is the one a visitor types and the one these sites answer on.
 *
 * A host that already carries a subdomain is left alone: it is a service at
 * its own name, and `www.` in front of it would name a host that does not
 * exist.
 */

// Suffixes whose registrable name is two labels rather than one, so a host
// under them is still an apex. Anything longer than this is a subdomain.
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'me.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'co.za',
  'com.br',
  'co.jp',
  'com.mx',
])

/**
 * @param {string} host - A bare hostname, with or without `www.`.
 * @returns {boolean} True when the host is the registrable domain itself.
 */
function isApex(host) {
  const labels = host.split('.')
  if (labels.length < 2) return false
  const lastTwo = labels.slice(-2).join('.')
  return labels.length === (TWO_LABEL_SUFFIXES.has(lastTwo) ? 3 : 2)
}

/**
 * The form two hosts are compared in.
 *
 * The console names a site one way, the uptime monitor another, and the Google
 * standing a third: `www.taylorurl.com`, `taylorurl.com`, and whatever the run
 * recorded. They are the same site, and matching them on the string as written
 * decides they are three - which is how a site in scope finds nothing to show.
 *
 * @param {string} host - A hostname or an origin, in any of those forms.
 * @returns {string} The bare registrable host, lowercased, with no `www.`.
 */
export function bareDomain(host) {
  if (!host) return ''
  return String(host)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .toLowerCase()
    .replace(/^www\./, '')
}

/**
 * @param {string} host - A hostname as the monitor recorded it.
 * @returns {string} The same host, written with `www.` when it is an apex.
 */
export function displayDomain(host) {
  if (!host) return ''
  const bare = String(host)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
  if (!bare || bare.startsWith('www.')) return bare
  return isApex(bare) ? `www.${bare}` : bare
}
