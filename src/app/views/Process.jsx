import { motion } from 'framer-motion'
import {
  Code,
  FileText,
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
import { breadcrumbSchema } from '@constants/seo'

const TIMELINE_STEPS = [
  {
    step: '01',
    icon: MessageCircle,
    title: 'First call',
    duration: 'Day 1',
    description:
      'You tell me about the business and what you want from a website. I ask questions, take notes, and tell you straight up whether I’m the right fit. No sales pitch, no drawn-out planning phase.',
    client: [
      'Tell me about the business',
      'Share sites you like (and ones you don’t)',
      'Explain how customers find you today',
    ],
    taylorurl: [
      'Ask the right questions',
      'Give an honest yes or no on fit',
      'Sketch out what the site should do',
    ],
  },
  {
    step: '02',
    icon: FileText,
    title: 'Plan and price',
    duration: 'Day 2-3',
    description:
      'I write up a clear plan: what I’m building, what’s included, and how long it takes. Once it works for both of us, we get started.',
    client: ['Look the plan over', 'Ask any questions', 'Give the go-ahead when you’re ready'],
    taylorurl: [
      'Send a clear plan and price',
      'Spell out what is and isn’t included',
      'Set the timeline',
    ],
  },
  {
    step: '03',
    icon: Palette,
    title: 'Design',
    duration: 'Week 1',
    description:
      'I show you what the site is going to look like. You give feedback, I make changes until it feels right. No huge design document, no design by committee.',
    client: [
      'Send your logo, photos, and content',
      'Look the designs over and tell me what you think',
      'Flag anything that doesn’t feel like you',
    ],
    taylorurl: [
      'Design what each page will look like',
      'Make changes based on your feedback',
      'Lock in the look and layout',
    ],
  },
  {
    step: '04',
    icon: Code,
    title: 'Build',
    duration: 'Week 2-3',
    description:
      'I build the site, custom from the ground up. You can check in any time — I share preview links the whole way, so there are no surprises at the end.',
    client: [
      'Check in on progress whenever you want',
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
    title: 'Review and launch',
    duration: 'Week 3-4',
    description:
      'You click through the whole site. I fix whatever needs fixing. Once you give the go-ahead, I put it online for the world to see.',
    client: ['Click through the whole site', 'Send any final changes', 'Give the go-ahead to launch'],
    taylorurl: [
      'Fix anything you find',
      'Tune up speed and Google visibility',
      'Handle the technical side of going live',
    ],
  },
  {
    step: '06',
    icon: HeadphonesIcon,
    title: 'After launch',
    duration: 'Ongoing',
    description:
      'Once the site is live, I keep it online, fast, safe, and up to date. The tech side stays with me so you stay focused on running the business.',
    client: ['Run the business', 'Text me when you need a change', 'No tickets, no waiting'],
    taylorurl: [
      'Keep the site fast and safe',
      'Handle hosting and backups',
      'Make updates as you need them',
    ],
  },
]

const WHAT_YOULL_NEED = [
  { icon: Image, label: 'Your logo (any file type)' },
  { icon: FileText, label: 'What you want each page to say' },
  { icon: Image, label: 'Photos of your work or your shop' },
  { icon: Paintbrush, label: 'Brand colors, if you have any' },
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
        eyebrow="// 01 — Process"
        title="From first call to live site."
        description="A clear, predictable path for Baytown and Houston-area businesses — six phases, three to four weeks, one operator."
      />

      <section className="relative overflow-hidden bg-paper py-24 sm:py-32">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div
            {...fadeInUp}
            className="grid items-end gap-10 border-b border-hair-paper pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                <span className="h-px w-8 bg-accent" />
                // 02 — Timeline
              </p>
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink-paper">
                Six phases.
                <br />
                <span className="text-accent">Three to four weeks.</span>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
              Most projects wrap in three to four weeks. Here is what each phase looks
              like — your half, my half, side by side.
            </p>
          </motion.div>

          <div className="mt-16 space-y-px overflow-hidden border border-hair-paper bg-hair-paper">
            {TIMELINE_STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.article
                  key={step.step}
                  {...staggerChild(i, 0.05)}
                  className="grid items-start gap-6 bg-paper p-8 sm:p-10 lg:grid-cols-[200px_1fr_1fr] lg:gap-10"
                >
                  <div className="flex items-start gap-5 lg:flex-col lg:gap-4">
                    <span className="font-mono text-[clamp(3rem,5vw,4.4rem)] font-semibold leading-none text-paper-faint">
                      {step.step}
                    </span>
                    <div className="flex flex-1 flex-col gap-3 lg:flex-none">
                      <Icon className="h-5 w-5 text-accent" strokeWidth={1.25} />
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                        {step.duration}
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <h3 className="mb-3 text-[22px] font-semibold leading-tight tracking-tight text-ink-paper sm:text-[26px]">
                      {step.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-paper-soft sm:text-[16px]">
                      {step.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-px overflow-hidden border border-hair-paper bg-hair-paper lg:col-span-1">
                    <div className="bg-paper p-5">
                      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                        Your part
                      </p>
                      <ul className="space-y-2">
                        {step.client.map(item => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-[13px] leading-snug text-paper-soft"
                          >
                            <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-paper-faint" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-paper p-5">
                      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                        My part
                      </p>
                      <ul className="space-y-2">
                        {step.taylorurl.map(item => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-[13px] leading-snug text-paper-soft"
                          >
                            <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-hair bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div
            {...fadeInUp}
            className="grid items-end gap-10 border-b border-hair pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                <span className="h-px w-8 bg-accent" />
                // 03 — Inputs
              </p>
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
                What I&apos;ll need
                <br />
                <span className="text-accent">from you.</span>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-ink-soft lg:text-right">
              Doesn&apos;t have to be perfect or finished. I can work with what you have
              and help fill in the gaps along the way.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-px overflow-hidden border border-hair bg-hair sm:grid-cols-2 lg:grid-cols-5">
            {WHAT_YOULL_NEED.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.label}
                  {...staggerChild(i, 0.05)}
                  className="flex flex-col gap-5 bg-bg p-6"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="text-[13px] font-medium leading-snug text-ink">
                    {item.label}
                  </span>
                </motion.div>
              )
            })}
          </div>

          <motion.p
            {...fadeInUp}
            transition={{ delay: 0.2 }}
            className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
          >
            // No logo or photos yet? I can point you to people who handle that.
          </motion.p>
        </div>
      </section>

      <CtaBanner
        heading="Ready to"
        accentText="get started?"
        description="You know how it works. Tell me about the business and what you need."
        primaryLabel="Start a project"
        primaryTo="/contact"
      />
    </div>
  )
}
