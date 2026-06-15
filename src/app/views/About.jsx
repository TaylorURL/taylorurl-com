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
    title: 'Real Code, Not Drag-and-Drop',
    description:
      'Every line is written by hand with modern JavaScript and React. No WordPress, no Wix, no Squarespace. Your site is built with the same tech that powers the biggest companies on the internet — except it actually loads fast.',
  },
  {
    icon: Headphones,
    title: 'You Talk to the Builder',
    description:
      'No account managers. No ticket systems. No "I\'ll get back to you in 3-5 business days." You text or call me directly and I handle it. That\'s how it should work.',
  },
  {
    icon: Zap,
    title: 'Fast Turnaround, Not Fast Talk',
    description:
      'Most sites are done in 2-4 weeks. I don\'t pad timelines with "discovery phases" and "stakeholder alignment sessions." You tell me what your business does, I build it.',
  },
  {
    icon: Shield,
    title: 'Built for Local Businesses',
    description:
      'I work with shops, restaurants, trades, contractors, and independent professionals — the kind of business that needs a real online presence, not a template-y agency project. Direct relationship, clear scope, no surprises.',
  },
]

const STATS = [
  { value: '2-4', unit: ' weeks', label: 'Average build time' },
  { value: '97+', unit: '', label: 'Average PageSpeed score' },
  { value: '50+', unit: '', label: 'Happy clients' },
  { value: '24/7', unit: '', label: 'Support after launch' },
]

const PROCESS = [
  {
    num: '01',
    title: 'You reach out',
    description:
      'Tell me about your business and what you need. Takes 5 minutes. No forms with 30 fields.',
    you: 'Send me a message',
    me: 'Get back to you same day',
  },
  {
    num: '02',
    title: 'I plan it out',
    description:
      'I figure out the structure, pages, and design direction. You approve it before I write a single line of code.',
    you: 'Give feedback on the plan',
    me: 'Design mockups you can actually see',
  },
  {
    num: '03',
    title: 'I build it',
    description:
      'Custom code, optimized images, fast hosting. You get progress updates and can give feedback the whole time.',
    you: 'Review and request changes',
    me: 'Build, test, and refine',
  },
  {
    num: '04',
    title: 'I launch and stick around',
    description:
      'Your site goes live. I handle hosting, security, updates, and fixes. You never have to think about the technical stuff.',
    you: 'Focus on your business',
    me: 'Keep everything running',
  },
]

export default function About() {
  return (
    <div>
      <Seo
        title="About"
        description="TaylorURL is Trenton Taylor — a solo developer based in Baytown, Texas, building modern websites and JavaScript applications for local businesses across the Houston area. Shops, restaurants, trades, contractors, independent professionals. No templates, no agencies — one developer who picks up the phone."
        path="/about"
      />
      <PageHero
        title="About"
        description="One developer building real websites for local businesses. No corporate energy."
      />

      {/* Story section */}
      <section className="relative overflow-hidden bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-start gap-8 lg:grid-cols-5 lg:gap-16">
            <motion.div {...fadeInUp} className="lg:col-span-3">
              <p className={`mb-2 ${EYEBROW}`}>My Story</p>
              <h2 className={`mb-8 ${SECTION_H2}`}>
                I got tired of watching local businesses get ripped off
              </h2>
              <div className="space-y-5 text-[17px] leading-relaxed text-gray-600">
                <p>
                  I&apos;m Trenton Taylor, and TaylorURL is just me. I started this in Baytown, Texas
                  because I kept seeing the same thing everywhere — local businesses either paying
                  some agency $10,000 for a WordPress template they could&apos;ve bought for $59, or
                  settling for a site that looks like it was built on a free Wix plan in 2012.
                </p>
                <p>
                  Both options suck. So I started building websites the right way — with real code,
                  real design, and real support after launch. Not as a faceless agency with a sales
                  team and a ticket queue, but as one developer you can text when something needs
                  fixing.
                </p>
                <p>
                  I use the same technology that powers sites like Netflix and Airbnb, except I
                  don&apos;t charge like them and I don&apos;t talk like them either. Every site I
                  build is custom, fast, and yours to keep. No lock-in, no platform fees, no
                  surprises.
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
                      Working with businesses everywhere. Everything I do is remote-friendly.
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
            <p className={`mb-2 ${EYEBROW}`}>Why Me</p>
            <h2 className={SECTION_H2}>I do things differently</h2>
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
            <p className={`mb-2 ${EYEBROW}`}>How It Works</p>
            <h2 className={`mb-3 ${SECTION_H2}`}>Four steps. That&apos;s it.</h2>
            <p className="mx-auto max-w-lg text-gray-500">
              No 12-step onboarding. No Gantt charts. No "discovery phase." Here&apos;s the whole
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
              Tell me what you need. I&apos;ll give you a straight answer and a real quote — no
              &quot;discovery phase&quot; required.
            </p>
            <div className="flex justify-center">
              <Link to="/pricing" className={`group ${BTN_PRIMARY}`}>
                Get a Quote
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
