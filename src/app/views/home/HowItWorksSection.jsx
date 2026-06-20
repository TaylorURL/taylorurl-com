import { motion } from 'framer-motion'
import { fadeInUp, staggerChild } from '@constants/animations'
import { HOW_IT_WORKS_STEPS } from '@data/home'

export default function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden border-t border-hair-paper bg-paper py-24 sm:py-36">
      <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
        <motion.div
          {...fadeInUp}
          className="grid items-end gap-10 border-b border-hair-paper pb-12 lg:grid-cols-[1.4fr_1fr]"
        >
          <div>
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              // 04 — Process
            </p>
            <h2 className="text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold leading-[1.02] tracking-tightest text-ink-paper">
              How it works
              <br />
              <span className="text-accent">in three steps.</span>
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
            From your first message to a live website. No drawn-out meetings, no confusing
            paperwork. One operator, one direct line, one clean handoff.
          </p>
        </motion.div>

        <div className="relative mt-16 grid gap-px overflow-hidden border border-hair-paper bg-hair-paper md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((item, i) => (
            <motion.div
              key={item.step}
              {...staggerChild(i, 0.08)}
              className="relative flex flex-col gap-8 bg-paper p-8 sm:p-10"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[clamp(3rem,5vw,4.2rem)] font-semibold leading-none text-paper-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                  Step / 03
                </span>
              </div>
              <div>
                <h3 className="mb-3 text-[24px] font-semibold leading-tight tracking-tight text-ink-paper">
                  {item.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-paper-soft">
                  {item.description}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-3 border-t border-hair-paper pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                <span className="h-px w-6 bg-accent" />
                {i === 0 ? 'You start' : i === 1 ? 'I build' : 'We ship'}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
