import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight, Bug } from 'lucide-react'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import Seo from '@components/Seo'
import { EASE, fadeInUpMount, settleIn } from '@constants/animations'
import { announceGroundChange } from '@hooks/theme/useOnDarkBackground'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import { useTheme } from '@hooks/theme/useTheme'
import Magnet from '@reactbits/Magnet/Magnet'
import { LazyAurora } from '@reactbits/LazyBg'
import { AccentGradient } from '@reactbits/kit'
import { IS_SECOND_SITE } from '../../../lib/site/current.js'

const BUG_SIZE = 28
const MOVE_INTERVAL_MS = 1200

// The entrance is kept short here because the reader arrived by mistake: the
// two ways off this page are the fourth thing to land, not the last.
const ENTER_STEP = 0.08

const entering = index => ({
  ...fadeInUpMount,
  transition: { ...fadeInUpMount.transition, delay: index * ENTER_STEP },
})

/**
 * What the page tells a crawler it is.
 *
 * `noIndex` is on, so this is read by a reader who opened the source or a tool
 * that ignores the directive rather than by search - which is exactly why it
 * cannot be the other site's offer. The rest of the page says nothing about
 * what is sold here and needs no second version.
 */
const DESCRIPTION = IS_SECOND_SITE
  ? 'That page is not here. Head back to the home page for software built to order, conversion tracking repaired, and outbound email run for you.'
  : 'That page is not here. Head back to the home page for websites, redesigns, hosting, and local search work for Baytown and Houston businesses.'

export default function NotFound() {
  // The bar above reads the ground by sampling the page, and a view that
  // arrives in its own chunk lands after that reading was taken. This says so.
  useEffect(() => announceGroundChange(), [])

  const [score, setScore] = useState(0)
  const [bugPos, setBugPos] = useState({ x: 0, y: 0 })
  const intervalRef = useRef(null)
  const gridRef = useRef(null)

  const moveBug = useCallback(() => {
    const el = gridRef.current
    const size = el ? el.offsetWidth : 280
    setBugPos({
      x: Math.random() * (size - BUG_SIZE),
      y: Math.random() * (size - BUG_SIZE),
    })
  }, [])

  useEffect(() => {
    moveBug()
    intervalRef.current = setInterval(moveBug, MOVE_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
  }, [moveBug])

  const catchBug = () => {
    setScore(prev => prev + 1)
    moveBug()
  }

  // Scroll-driven parallax — the blueprint grid backdrop drifts slowly and the
  // bug-catcher panel rises faster, giving the otherwise-static 404 a small
  // sense of depth on viewports tall enough to scroll. Both collapse under
  // reduced motion via the hook's built-in handling.
  const { ref: sectionRef, transform: gridTransform } = useScrollParallax({
    range: [0, -50],
  })
  const { ref: panelRef, transform: panelTransform } = useScrollParallax({
    range: [60, -60],
  })
  // The aurora belongs to the slab, and under the light setting this ground
  // stands down to the field. Additive light over the field is a smear.
  const { resolved } = useTheme()

  return (
    <div
      ref={sectionRef}
      data-ground="dark"
      className="relative flex min-h-[calc(100dvh-var(--nav-height))] items-center justify-center overflow-hidden bg-bg pb-16 pt-32 text-ink sm:pb-20 sm:pt-44"
    >
      {resolved === 'dark' && (
        <div
          className="pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
          aria-hidden="true"
        >
          <LazyAurora amplitude={1.2} blend={0.6} speed={0.7} />
        </div>
      )}
      <m.div
        style={{ transform: gridTransform }}
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.hatch} ${SEAMS.hero}`}
        aria-hidden="true"
      />
      <Seo title="Page Not Found" description={DESCRIPTION} path="/404" noIndex />

      <div className="container-rail-tight relative grid items-center gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="section-label mb-6 text-accent">Page Not Found · 404</p>
          <m.p
            {...entering(0)}
            className="watermark-numeral font-mono font-semibold leading-none tracking-tightest text-ink"
          >
            <AccentGradient>404</AccentGradient>
          </m.p>

          <m.h1
            {...entering(1)}
            className="display-4 mt-6 font-semibold tracking-tightest text-ink [text-wrap:balance]"
          >
            Nothing is at this address.
          </m.h1>

          <m.p {...entering(2)} className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-soft">
            Catch a few bugs while you&apos;re here, then head to the home page or tell us what you
            were after.
          </m.p>

          <m.div {...entering(3)} className="mt-10 flex flex-wrap gap-4">
            <Magnet padding={60} magnetStrength={5}>
              <Link to="/" className="btn btn-primary group">
                Return to Home
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Magnet>
            <Magnet padding={60} magnetStrength={5}>
              <Link to="/contact" className="btn btn-secondary">
                Get in Touch
              </Link>
            </Magnet>
          </m.div>
        </div>

        <m.div
          ref={panelRef}
          {...settleIn}
          transition={{ ...settleIn.transition, delay: 4 * ENTER_STEP }}
          style={{ transform: panelTransform }}
          className="relative w-full max-w-[320px] justify-self-center will-change-transform lg:justify-self-end"
        >
          <div className="panel-static relative bg-bg p-5">
            <div className="section-label-sm mb-4 flex items-baseline justify-between text-ink-faint">
              <span>Bug Catcher</span>
              <span className="text-accent">
                Caught ·{' '}
                <span className="font-mono font-semibold tabular-nums text-ink">
                  {String(score).padStart(2, '0')}
                </span>
              </span>
            </div>
            <div
              ref={gridRef}
              className="border-hair-strong bg-surface-1 relative mx-auto w-full overflow-hidden border border-dashed"
              style={{ aspectRatio: '1 / 1' }}
            >
              <div
                className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.plan} ${SEAMS.card}`}
                aria-hidden="true"
              />
              <m.button
                type="button"
                onClick={catchBug}
                animate={{ transform: `translateX(${bugPos.x}px) translateY(${bugPos.y}px)` }}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inline-flex min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation items-center justify-center text-accent transition-colors hover:text-[color:var(--accent-hi)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:opacity-70"
                whileHover={{
                  transform: `translateX(${bugPos.x}px) translateY(${bugPos.y}px) scale(1.25)`,
                }}
                whileTap={{
                  transform: `translateX(${bugPos.x}px) translateY(${bugPos.y}px) scale(0.78)`,
                }}
                aria-label="Catch the bug"
              >
                <Bug className="h-7 w-7" strokeWidth={1.5} />
              </m.button>
            </div>
            <p className="section-label-sm mt-4 text-ink-faint">Catch the bug before it moves</p>
          </div>
        </m.div>
      </div>
    </div>
  )
}
