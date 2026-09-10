/**
 * Reverse proxy for the Sunday Server's reading of itself.
 *
 * `status-feed.js` beside this carries the same machine's answer about the
 * sites, and the two are deliberately separate endpoints rather than one feed
 * with two halves. The sites' board is the public one and is read by anybody
 * who opens `/status`; this is the machine underneath it - the units running
 * on it, how full its card is, what it is - and that is nobody's business but
 * the studio's. So this door asks for an admin session where the other asks
 * for nothing.
 *
 * Two secrets rather than one, and they do different jobs. The session proves
 * who is asking, and is checked here rather than at the far end, which is a
 * small machine on a home network with no idea what a Supabase account is. The
 * token proves the request came from this site: the server sits behind a
 * public relay, so without it the feed would be one URL away from anybody who
 * guessed the path.
 *
 * Neither reaches the browser. The console calls its own origin, the token
 * lives in this deployment's environment, and what comes back is the feed and
 * nothing else.
 */

import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { methodsOr405, servedHereOr404 } from '../lib/http/guard.js'
import { reach } from '../lib/http/reach.js'

// Where the server publishes its own reading, and what it wants to see before
// it answers. A deployment given neither refuses rather than guessing: the
// address is a machine on a private network and there is no sensible default
// for it.
const UPSTREAM = process.env.SERVER_FEED_URL || ''
const TOKEN = process.env.SERVER_FEED_TOKEN || ''

// The upstream is a home connection behind a relay, so a first byte can be
// slow without the machine being down. One retry covers a dropped connection;
// the pair still finishes inside the function's own execution ceiling.
const TIMEOUT_MS = 12000
const ATTEMPTS = 2

// The last reading that actually came off the machine, and when it did.
//
// The machine is reached by name, and the name is a subdomain of somebody
// else's zone. That zone answers NXDOMAIN for it every so often - measured on
// 2026-09-10 at eight refusals in twenty queries against one public resolver,
// with a second resolver answering every time - and a negative answer is
// cached against the whole resolver for the zone's SOA minimum, which is five
// minutes. So a machine that is up, funnelled and answering in under a second
// becomes unreachable from here in five-minute blocks, and the retry above is
// no use against it: both attempts are the same lookup, microseconds apart,
// inside the same cached refusal.
//
// `readFeed` answers that at the lookup, by asking a public resolver when the
// platform's own says the name is not there. This is what is left when that
// fails too - both resolvers unreachable, or a name that really has gone - and
// it is kept because the failure it covers is the one that reads worst: a page
// that says the machine is gone, about a machine that is answering.
//
// So the last good reading is held here and served through a failure. That is
// not a stale answer dressed as a fresh one: every reading this endpoint has
// ever returned carries the machine's own `updated_at`, the page reads its age
// off that rather than off the success of the request, and it says across the
// top of itself when the reading it is drawing is not current. A held reading
// is exactly the case that was already built for - a read that lands on a feed
// the machine has not rebuilt - and it arrives, correctly, looking like one.
//
// Fifteen minutes is the ceiling, which is the same figure the rest of the
// fleet uses to decide this machine is not alive. Past it there is nothing
// honest left to draw and the failure goes through.
const HOLD_MS = 15 * 60 * 1000
let held = null
let heldAt = 0

/** Which stage failed, in the words the log uses. */
function describe(error) {
  if (error && error.status) return error.message
  if (error && error.name === 'AbortError') return 'the server timed out'
  if (error && error.name === 'SyntaxError') return 'the server sent malformed JSON'
  // A socket fault arrives bare from `reach` and wrapped by `fetch`, and which
  // code it carries is the whole diagnosis here. Read both, or the one line
  // this failure ever writes says only that something did not work.
  if (error && error.code) return `the server was unreachable (${error.code})`
  const cause = error && error.cause
  if (cause && cause.code) return `the server was unreachable (${cause.code})`
  return 'the server was unreachable'
}

async function readFeed() {
  // `reach` rather than `fetch`, because the name this asks for is one the
  // platform's own resolver intermittently says does not exist while every
  // public resolver answers it. `lib/http/reach.js` asks the system first and
  // a public resolver only when the system says the name is not there, so the
  // day that resolver is right this is an ordinary request again.
  const upstream = await reach(`${UPSTREAM}?t=${Date.now()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: 'application/json', Authorization: `Bearer ${TOKEN}` },
  })
  if (!upstream.ok) {
    const status = new Error(`the server answered ${upstream.status}`)
    status.status = upstream.status
    throw status
  }
  return await upstream.json()
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!methodsOr405(request, response, ['GET'])) return

  const clients = connect()
  if (!clients) return response.status(503).json({ error: 'The database is not configured.' })

  const account = await authorizeAdmin(clients, request.headers.authorization)
  if (account.status) return response.status(account.status).json({ error: account.error })

  if (!UPSTREAM || !TOKEN) {
    return response
      .status(503)
      .json({ error: 'This deployment has not been told where the server is.' })
  }

  let last = null
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const body = await readFeed()
      held = body
      heldAt = Date.now()
      // Never cached at any layer. The answer is one account's to read, and a
      // shared cache in front of it is a way to hand it to somebody else.
      response.setHeader('Cache-Control', 'private, no-store')
      response.status(200).json(body)
      return
    } catch (error) {
      last = error
      // A server that answered with a status of its own is reporting a real
      // condition rather than a lost connection, so asking again would put the
      // same question and get the same answer.
      if (error && error.status) break
    }
  }

  // The reason goes to the log and no further. A slow relay, a dead machine
  // and a refused token need telling apart when this is looked into, and none
  // of them is a difference to the person looking at the page: what reaches
  // them is that the reading is not current and that the page keeps asking.
  const reason = describe(last)

  if (held && Date.now() - heldAt < HOLD_MS) {
    console.error('server-feed: %s reading %s, holding the last reading', reason, UPSTREAM, last)
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).json(held)
    return
  }

  console.error('server-feed: %s reading %s', reason, UPSTREAM, last)
  response
    .status(502)
    .json({ error: 'The server could not be reached just now. This page keeps trying.' })
}
