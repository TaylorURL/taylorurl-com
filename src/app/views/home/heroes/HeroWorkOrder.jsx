import { m } from 'framer-motion'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { EASE, fadeInUpMount } from '@constants/animations'
import { AccentGradient } from '@reactbits/kit'
import HeroActions from './HeroActions'
import WorkOrderCard from './WorkOrderCard'

const rise = delay => ({
  ...fadeInUpMount,
  transition: { ...fadeInUpMount.transition, delay },
})

export default function HeroWorkOrder() {
  return (
    // The offer set as the document it produces. It stands on the ground the
    // setting chose, like the other three presentations.
    <section className="relative isolate flex h-full min-h-[100svh] items-center overflow-hidden bg-bg pt-24 text-ink">
      <div
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.ledger} ${SEAMS.hero}`}
        aria-hidden="true"
      />

      <div className="container-rail relative grid items-center gap-14 pb-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <m.p {...rise(0)} className="section-label-sm flex items-center gap-3 text-ink-mute">
            <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
            TaylorURL LLC · Baytown, TX
          </m.p>

          <h1 className="display-1 mt-8 font-semibold leading-[0.94] tracking-tightest text-ink [text-wrap:balance]">
            <m.span {...rise(0.08)} className="block">
              Hire the team{' '}
            </m.span>
            <m.span {...rise(0.16)} className="block">
              who <AccentGradient>builds it</AccentGradient>.
            </m.span>
          </h1>

          <m.p
            {...rise(0.28)}
            className="mt-8 max-w-[46ch] text-[17px] leading-relaxed text-ink-soft sm:text-[19px]"
          >
            You talk to the people doing the work, from the first message to launch day and long
            after it.
          </m.p>

          <m.div {...rise(0.36)} className="mt-8">
            <HeroActions />
          </m.div>
        </div>

        <m.div
          initial={{ opacity: 0, transform: 'translateY(22px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.45, delay: 0.2, ease: EASE }}
        >
          <WorkOrderCard />
        </m.div>
      </div>
    </section>
  )
}
