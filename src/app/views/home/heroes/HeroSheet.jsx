import { m } from 'framer-motion'
import { EASE, fadeInUpMount } from '@constants/animations'
import { AccentGradient } from '@reactbits/kit'
import HeroActions from './HeroActions'

const rise = delay => ({
  ...fadeInUpMount,
  transition: { ...fadeInUpMount.transition, delay },
})

// The column rule the type is set against. Twelve columns at the rail width,
// drawn as one gradient rather than twelve elements, and pale enough that it
// reads as ruled paper behind the words instead of as lines across them.
const COLUMN_RULE = {
  backgroundImage: 'linear-gradient(to right, var(--rule-ink-fine) 1px, transparent 1px)',
  backgroundSize: 'calc(100% / 12) 100%',
}

export default function HeroSheet() {
  return (
    <section className="relative isolate flex h-full min-h-[100svh] items-center overflow-hidden bg-bg pt-24">
      <div className="pointer-events-none absolute inset-0 flex justify-center" aria-hidden="true">
        <div className="container-rail">
          <div className="h-full w-full" style={COLUMN_RULE} />
        </div>
      </div>

      <div className="container-rail relative pb-20">
        <m.p {...rise(0)} className="section-label-sm flex items-center gap-3 text-ink-mute">
          <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
          TaylorURL LLC · Baytown, TX
        </m.p>

        <h1 className="display-1 mt-8 font-semibold leading-[0.88] tracking-tightest text-ink [text-wrap:balance]">
          <m.span {...rise(0.08)} className="block">
            Look like the business{' '}
          </m.span>
          <m.span {...rise(0.16)} className="block">
            <AccentGradient>you already are.</AccentGradient>
          </m.span>
        </h1>

        {/* The measure under the headline: a drawn rule with a tick at each
            column boundary, which is the only thing in this hero that is not
            type. It draws from the left so the eye finishes the headline and
            is handed down to the paragraph. */}
        <m.div
          initial={{ transform: 'scaleX(0)' }}
          animate={{ transform: 'scaleX(1)' }}
          transition={{ duration: 0.45, delay: 0.3, ease: EASE }}
          className="border-hair-strong relative mt-12 h-6 origin-left border-t"
          aria-hidden="true"
        >
          <div
            className="h-2 w-full"
            style={{
              backgroundImage:
                'linear-gradient(to right, var(--hairline-strong) 1px, transparent 1px)',
              backgroundSize: 'calc(100% / 12) 100%',
            }}
          />
          <span className="absolute left-0 top-0 h-3 w-px bg-accent" />
        </m.div>

        <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <m.p
            {...rise(0.38)}
            className="max-w-[46ch] text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
          >
            Custom websites for shops and trades around Baytown and Houston. Most go live in two to
            four weeks.
          </m.p>
          <m.div {...rise(0.46)} className="flex-shrink-0">
            <HeroActions />
          </m.div>
        </div>
      </div>
    </section>
  )
}
