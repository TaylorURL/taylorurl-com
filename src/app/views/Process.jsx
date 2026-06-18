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
import { breadcrumbSchema } from '@constants/seo'

const TIMELINE_STEPS = [
  {
    step: '01',
    icon: MessageCircle,
    title: 'First call',
    duration: 'Day 1',
    description:
      'You walk me through the business and what you want from a website. I ask questions, take notes, and tell you straight up whether I am the right fit. No sales pitch, no long planning phase.',
    client: [
      'Describe the business',
      'Share what you like and dislike about other sites',
      'Explain how customers reach you today',
    ],
    taylorurl: [
      'Ask the right questions',
      'Give a straight yes or no on fit',
      'Sketch out what the site should do',
    ],
  },
  {
    step: '02',
    icon: FileText,
    title: 'Plan and quote',
    duration: 'Day 2-3',
    description:
      'I write up a clear plan — what I am building, what is included, and how long it takes. Once it works for both sides, we get going.',
    client: ['Review the plan', 'Ask questions', 'Give the green light when ready'],
    taylorurl: [
      'Send a clear plan and price',
      'Spell out what is and is not included',
      'Set the timeline',
    ],
  },
  {
    step: '03',
    icon: Palette,
    title: 'Design',
    duration: 'Week 1',
    description:
      'I show you pictures of what the site will look like. You give feedback, I make changes until it feels right. No oversized design document, no design by committee.',
    client: [
      'Send your logo, photos, and content',
      'Review and respond to the designs',
      'Flag anything that does not fit',
    ],
    taylorurl: [
      'Design what each page will look like',
      'Revise based on your feedback',
      'Lock in the look and layout',
    ],
  },
  {
    step: '04',
    icon: Code,
    title: 'Build',
    duration: 'Week 2-3',
    description:
      'I build the site, custom from the ground up. You can peek in any time — I share preview links the whole way so there are no surprises at the end.',
    client: [
      'Review progress whenever you want',
      'Flag anything that needs to change',
      'Send any remaining content',
    ],
    taylorurl: [
      'Build clean, quick-loading pages',
      'Make sure it works on phones, tablets, and computers',
      'Share preview links the whole way',
    ],
  },
  {
    step: '05',
    icon: Rocket,
    title: 'Review and go live',
    duration: 'Week 3-4',
    description:
      'You click through the whole site. I fix whatever needs fixing. Once you give the go-ahead, I put it online for the world to see.',
    client: [
      'Click through the whole site',
      'Send final changes',
      'Give the go-ahead to launch',
    ],
    taylorurl: [
      'Fix any issues you find',
      'Tune up speed and Google visibility',
      'Handle the technical side of going live',
    ],
  },
  {
    step: '06',
    icon: HeadphonesIcon,
    title: 'Ongoing care',
    duration: 'Ongoing',
    description:
      'After launch I keep the site online, fast, safe, and up to date. The technical side stays with me so you stay focused on running the business.',
    client: [
      'Run the business',
      'Send a message when you need a change',
      'No tickets, no waiting',
    ],
    taylorurl: [
      'Keep the site fast and safe',
      'Handle hosting and backups',
      'Make updates as you need them',
    ],
  },
]

const WHAT_YOULL_NEED = [
  { icon: Image, label: 'Your logo (any format)' },
  { icon: FileText, label: 'What you want each page to say' },
  { icon: Image, label: 'Photos of your work or your space' },
  { icon: Paintbrush, label: 'Brand colors, if you have them' },
  { icon: Globe, label: 'Your web address, or help picking one' },
]

export default function Process() {
  return (
    <div>
      <Seo
        title="My Website Build Process — Baytown & Houston"
        description="How I build websites for Baytown and Houston-area small businesses — from your first call to a live site in two to four weeks."
        path="/process"
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Process', path: '/process' },
        ])}
      />
      <PageHero
        title="How it works"
        description="A clear, predictable path from your first call to a live website — for Baytown and Houston-area businesses."
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
              From first call to <span className="logo-wave-dark">live site</span>
            </h2>
            <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">
              Most projects wrap up in three to four weeks. Here is what each step looks like.
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
                            YOUR PART
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
                            MY PART
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
              What I&apos;ll <span className="logo-wave-dark">need from you</span>
            </h2>
            <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">
              It does not have to be perfect or finished. I can work with what you have and
              help fill in the gaps.
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
            No logo or photos yet? I can point you to people who handle that.
          </motion.p>
        </div>
      </section>

      <CtaBanner
        heading="Ready to"
        accentText="get started?"
        description="You know the process. Tell me about the business and what you need."
        primaryLabel="Get in Touch"
        primaryTo="/contact"
      />
    </div>
  )
}
