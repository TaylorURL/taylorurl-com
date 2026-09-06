import { useEffect, useState } from 'react'

/**
 * Whether the page sits below a scroll depth.
 *
 * A sentinel of that exact height is parked at the top of the document and
 * watched, so the browser reports the crossing once in each direction. Asking
 * `window.scrollY` on every scroll event answers the same question but runs a
 * React render on frames where the answer has not changed.
 */
export function useScrolledPast(threshold) {
  const [past, setPast] = useState(false)

  useEffect(() => {
    const sentinel = document.createElement('div')
    sentinel.setAttribute('aria-hidden', 'true')
    Object.assign(sentinel.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '1px',
      height: `${threshold}px`,
      pointerEvents: 'none',
      visibility: 'hidden',
    })
    document.body.appendChild(sentinel)

    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting))
    observer.observe(sentinel)

    return () => {
      observer.disconnect()
      sentinel.remove()
    }
  }, [threshold])

  return past
}
