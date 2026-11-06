/**
 * One upstream read for the identical requests that arrive together.
 *
 * A console poll is cheap to make and can be expensive to answer. Where the
 * answer costs the far end real work, several callers asking the same question
 * in the same second are not several questions - they are one, asked by a
 * second tab, a retry, or a page that mounts the same feed twice. Served
 * separately they multiply the cost of the slowest thing in the request by the
 * number of callers, and that is how a read that is comfortable alone becomes
 * a read that times its own neighbours out.
 *
 * So the first caller does the work and the ones that arrive while it is in
 * flight are handed the same promise. The answer is then held for a moment
 * after it lands, which is what catches a retry arriving just behind a success
 * rather than beside it. The hold is deliberately shorter than the poll it
 * serves, so no caller is ever shown figures older than the interval it asked
 * on - what is collapsed is duplication, never a refresh.
 *
 * A failure is let go of immediately. Holding one would turn a single bad
 * second into a bad few seconds for everybody behind it, and the next caller
 * asking again is how a blip clears itself.
 *
 * The key is the caller's own, and it is the caller that decides what goes in
 * it. An authorised answer keyed on the question alone would be served to
 * whoever asked it next, so anything reading per-account figures puts the
 * session in the key and gets a hold per session.
 */

/**
 * A read held briefly per key, shared by whoever asks for it meanwhile.
 *
 * @param {number} keptMs How long a landed answer stays good for. Zero or less
 *   coalesces the requests in flight together and holds nothing after them.
 * @param {(...args: any[]) => Promise<any>} read Does the work.
 * @param {{now?: () => number}} [clock] The clock, for tests.
 * @returns {(key: string, ...args: any[]) => Promise<any>}
 */
export function coalesced(keptMs, read, { now = () => Date.now() } = {}) {
  const held = new Map()

  // Nothing is kept past its welcome: the keys carry a session each, so a
  // long-lived instance would otherwise hold one entry per session it ever
  // served. Sweeping on the way in keeps the map the size of what is live.
  const sweep = at => {
    for (const [key, sitting] of held) {
      if (at - sitting.at >= keptMs && sitting.settled) held.delete(key)
    }
  }

  return (key, ...args) => {
    const at = now()
    sweep(at)
    const sitting = held.get(key)
    // An entry still in flight is joined whatever the hold is, because the
    // work it is doing is the work this caller wanted.
    if (sitting && (!sitting.settled || at - sitting.at < keptMs)) return sitting.read
    const entry = { at, settled: false, read: null }
    // The work starts where it is asked for rather than a microtask later, so
    // a caller that counts the reads sees the one it just caused.
    let started
    try {
      started = Promise.resolve(read(...args))
    } catch (cause) {
      return Promise.reject(cause)
    }
    const reading = started.then(answer => {
      entry.settled = true
      entry.at = now()
      return answer
    })
    entry.read = reading
    held.set(key, entry)
    reading.catch(() => {
      if (held.get(key) === entry) held.delete(key)
    })
    return reading
  }
}
