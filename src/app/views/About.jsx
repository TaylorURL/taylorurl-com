import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Code2,
  Headphones,
  Zap,
  Shield,
  Clock,
  Heart,
  Users,
  Monitor,
} from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { BTN_PRIMARY, CARD, EYEBROW, SECTION_H2, SECTION_H2_DARK } from '@constants/ui'

const VALUES = [
  {
    icon: Code2,
    title: 'Hand-coded, not templated',
    description:
      'Every line is written in modern JavaScript and React. No WordPress, no Wix, no Squarespace. The same stack used by serious product teams, scaled to what a local business actually needs.',
  },
  {
    icon: Headphones,
    title: 'Direct relationship',
    description:
      'No account managers, no ticket systems, no multi-day response windows. You text or call me directly and I handle it.',
  },
  {
    icon: Zap,
    title: 'Two-to-four-week turnaround',
    description:
      'Most projects launch inside four weeks. I do not pad timelines with extended discovery or stakeholder alignment phases. You describe the business, I build the site.',
  },
  {
    icon: Shield,
    title: 'Built for local businesses',
    description:
      'I work with shops, restaurants, trades, contractors, and independent professionals — businesses that need a real online presence and a clear, ongoing relationship with the developer who maintains it.',
  },
]

const STATS = [
  { value: '2-4', unit: ' weeks', label: 'Average build time' },
  { value: '97+', unit: '', label: 'Average PageSpeed score' },
  { value: '50+', unit: '', label: 'Clients served' },
  { value: '24/7', unit: '', label: 'Support after launch' },
]

const PROCESS = [
  {
    num: '01',
    title: 'You reach out',
    description:
      'Tell me about the business and what you need. A short message is enough — no forms with thirty fields.',
    you: 'Send me a message',
    me: 'Reply same day',
  },
  {
    num: '02',
    title: 'I plan it out',
    description:
      'I scope the structure, pages, and design direction. You approve the plan before any code is written.',
    you: 'Review and give feedback',
    me: 'Share mockups you can actually see',
  },
  {
    num: '03',
    title: 'I build it',
    description:
      'Custom code, optimized images, fast hosting. You get progress updates throughout and can give feedback at any stage.',
    you: 'Review and request changes',
    me: 'Build, test, and refine',
  },
  {
    num: '04',
    title: 'Launch and support',
    description:
      'Your site goes live. I handle hosting, security, updates, and fixes after launch so the technical side stays off your plate.',
    you: 'Run the business',
    me: 'Keep everything running',
  },
]

export default function About() {
  return (
    <div>
      <Seo
        title="About"
        description="TaylorURL is Trenton Taylor, an independent developer based in Baytown, Texas, building modern websites and JavaScript applications for local businesses across the Houston area. Hand-coded React, direct relationship, ongoing support after launch."
        path="/about"
      />
      <PageHero
        title="About"
        description="One developer, hand-coded sites, direct relationship from first call through ongoing support."
      />

      {/* Story section */}
      <section className="relative overflow-hidden bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-start gap-8 lg:grid-cols-5 lg:gap-16">
            <motion.div {...fadeInUp} className="lg:col-span-3">
              <p className={`mb-2 ${EYEBROW}`}>Background</p>
              <h2 className={`mb-8 ${SECTION_H2}`}>I build modern websites for local businesses</h2>
              <div className="space-y-5 text-[17px] leading-relaxed text-gray-600">
                <p>
                  I&apos;m Trenton Taylor, and TaylorURL is me. I started the practice in Baytown,
                  Texas because the local businesses around me — restaurants, trades, salons,
                  independent professionals — kept ending up with one of two outcomes: a generic
                  agency build or an outdated page-builder site that no longer represented their
                  business.
                </p>
                <p>
                  Neither option works long-term. So I build sites the way a serious product team
                  would: real code, considered design, and ongoing support from the person who
                  wrote it. No sales layer, no ticket queue, no handoffs.
                </p>
                <p>
                  The stack is the same JavaScript and React stack used by major engineering
                  teams, scaled to what a local business actually needs: fast pages, clear design,
                  and a direct relationship with the developer who maintains the site. No
                  vendor lock-in, no platform fees, no surprises.
                </p>
              </div>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ delay: 0.15 }} className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                {STATS.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
                  >
                    <div className="mb-1 text-2xl font-bold text-gray-900">
                      {stat.value}
                      <span className="text-blue-600">{stat.unit}</span>
                    </div>
                    <div className="text-sm text-gray-500">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                {...fadeInUp}
                transition={{ delay: 0.3 }}
                className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-5"
              >
                <div className="flex items-start gap-3">
                  <Heart className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Based in Baytown, TX</p>
                    <p className="text-sm text-gray-600">
                      Working with local businesses across the Houston area and beyond. The work
                      is remote-friendly end-to-end.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-gray-200 bg-gray-50 py-12 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mb-14">
            <p className={`mb-2 ${EYEBROW}`}>How I work</p>
            <h2 className={SECTION_H2}>Why clients choose to work with me</h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {VALUES.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div key={item.title} {...staggerChild(i, 0.08)} className={`group ${CARD}`}>
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">{item.title}</h3>
                  <p className="text-[15px] leading-relaxed text-gray-600">{item.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="relative overflow-hidden bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp} className="mb-14 text-center">
            <p className={`mb-2 ${EYEBROW}`}>Process</p>
            <h2 className={`mb-3 ${SECTION_H2}`}>Four steps from first call to launch</h2>
            <p className="mx-auto max-w-lg text-gray-500">
              No twelve-step onboarding, no Gantt charts, no extended discovery. This is the whole
              process.
            </p>
          </motion.div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 hidden h-full w-px bg-gray-200 sm:block" />

            <div className="space-y-8">
              {PROCESS.map((step, i) => (
                <motion.div key={step.num} {...staggerChild(i, 0.1)} className="relative sm:pl-16">
                  {/* Step number on line */}
                  <div className="absolute left-0 top-0 hidden h-12 w-12 items-center justify-center rounded-full border-2 border-gray-200 bg-surface-overlay text-sm font-bold text-gray-900 sm:flex">
                    {step.num}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                    <div className="mb-1 flex items-center gap-3">
                      <span className="text-sm font-bold text-blue-600 sm:hidden">{step.num}</span>
                      <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                    </div>
                    <p className="mb-4 text-[15px] text-gray-600">{step.description}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-start gap-2 rounded-lg bg-surface-overlay px-3 py-2">
                        <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-400">You</p>
                          <p className="text-sm text-gray-700">{step.you}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-lg bg-surface-overlay px-3 py-2">
                        <Monitor className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                        <div>
                          <p className="text-xs font-semibold uppercase text-blue-500">Me</p>
                          <p className="text-sm text-gray-700">{step.me}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gray-950 py-12 sm:py-20">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className={`mb-4 ${SECTION_H2_DARK}`}>
              Let&apos;s <span className="logo-wave">Do This</span>
            </h2>
            <p className="mb-8 text-base text-gray-400 sm:text-lg">
              Tell me about your local business and what you&apos;re trying to fix. I&apos;ll give
              you a straight answer — no &quot;discovery phase&quot; required.
            </p>
            <div className="flex justify-center">
              <Link to="/contact" className={`group ${BTN_PRIMARY}`}>
                Get in Touch
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
