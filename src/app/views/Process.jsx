import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Code,
  FileText,
  Handshake,
  HeadphonesIcon,
  MessageCircle,
  Palette,
  Rocket,
  Image,
  Globe,
  Paintbrush,
} from 'lucide-react'
import PageHero from '@components/PageHero'
import CtaBanner from '@components/CtaBanner'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { BADGE, SECTION_H2 } from '@constants/ui'

const TIMELINE_STEPS = [
  {
    step: '01',
    icon: MessageCircle,
    title: 'First call',
    duration: 'Day 1',
    description:
      'You walk me through the business and what you need from a site. I ask questions, take notes, and give you a direct answer on whether I am the right fit. No pitch deck, no extended discovery.',
    client: [
      'Describe the business',
      'Share what works and what does not in other sites',
      'Explain how customers reach you today',
    ],
    taylorurl: [
      'Ask the right questions',
      'Give a direct yes or no on fit',
      'Outline what the site should do',
    ],
  },
  {
    step: '02',
    icon: FileText,
    title: 'Scope and agreement',
    duration: 'Day 2-3',
    description:
      'I write up a clear scope of work — what I am building, what is included, and how long it takes. Once it works for both sides, we move forward.',
    client: ['Review the scope', 'Ask questions', 'Sign off when ready'],
    taylorurl: [
      'Send a clear scope of work',
      'Outline what is and is not included',
      'Set the project timeline',
    ],
  },
  {
    step: '03',
    icon: Palette,
    title: 'Design',
    duration: 'Week 1',
    description:
      'I produce mockups of the site. You give feedback, I iterate until the direction is right. No oversized design doc, no design-by-committee.',
    client: [
      'Send your logo, photos, and content',
      'Review and respond to mockups',
      'Flag anything that does not fit',
    ],
    taylorurl: [
      'Produce visual mockups',
      'Revise based on your feedback',
      'Lock the layout and visual style',
    ],
  },
  {
    step: '04',
    icon: Code,
    title: 'Build',
    duration: 'Week 2-3',
    description:
      'I write the code. Hand-coded React, not page builders. You can check in at any point — I share progress links throughout so there are no surprises at the end.',
    client: [
      'Review progress whenever you want',
      'Flag anything that needs to change',
      'Send any remaining content',
    ],
    taylorurl: [
      'Write clean, performant code',
      'Make it work on every screen size',
      'Share progress links throughout',
    ],
  },
  {
    step: '05',
    icon: Rocket,
    title: 'Review and launch',
    duration: 'Week 3-4',
    description:
      'You test the site end-to-end. I fix whatever needs fixing. Once you approve it, I deploy to production and handle the launch.',
    client: [
      'Test the site end-to-end',
      'Send final changes',
      'Approve the launch',
    ],
    taylorurl: [
      'Fix any issues you find',
      'Run performance and SEO checks',
      'Handle DNS, hosting, and deployment',
    ],
  },
  {
    step: '06',
    icon: HeadphonesIcon,
    title: 'Ongoing support',
    duration: 'Ongoing',
    description:
      'After launch I continue to handle hosting, updates, security, and content changes. The technical side stays with me so the business stays focused on operating.',
    client: [
      'Run the business',
      'Send a message when you need a change',
      'No tickets, no waiting',
    ],
    taylorurl: [
      'Keep the site fast and secure',
      'Handle hosting and backups',
      'Ship updates as you need them',
    ],
  },
]

const WHAT_YOULL_NEED = [
  { icon: Image, label: 'Your logo (any format)' },
  { icon: FileText, label: 'Content or copy for your pages' },
  { icon: Image, label: 'Photos of the work or the space' },
  { icon: Paintbrush, label: 'Brand colors, if you have them' },
  { icon: Globe, label: 'Domain info, or assistance registering one' },
]

