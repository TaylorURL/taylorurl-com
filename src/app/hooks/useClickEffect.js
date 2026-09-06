import { useEffect } from 'react'

/**
 * What the page does at the cursor when it is clicked, anywhere.
 *
 * Press feedback answers for the control that was hit: a button scales under
 * the finger and the finger learns it landed. Nothing answers for the click
 * itself, which is why a site where every control presses correctly can still
 * feel like it is only accepting input rather than responding to it.
 *
 * One hairline ring opens from the point of the press and is gone inside half a
 * second. It draws on a fixed layer of its own rather than inside whatever was
 * clicked, so an ancestor with hidden overflow cannot clip it, and the layer
 * takes no pointer events, so it never stands between a reader and a control.
 *
 * Left button only: a right-click is opening a menu and does not want a
 * flourish underneath it. Nothing at all under reduced motion, which is a
 * setting about exactly this.
 */
export function useClickEffect() {
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')

    const layer = document.createElement('div')
    layer.className = 'click-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(layer)

    const draw = event => {
      if (still.matches || event.button !== 0) return
      const ripple = document.createElement('span')
      ripple.className = 'click-ripple'
      ripple.style.left = `${event.clientX}px`
      ripple.style.top = `${event.clientY}px`
      layer.appendChild(ripple)
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
    }

    document.addEventListener('pointerdown', draw)
    return () => {
      document.removeEventListener('pointerdown', draw)
      layer.remove()
    }
  }, [])
}
