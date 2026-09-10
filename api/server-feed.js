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

/** Which stage failed, in the words the log uses. */
function describe(error) {
  if (error && error.status) return error.message
  if (error && error.name === 'AbortError') return 'the server timed out'
  if (error && error.name === 'SyntaxError') return 'the server sent malformed JSON'
  const cause = error && error.cause
  if (cause && cause.code) return `the server was unreachable (${cause.code})`
  return 'the server was unreachable'
}

async function readFeed() {
  const upstream = await fetch(`${UPSTREAM}?t=${Date.now()}`, {
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
  console.error('server-feed: %s reading %s', describe(last), UPSTREAM, last)
  response
    .status(502)
    .json({ error: 'The server could not be reached just now. This page keeps trying.' })
}
