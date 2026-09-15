import { m } from 'framer-motion'
import {
  Check,
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
import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { PROCESS_TIMELINE } from '@data/pages/home'
import { breadcrumbSchema } from '@constants/seo'
import { AccentGradient } from '@reactbits/kit'

const TIMELINE_DETAIL = [
  {
    icon: MessageCircle,
    description:
      'You tell us what the business does and which customers you want more of. We ask questions and tell you straight whether we are the right fit. Nobody gets a pitch out of this call.',
    client: [
      'Tell us about the business',
      'Share sites you like (and ones you don’t)',
      'Explain how customers find you today',
    ],
    taylorurl: [
      'Learn how the business actually gets customers',
      'Give an honest yes or no on fit',
      'Sketch out what the site should do',
    ],
  },
  {
    icon: FileText,
    description:
      'We put the plan in writing: what gets built, what it costs, and the date it goes live. Nothing starts until the price and the plan both sit right with you.',
    client: ['Look the plan over', 'Ask any questions', 'Give the go-ahead when you’re ready'],
    taylorurl: [
      'Send a clear plan and price',
      'Spell out what is and isn’t included',
      'Set the timeline',
    ],
  },
  {
    icon: Palette,
    description:
      'You see the site before it gets built, as real pages with your own photos in them. Tell us what is wrong with it and we keep changing it until it looks like your business.',
    client: [
      'Send your logo, photos, and content',
      'Look the designs over and tell us what you think',
      'Flag anything that doesn’t feel like you',
    ],
    taylorurl: [
      'Design what each page will look like',
      'Make changes based on your feedback',
      'Lock in the look and layout',
    ],
  },
  {
    icon: Code,
    description:
      'This is the quiet stretch. We build the site from scratch and send a preview link as it goes, so the finished site is one you have already seen.',
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
    icon: Rocket,
    description:
      'You click through every page and list what is off. We fix all of it, then put the site live the day you say go.',
    client: [
      'Click through the whole site',
      'Send any final changes',
      'Give the go-ahead to launch',
    ],
    taylorurl: [
      'Fix anything you find',
      'Tune up speed and Google visibility',
      'Handle the technical side of going live',
    ],
  },
  {
    icon: HeadphonesIcon,
    description:
      'Hosting, backups and monitoring stay with us, and so do the changes: new hours, a new photo on the front page, a new page. You text us, and it is handled.',
    client: ['Run the business', 'Text us when something changes', 'Send photos as you get them'],
    taylorurl: [
      'Keep the site fast and safe',
      'Handle hosting and backups',
      'Make updates as you need them',
    ],
  },
]

/**
 * The cells the page draws: each step's name and duration from the shared
 * list, carrying the long-form detail written for it here.
 */
const TIMELINE_STEPS = PROCESS_TIMELINE.map((step, index) => ({
  ...step,
  ...TIMELINE_DETAIL[index],
}))

// How much of the four weeks each step takes, as the share of the ruler it is
// drawn across. The two days at the front are held wider than their share so
// their labels have room; the rest is the calendar.
const RULER_COLUMNS = 'lg:[grid-template-columns:13fr_17fr_26fr_34fr_30fr_20fr]'

const stepAnchor = step => `step-${step.step}`

/**
 * The six steps laid across the four weeks, over the grid that explains them.
 * The bar over each step is its span; the last one is drawn in the hairline
 * because it has no end.
 */
function TimelineRuler() {
  return (
    <ol className={`grid grid-cols-2 gap-x-1.5 gap-y-5 sm:grid-cols-3 ${RULER_COLUMNS}`}>
      {TIMELINE_STEPS.map((step, i) => {
        const open = i === TIMELINE_STEPS.length - 1
        return (
          <li key={step.step}>
            <a href={`#${stepAnchor(step)}`} className="group block">
              <span
                className={`block h-[3px] rounded-[var(--r-tiny)] ${open ? 'bg-hair-paper-strong' : 'bg-accent'}`}
                aria-hidden="true"
              />
              <span className="mt-3 flex gap-2 font-mono text-[12px] font-medium">
                <span className="text-accent">{step.step}</span>
                <span className="text-paper-faint">{step.duration}</span>
              </span>
              <span className="mt-1 block text-[14px] font-medium tracking-tight text-ink-paper transition-colors duration-200 ease-out-soft group-hover:text-accent">
                {step.title}
              </span>
            </a>
          </li>
        )
      })}
    </ol>
  )
}

// One step in the grid: the number and the span across the top, the title,
// the description, then what lands on the reader over what lands on us. The
// reader's list leads and takes the accent, because it is the one they came
// to read.
function StepCell({ step, index }) {
  const Icon = step.icon

  return (
    <m.article
      id={stepAnchor(step)}
      {...staggerChild(index, 0.05)}
      className="flex scroll-mt-28 flex-col bg-paper p-6 sm:p-7"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-[18px] w-[18px] text-accent" strokeWidth={1.5} aria-hidden="true" />
        <span className="font-mono text-[12px] font-medium text-accent">{step.step}</span>
        <span className="flex-1" />
        <span className="chip-static font-mono">{step.duration}</span>
      </div>

      <h3 className="mt-5 text-[20px] font-semibold leading-tight tracking-tight text-ink-paper">
        {step.title}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-paper-soft">{step.description}</p>

      <div className="border-hair-paper mt-5 flex flex-1 flex-col gap-5 border-t pt-5">
        <div>
          <p className="section-label-sm mb-3 text-accent">Your Part</p>
          <ul className="space-y-2">
            {step.client.map(item => (
              <li
                key={item}
                className="flex items-start gap-2 text-[13px] font-medium leading-snug text-ink-paper"
              >
                <Check
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="section-label-sm text-paper-faint mb-3">Our Part</p>
          <ul className="space-y-2">
            {step.taylorurl.map(item => (
              <li
                key={item}
                className="flex items-start gap-2 text-[13px] leading-snug text-paper-soft"
              >
                <span
                  className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-[color:var(--paper-ink-ghost)]"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </m.article>
  )
}

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
        title="How We Build Your Website in Baytown, TX"
        description="How we build websites for Baytown and Houston-area small businesses: a reply within the hour, a written plan and price, and a live site in two to four weeks."
        path="/process"
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Process', path: '/process' },
        ])}
      />
      <PageHero
        eyebrow="Process"
        title="Most of the work is ours."
        description="Six steps, two to four weeks, one small team from the first call to launch, for shops around Baytown and Houston. Your part is a few answers and a yes when it looks right."
      />

      <section className="section-y relative overflow-hidden bg-paper">
        <div className="container-rail relative">
          <m.div
            {...fadeInUp}
            className="border-hair-paper grid items-end gap-6 border-b pb-8 lg:grid-cols-[1.4fr_1fr] lg:gap-10"
          >
            <div>
              <p className="section-label mb-5 block text-accent">Timeline</p>
              <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink-paper [text-wrap:balance]">
                Six steps. <AccentGradient>Two to four weeks.</AccentGradient>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
              Every step names your part and ours, so you know what lands on you and when.
            </p>
          </m.div>

          <m.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }} className="mt-8">
            <TimelineRuler />
          </m.div>

          <div className="panel-static bg-hair-paper mt-8 grid gap-px overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
            {TIMELINE_STEPS.map((step, i) => (
              <StepCell key={step.step} step={step} index={i} />
            ))}
          </div>

          <m.div
            {...fadeInUp}
            className="panel-static bg-hair-paper mt-6 grid gap-px overflow-hidden lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
          >
            <div className="bg-paper p-6 sm:p-7">
              <p className="section-label-sm mb-3 text-accent">What You Bring</p>
              <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {WHAT_YOULL_NEED.map(item => {
                  const Icon = item.icon
                  return (
                    <li
                      key={item.label}
                      className="flex items-start gap-2.5 text-[14px] font-medium leading-snug tracking-tight text-ink-paper"
                    >
                      <Icon
                        className="mt-px h-4 w-4 flex-shrink-0 text-accent"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      {item.label}
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="flex flex-col justify-center gap-2 bg-paper p-6 sm:p-7">
              <p className="text-[15px] font-semibold tracking-tight text-ink-paper">
                None of it has to be finished.
              </p>
              <p className="text-[14px] leading-relaxed text-paper-soft">
                Send what you have and we fill the gaps as we go. No logo or photos yet? We can
                point you to people who do that.
              </p>
            </div>
          </m.div>
        </div>
      </section>

      <CtaBanner
        heading="Two to four weeks"
        accentText="from here."
        description="Tell us what the business does and which customers you want. You get a plan and a price before any work starts."
        primaryLabel="Start a Project"
        primaryTo="/start"
      />
    </div>
  )
}
