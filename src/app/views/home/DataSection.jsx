import { motion } from 'framer-motion'
import { ArrowUpRight, Monitor, Smartphone, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fadeInUp, staggerChild } from '@constants/animations'
import { REVENUE_GROWTH_DATA } from '@data/home'
import RevenueGrowthChart from './RevenueGrowthChart'

const FACTS = [
  {
    icon: TrendingUp,
    stat: '+110%',
    label: 'more revenue',
    detail:
      'Local businesses with a real website grow faster than the ones without — and the gap gets wider every quarter.',
  },
  {
    icon: Smartphone,
    stat: '70%',
    label: 'searches happen on phones',
    detail:
      'Most people looking for what you do are on their phone. If your site is slow or hard to use there, they’re gone before they ever see your work.',
  },
  {
    icon: Monitor,
    stat: '<2s',
    label: 'page load',
    detail:
      'Every site I build opens in under two seconds. Quick pages keep more visitors, and Google rewards them with better spots in search.',
  },
]

export default function DataSection() {
  return (
    <section className="relative overflow-hidden border-t border-hair bg-bg py-24 text-ink sm:py-36">
      <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
        <motion.div
          {...fadeInUp}
          className="grid items-end gap-10 border-b border-hair pb-12 lg:grid-cols-[1.4fr_1fr]"
        >
          <div>
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              // 02 — By the numbers
            </p>
            <h2 className="text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold leading-[1.02] tracking-tightest text-ink">
              A real website
              <br />
              <span className="text-accent">pulls its weight.</span>
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-ink-soft lg:text-right">
            Local businesses with a real website grow faster, get found more often, and win
            more customers. The ones without are leaning on referrals and luck.
          </p>
        </motion.div>

        <div className="mt-12 grid items-stretch gap-px overflow-hidden border border-hair bg-hair sm:mt-16 lg:grid-cols-[1fr_1.2fr]">
          <motion.div
            {...fadeInUp}
            className="flex flex-col justify-between gap-8 bg-bg p-8 sm:p-12"
          >
            <div>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                // The short version
              </p>
              <p className="text-[17px] leading-relaxed text-ink-soft">
                A well-built website puts your business right where people are already
                looking when they need someone to call.
              </p>
            </div>
            <Link
              to="/contact"
              className="group inline-flex w-fit items-center gap-2.5 rounded-sm border border-hair-strong px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink transition duration-200 ease-out hover:bg-ink hover:text-bg active:scale-[0.98]"
            >
              Start a project
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>

          <motion.div
            {...fadeInUp}
            transition={{ delay: 0.08 }}
            className="relative bg-bg p-6 sm:p-8"
          >
            <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              <span>12-mo revenue · indexed to 100</span>
              <div className="flex gap-5">
                <span className="flex items-center gap-1.5">
                  <span className="h-px w-4 bg-accent" />
                  <span>With site</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-px w-4 border-t border-dashed border-ink-faint" />
                  <span>Without</span>
                </span>
              </div>
            </div>
            <RevenueGrowthChart data={REVENUE_GROWTH_DATA} />
          </motion.div>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden border border-hair bg-hair sm:mt-16 md:grid-cols-3">
          {FACTS.map((fact, i) => {
            const Icon = fact.icon
            return (
              <motion.div
                key={fact.label}
                {...staggerChild(i, 0.06)}
                className="flex flex-col justify-between gap-6 bg-bg p-7 sm:p-9"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                    {String(i + 1).padStart(2, '0')} / 03
                  </span>
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.25} />
                </div>
                <div>
                  <p className="font-mono text-[clamp(2.4rem,5vw,3.6rem)] font-semibold leading-none text-ink">
                    {fact.stat}
                  </p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                    {fact.label}
                  </p>
                  <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">
                    {fact.detail}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
