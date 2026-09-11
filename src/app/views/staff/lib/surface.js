import { useEffect, useRef } from 'react'

/** How far the column travels before the head starts casting over it. */
const CAST_AT = 4

/**
 * Whether the column has moved under the head, written to the head as an
 * attribute rather than held in state.
 *
 * A bar only throws a shadow onto something. Until the column has scrolled there
 * is nothing under the head but the top of the first line, and a bar casting
 * over a page that is sitting at its own top reads as a bar stuck to the page
 * rather than one held above it. The site's own navigation settled this the same
 * way and calls it `data-surfaced`, so the staff bars answer to the same name.
 *
 * The scroll position never reaches React: a representative scrolls the call
 * screen with a thumb while reading it, and re-rendering the whole column on
 * every frame of that is a screen that stutters under the thing it is for.
 *
 * @returns {{scroll: React.RefObject<HTMLElement>, head: React.RefObject<HTMLElement>}}
 */
export function useSurfaced() {
  const scroll = useRef(null)
  const head = useRef(null)

  useEffect(() => {
    const column = scroll.current
    if (!column) return undefined
    let cast = null
    const read = () => {
      const now = column.scrollTop > CAST_AT
      if (now === cast) return
      cast = now
      head.current?.setAttribute('data-surfaced', String(now))
    }
    read()
    column.addEventListener('scroll', read, { passive: true })
    return () => column.removeEventListener('scroll', read)
  }, [])

  return { scroll, head }
}

/**
 * The light a pane carries under the pointer, for a grid of them.
 *
 * One listener on the grid rather than one per tile: the tile under the pointer
 * is the one the event came through, so finding it is a `closest` call and
 * adding four tiles changes nothing here. The position is written as two custom
 * properties and the gradient is built in the stylesheet, which is the same
 * arrangement the site's own spotlight card uses and for the same reason - a
 * pointer crossing a tile fires often enough that a render per frame is felt.
 *
 * @param {string} selector The pane inside the grid that takes the light.
 * @returns {{ref: React.RefObject<HTMLElement>}}
 */
export function usePointerLight(selector) {
  const ref = useRef(null)
  const frame = useRef(0)
  const next = useRef(null)

  useEffect(() => {
    const grid = ref.current
    if (!grid) return undefined
    // A coarse pointer has no hover to follow, and lighting the tile a thumb
    // has just landed on is a light nobody sees before the screen changes.
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined

    // One write a frame, whatever the pointer did in between. Everything the
    // move handler learned is left here and read back on the frame itself.
    const write = () => {
      frame.current = 0
      const at = next.current
      if (!at) return
      at.pane.style.setProperty('--lit-x', `${at.x}px`)
      at.pane.style.setProperty('--lit-y', `${at.y}px`)
      at.pane.style.setProperty('--lit', '1')
    }

    const paneUnder = event =>
      event.target instanceof Element ? event.target.closest(selector) : null

    const onMove = event => {
      const pane = paneUnder(event)
      if (!pane) return
      const box = pane.getBoundingClientRect()
      next.current = { pane, x: event.clientX - box.left, y: event.clientY - box.top }
      if (!frame.current) frame.current = requestAnimationFrame(write)
    }

    // A pointer moving between two children of the same pane leaves one of them
    // without leaving the pane, so the light goes out on the pane the pointer
    // actually left rather than on every crossing inside it.
    const onOut = event => {
      const pane = paneUnder(event)
      if (pane && !pane.contains(event.relatedTarget)) pane.style.setProperty('--lit', '0')
    }

    grid.addEventListener('pointermove', onMove)
    grid.addEventListener('pointerout', onOut)
    return () => {
      grid.removeEventListener('pointermove', onMove)
      grid.removeEventListener('pointerout', onOut)
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [selector])

  return { ref }
}
