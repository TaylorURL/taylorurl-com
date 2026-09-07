import { useEffect, useRef } from 'react'
import { useMotionValue, useReducedMotion } from 'framer-motion'

/**
 * The queue that swells one block at a time as the page goes past.
 *
 * A block grows a little above the size it was laid out at, peaks once, and
 * comes back down, and the next block in reading order does not start until the
 * one before it has finished. That is the whole behaviour: at any moment at
 * most one thing on the page is above its own size, so the eye is handed from
 * block to block rather than watching a row of them breathe together.
 *
 * Reaching a block's own line on the way down is the cue, and cueing is the
 * only thing scroll does here. The swell that follows runs on a clock of its
 * own, so a flick does not blow it through in two frames, inching down does not
 * leave it stalled half grown, and turning round does not run it backwards. The
 * obvious implementation makes size a function of scroll position, and a size
 * that is a function of scroll position is a readout of the wheel rather than
 * something the block does.
 *
 * Coming back down the page is the only way to see one again. A block that has
 * swelled is spent until the reader is back above its own line, so scrolling to
 * the top does not replay every swell on the page in reverse on the way.
 *
 * A block's line is its own arrival and nothing else. Two cards side by side
 * arrive together, so they are cued together and relay through one after the
 * other while the reader sits still - the queue holds them apart in time, which
 * is where the collision actually is, rather than in scroll distance, which
 * would charge the reader another half a window of scrolling for the second
 * card in a row it can already see.
 *
 * The queue is shared by every block that joins it rather than held per band,
 * because two bands meeting at a section edge are as able to collide as two
 * cards in one row, and a per-band queue cannot see the collision.
 *
 * Order is document order, taken from the nodes themselves. A grid reads
 * left-to-right and top-to-bottom in the DOM, which is the order a reader takes
 * it in, and it is the one ordering that survives a breakpoint moving a card
 * from the end of one row to the start of the next.
 */

/** How much bigger a block gets at its peak, with 1 being the size it was laid out at. */
const PEAK = 1.035

/**
 * How long one swell runs, from the cue to back at rest.
 *
 * Longer than the ceiling the site's transitions answer to, and deliberately
 * so. That ceiling is on motion a reader is waiting behind - a reveal, a page
 * change, a panel opening - where every extra frame is a frame of not being
 * able to read the thing yet. Nothing waits on a swell. It runs under content
 * that is already on the screen and already legible, so the reason to keep it
 * short does not apply here, and held to the ceiling it read as a flinch
 * rather than as something growing.
 */
const SPAN = 1000

/**
 * How far down the window a block's middle has to come to count as arrived, as
 * a share of the window height.
 *
 * Two thirds down is far enough in to be what the reader is looking at and
 * early enough that the swell has run by the time the block reaches the middle.
 * Being a share rather than a distance is what keeps a short window from
 * cueing everything at once.
 */
const ARRIVAL = 0.66

/**
 * How far back above its own line a spent block has to be before it will swell
 * again.
 *
 * Without it a hand resting on the trackpad at the line drifts across, back and
 * across again, and fires the block every time.
 */
const REARM = 32

const queue = new Set()
const waiting = []
let ordered = []
let watcher = null
let pending = 0
let cueing = 0
let playing = null

const byDocument = (a, b) => {
  const where = a.el.compareDocumentPosition(b.el)
  if (where & Node.DOCUMENT_POSITION_FOLLOWING) return -1
  if (where & Node.DOCUMENT_POSITION_PRECEDING) return 1
  return 0
}

/**
 * Read every block's place on the page and tell it where its line is.
 *
 * Nothing here looks at where any other block is. A block is cued by its own
 * arrival, and two blocks that arrive at the same moment are handed to the
 * queue in document order to be relayed through.
 */
function measure() {
  if (!queue.size) {
    ordered = []
    return
  }
  ordered = [...queue].sort(byDocument)
  const view = window.innerHeight

  for (const member of ordered) {
    const box = member.el.getBoundingClientRect()
    member.settle(box.top + window.scrollY + box.height / 2 - view * ARRIVAL)
  }
}

function schedule() {
  if (typeof window === 'undefined' || pending) return
  pending = requestAnimationFrame(() => {
    pending = 0
    measure()
  })
}

function onScroll() {
  if (cueing) return
  cueing = requestAnimationFrame(() => {
    cueing = 0
    const y = window.scrollY
    for (const member of ordered) member.cue(y)
  })
}

