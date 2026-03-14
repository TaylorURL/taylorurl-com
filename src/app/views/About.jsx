import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Code2, Headphones, Zap, Shield, Clock, Heart, Users, Monitor } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'

const VALUES = [
  {
    icon: Code2,
    title: 'Real Code, Not Drag-and-Drop',
    description:
      'Every line is written by hand. No WordPress, no Wix, no Squarespace. Your site is built with the same tech that powers the biggest companies on the internet — except it actually loads fast.',
  },
  {
    icon: Headphones,
    title: 'You Talk to the Builder',
    description:
      'No account managers. No ticket systems. No "we\'ll get back to you in 3-5 business days." You text or call us directly and we handle it. That\'s how it should work.',
  },
  {
    icon: Zap,
    title: 'Fast Turnaround, Not Fast Talk',
    description:
      'Most sites are done in 2-4 weeks. We don\'t pad timelines with "discovery phases" and "stakeholder alignment sessions." You tell us what you need, we build it.',
  },
  {
    icon: Shield,
    title: 'No Hidden Costs. Ever.',
    description:
      'We quote you a number and that\'s what it costs. No surprise "oh we didn\'t scope that" invoices. No nickel-and-diming on revisions. The price is the price.',
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
    description: 'Tell us about your business and what you need. Takes 5 minutes. No forms with 30 fields.',
    you: 'Send us a message',
    us: 'Get back to you same day',
  },
  {
    num: '02',
    title: 'We plan it out',
    description: 'We figure out the structure, pages, and design direction. You approve it before we write a single line of code.',
    you: 'Give feedback on the plan',
    us: 'Design mockups you can actually see',
  },
  {
    num: '03',
    title: 'We build it',
    description: 'Custom code, optimized images, fast hosting. You get progress updates and can give feedback the whole time.',
    you: 'Review and request changes',
    us: 'Build, test, and refine',
  },
  {
    num: '04',
    title: 'We launch and stick around',
    description: 'Your site goes live. We handle hosting, security, updates, and fixes. You never have to think about the technical stuff.',
    you: 'Focus on your business',
    us: 'Keep everything running',
  },
]

export default function About() {
  return (
    <div>
      <Seo
        title="About"
        description="We're a small web dev team out of Baytown, Texas. We build websites for local businesses and actually stick around to keep them running."
        path="/about"
      />
      <PageHero
        title="About Us"
        description="Small team. Real code. No corporate energy."
      />

      {/* Story section */}
      <section className="relative overflow-hidden bg-white py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-start gap-16 lg:grid-cols-5">
            <motion.div {...fadeInUp} className="lg:col-span-3">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">Our Story</p>
              <h2 className="mb-8 text-3xl font-bold text-gray-900 sm:text-4xl">
                We got tired of watching local businesses get ripped off
              </h2>
              <div className="space-y-5 text-[17px] leading-relaxed text-gray-600">
                <p>
                  TaylorURL started in Baytown, Texas because we kept seeing the same thing everywhere — local
                  businesses either paying some agency $10,000 for a WordPress template they could&apos;ve bought
                  for $59, or settling for a site that looks like it was built on a free Wix plan in 2012.
                </p>
                <p>
                  Both options suck. So we started building websites the right way — with real code, real design,
                  and real support after launch. Not as a faceless agency with a sales team and a ticket queue,
                  but as actual humans you can text when something needs fixing.
                </p>
                <p>
                  We use the same technology that powers sites like Netflix and Airbnb, except we don&apos;t
                  charge like them and we don&apos;t talk like them either. Every site we build is custom,
                  fast, and yours to keep. No lock-in, no platform fees, no surprises.
                </p>
              </div>
            </motion.div>

            <motion.div
              {...fadeInUp}
              transition={{ delay: 0.15 }}
              className="lg:col-span-2"
            >
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
                      {stat.value}<span className="text-blue-600">{stat.unit}</span>
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
                    <p className="text-sm text-gray-600">Working with businesses everywhere. Everything we do is remote-friendly.</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-gray-200 bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mb-14">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">Why Us</p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              We do things differently
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {VALUES.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.title}
                  {...staggerChild(i, 0.08)}
                  className="group rounded-2xl border border-gray-200 bg-white p-7 transition-all duration-300 hover:border-blue-200 hover:shadow-lg"
                >
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
      <section className="relative overflow-hidden bg-white py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp} className="mb-14 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">How It Works</p>
            <h2 className="mb-3 text-3xl font-bold text-gray-900 sm:text-4xl">
              Four steps. That&apos;s it.
            </h2>
            <p className="mx-auto max-w-lg text-gray-500">
              No 12-step onboarding. No Gantt charts. No "discovery phase." Here&apos;s the whole process.
            </p>
          </motion.div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 hidden h-full w-px bg-gray-200 sm:block" />

            <div className="space-y-8">
              {PROCESS.map((step, i) => (
                <motion.div
                  key={step.num}
                  {...staggerChild(i, 0.1)}
                  className="relative sm:pl-16"
                >
                  {/* Step number on line */}
                  <div className="absolute left-0 top-0 hidden h-12 w-12 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-sm font-bold text-gray-900 sm:flex">
                    {step.num}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                    <div className="mb-1 flex items-center gap-3">
                      <span className="text-sm font-bold text-blue-600 sm:hidden">{step.num}</span>
                      <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                    </div>
                    <p className="mb-4 text-[15px] text-gray-600">{step.description}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-start gap-2 rounded-lg bg-white px-3 py-2">
                        <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-400">You</p>
                          <p className="text-sm text-gray-700">{step.you}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-lg bg-white px-3 py-2">
                        <Monitor className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                        <div>
                          <p className="text-xs font-semibold uppercase text-blue-500">Us</p>
                          <p className="text-sm text-gray-700">{step.us}</p>
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
      <section className="relative overflow-hidden bg-gray-950 py-20">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              Let&apos;s <span className="logo-wave">Do This</span>
            </h2>
            <p className="mb-8 text-lg text-gray-400">
              Tell us what you need. We&apos;ll give you a straight answer and a real quote — no &quot;discovery phase&quot; required.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/pricing"
                className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white transition-all duration-300 hover:bg-blue-500"
              >
                Get a Quote
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/work"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-7 py-3.5 font-semibold text-gray-300 transition-all duration-300 hover:border-gray-500 hover:text-white"
              >
                View Our Work
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
