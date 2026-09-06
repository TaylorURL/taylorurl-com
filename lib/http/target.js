/**
 * Reading a web address a stranger typed, and refusing the ones that are not.
 *
 * Every caller of this fetches whatever comes back, so the refusals are the
 * point rather than a courtesy: an address that resolves anywhere other than
 * the public internet is turned away here, before a request exists to be
 * pointed at something inside the network the function runs in. A loopback
 * name, a private range, a cloud provider's metadata address and an internal
 * suffix a resolver completes are all the same answer.
 *
 * It lives apart from any one endpoint because the second endpoint to take an
 * address from a stranger is where a copy of this would start to drift, and a
 * guard that is right in one place and stale in another is not a guard.
 */

/** The longest an address can be and still be a website. */
const ADDRESS_MAX = 300

// Hosts that name something other than a public server: the loopback names, the
// link-local and metadata addresses cloud providers answer on, and the internal
// suffixes a resolver inside a network completes. A hostname is refused on this
// list before anything is fetched, and the numeric ranges below cover an
// address written out rather than named.
const CLOSED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'broadcasthost', '0.0.0.0'])
const CLOSED_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa', '.lan']

/** Whether a dotted-quad sits in a range that is not routed on the internet. */
function privateIpv4(host) {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map(part => (/^\d{1,3}$/.test(part) ? Number(part) : -1))
  if (octets.some(octet => octet < 0 || octet > 255)) return false

  const [a, b] = octets
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

/** Whether an IPv6 literal is a loopback, link-local or unique-local address. */
function privateIpv6(host) {
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (!bare.includes(':')) return false
  if (bare === '::1' || bare === '::') return true
  if (/^f[cd]/.test(bare)) return true
  if (/^fe[89ab]/.test(bare)) return true
  // An address carrying an embedded v4 one is only as public as that address.
  const embedded = bare.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  return embedded ? privateIpv4(embedded[1]) : false
}

/**
 * The address to read, or the reason it will not be read.
 *
 * The fault is a sentence rather than a code, because every caller shows it to
 * the person who typed the address and none of them has more to add.
 *
 * @param {string} value - Whatever was typed in the field.
 * @returns {{ url: URL } | { fault: string }}
 */
export function target(value) {
  const typed = typeof value === 'string' ? value.trim() : ''
  if (!typed) return { fault: 'Enter a web address.' }
  if (typed.length > ADDRESS_MAX) return { fault: 'That address is too long to be a website.' }

  let url
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(typed) ? typed : `https://${typed}`)
  } catch {
    return { fault: 'That does not look like a web address.' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { fault: 'Only web addresses starting http or https can be checked.' }
  }
  if (url.username || url.password) {
    return { fault: 'Leave the sign-in details out of the address.' }
  }

  const host = url.hostname.toLowerCase()
  if (CLOSED_HOSTS.has(host) || CLOSED_SUFFIXES.some(suffix => host.endsWith(suffix))) {
    return { fault: 'That address is not a public website.' }
  }
  if (privateIpv4(host) || privateIpv6(host)) {
    return { fault: 'That address is not a public website.' }
  }
  // A name with no dot in it is a machine on somebody's network rather than a
  // site, and a trailing dot is the same name written to defeat that test.
  if (!host.includes('.') || host.endsWith('.')) {
    return { fault: 'That address is not a public website.' }
  }

  return { url }
}
