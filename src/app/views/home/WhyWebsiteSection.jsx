import { motion } from 'framer-motion'
import { fadeInUp, staggerChild } from '@constants/animations'
import { WHY_WEBSITE_CARDS } from '@data/home'

export default function WhyWebsiteSection() {
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
              // 01 — Why a website
            </p>
            <h2 className="text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold leading-[1.02] tracking-tightest text-ink-paper">
              A website is the difference between
              <br />
              <span className="text-accent">getting the call</span> and getting skipped.
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
            Six honest reasons a website pays for itself for shops, restaurants, trades, and
            pros around Baytown and the rest of the Houston area.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 divide-y divide-hair-paper border-hair-paper md:mt-16 md:grid-cols-2 md:divide-y-0 md:border-y md:[&>*:nth-child(2n)]:border-l lg:grid-cols-3 lg:[&>*:nth-child(3n+1)]:border-l-0 lg:[&>*]:border-l">
          {WHY_WEBSITE_CARDS.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.article
                key={item.title}
                {...staggerChild(i, 0.05)}
                className="group relative border-hair-paper p-8 transition-colors duration-300 hover:bg-ink-paper/[0.02] sm:p-10"
              >
                <div className="mb-6 flex items-baseline justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                    {String(i + 1).padStart(2, '0')} / 06
                  </span>
                  <Icon
                    className="h-6 w-6 text-ink-paper transition-colors duration-300 group-hover:text-accent"
                    strokeWidth={1.25}
                  />
                </div>
                <h3 className="mb-4 text-[22px] font-semibold leading-tight tracking-tight text-ink-paper">
                  {item.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-paper-soft">
                  {item.description}
                </p>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
