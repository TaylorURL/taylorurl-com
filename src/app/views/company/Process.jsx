import { m } from 'framer-motion'
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
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { PROCESS_TIMELINE } from '@data/pages/home'
import { breadcrumbSchema } from '@constants/seo'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
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
      'The plan comes back in writing: what gets built, what it costs, and the date it goes live. Nothing starts until the price and the plan both sit right with you.',
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
      'Hosting, backups and monitoring stay with us, and so do the small changes: new hours, a new photo on the front page. You text us, and it is handled.',
    client: ['Run the business', 'Text us when something changes', 'Send photos as you get them'],
    taylorurl: [
      'Keep the site fast and safe',
      'Handle hosting and backups',
      'Make updates as you need them',
    ],
  },
]

/**
 * The rows the page draws: each step's name and duration from the shared list,
 * carrying the long-form detail written for it here.
 */
const TIMELINE_STEPS = PROCESS_TIMELINE.map((step, index) => ({
  ...step,
  ...TIMELINE_DETAIL[index],
}))

// Scroll-driven timeline row. The decorative left rail (huge mono digit +
// icon + duration tag) drifts at its own pace as the row scrolls through view,
// breaking the otherwise-static grid into something with a sense of momentum.
function TimelineRow({ step, index }) {
  const Icon = step.icon
  const { ref, transform } = useScrollParallax({ range: [50, -50] })

  return (
    <m.article
      ref={ref}
      {...staggerChild(index, 0.05)}
      className="grid items-start gap-6 bg-paper p-8 sm:p-10 lg:grid-cols-[200px_1fr_1fr] lg:gap-10"
    >
      <m.div
        style={{ transform }}
        className="flex items-start gap-5 will-change-transform lg:flex-col lg:gap-4"
      >
        <span className="text-paper-faint display-2 font-mono font-semibold leading-none">
          {step.step}
        </span>
        <div className="flex flex-1 flex-col gap-3 lg:flex-none">
          <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
          <span className="section-label-sm text-accent">{step.duration}</span>
        </div>
      </m.div>

      <div className="lg:col-span-1">
        <h3 className="mb-3 text-[22px] font-semibold leading-tight tracking-tight text-ink-paper sm:text-[26px]">
          {step.title}
        </h3>
        <p className="text-[15px] leading-relaxed text-paper-soft sm:text-[16px]">
          {step.description}
        </p>
      </div>

      <div className="edge bg-hair-paper grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-2 lg:col-span-1">
        <div className="bg-paper p-5">
          <p className="section-label-sm text-paper-faint mb-3">Your Part</p>
          <ul className="space-y-2">
            {step.client.map(item => (
              <li
                key={item}
                className="flex items-start gap-2 text-[13px] leading-snug text-paper-soft"
              >
                <span className="mt-1 h-1 w-1 flex-shrink-0 rounded bg-[color:var(--paper-ink-faint)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-paper p-5">
          <p className="section-label-sm mb-3 text-accent">Our Part</p>
          <ul className="space-y-2">
            {step.taylorurl.map(item => (
              <li
                key={item}
                className="flex items-start gap-2 text-[13px] leading-snug text-paper-soft"
              >
                <span className="mt-1 h-1 w-1 flex-shrink-0 rounded bg-accent" />
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
        draft="iso"
        eyebrow="Process"
        title="Most of the work is mine."
        description="Six steps, two to four weeks, one small team from the first call to launch, for shops around Baytown and Houston. Your part is a few answers and a yes when it looks right."
      />

      <section className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.ledger}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <m.div
            {...fadeInUp}
            className="border-hair-paper grid items-end gap-10 border-b pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="section-label mb-6 block text-accent">Timeline</p>
              <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink-paper [text-wrap:balance]">
                Six steps. <br />
                <AccentGradient>Two to four weeks.</AccentGradient>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
              Every step names your part and mine, so you know what lands on you and when.
            </p>
          </m.div>

          <div className="panel-static bg-hair-paper mt-16 space-y-px overflow-hidden">
            {TIMELINE_STEPS.map((step, i) => (
              <TimelineRow key={step.step} step={step} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section
        data-ground="band"
        className="border-hair section-y relative overflow-hidden border-t bg-bg text-ink"
      >
        <div
          className={`absolute inset-0 ${GROUNDS.band.grid} ${DRAFTS.column}`}
          aria-hidden="true"
        />
        <div className="container-rail relative flex flex-col gap-12">
          <m.div
            {...fadeInUp}
            className="border-hair grid items-end gap-10 border-b pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="section-label mb-6 block text-accent">What You Bring</p>
              <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink [text-wrap:balance]">
                What we&apos;ll need <br />
                <AccentGradient>from you.</AccentGradient>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-ink-soft lg:text-right">
              None of it has to be finished. Send what you have and we fill the gaps as we go.
            </p>
          </m.div>

          <div className="panel-static bg-hair grid gap-px overflow-hidden sm:grid-cols-2 lg:grid-cols-5">
            {WHAT_YOULL_NEED.map((item, i) => {
              const Icon = item.icon
              return (
                <m.div key={item.label} {...staggerChild(i, 0.05)}>
                  <SpotlightCard
                    className="flex h-full flex-col gap-5 bg-bg p-6"
                    spotlightColor="var(--spotlight)"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                      <span className="font-mono text-[9px] tabular-nums tracking-tight text-ink-faint">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <span className="text-[13px] font-medium leading-snug text-ink">
                      {item.label}
                    </span>
                  </SpotlightCard>
                </m.div>
              )
            })}
          </div>

          <m.p
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.2 }}
            className="section-label-sm leading-relaxed text-ink-faint"
          >
            No logo or photos yet? We can point you to people who do that.
          </m.p>
        </div>
      </section>

      <CtaBanner
        draft="iso"
        heading="Two to four weeks"
        accentText="from here."
        description="Tell us what the business does and which customers you want. A plan and a price come back before any work starts."
        primaryLabel="Start a Project"
        primaryTo="/start"
      />
    </div>
  )
}
