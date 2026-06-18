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
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

const VALUES = [
  {
    icon: Code2,
    title: 'Custom-built, not templated',
    description:
      'Every site is built from scratch for your business. No Wix, no Squarespace, no cookie-cutter themes. The result is faster, more polished, and entirely yours.',
  },
  {
    icon: Headphones,
    title: 'You work with me directly',
    description:
      'No account managers, no support tickets, no waiting days for a reply. You text or call me and I take care of it.',
  },
  {
    icon: Zap,
    title: 'Live in two to four weeks',
    description:
      'Most sites are up and running in under a month. I do not pad timelines with endless meetings or paperwork. You tell me about your business, I build the site.',
  },
  {
    icon: Shield,
    title: 'Built for local businesses',
    description:
      'I work with shops, restaurants, trades, contractors, and independent pros — businesses that need to look great online and have one person to call when something needs to change.',
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
      'Tell me about the business and what you need. A short message is plenty — no thirty-field intake form.',
    you: 'Send me a message',
    me: 'Reply same day',
  },
  {
    num: '02',
    title: 'I plan it out',
    description:
      'I lay out the pages, structure, and look of the site. You approve the plan before any work starts.',
    you: 'Review and give feedback',
    me: 'Share designs you can actually see',
  },
  {
    num: '03',
    title: 'I build it',
    description:
      'Clean design, sharp photos, and fast pages. You get progress updates the whole way and can ask for changes at any stage.',
    you: 'Review and request changes',
    me: 'Build, test, and polish',
  },
  {
    num: '04',
    title: 'Launch and look after it',
    description:
      'Your site goes live. I keep it online, secure, and up to date so the technical side never lands on you.',
    you: 'Run the business',
    me: 'Keep everything running',
  },
]

export default function About() {
  return (
    <div>
      <Seo
        title="About Trenton Taylor — Baytown Website Designer"
        description="Trenton Taylor is an independent Baytown, TX website designer building custom small business websites for shops, trades, and pros across Houston."
        path="/about"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'About', path: '/about' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            url: `${SITE_URL}/about`,
            mainEntity: { '@id': BUSINESS_ID },
            about: {
              '@type': 'Person',
              '@id': `${SITE_URL}/#trenton`,
              name: 'Trenton Taylor',
              jobTitle: 'Website Designer',
              worksFor: { '@id': BUSINESS_ID },
              url: `${SITE_URL}/about`,
            },
          },
        ]}
      />
      <PageHero
        title="Baytown, TX website designer"
        description="One person, custom-built sites, and a direct line to me — serving local businesses across Baytown and the Houston area from your first call through every change after launch."
      />

      {/* Story section */}
      <section className="relative overflow-hidden bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-start gap-8 lg:grid-cols-5 lg:gap-16">
            <motion.div {...fadeInUp} className="lg:col-span-3">
              <p className={`mb-2 ${EYEBROW}`}>Background</p>
              <h2 className={`mb-8 ${SECTION_H2}`}>I build websites for Baytown and Houston-area small businesses</h2>
              <div className="space-y-5 text-[17px] leading-relaxed text-gray-600">
                <p>
                  I&apos;m Trenton Taylor, and TaylorURL LLC is me. I started the business in
                  Baytown, Texas because the local shops around me — restaurants, trades,
                  salons, independent pros — kept ending up with one of two outcomes: a generic
                  agency site or a dated, do-it-yourself page that no longer matched their
                  business.
                </p>
                <p>
                  Neither one works for long. So I build sites the way the best companies online
                  do: clean design, fast pages, and ongoing care from the person who made it. No
                  sales reps, no support queue, no handoffs.
                </p>
                <p>
                  You get a site that is fast, easy on the eyes, and built around the customers
                  you actually want — with a direct line to me whenever something needs to
                  change. No platform you are stuck with, no monthly fees that creep up, no
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
                      Working with local businesses across Baytown, Mont Belvieu, Channelview,
                      Crosby, La Porte, Deer Park, Pasadena, and the greater Houston area. The
                      whole project can be handled by phone, text, and email — no in-person
                      meetings required.
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
              No twelve-step onboarding, no project charts, no drawn-out planning. This is the
              whole thing.
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
              Start a <span className="logo-wave">conversation</span>
            </h2>
            <p className="mb-8 text-base text-gray-400 sm:text-lg">
              Tell me what your business does and what you need from a site. You get a direct
              answer and a clear next step.
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
