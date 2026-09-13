import { m } from 'framer-motion'
import { EASE, rise } from '@constants/animations'
import { AccentGradient } from '@reactbits/kit'
import HeroActions from './HeroActions'
import SearchSeamPlate from './SearchSeamPlate'

export default function HeroSeam() {
  return (
    <section className="relative isolate flex h-full min-h-[100svh] items-center overflow-hidden bg-bg pt-24 text-ink">
      <div className="container-rail relative grid items-center gap-14 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
        <div>
          <m.p {...rise(0)} className="section-label-sm flex items-center gap-3 text-ink-mute">
            <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
            TaylorURL LLC · Baytown, TX
          </m.p>

          <h1 className="display-1 mt-8 font-semibold leading-[0.94] tracking-tightest text-ink [text-wrap:balance]">
            <m.span {...rise(0.08)} className="block">
              Be the one{' '}
            </m.span>
            <m.span {...rise(0.16)} className="block">
              they <AccentGradient>call</AccentGradient>.
            </m.span>
          </h1>

          <m.p
            {...rise(0.28)}
            className="mt-8 max-w-[44ch] text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
          >
            Somebody searches, picks one, and calls. We build the site that gets picked, for shops
            around Baytown and clients anywhere.
          </m.p>

          <m.div {...rise(0.36)} className="mt-8">
            <HeroActions />
          </m.div>
        </div>

        <m.div
          initial={{ opacity: 0, transform: 'translateY(24px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.45, delay: 0.2, ease: EASE }}
        >
          <SearchSeamPlate />
        </m.div>
      </div>
    </section>
  )
}
