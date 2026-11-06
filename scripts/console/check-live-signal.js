/**
 * Proves the console hears the collector's signal: one private channel per
 * site the account holds, one re-read of the live view per burst of arrivals
 * and departures, and every channel left when the console stops listening.
 *
 * The client is a stand-in that records what was joined and lets the check
 * fire a signal by hand, and the timers are the check's own, so nothing here
 * opens a socket or waits on a clock.
 *
 *   npm run check:live-signal
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { listenForLive, liveTopic } from '../../src/app/hooks/console/liveSignal.js'
import { check, finish, ok, same } from '../harness/checks.js'

function standIn() {
  const joined = []
  const left = []
  let authed = 0
  return {
    joined,
    left,
    authed: () => authed,
    realtime: {
      setAuth: async () => {
        authed += 1
      },
    },
    channel(topic, options) {
      const handlers = []
      const channel = {
        topic,
        options,
        on(type, filter, handler) {
          handlers.push({ type, event: filter.event, handler })
          return channel
        },
        subscribe() {
          joined.push(channel)
          return channel
        },
        fire(event) {
          for (const one of handlers)
            if (one.type === 'broadcast' && one.event === event) one.handler({})
        },
      }
      return channel
    },
    removeChannel(channel) {
      left.push(channel.topic)
    },
  }
}

function clock() {
  let next = 1
  const pending = new Map()
  return {
    timers: {
      set: (run, ms) => {
        const id = next++
        pending.set(id, { run, ms })
        return id
      },
      clear: id => pending.delete(id),
    },
    pending,
    runAll() {
      for (const [id, { run }] of [...pending]) {
        pending.delete(id)
        run()
      }
    },
  }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

check('one private channel per site, joined after the session is presented', async () => {
  const client = standIn()
  const stop = listenForLive(client, ['b', 'a', 'a', ''], () => {})
  await settle()
  same(client.authed(), 1, 'the session is presented once before joining')
  same(
    client.joined.map(channel => channel.topic).join(','),
    [liveTopic('a'), liveTopic('b')].join(','),
    'each site once, blanks dropped'
  )
  ok(
    client.joined.every(channel => channel.options?.config?.private === true),
    'a channel was joined in the open'
  )
  same(liveTopic('a'), 'analytics:live:a', 'the topic the database sends on')
  stop()
})

check('a burst of signals is one re-read, after it settles', async () => {
  const client = standIn()
  const time = clock()
  let reads = 0
  const stop = listenForLive(client, ['a', 'b'], () => (reads += 1), { timers: time.timers })
  await settle()
  client.joined[0].fire('presence')
  client.joined[1].fire('presence')
  client.joined[0].fire('presence')
  same(reads, 0, 'read before the burst settled')
  same(time.pending.size, 1, 'one wait for the whole burst')
  time.runAll()
  same(reads, 1, 'one re-read for three signals')
  client.joined[1].fire('something-else')
  same(time.pending.size, 0, 'another event on the channel is not a signal')
  stop()
})

check('stopping leaves every channel and drops a re-read still waiting', async () => {
  const client = standIn()
  const time = clock()
  let reads = 0
  const stop = listenForLive(client, ['a', 'b'], () => (reads += 1), { timers: time.timers })
  await settle()
  client.joined[0].fire('presence')
  stop()
  time.runAll()
  same(reads, 0, 'a re-read ran for a console that had stopped listening')
  same(client.left.sort().join(','), [liveTopic('a'), liveTopic('b')].join(','), 'channels left')
})

check('stopping before the session was presented joins nothing', async () => {
  const client = standIn()
  const stop = listenForLive(client, ['a'], () => {})
  stop()
  await settle()
  same(client.joined.length, 0, 'a channel was joined after the console stopped listening')
  same(listenForLive(client, [], () => {})(), undefined, 'no sites is nothing to join')
  same(listenForLive(null, ['a'], () => {})(), undefined, 'no client is nothing to join')
})

check('the frame listens on every site it knows and re-reads the live view on a signal', () => {
  const frame = readFileSync(
    join(import.meta.dirname, '../../src/app/views/console/ConsoleFrame.jsx'),
    'utf8'
  )
  ok(/useLiveSignal\(\{/.test(frame), 'the frame does not listen for the signal')
  ok(/siteIds: knownSites\.map\(row => row\.site_id\)/.test(frame), 'it listens on a narrower list')
  const handler = frame.slice(frame.indexOf('const onSignal = useCallback('))
  ok(
    /^[^]*?live\.refresh\(\)/.test(handler.slice(0, 200)),
    'a signal does not re-read the live view'
  )
  ok(/LIVE_WINDOW_SECONDS = 90/.test(frame), 'the first frame captions a different window')
})

await finish()

console.log('live signal: the console re-reads who is on the moment somebody arrives or leaves')
