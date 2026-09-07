import { m, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { announceGroundChange } from '@hooks/theme/useOnDarkBackground'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import BlurText from '@reactbits/BlurText/BlurText'
import { LazyParticles } from '@reactbits/LazyBg'
import { useThemeTokens } from '@hooks/theme/useThemeTokens'
import { fadeInUpMount, settleIn } from '@constants/animations'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { SITE } from '../../../../lib/site/current.js'

// How far apart the headline's words start, and how early the run is tripped.
// The stagger is the site's own step, and the margin is the one the shared
// reveals carry, so the words are moving before the headline reaches the reader
// rather than after.
const TITLE_STAGGER_MS = 60
const TITLE_MARGIN = '0px 0px 15% 0px'

/**
 * Shared hero for every secondary view: a full-bleed dark slab under either
 * setting, a faint field, and scroll-driven parallax.
 *
 * The headline column rises and fades on the way past while the field drifts
 * slower behind it, which is what separates the two layers. Under a
 * reduced-motion setting both travel ranges collapse to zero and the headline
 * holds its opacity, so the slab arrives composed rather than assembling.
 *
 * The hero is on nineteen of the twenty-one secondary views, so what it draws
 * is the largest single thing separating one page from another. It takes the
 * motif as a prop for that reason, and holds the seam that suits a slab at the
 * top of a document: no fade at its head, because there is nothing above it,
 * and a deep one at its foot, because the drift carries the fade with it and
 * the fade has to have finished before the drift can expose the slab's edge.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title - Heading content.
 * @param {string} [props.description] - Supporting line under the heading.
 * @param {string} [props.eyebrow] - Standing label above the heading.
 * @param {'plan' | 'ledger' | 'column' | 'node' | 'hatch' | 'iso' | 'quiet'}
 *   [props.draft] - What the slab's field draws.
 */
export default function PageHero({ title, description, eyebrow, draft = 'plan' }) {
  // Canvas takes colour values, not CSS, so the accent steps are resolved first.
  const tone = useThemeTokens(['--accent', '--accent-hi', '--accent-pale'])
  const reduced = useReducedMotion()

  // The bar above reads the ground by sampling the page, and a view that
  // arrives in its own chunk lands after that reading was taken. This says so.
  useEffect(() => announceGroundChange(), [])

  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })

  const rawOpacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.2])
  const opacity = useSpring(rawOpacity, { stiffness: 140, damping: 32, mass: 0.4 })

  const { ref: gridRef, transform: gridTransform } = useScrollParallax({
    range: [0, reduced ? 0 : -40],
  })

  return (
    <section
      ref={ref}
      data-ground="dark"
      className="relative isolate overflow-hidden bg-bg pb-20 pt-32 text-ink sm:pb-28 sm:pt-44"
    >
      <m.div
        ref={gridRef}
        style={{ transform: gridTransform }}
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS[draft]} ${SEAMS.hero}`}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
        aria-hidden="true"
      >
        <LazyParticles
          particleColors={[tone['--accent'], tone['--accent-hi'], tone['--accent-pale']]}
          particleCount={140}
          particleSpread={12}
          speed={0.06}
          particleBaseSize={64}
          alphaParticles
          disableRotation
        />
      </div>
      <div
        className="via-hair-strong absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent"
        aria-hidden="true"
      />

      <m.div style={{ opacity }} className="container-rail relative will-change-transform">
        {/* The studio's imprint, set opposite the headline. It carries no
            information the page needs, so it is hidden from the reading order
            and set at the quietest step the ground will hold. */}
        <m.div
          {...settleIn}
          transition={{ ...settleIn.transition, delay: 0.35 }}
          aria-hidden="true"
          className="section-label-sm pointer-events-none absolute right-6 top-0 hidden text-right leading-[1.9] text-ink-faint sm:right-10 md:block lg:right-16"
        >
          <p>TaylorURL LLC</p>
          <p>{SITE.locationShort}</p>
        </m.div>

        <m.p {...fadeInUpMount} className="section-label mb-4 block text-accent">
          {eyebrow || 'Overview'}
        </m.p>

        <m.h1
          {...fadeInUpMount}
          transition={{ ...fadeInUpMount.transition, delay: 0.05 }}
          className="display-1 max-w-3xl font-semibold leading-[0.98] tracking-tightest text-ink [text-wrap:balance]"
        >
          {typeof title === 'string' ? (
            <BlurText
              text={title}
              delay={TITLE_STAGGER_MS}
              animateBy="words"
              direction="top"
              threshold={0}
              rootMargin={TITLE_MARGIN}
            />
          ) : (
            title
          )}
        </m.h1>

        {description && (
          <m.p
            {...fadeInUpMount}
            transition={{ ...fadeInUpMount.transition, delay: 0.12 }}
            className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
          >
            {description}
          </m.p>
        )}
      </m.div>
    </section>
  )
}
