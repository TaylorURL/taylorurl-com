import { m } from 'framer-motion'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { EASE, fadeInUpMount } from '@constants/animations'
import { AccentGradient } from '@reactbits/kit'
import HeroActions from './HeroActions'

const rise = delay => ({
  ...fadeInUpMount,
  transition: { ...fadeInUpMount.transition, delay },
})

// The ruler's ticks: a short mark every 10px and a tall one every 50px, drawn
// as two gradients on one strip so the whole ruler is a single element.
const TICKS_H = {
  backgroundImage:
    'linear-gradient(to right, var(--hairline-strong) 1px, transparent 1px), linear-gradient(to right, var(--hairline) 1px, transparent 1px)',
  backgroundSize: '50px 10px, 10px 5px',
  backgroundPosition: 'bottom left, bottom left',
  backgroundRepeat: 'repeat-x, repeat-x',
}

const TICKS_V = {
  backgroundImage:
    'linear-gradient(to bottom, var(--hairline-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--hairline) 1px, transparent 1px)',
  backgroundSize: '10px 50px, 5px 10px',
  backgroundPosition: 'right top, right top',
  backgroundRepeat: 'repeat-y, repeat-y',
}

const HANDLES = ['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1']

export default function HeroArtboard() {
  return (
    <section className="relative isolate flex h-full min-h-[100svh] items-center overflow-hidden bg-bg pt-24">
      <div
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.plan} ${SEAMS.hero}`}
        aria-hidden="true"
      />

      <div className="container-rail relative pb-16">
        <div className="relative">
          {/* The artboard's name tab, which is also the brand strip: the sheet
              this page was drawn on is the one signed at the corner. */}
          <m.p {...rise(0)} className="section-label-sm absolute -top-7 left-0 text-accent">
            TaylorURL LLC
          </m.p>

          <m.div
            initial={{ opacity: 0, transform: 'scale(0.985)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            transition={{ duration: 0.42, ease: EASE }}
            className="border-hair-strong relative border"
          >
            <div
              className="border-hair absolute -top-6 left-0 right-0 h-6 border-b"
              style={TICKS_H}
              aria-hidden="true"
            />
            <div
              className="border-hair absolute -left-6 bottom-0 top-0 w-6 border-r"
              style={TICKS_V}
              aria-hidden="true"
            />

            {HANDLES.map(position => (
              <span
                key={position}
                aria-hidden="true"
                className={`absolute ${position} h-2 w-2 border border-accent bg-[color:var(--bg)]`}
              />
            ))}

            <div className="flex flex-col items-center px-6 py-16 text-center sm:px-12 sm:py-20 lg:px-20">
              <h1 className="display-1 max-w-[17ch] font-semibold leading-[0.96] tracking-tightest text-ink [text-wrap:balance]">
                <m.span {...rise(0.1)} className="block">
                  Most people meet your{' '}
                </m.span>
                <m.span {...rise(0.18)} className="block">
                  business <AccentGradient>online first</AccentGradient>.
                </m.span>
              </h1>

              <m.p
                {...rise(0.3)}
                className="mt-8 max-w-[48ch] text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
              >
                I design and build the page that meeting happens on. One person, start to finish.
              </m.p>

              <m.div {...rise(0.4)} className="mt-10 flex justify-center">
                <HeroActions />
              </m.div>
            </div>
          </m.div>
        </div>
      </div>
    </section>
  )
}
