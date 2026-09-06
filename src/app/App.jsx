import { Suspense } from 'react'
import { DeferredWaiting } from '@components/Waiting'
import ErrorBoundary from '@components/ErrorBoundary'
import { useClickEffect } from '@hooks/useClickEffect'
import AppRoutes from './routes'

/**
 * The routed page, under whichever router the entry above it mounted.
 *
 * Both entries render this, and render it at the same depth, because the ids
 * React generates below here are numbered by position and have to come out the
 * same in the markup and in the browser.
 */
export default function App({ views }) {
  useClickEffect()

  return (
    <ErrorBoundary>
      {/* The page a visitor arrives on is the only one that reaches this:
          every navigation after it keeps the page already on screen until the
          next one is ready, so the crossfade in Layout is what a reader sees.
          A first load quick enough to beat the delay draws nothing at all. */}
      <Suspense fallback={<DeferredWaiting />}>
        <AppRoutes views={views} />
      </Suspense>
    </ErrorBoundary>
  )
}
