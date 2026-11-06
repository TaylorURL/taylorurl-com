/**
 * The collector's word that somebody arrived, moved to another page or left.
 *
 * The database sends it on a private channel per site the moment a visitor's
 * presence changes, and it carries nothing but the fact: what changed is read
 * again through the collector, which answers for whoever is asking. A reader
 * joins only the channels of sites their account may read; the channel refuses
 * anybody else.
 *
 * Pure apart from the client it is handed, so the check can drive it with a
 * stand-in and prove the burst handling and the teardown without a socket.
 */

/** The topic a site's signal arrives on, as the database names it. */
export function liveTopic(siteId) {
  return `analytics:live:${siteId}`
}

/**
 * Listens on every named site and calls `onSignal` once per burst.
 *
 * A page that loads a fresh document for every link sends a goodbye and an
 * arrival together, and five people landing from one post send five; reading
 * the live view once after the burst settles is the same answer for a fifth of
 * the requests. The wait is short enough that nobody watching sees it.
 *
 * @param {object} client - a Supabase client
 * @param {string[]} siteIds - the sites to listen on
 * @param {() => void} onSignal - called after each burst of signals settles
 * @param {{settleMs?: number, timers?: {set: Function, clear: Function}}} [options]
 * @returns {() => void} stops listening and leaves every channel
 */
export function listenForLive(client, siteIds, onSignal, options = {}) {
  const { settleMs = 300, timers = { set: setTimeout, clear: clearTimeout } } = options
  const ids = [...new Set(siteIds.filter(Boolean))].sort()
  if (!client?.channel || !ids.length) return () => {}

  let stopped = false
  let timer = null
  const channels = []

  const signalled = () => {
    if (stopped) return
    if (timer !== null) timers.clear(timer)
    timer = timers.set(() => {
      timer = null
      if (!stopped) onSignal()
    }, settleMs)
  }

  // The socket has to present the session before a private channel will let
  // it in. The client keeps the token current once it has one; asking for it
  // here covers the first join, made before the client has had cause to.
  const ready = Promise.resolve(client.realtime?.setAuth?.()).catch(() => undefined)

  ready.then(() => {
    if (stopped) return
    for (const id of ids) {
      const channel = client.channel(liveTopic(id), { config: { private: true } })
      channel.on('broadcast', { event: 'presence' }, signalled)
      channel.subscribe()
      channels.push(channel)
    }
  })

  return () => {
    stopped = true
    if (timer !== null) timers.clear(timer)
    timer = null
    for (const channel of channels.splice(0)) client.removeChannel(channel)
  }
}
