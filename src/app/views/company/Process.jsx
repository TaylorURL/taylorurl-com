import {
  CallToAction,
  CheckList,
  PageIntro,
  Section,
  SectionHead,
  Steps,
} from '@components/kit/Kit'
import Seo from '@components/Seo'
import { PROCESS_TIMELINE } from '@data/pages/home'
import { breadcrumbSchema } from '@constants/seo'

// What happens in each step, in the order of the shared timeline, which holds
// each step's name and how long it takes.
const DETAIL = [
  'You tell me what the business does and which customers you want more of. I tell you straight whether I am the right fit.',
  'I put the plan in writing: what gets built, what it costs, and the date it goes live. Nothing starts until the price and the plan both sit right with you.',
  'You see the site before it gets built, as real pages with your own photos in them. I keep changing it until it looks like your business.',
  'I build the site from scratch and send a preview link as it goes, so the finished site is one you have already seen.',
  'You click through every page and list what is off. I fix all of it, then put the site live the day you say go.',
  'Hosting, backups, monitoring and changes stay with me: new hours, a new photo, a new page. You text me, and it is handled.',
]

const STEPS = PROCESS_TIMELINE.map((step, index) => ({
  title: `${step.title} · ${step.duration.replace('-', '–')}`,
  body: DETAIL[index],
}))

const WHAT_YOU_BRING = [
  'Your logo (any file type)',
  'What you want each page to say',
  'Photos of your work or your shop',
  'Brand colors, if you have any',
  'Your web address, or help picking one',
]

/**
 * How a build runs: six steps from the first call to the site going live, and
 * what to send. Each step is a card with its name, how long it takes, and what
 * happens in it.
 */
export default function Process() {
  return (
    <>
      <Seo
        title="How I Build Your Website in Baytown, TX"
        description="How I build websites for Baytown and Houston-area small businesses: a reply within the hour, a written plan and price, and a live site in two to four weeks."
        path="/process"
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Process', path: '/process' },
        ])}
      />

      <PageIntro
        title="Most of the work is mine."
        lead="Six steps, two to four weeks from the first call to launch. Your part is a few answers and a yes when it looks right."
      />

      <Section label="The six steps" className="!pt-6">
        <Steps items={STEPS} className="lg:!grid-cols-3" />
      </Section>

      <Section label="What you bring">
        <SectionHead title="What to send me" />
        <CheckList items={WHAT_YOU_BRING} />
      </Section>

      <CallToAction title="Two to four weeks from here." />
    </>
  )
}
