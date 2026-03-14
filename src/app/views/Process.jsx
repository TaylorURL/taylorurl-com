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

const TIMELINE_STEPS = [
  {
    step: '01',
    icon: MessageCircle,
    title: 'First Call',
    duration: 'Day 1',
    description:
      'You tell us what you need. We ask questions, take notes, and give you a straight answer on whether we can help and what it\'ll cost. No pitch deck, no "discovery phase."',
    client: [
      'Tell us about your business',
      'Share what you like (and hate) in other sites',
      'Give us a rough idea of budget',
    ],
    taylorurl: [
      'Ask the right questions',
      'Give you a straight yes/no on fit',
      'Ballpark the cost on the spot',
    ],
  },
  {
    step: '02',
    icon: FileText,
    title: 'Quote & Agreement',
    duration: 'Day 2-3',
    description:
      'We send you a real number. Not a range. Not "it depends." If it works, we shake hands (digitally) and get moving.',
    client: [
      'Review the quote',
      'Ask any questions',
      'Sign off when you\'re ready',
    ],
    taylorurl: [
      'Send a clear, itemized quote',
      'Explain what\'s included (and what\'s not)',
      'Set up the project timeline',
    ],
  },
  {
    step: '03',
    icon: Palette,
    title: 'Design',
    duration: 'Week 1',
    description:
      'We mock up your site. You tell us what you like, what you don\'t. We go back and forth until it looks right. No weird 40-page design doc.',
    client: [
      'Send us your logo, photos, and content',
      'Give feedback on mockups',
      'Tell us if something feels off',
    ],
    taylorurl: [
      'Create visual mockups of your site',
      'Revise based on your feedback',
      'Nail down the layout and style',
    ],
  },
  {
    step: '04',
    icon: Code,
    title: 'Build',
    duration: 'Week 2-3',
    description:
      'We write the code. Real code, not drag-and-drop. You can check in anytime \u2014 we\'ll share progress as we go so there are zero surprises.',
    client: [
      'Check in whenever you want',
      'Flag anything that doesn\'t look right',
      'Send over any remaining content',
    ],
    taylorurl: [
      'Write clean, performant code',
      'Make it look great on every screen',
      'Share progress links along the way',
    ],
  },
  {
    step: '05',
    icon: Rocket,
    title: 'Review & Launch',
    duration: 'Week 3-4',
    description:
      'You test everything. Click every button, read every page. We fix whatever needs fixing. When you say go, we push it live.',
    client: [
      'Test the site top to bottom',
      'Send us any final changes',
      'Say the word and we go live',
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
    title: 'We Stick Around',
    duration: 'Ongoing',
    description:
      'Site\'s live, but we\'re not gone. Hosting, updates, security, content changes \u2014 all handled. You just run your business.',
    client: [
      'Run your business',
      'Text us when you need something changed',
      'That\'s it. Seriously.',
    ],
    taylorurl: [
      'Keep your site fast and secure',
      'Handle hosting and backups',
      'Make updates whenever you need them',
    ],
  },
]

const WHAT_YOULL_NEED = [
  { icon: Image, label: 'Your logo (any format works)' },
  { icon: FileText, label: 'Content or copy for your pages' },
  { icon: Image, label: 'Photos of your work, team, or space' },
  { icon: Paintbrush, label: 'Brand colors, if you have them' },
  { icon: Globe, label: 'Domain info (or we can help you get one)' },
]

export default function Process() {
  return (
    <div>
      <Seo
        title="Our Process"
        description="No mystery. No jargon. Here's exactly what happens when you work with TaylorURL, from first call to launch and beyond."
        path="/process"
      />
      <PageHero
        title="How We Work"
        description="No mystery. No jargon. Here's exactly what happens."
      />

      {/* Timeline */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div {...fadeInUp} transition={{ duration: 0.5 }} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              From <span className="logo-wave-dark">Hello</span> to Live Site
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
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
                  <motion.div
                    key={step.step}
                    {...staggerChild(i, 0.15)}
                    className="relative"
                  >
                    {/* Step number + icon row */}
                    <div className="mb-6 flex items-center gap-4 lg:gap-6">
                      {/* Step circle */}
                      <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-white md:h-16 md:w-16">
                        <Icon className="h-5 w-5 text-blue-600 md:h-6 md:w-6" strokeWidth={1.5} />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center gap-3">
                          <span className="text-sm font-semibold tracking-wider text-blue-600">
                            STEP {step.step}
                          </span>
                          <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600">
                            {step.duration}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                      </div>
                    </div>

                    {/* Content card */}
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 transition-all duration-300 hover:border-blue-200 hover:shadow-md lg:ml-20">
                      <p className="mb-6 text-lg text-gray-600">{step.description}</p>

                      {/* Two-column: You / Us */}
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-5">
                          <h4 className="mb-3 text-sm font-semibold tracking-wider text-gray-400">
                            WHAT YOU DO
                          </h4>
                          <ul className="space-y-2">
                            {step.client.map(item => (
                              <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" strokeWidth={2} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl bg-white p-5">
                          <h4 className="mb-3 text-sm font-semibold tracking-wider text-blue-500">
                            WHAT WE DO
                          </h4>
                          <ul className="space-y-2">
                            {step.taylorurl.map(item => (
                              <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" strokeWidth={2} />
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
      <section className="border-y border-gray-200 bg-gray-50 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp} transition={{ duration: 0.5 }} className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              What You&apos;ll Need <span className="logo-wave-dark">From Us</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              Don&apos;t stress about having everything perfect. We can work with what you&apos;ve got
              and help fill in the gaps.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_YOULL_NEED.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.label}
                  {...staggerChild(i)}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:border-blue-200 hover:shadow-md"
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
            Don&apos;t have a logo or photos yet? No worries — we can point you in the right direction.
          </motion.p>
        </div>
      </section>

      <CtaBanner
        heading="Ready to"
        accentText="Get Started?"
        description="Now you know how it works. Let's talk about your project and get you a real number."
        primaryLabel="Get a Quote"
        primaryTo="/pricing"
        secondaryLabel="See Our Work"
        secondaryTo="/work"
      />
    </div>
  )
}
