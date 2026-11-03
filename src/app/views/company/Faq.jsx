import { CallToAction, PageIntro, Questions, Section, SectionHead } from '@components/kit/Kit'
import Seo from '@components/Seo'
import { PORTFOLIO_AVERAGES } from '@data/portfolio'
import { breadcrumbSchema, faqSchema } from '@constants/seo'

const FAQ_CATEGORIES = [
  {
    title: 'Getting started',
    questions: [
      {
        q: 'What does a website cost?',
        a: 'It depends on the project. A site is one fee to build, paid once before the work begins, and a monthly that covers hosting and everything after launch. Booking, ordering, a shop, the tools behind them, the ad tracking, and the monitoring are built as part of the site rather than billed on top of it, so what moves the price is how big the whole project is. Send me a line about the business and you get both figures in writing before any work starts. You pay nothing to ask.',
      },
      {
        q: 'Who do you build websites for?',
        a: 'Small businesses around Baytown and Houston. Live right now: a barber shop, a print shop, a barge fleeting yard on the bay, an industrial scale repair shop, a real estate agent, and a youth football league. If you serve a local area and most of your work comes from people near you, you are the kind of client I work with.',
      },
      {
        q: 'How long does a build take?',
        a: 'Most sites are live in two to four weeks. You tell me about the business, I build it, you say what is wrong, I fix it and put it online. What usually moves that date is photos and content coming back slowly, so having those ready is the fastest thing you can do.',
      },
      {
        q: 'What do you need from me to get started?',
        a: 'Your logo if you have one, whatever photos of the work you already have, and half an hour on the phone. I write the copy and design the site. If nothing is ready, I build the content as I go rather than waiting on it.',
      },
      {
        q: 'Can you redesign an existing site?',
        a: 'Yes. I look at what you have, work out which pages are costing you calls, and rebuild it. The layout, the order of the pages, and the words all get rethought, not just the colors.',
      },
    ],
  },
  {
    title: 'How I work',
    questions: [
      {
        q: 'What does ongoing care include?',
        a: 'Hosting, daily backups, security and software updates, changes whenever you need them, and the organic search work every month. If the site throws an error in a visitor’s browser, it reaches me as it happens rather than when somebody calls to tell me.',
      },
      {
        q: 'How is this different from working with an agency?',
        a: 'You text me, and I make the change. There is no account manager and no ticket queue, and a year after launch you are still texting the same number.',
      },
      {
        q: 'Do you use WordPress, Wix, or Squarespace?',
        a: `No. Every site is written from scratch, so there is no theme to update and no plugin to break it at midnight. Across the client sites already live, Google’s PageSpeed test averages ${PORTFOLIO_AVERAGES.mobile} on mobile and ${PORTFOLIO_AVERAGES.desktop} on desktop.`,
      },
      {
        q: 'Can you build more than a basic website?',
        a: 'Yes. Booking, customer accounts, ordering, quote forms, and small back-office screens all get built to fit how the shop already runs, and they talk to the software you already pay for.',
      },
    ],
  },
  {
    title: 'After launch',
    questions: [
      {
        q: 'Who owns what once the site is live?',
        a: 'Your domain is registered in your name and the text, photos, logo and brand marks you supply stay yours. TaylorURL keeps the source code and the platform it runs on, and each project agreement sets that out in full.',
      },
      {
        q: 'Can I update content myself?',
        a: 'On some sites, yes: they come with a simple editor for text and photos. On the rest, you text me the change and it goes live the same day, free. Either way, you are never sitting in a queue waiting to fix a price.',
      },
      {
        q: 'What if I need changes after launch?',
        a: 'Text, photo, and page changes are part of the monthly. A new feature, like a booking system or a whole new section, gets a price before any work starts, so nothing lands on an invoice you did not agree to.',
      },
      {
        q: 'Do you only work with businesses in the Houston area?',
        a: 'No. I am based in Baytown and most clients are around Houston and the bay, but the whole project runs fine by phone, text, and email. Being close enough to come look at the shop is a bonus, not a requirement.',
      },
      {
        q: 'Can I stop the monthly?',
        a: 'Yes, any time. There is no annual term to sign, no notice period, and no cancellation fee. The monthly is what keeps the site hosted, backed up and watched, so it is part of the cost of having the site rather than an add-on to it: the site stays online to the end of the period you have paid for and comes offline after that. If the monthly ever changes you hear about it in writing well before it is charged. Your domain is yours to move anywhere, and the content you gave me is yours to take.',
      },
    ],
  },
]

/**
 * The questions owners ask before they hire, in three groups, each answer
 * opening on a tap. The answers are native disclosures, so every one of them
 * is in the prerendered page and in the FAQPage schema whether or not a reader
 * opens it.
 */
export default function Faq() {
  return (
    <>
      <Seo
        title="FAQ: Small Business Websites in Baytown, TX"
        description="What owners ask before hiring a Baytown web designer: what a website costs, how long a build takes, who owns it afterward, and what happens after launch."
        path="/faq"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'FAQ', path: '/faq' },
          ]),
          faqSchema(FAQ_CATEGORIES.flatMap(cat => cat.questions)),
        ]}
      />

      <PageIntro
        title="What owners ask before they hire me."
        lead="Timelines, what it costs, who owns the site, and what happens after launch."
      />

      {/* Each group's name stands to the left of its questions on a wide
          screen and over them on a phone. */}
      {FAQ_CATEGORIES.map((category, index) => (
        <Section
          key={category.title}
          label={category.title}
          tight
          className={index === 0 ? '!pt-6' : ''}
          inner="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
        >
          <SectionHead title={category.title} className="self-start lg:mb-0" />
          <Questions items={category.questions} />
        </Section>
      ))}

      <CallToAction title="Still have a question?" />
    </>
  )
}
