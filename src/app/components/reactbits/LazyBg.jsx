import { Suspense, useEffect, useRef, useState } from 'react'
import QuietBoundary from '../app-shell/QuietBoundary'
import { lazyWithRetry } from '@utils/lazyWithRetry'

const Aurora = lazyWithRetry(() => import('./Aurora/Aurora'))
const Particles = lazyWithRetry(() => import('./Particles/Particles'))

// How far ahead of the viewport a background is built. Far enough that it has
// drawn its first frame before the section it sits behind is scrolled to, near
// enough that a wash at the foot of a long page is not compiling shaders while
// somebody is still reading the top of it.
const LEAD_IN = '300px'

/**
 * Holds its children back until the space they fill comes within reach of the
 * viewport. A background is decoration, and decoration nobody can see is worth
 * neither the download nor the frame: a WebGL surface that mounts on load runs
 * its shader against the first paint of the page above it, and on a machine
 * without a GPU that shader is rasterised on the same thread the page is
 * drawing on.
 *
 * The gate is an effect, so the prerendered HTML carries none of this either.
 */
function NearViewport({ children }) {
  const ref = useRef(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const frame = ref.current
    if (!frame) return undefined
    if (typeof IntersectionObserver !== 'function') {
      setNear(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setNear(true)
        observer.disconnect()
      },
      { rootMargin: LEAD_IN }
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="h-full w-full">
      {near ? children : null}
    </div>
  )
}

/**
 * The two WebGL backgrounds, split out of the route's initial bundle and held
 * until the reader is near them. Both draw decoration and nothing else, so a
 * visit that never reaches one never pays for it.
 *
 * Which is also why neither may answer for the page it sits behind. These mount
 * from a scroll, long after the document was served, and the chunk they ask for
 * is the deploy's to delete; without the boundary that rejection reached the
 * one above the routes, and a wash at the foot of a page reloaded the page.
 */
export function LazyAurora(props) {
  return (
    <NearViewport>
      <QuietBoundary>
        <Suspense fallback={null}>
          <Aurora {...props} />
        </Suspense>
      </QuietBoundary>
    </NearViewport>
  )
}

export function LazyParticles(props) {
  return (
    <NearViewport>
      <QuietBoundary>
        <Suspense fallback={null}>
          <Particles {...props} />
        </Suspense>
      </QuietBoundary>
    </NearViewport>
  )
}
