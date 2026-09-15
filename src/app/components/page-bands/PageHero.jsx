import { m, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { useAnnounceGround } from '@hooks/theme/useOnDarkBackground'
import BlurText from '@reactbits/BlurText/BlurText'
import { LazyParticles } from '@reactbits/LazyBg'
import { useThemeTokens } from '@hooks/theme/useThemeTokens'
import { fadeInUpMount, rise, settleIn } from '@constants/animations'
import { SITE } from '../../../../lib/site/current.js'

// How far apart the headline's words start, and how early the run is tripped.
// The stagger is the site's own step, and the margin is the one the shared
// reveals carry, so the words are moving before the headline reaches the reader
// rather than after.
const TITLE_STAGGER_MS = 60
const TITLE_MARGIN = '0px 0px 15% 0px'

/**
 * Shared hero for every secondary view: a full-bleed dark slab under either
 * setting, carrying the headline column and the particles behind it.
 *
 * The headline column rises and fades on the way past. Under a reduced-motion
 * setting its travel collapses to zero and it holds its opacity, so the slab
 * arrives composed rather than assembling.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title - Heading content.
 * @param {string} [props.description] - Supporting line under the heading.
 * @param {string} [props.eyebrow] - Standing label above the heading.
 * @param {string} [props.image] - A photograph of the kind of place the page
 *   is about, standing beside the column where the slab is wide enough for
 *   both. It says nothing the words do not, so it is decoration to a screen
 *   reader and absent on a phone, where it would only hold the page's own
 *   work further down.
 * @param {import('react').ReactNode} [props.children] - Anything the page sets
 *   under the supporting line, on the same rise as the rest of the column.
 */
export default function PageHero({ title, description, eyebrow, image, children }) {
  // Canvas takes colour values, not CSS, so the accent steps are resolved first.
  const tone = useThemeTokens(['--accent', '--accent-hi', '--accent-pale'])
  const reduced = useReducedMotion()
  useAnnounceGround()

  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })

  const rawOpacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.2])
  const opacity = useSpring(rawOpacity, { stiffness: 140, damping: 32, mass: 0.4 })

  return (
    <section
      ref={ref}
      data-ground="dark"
      className="relative isolate overflow-hidden bg-bg pb-20 pt-32 text-ink sm:pb-28 sm:pt-44"
    >
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
            and set at the quietest step the ground will hold. A photograph
            stands in the same corner, so a hero carrying one goes without. */}
        {!image && (
          <m.div
            {...settleIn}
            transition={{ ...settleIn.transition, delay: 0.35 }}
            aria-hidden="true"
            className="section-label-sm pointer-events-none absolute right-6 top-0 hidden text-right leading-[1.9] text-ink-faint sm:right-10 md:block lg:right-16"
          >
            <p>TaylorURL LLC</p>
            <p>{SITE.locationShort}</p>
          </m.div>
        )}

        <div
          className={
            image
              ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-x-16 xl:grid-cols-[minmax(0,1fr)_24rem]'
              : undefined
          }
        >
          <div>
            <m.p {...fadeInUpMount} className="section-label mb-4 block text-accent">
              {eyebrow || 'Overview'}
            </m.p>

            <m.h1
              {...rise(0.05)}
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
                {...rise(0.12)}
                className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
              >
                {description}
              </m.p>
            )}

            {children && (
              <m.div {...rise(0.18)} className="mt-10">
                {children}
              </m.div>
            )}
          </div>

          {/* The photograph, on the same plane as the cards below it: the
              feature radius, the ground's own edge, and the lift a raised
              panel carries. It rises with the description rather than after
              the whole column, so the two halves of the slab arrive together. */}
          {image && (
            <m.figure {...rise(0.12)} aria-hidden="true" className="hidden lg:block">
              <img
                src={image}
                alt=""
                width="768"
                height="960"
                decoding="async"
                className="h-auto w-full rounded-[var(--r-feature)] object-cover shadow-[var(--edge),var(--raise-hi)]"
              />
            </m.figure>
          )}
        </div>
      </m.div>
    </section>
  )
}
