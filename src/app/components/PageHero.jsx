import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { useScrollParallax } from '@hooks/useScrollParallax'
import BlurText from '@reactbits/BlurText/BlurText'
import DecryptedText from '@reactbits/DecryptedText/DecryptedText'
import { LazyParticles } from '@reactbits/LazyBg'

/**
 * Cinematic page hero used by every secondary view. Full-bleed black canvas
 * with a faint blueprint grid, monumental ink-on-black title, and a scroll-
 * driven parallax — the headline column rises and softens as the user scrolls
 * past, while the blueprint grid drifts at a slower rate behind it for depth.
 * Reduced-motion users get the static composition with no transforms.
 */
export default function PageHero({ title, description, eyebrow }) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })

  const rawOpacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.2])
  const opacity = useSpring(rawOpacity, { stiffness: 140, damping: 32, mass: 0.4 })

  const { transform: contentTransform } = useScrollParallax({ range: [0, reduced ? 0 : -90] })
  const { ref: gridRef, transform: gridTransform } = useScrollParallax({
    range: [0, reduced ? 0 : -40],
  })

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden bg-bg pb-20 pt-32 text-ink sm:pb-28 sm:pt-44"
    >
      <motion.div
        ref={gridRef}
        style={{ transform: gridTransform }}
        className="grid-blueprint absolute inset-0 opacity-60 will-change-transform"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
        aria-hidden="true"
      >
        <LazyParticles
          particleColors={['#2f6bff', '#4f86ff', '#9dbcff']}
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

      <motion.div
        style={{ transform: contentTransform, opacity }}
        className="relative mx-auto w-full max-w-[1280px] px-6 will-change-transform sm:px-10 lg:px-16"
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent"
        >
          <span className="h-px w-8 bg-accent" />
          <DecryptedText
            text={eyebrow || '// Document'}
            animateOn="view"
            sequential
            speed={38}
            maxIterations={14}
          />
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl text-[clamp(2.4rem,6.4vw,5rem)] font-semibold leading-[0.98] tracking-tightest text-ink"
        >
          {typeof title === 'string' ? (
            <BlurText text={title} delay={90} animateBy="words" direction="top" stepDuration={0.4} />
          ) : (
            title
          )}
        </motion.h1>

        {description && (
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
          >
            {description}
          </motion.p>
        )}
      </motion.div>
    </section>
  )
}
