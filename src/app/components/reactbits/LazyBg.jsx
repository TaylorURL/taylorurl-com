import { lazy, Suspense } from 'react'
import ClientOnly from './ClientOnly'

/**
 * Client-only, code-split wrappers for the WebGL (ogl) backgrounds. The site
 * targets sub-two-second loads, so the ~50KB ogl runtime must never sit in a
 * route's initial bundle. ClientOnly keeps them out of the prerendered HTML;
 * React.lazy pushes ogl into its own async chunk that is fetched only after the
 * page has mounted on the client. Both are purely decorative, so a null
 * fallback until the chunk lands is exactly right.
 */
const Aurora = lazy(() => import('./Aurora/Aurora'))
const Particles = lazy(() => import('./Particles/Particles'))

export function LazyAurora(props) {
  return (
    <ClientOnly>
      <Suspense fallback={null}>
        <Aurora {...props} />
      </Suspense>
    </ClientOnly>
  )
}

export function LazyParticles(props) {
  return (
    <ClientOnly>
      <Suspense fallback={null}>
        <Particles {...props} />
      </Suspense>
    </ClientOnly>
  )
}
