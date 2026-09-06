import { StrictMode } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { domAnimation, LazyMotion, MotionConfig } from 'framer-motion'
import { ToastProvider } from '@components/Toast'
import { PrerenderDataContext } from '@hooks/usePrerenderData'

/**
 * Everything wrapped around the router, for the build and for the browser both.
 *
 * The two entries render the same page and have to render it through the same
 * stack. React numbers the ids behind `useId` by where a component sits in the
 * tree, so a provider one side carries and the other does not renumbers every
 * generated id below it: the served markup points a control at a panel id the
 * browser will never give anything, and the pairing is silently broken for
 * anyone reading the page through it. Held in one file, the two cannot drift.
 *
 * `seed` is the build-time data for the route being rendered, and null in the
 * browser, where every consumer falls back to fetching.
 */
export default function Providers({ seed = null, children }) {
  return (
    <StrictMode>
      <PrerenderDataContext.Provider value={seed}>
        <HelmetProvider>
          {/* The chrome every page carries - the bar, the footer, the page
              transition - animates, so the animation library is a dependency of
              the first bundle and a phone pays for it before the hero has
              painted. `m` is the same component with the whole feature set left
              off it, and the features are named once here instead of dragged in
              by all 58 files that animate. `strict` is what holds it: it refuses
              the full component, so one later import cannot quietly put the
              difference back. */}
          <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
              <ToastProvider>{children}</ToastProvider>
            </MotionConfig>
          </LazyMotion>
        </HelmetProvider>
      </PrerenderDataContext.Provider>
    </StrictMode>
  )
}
