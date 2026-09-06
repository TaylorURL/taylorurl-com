import { m } from 'framer-motion'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { EASE, fadeInUpMount } from '@constants/animations'
import { AccentGradient } from '@reactbits/kit'
import { HOME } from '@data/homeTaylorwebsite'
import HeroActions from './HeroActions'

const rise = delay => ({
  ...fadeInUpMount,
  transition: { ...fadeInUpMount.transition, delay },
})

/**
 * The hero for the site that sells three things.
 *
 * It carries no figure, and that is the decision rather than an omission. The
 * studio's four presentations each set a picture beside the words - a client's
 * listing, a work order, a ruled artboard - because the studio has an artefact
 * to hold up. The three services here produce software somebody logs into, a
 * measurement that reports the truth, and mail nobody outside the client's
 * inbox ever sees, and a drawing of any of those would be a picture invented
 * for the page. So the offer is set as type and the section below it carries
 * the terms.
 *
 * One presentation rather than a rotation, for the same reason: four readings
 * of one offer is a thing a site with one offer can do.
 */
export default function HeroLines() {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-bg pt-24 text-ink">
      <div
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.plan} ${SEAMS.hero}`}
        aria-hidden="true"
      />

      <div className="container-rail relative pb-20">
        <m.p {...rise(0)} className="section-label-sm flex items-center gap-3 text-ink-mute">
          <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
          {HOME.hero.eyebrow}
        </m.p>

        <h1 className="display-1 mt-8 font-semibold leading-[0.88] tracking-tightest text-ink [text-wrap:balance]">
          {HOME.hero.headline.map((line, i) => (
            <m.span key={line} {...rise(0.08 + i * 0.08)} className="block">
              {line}{' '}
            </m.span>
          ))}
          <m.span {...rise(0.08 + HOME.hero.headline.length * 0.08)} className="block">
            <AccentGradient>{HOME.hero.headlineAccent}</AccentGradient>
          </m.span>
        </h1>

        {/* The datum under the three lines. It draws from the left once they
            have all arrived, so the eye finishes the offer and is handed down
            to the terms it is on. */}
        <m.div
          initial={{ transform: 'scaleX(0)' }}
          animate={{ transform: 'scaleX(1)' }}
          transition={{ duration: 0.45, delay: 0.36, ease: EASE }}
          className="border-hair-strong relative mt-12 origin-left border-t"
          aria-hidden="true"
        >
          <span className="absolute left-0 top-0 h-3 w-px bg-accent" />
        </m.div>

        <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <m.p
            {...rise(0.44)}
            className="max-w-[46ch] text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
          >
            {HOME.hero.lede}
          </m.p>
          <m.div {...rise(0.52)} className="flex-shrink-0">
            <HeroActions />
          </m.div>
        </div>
      </div>
    </section>
  )
}
