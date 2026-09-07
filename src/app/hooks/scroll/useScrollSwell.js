import { useEffect, useRef } from 'react'
import { useMotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion'

/**
 * The queue that swells one block at a time as the page goes past.
 *
 * A block grows a little above the size it was laid out at, peaks once, and
 * comes back down, and the next block in reading order does not start until the
 * one before it has finished. That is the whole behaviour: at any scroll
 * position at most one thing on the page is above its own size, so the eye is
 * handed from block to block rather than watching a row of them breathe
 * together.
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
 * How far apart two peaks are, as a share of the window height. It is the
 * length of one swell as well as the gap between two, because a swell that ran
 * longer than the gap would still be growing when its neighbour started.
 *
 * What sets it is the widest row on the page rather than how a single swell
 * feels. Three columns of one row are on the screen together for about a window
 * of scrolling, and their three turns have to fit inside that: at half a window
 * apiece the third column peaked with two thirds of itself already above the top
 * edge, which is a swell nobody is looking at.
 */
const STRIDE = 0.32

/** The shortest a swell may run, for a window too short for the share to mean anything. */
const MIN_STRIDE = 200

const queue = new Set()
let watcher = null
let pending = 0

const byDocument = (a, b) => {
  const where = a.el.compareDocumentPosition(b.el)
  if (where & Node.DOCUMENT_POSITION_FOLLOWING) return -1
  if (where & Node.DOCUMENT_POSITION_PRECEDING) return 1
  return 0
}

/**
 * The scroll position each block would peak at if nothing else were in the way,
 * spaced out so no two are closer together than one swell.
 *
 * Shifting each wanted position back by that block's own place in the queue
 * turns the spacing rule into a much simpler one: the queue is far enough apart
 * exactly when the shifted series never falls. So the job is to make a series
 * non-decreasing while moving it as little as possible, and pooling adjacent
 * violators does that - a place that falls below the one before it is pooled
 * with it and both take the average, and the pooled block is then checked
 * against the block before that.
 *
 * Two cards in one row want the same position, and pooling settles them either
 * side of it rather than pushing the second one late. A queue that only ever
 * pushed forward would hand a row's second card to the row below it, and by the
 * fourth card the peak would be arriving after the card had left the screen.
 *
 * @param {number[]} wanted Where each block would peak, in document order.
 * @param {number} stride The least distance allowed between two peaks.
 * @returns {number[]} Where each block actually peaks.
 */
function spaced(wanted, stride) {
  const blocks = []
  wanted.forEach((want, i) => {
    let sum = want - i * stride
    let count = 1
    while (blocks.length) {
      const previous = blocks[blocks.length - 1]
      if (previous.sum / previous.count <= sum / count) break
      blocks.pop()
      sum += previous.sum
      count += previous.count
    }
    blocks.push({ sum, count })
  })

  const at = []
  for (const block of blocks) {
    for (let k = 0; k < block.count; k += 1) at.push(block.sum / block.count)
  }
  return at.map((base, i) => base + i * stride)
}

/**
 * Read every block's place on the page and hand each one its turn.
 *
 * A block wants to peak when its own middle is at the middle of the window,
 * which is the moment a reader is looking at it. Everything after that is the
 * queue keeping two of those moments from being the same moment.
 */
function measure() {
  if (!queue.size) return
  const members = [...queue].sort(byDocument)
  const view = window.innerHeight
  const stride = Math.max(MIN_STRIDE, Math.round(view * STRIDE))

  const wanted = members.map(member => {
    const box = member.el.getBoundingClientRect()
    return box.top + window.scrollY + box.height / 2 - view / 2
  })

  const at = spaced(wanted, stride)
  members.forEach((member, i) => member.settle(at[i], stride))
}

function schedule() {
  if (typeof window === 'undefined' || pending) return
  pending = requestAnimationFrame(() => {
    pending = 0
    measure()
  })
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
  if (first) window.addEventListener('resize', schedule)
  schedule()

  return () => {
    queue.delete(member)
    watcher?.unobserve(member.el)
    if (!queue.size) {
      window.removeEventListener('resize', schedule)
      watcher?.disconnect()
      watcher = null
    }
    schedule()
  }
}

/**
 * One block's place in the queue.
 *
 * The curve is a raised cosine over the block's turn: the size leaves 1 and
 * comes back to 1 with no corner at either end, and it is flat 1 everywhere
 * outside. Flat outside is what makes the queue hold - a curve with a tail
 * would have a block still fractionally large while the next one was already
 * growing, which is the overlap the queue exists to prevent.
 *
 * Nothing is sprung. A spring lags the scroll, and a lagged swell would run on
 * past the end of its own turn and into its neighbour's.
 *
 * Honors `prefers-reduced-motion` by not joining the queue at all, which leaves
 * the block at the size it was laid out at and puts no transform on it.
 * `<MotionConfig reducedMotion="user">` does not reach a style written from a
 * scroll position, so this reads the preference itself.
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
  const turn = useRef(null)
  const version = useMotionValue(0)
  const { scrollY } = useScroll()

  useEffect(() => {
    const el = ref.current
    if (reduced || !el) return undefined
    return join({
      el,
      settle(at, stride) {
        turn.current = { at, half: stride / 2 }
        version.set(version.get() + 1)
      },
    })
  }, [reduced, version])

  const scale = useTransform([scrollY, version], ([y]) => {
    const its = turn.current
    if (!its || its.half <= 0) return 1
    const away = Math.abs(y - its.at)
    if (away >= its.half) return 1
    return 1 + (peak - 1) * (0.5 + 0.5 * Math.cos((away / its.half) * Math.PI))
  })

  return { ref, style: reduced ? undefined : { scale, transformOrigin: origin } }
}
