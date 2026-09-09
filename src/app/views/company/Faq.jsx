import { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import Seo from '@components/Seo'
import { BUILD_PRICE, MONTHLY_PRICE } from '@data/checkout/pricing'
import { PORTFOLIO_AVERAGES } from '@data/portfolio'
import { EASE, fadeInUp, staggerChild } from '@constants/animations'
import { breadcrumbSchema } from '@constants/seo'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'

const FAQ_CATEGORIES = [
  {
    title: 'Getting started',
    questions: [
      {
        q: 'What does a website cost?',
        a: `Builds start at ${BUILD_PRICE}, paid once before the work begins. The monthly starts at ${MONTHLY_PRICE} and covers hosting and everything after launch. Most sites land there. Booking, ordering, a shop, and the tools behind them are built as part of the site rather than billed on top of it. What moves the price is how big the whole project is, and you agree to that figure before any work starts. Nothing is charged to get the plan and the price.`,
      },
      {
        q: 'Who do you build websites for?',
        a: 'Small businesses around Baytown and Houston. Live right now: a barber shop, a print shop, a barge fleeting yard on the bay, an industrial scale repair shop, a real estate agent, and a youth football league. If you serve a local area and most of your work comes from people near you, you are the kind of client we work with.',
      },
      {
        q: 'How long does a build take?',
        a: 'Most sites are live in two to four weeks. You tell us about the business, we build it, you say what is wrong, we fix it and put it online. What usually moves that date is photos and content coming back slowly, so having those ready is the fastest thing you can do.',
      },
      {
        q: 'What do you need from me to get started?',
        a: 'Your logo if you have one, whatever photos of the work you already have, and half an hour on the phone. We write the copy and design the site. If nothing is ready, we build the content as we go rather than waiting on it.',
      },
      {
        q: 'Can you redesign an existing site?',
        a: 'Yes. We look at what you have, work out which pages are costing you calls, and rebuild it. The layout, the order of the pages, and the words all get rethought, not just the colors.',
      },
    ],
  },
  {
    title: 'How we work',
    questions: [
      {
        q: 'What does ongoing care include?',
        a: 'Hosting, daily backups, security and software updates, and text or photo changes whenever you need them. If the site throws an error in a visitor’s browser, it reaches us as it happens rather than when somebody calls to tell us.',
      },
      {
        q: 'How is this different from working with an agency?',
        a: 'You talk to the people building the site. The team is small, so there is no account manager and no ticket queue. You text us, we make the change, and a year later the same people are still answering.',
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
        a: 'On some sites, yes: they come with a simple editor for text and photos. On the rest, you text us the change and it goes live the same day at no charge. Either way, you are never sitting in a queue waiting to fix a price.',
      },
      {
        q: 'What if I need changes after launch?',
        a: 'Text edits and photo swaps are part of the monthly. A new page or a new feature gets a price before any work starts, so nothing lands on an invoice you did not agree to.',
      },
      {
        q: 'Do you only work with businesses in the Houston area?',
        a: 'No. We are based in Baytown and most clients are around Houston and the bay, but the whole project runs fine by phone, text, and email. Being close enough to come look at the shop is a bonus, not a requirement.',
      },
      {
        q: 'Can I stop the monthly?',
        a: `Yes, any time. There is no annual term to sign, no notice period, and no cancellation fee. The ${MONTHLY_PRICE} is what keeps the site hosted, backed up and watched, so it is part of the cost of having the site rather than an add-on to it: the site stays online to the end of the period you have paid for and comes offline after that. If the monthly ever changes you hear about it in writing well before it is charged. Your domain is yours to move anywhere, and the content you gave us is yours to take.`,
      },
    ],
  },
]

function FaqItem({ question, answer, isOpen, onToggle, index, panelId, sectionIndex }) {
  return (
    <m.div {...staggerChild(index, 0.04)} className="border-hair-paper border-t">
      <SpotlightCard className="bg-transparent px-2" spotlightColor="var(--spotlight-soft)">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="group flex w-full items-baseline justify-between gap-4 px-2 py-6 text-left transition-colors duration-200 hover:bg-ink-paper/[0.02]"
        >
          <div className="flex items-baseline gap-5">
            <span className="text-paper-faint font-mono text-[11px] tabular-nums tracking-tight">
              {String(sectionIndex + 1).padStart(2, '0')}.{String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-[17px] font-medium tracking-tight text-ink-paper transition-colors group-hover:text-accent sm:text-[19px]">
              {question}
            </span>
          </div>
          <m.span
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="flex-shrink-0"
          >
            <Plus
              className={`h-5 w-5 transition-colors ${isOpen ? 'text-accent' : 'text-paper-faint group-hover:text-ink-paper'}`}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </m.span>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <m.div
              id={panelId}
              role="region"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden"
            >
              <p className="ml-12 max-w-3xl pb-7 pr-6 text-[15px] leading-relaxed text-paper-soft sm:text-[16px]">
                {answer}
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </SpotlightCard>
    </m.div>
  )
}

export default function Faq() {
  const [openItems, setOpenItems] = useState({})

  const toggleItem = key => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div>
      <Seo
        title="FAQ: Small Business Websites in Baytown, TX"
        description="What owners ask before hiring a Baytown web designer: what a website costs, how long a build takes, who owns it afterward, and what happens after launch."
        path="/faq"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'FAQ', path: '/faq' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_CATEGORIES.flatMap(cat =>
              cat.questions.map(item => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.a,
                },
              }))
            ),
          },
        ]}
      />
      <PageHero
        eyebrow="FAQ"
        title="What owners ask before they hire us."
        description="Timelines, what it costs, who owns the site, and what happens after launch. If yours is not here, ask and get a straight answer."
      />

      <section className="section-y relative overflow-hidden bg-paper">
        <div className="container-rail-tight relative">
          <div className="space-y-20">
            {FAQ_CATEGORIES.map((category, catIndex) => (
              <m.div key={category.title} {...fadeInUp}>
                <div className="border-hair-paper flex items-baseline gap-5 border-b pb-5">
                  <span className="font-mono text-[11px] tabular-nums tracking-tight text-accent">
                    {String(catIndex + 1).padStart(2, '0')}
                  </span>
                  <h2 className="display-4 font-semibold tracking-tightest text-ink-paper [text-wrap:balance]">
                    {category.title}
                  </h2>
                  <span className="section-label-sm text-paper-faint ml-auto">
                    {String(category.questions.length).padStart(2, '0')} entries
                  </span>
                </div>
                <div>
                  {category.questions.map((item, qIndex) => {
                    const key = `${catIndex}-${qIndex}`
                    return (
                      <FaqItem
                        key={key}
                        question={item.q}
                        answer={item.a}
                        isOpen={!!openItems[key]}
                        onToggle={() => toggleItem(key)}
                        index={qIndex}
                        sectionIndex={catIndex}
                        panelId={`faq-panel-${key}`}
                      />
                    )
                  })}
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        eyebrow="Next"
        heading="Still have"
        accentText="questions?"
        description="Send the question over. The reply usually comes back within the hour, and asking costs nothing."
        primaryLabel="Get Your Answer"
        primaryTo="/contact"
      />
    </div>
  )
}