export default function Process() {
  return (
    <div>
      <Seo
        title="Process"
        description="The process for building modern websites and JavaScript applications for local businesses in Baytown, Houston, and beyond. From first call to launch in 2-4 weeks, with ongoing support after launch."
        path="/process"
      />
      <PageHero
        title="Process"
        description="A clear, predictable path from first call to launch and beyond."
      />

      {/* Timeline */}
      <section className="bg-surface-base py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            {...fadeInUp}
            transition={{ duration: 0.5 }}
            className="mb-10 text-center sm:mb-16"
          >
            <h2 className={`mb-4 ${SECTION_H2}`}>
              From <span className="logo-wave-dark">Hello</span> to Live Site
            </h2>
            <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">
              Most projects wrap in 3-4 weeks. Here&apos;s what each step looks like.
            </p>
          </motion.div>

          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-blue-200 via-blue-400 to-blue-200 md:left-8 lg:block" />

            <div className="space-y-12 lg:space-y-16">
              {TIMELINE_STEPS.map((step, i) => {
                const Icon = step.icon
                return (
                  <motion.div key={step.step} {...staggerChild(i, 0.15)} className="relative">
                    {/* Step number + icon row */}
                    <div className="mb-6 flex items-center gap-4 lg:gap-6">
                      {/* Step circle */}
                      <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-surface-overlay md:h-16 md:w-16">
                        <Icon className="h-5 w-5 text-blue-600 md:h-6 md:w-6" strokeWidth={1.5} />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center gap-3">
                          <span className="text-sm font-semibold tracking-wider text-blue-600">
                            STEP {step.step}
                          </span>
                          <span className={BADGE}>{step.duration}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 sm:text-2xl">
                          {step.title}
                        </h3>
                      </div>
                    </div>

                    {/* Content card */}
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 transition-all duration-300 hover:border-blue-200 hover:shadow-md lg:ml-20">
                      <p className="mb-6 text-base text-gray-600 sm:text-lg">{step.description}</p>

                      {/* Two-column: You / Me */}
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="rounded-xl bg-surface-overlay p-5">
                          <h4 className="mb-3 text-sm font-semibold tracking-wider text-gray-400">
                            WHAT YOU DO
                          </h4>
                          <ul className="space-y-2">
                            {step.client.map(item => (
                              <li
                                key={item}
                                className="flex items-start gap-2 text-sm text-gray-700"
                              >
                                <Check
                                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
                                  strokeWidth={2}
                                />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl bg-surface-overlay p-5">
                          <h4 className="mb-3 text-sm font-semibold tracking-wider text-blue-500">
                            WHAT I DO
                          </h4>
                          <ul className="space-y-2">
                            {step.taylorurl.map(item => (
                              <li
                                key={item}
                                className="flex items-start gap-2 text-sm text-gray-700"
                              >
                                <Check
                                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500"
                                  strokeWidth={2}
                                />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* What You'll Need */}
      <section className="border-y border-gray-200 bg-gray-50 py-12 sm:py-20">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp} transition={{ duration: 0.5 }} className="mb-12 text-center">
            <h2 className={`mb-4 ${SECTION_H2}`}>
              What You&apos;ll Need <span className="logo-wave-dark">From Me</span>
            </h2>
            <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">
              Don&apos;t stress about having everything perfect. I can work with what you&apos;ve
              got and help fill in the gaps.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_YOULL_NEED.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.label}
                  {...staggerChild(i)}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-surface-overlay p-5 transition-all duration-300 hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Icon className="h-5 w-5 text-gray-700" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </motion.div>
              )
            })}
          </div>

          <motion.p
            {...fadeInUp}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 text-center text-sm text-gray-500"
          >
            Don&apos;t have a logo or photos yet? No worries — I can point you in the right
            direction.
          </motion.p>
        </div>
      </section>

      <CtaBanner
        heading="Ready to"
        accentText="Get Started?"
        description="Now you know how it works. Let's talk about your local business and what you need."
        primaryLabel="Get in Touch"
        primaryTo="/contact"
      />
    </div>
  )
}