/**
 * Hand the queue on to whoever is next.
 *
 * A block that has left the screen while it waited has missed its turn rather
 * than earned a late one. The swell is for the reader looking at the block, and
 * a reader who flicked through the band is not looking at any of them - so a
 * flick swells the one that was on screen and drops the rest, instead of
 * playing a backlog to an empty stretch of page.
 */
function next() {
  playing = null
  while (waiting.length) {
    const member = waiting.shift()
    if (queue.has(member) && member.onScreen()) {
      playing = member
      member.run(next)
      return
    }
  }
}

function play(member) {
  if (!queue.has(member)) return
  if (playing) {
    if (!waiting.includes(member)) waiting.push(member)
    return
  }
  playing = member
  member.run(next)
}

/**
 * Take a block into the queue, and watch for anything that would move it.
 *
 * A picture landing above the band moves every block below it without any of
 * them changing size, so the document's own height is watched alongside the
 * blocks themselves.
 */
function join(member) {
  const first = queue.size === 0
  queue.add(member)

  if (typeof ResizeObserver !== 'undefined') {
    if (!watcher) {
      watcher = new ResizeObserver(schedule)
      watcher.observe(document.documentElement)
    }
    watcher.observe(member.el)
  }
  if (first) {
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', onScroll, { passive: true })
  }
  schedule()

  return () => {
    queue.delete(member)
    ordered = ordered.filter(other => other !== member)
    watcher?.unobserve(member.el)

    const held = waiting.indexOf(member)
    if (held >= 0) waiting.splice(held, 1)
    // A block that unmounts mid-swell never reaches the end of its own run, so
    // the queue is handed on here or it stops forever on a block that is gone.
    if (playing === member) next()

    if (!queue.size) {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', onScroll)
      watcher?.disconnect()
      watcher = null
    }
    schedule()
  }
}

/**
 * One block's place in the queue.
 *
 * The curve is a raised cosine over the swell's own span: the size leaves 1 and
 * comes back to 1 with no corner at either end. Flat at both ends is what makes
 * the queue hold - a curve with a tail would have a block still fractionally
 * large while the next one was already growing, which is the overlap the queue
 * exists to prevent.
 *
 * Nothing is sprung. A spring carries momentum out of the end of the swell, and
 * a block still settling is a block still bigger than the one that has just
 * been handed the reader's eye.
 *
 * A block the reader is already past is not armed, which is read fresh on every
 * measurement. Otherwise a page opened part way down, or a picture landing and
 * moving the band, would cue a swell for something off the top of the screen.
 *
 * Honors `prefers-reduced-motion` by not joining the queue at all, which leaves
 * the block at the size it was laid out at and puts no transform on it.
 * `<MotionConfig reducedMotion="user">` does not reach a style written from a
 * frame loop, so this reads the preference itself.
 *
 * @param {object} [options]
 * @param {number} [options.peak] How much bigger the block gets at its peak.
 * @param {string} [options.origin] `transform-origin` for the growth. Blocks
 *   set narrower than the rail take `left`, so a heading grows without leaving
 *   the line the band below it is set to.
 * @returns {{ ref: import('react').MutableRefObject, style: object|undefined }}
 *   `ref` attaches to the block, `style` to the same element. The element must
 *   carry no other Framer animation: a variant writing `transform` and this
 *   writing `scale` are the same property twice.
 */
export function useScrollSwell({ peak = PEAK, origin = 'center' } = {}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const scale = useMotionValue(1)

  useEffect(() => {
    const el = ref.current
    if (reduced || !el) return undefined

    let line = null
    let armed = false
    let frame = 0

    const member = {
      el,

      settle(at) {
        line = at
        armed = window.scrollY < line
      },

      cue(y) {
        if (line === null) return
        if (!armed) {
          if (y < line - REARM) armed = true
          return
        }
        if (y < line) return
        armed = false
        if (member.onScreen()) play(member)
      },

      onScreen() {
        const box = el.getBoundingClientRect()
        return box.bottom > 0 && box.top < window.innerHeight
      },

      run(finished) {
        const started = performance.now()
        const step = now => {
          const through = Math.min(1, (now - started) / SPAN)
          scale.set(1 + (peak - 1) * (0.5 - 0.5 * Math.cos(2 * Math.PI * through)))
          if (through < 1) {
            frame = requestAnimationFrame(step)
            return
          }
          frame = 0
          finished()
        }
        frame = requestAnimationFrame(step)
      },

      stop() {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        scale.set(1)
      },
    }

    const leave = join(member)
    return () => {
      member.stop()
      leave()
    }
  }, [reduced, peak, scale])

  return { ref, style: reduced ? undefined : { scale, transformOrigin: origin } }
}
