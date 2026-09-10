/**
 * Reaching a host the platform's own resolver cannot see.
 *
 * Everything visitor-facing that is not a site runs on the Pi, and the site
 * reaches it at the address Tailscale publishes for the Funnel. That name is
 * an ordinary public record: it is signed for by DNSimple, it answers NOERROR
 * with two addresses, and Google, Cloudflare and every browser resolve it. The
 * resolver inside a deployed function does not, and answers ENOTFOUND for it
 * while resolving everything else on the internet.
 *
 * The cost of that is not a slow page. `fetch` fails before a packet leaves,
 * the widget's probe reads the failure as an assistant that is gone, and the
 * chat is taken off every page of the site -- which is what it had done, for
 * hours, with the assistant up and answering the whole time. A visitor cannot
 * tell that apart from a studio that never offered a chat.
 *
 * So the name is resolved here rather than asked of the platform. The system
 * resolver is still asked first, because it is right everywhere else and is
 * the cheaper answer; only when it says a name does not exist is a public
 * resolver asked over ordinary HTTPS, which is a route the function is already
 * proven to have. The address that comes back is dialled directly and the
 * hostname still travels as the TLS server name, so the certificate is checked
 * against the name and not the number -- the connection is the same connection,
 * and only the lookup in front of it has moved.
 *
 * This is a workaround for somebody else's resolver and it is written to
 * disappear quietly: the day that resolver answers, the first lookup succeeds
 * and nothing below it is ever reached.
 */

import { request as openRequest } from 'node:https'
import { lookup as askTheSystem } from 'node:dns'

/**
 * Where to ask when the system resolver says a name does not exist.
 *
 * Two of them, run by different companies on different networks, because the
 * whole point of this file is that one resolver can be wrong about a name that
 * is plainly there. Both speak the same JSON dialect over ordinary HTTPS.
 */
const PUBLIC_RESOLVERS = ['https://dns.google/resolve', 'https://cloudflare-dns.com/dns-query']

// A lookup sits in front of a request that is already waiting, so it is held
// to a fraction of that request's own patience. The tightest caller is the
// widget's probe, which has three seconds for the whole knock: this leaves half
// of that for the connection the lookup exists to make, and only the first
// knock pays it at all, because what it finds is held.
const RESOLVE_TIMEOUT_MS = 1500

// The floor under a record's own time to live. The Funnel's record carries
// 300s; a shorter one is not worth re-asking on every knock, and a longer one
// is not worth trusting through an address change.
const MIN_HOLD_S = 60
const MAX_HOLD_S = 600

// A record of type A. The answer to a Funnel name arrives as one of these,
// sometimes behind a CNAME, so the chain is filtered rather than read at [0].
const A_RECORD = 1

/** Addresses already found, against the moment they stop being worth trusting. */
const FOUND = new Map()

/**
 * The addresses a public resolver has for a name.
 *
 * A resolver that answers with nothing useful is passed over rather than
 * believed, because an empty answer here and a wrong one are the same failure:
 * the caller ends up told a live host is gone.
 *
 * Exported for the checks, which stub the resolver rather than reaching one.
 *
 * @param {string} hostname
 * @returns {Promise<string[]>}
 */
export async function addressesFor(hostname) {
  const held = FOUND.get(hostname)
  if (held && held.until > Date.now()) return held.addresses

  for (const resolver of PUBLIC_RESOLVERS) {
    try {
      const answer = await fetch(`${resolver}?name=${encodeURIComponent(hostname)}&type=A`, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
      })
      if (!answer.ok) continue

      const said = await answer.json()
      const records = (said.Answer || []).filter(row => row.type === A_RECORD)
      const addresses = records.map(row => row.data).filter(Boolean)
      if (!addresses.length) continue

      const ttl = Math.min(...records.map(row => Number(row.TTL) || MIN_HOLD_S))
      const hold = Math.min(Math.max(ttl, MIN_HOLD_S), MAX_HOLD_S)
      FOUND.set(hostname, { addresses, until: Date.now() + hold * 1000 })
      return addresses
    } catch {
      // This resolver could not be asked. The next one is the answer to that,
      // and a name nobody can resolve is reported by the caller that needed it.
    }
  }

  return []
}

/**
 * The system resolver, with a public one behind it.
 *
 * Shaped as `dns.lookup` because that is what a socket expects, and handed to
 * one so the connection underneath is otherwise untouched.
 */
function lookup(hostname, options, done) {
  askTheSystem(hostname, options, (fault, ...answer) => {
    if (!fault) {
      done(null, ...answer)
      return
    }

    addressesFor(hostname)
      .then(addresses => {
        // The original fault is what is reported when nothing else knows the
        // name either, because it is the one that describes the lookup rather
        // than describing this file's opinion of it.
        if (!addresses.length) {
          done(fault)
          return
        }
        if (options?.all) {
          done(
            null,
            addresses.map(address => ({ address, family: 4 }))
          )
          return
        }
        done(null, addresses[0], 4)
      })
      .catch(() => done(fault))
  })
}

/** A request that was given up on, in the shape callers already read for. */
function abandoned() {
  const stopped = new Error('The operation was aborted.')
  stopped.name = 'AbortError'
  return stopped
}

/**
 * One request, over the lookup above.
 *
 * The answer carries the handful of things a caller reads off a `Response` and
 * nothing more, so a call site moves onto this by changing the word in front of
 * it. The body is collected whole rather than streamed, which is what every
 * caller here does with it anyway.
 *
 * @param {string} address
 * @param {{method?: string, headers?: Record<string,string>, body?: string, signal?: AbortSignal}} [sent]
 * @returns {Promise<{ok: boolean, status: number, text: () => Promise<string>, json: () => Promise<unknown>}>}
 */
export function reach(address, sent = {}) {
  const { method = 'GET', headers = {}, body = null, signal } = sent

  return new Promise((answered, failed) => {
    if (signal?.aborted) {
      failed(abandoned())
      return
    }

    // Measured rather than streamed. Without a length the body goes out
    // chunked, and the assistant reads its request the plain way every small
    // server does -- by the length it was promised -- so a chunked turn would
    // arrive at a door that answers but never hears the question.
    const sending = body === null ? null : Buffer.from(body, 'utf8')
    const url = new URL(address)
    const call = openRequest(
      url,
      {
        method,
        headers: sending ? { 'Content-Length': String(sending.byteLength), ...headers } : headers,
        lookup,
        // The name is what the certificate is for. The lookup above changed
        // which address is dialled and nothing else, so this has to stay the
        // name or the handshake is against the wrong identity.
        servername: url.hostname,
      },
      response => {
        const parts = []
        response.on('data', part => parts.push(part))
        response.on('end', () => {
          const said = Buffer.concat(parts).toString('utf8')
          answered({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            text: () => Promise.resolve(said),
            json: () => Promise.resolve(JSON.parse(said)),
          })
        })
        response.on('error', failed)
      }
    )

    const leave = () => {
      call.destroy()
      failed(abandoned())
    }
    signal?.addEventListener('abort', leave, { once: true })

    call.on('error', cause => {
      // A socket this side tore down reports as an ordinary connection fault.
      // The caller asked for it, so it is told what it asked rather than what
      // the socket made of it.
      failed(signal?.aborted ? abandoned() : cause)
    })

    if (sending) call.write(sending)
    call.end()
  })
}
