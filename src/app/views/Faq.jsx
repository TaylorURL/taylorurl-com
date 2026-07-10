import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import PageHero from '@components/PageHero'
import CtaBanner from '@components/CtaBanner'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { breadcrumbSchema } from '@constants/seo'
import { useScrollParallax } from '@hooks/useScrollParallax'

const FAQ_CATEGORIES = [
  {
    title: 'Getting started',
    questions: [
      {
        q: 'Who do you build websites for?',
        a: 'Local businesses — shops, restaurants, trades, contractors, salons, dentists, realtors, law firms, and independent pros. If you serve a local area and need to look the part online, you’re the kind of client I work with.',
      },
      {
        q: 'How long does a build take?',
        a: 'Most websites are up and running in two to four weeks. No endless meetings, no never-ending revision rounds. You tell me about the business, I build it, you give feedback, I put it online.',
      },
      {
        q: 'What do you need from me to get started?',
        a: 'Your logo if you have one, any photos you want used, and a clear sense of what your business does. I handle the writing, design, and overall look of the site. If your content isn’t ready yet, we can put it together as we go.',
      },
      {
        q: 'Can you redesign an existing site?',
        a: 'Yes. I do full redesigns all the time. I look at what you have, figure out what’s working and what isn’t, and rebuild from the ground up. I rethink how the pages are laid out, not just the colors.',
      },
    ],
  },
  {
    title: 'How I work',
    questions: [
      {
        q: 'What does ongoing care include?',
        a: 'Keeping the site online, keeping it safe, keeping it fast, fixing anything that breaks, daily backups, and small content changes. Pretty much everything needed to keep your site running smoothly.',
      },
      {
        q: 'How is this different from working with an agency?',
        a: 'I build the site and you talk to me directly. No account managers, no support tickets, no layers between you and the person doing the work. You text me, I handle it, and I stick around after launch.',
      },
      {
        q: 'Do you use WordPress, Wix, or Squarespace?',
        a: 'No. I build custom sites from scratch — no Wix, no Squarespace, no drag-and-drop builders. The result is faster, safer, and not tied to a monthly subscription you can never get off of.',
      },
      {
        q: 'Can you build more than a basic website?',
        a: 'Yes. A lot of local businesses need more than a few pages — online booking, customer accounts, ordering, quote forms, simple back-office tools. I build those custom to fit how you actually work, and connect them to the apps you already use.',
      },
    ],
  },
  {
    title: 'After launch',
    questions: [
      {
        q: 'Do I own the website?',
        a: 'Yes, completely. The site is yours. If you ever decide to move on, everything gets handed over. No lock-in.',
      },
      {
        q: 'Can I update content myself?',
        a: 'Depends on the setup. Some sites come with a simple editor so you can change text and photos yourself. For others, you send me a quick request and the change goes live the same day. Either way works.',
      },
      {
        q: 'What if I need changes after launch?',
        a: 'Small updates — text edits, photo swaps — are included in your ongoing care. Bigger changes like new pages or new features get a quick price up front before any work starts.',
      },
      {
        q: 'Do you only work with businesses in the Houston area?',
        a: 'I’m based in Baytown and most of my clients are around Houston, but I work with local businesses anywhere. The whole project can be handled by phone, text, and email.',
      },
      {
        q: 'What happens if I want to cancel?',
        a: 'You can stop the ongoing care plan any time. No annual contracts. If you leave, your whole site gets handed over. I’d rather earn your business every month than tie you to a contract.',
      },
    ],
  },
]

function FaqItem({ question, answer, isOpen, onToggle, index, panelId, sectionIndex }) {
  return (
    <motion.div {...staggerChild(index, 0.04)} className="border-hair-paper border-t">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="group flex w-full items-baseline justify-between gap-4 py-6 text-left"
      >
        <div className="flex items-baseline gap-5">
          <span className="text-paper-faint font-mono text-[11px] uppercase tracking-[0.22em]">
            {String(sectionIndex + 1).padStart(2, '0')}.{String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-[17px] font-medium tracking-tight text-ink-paper transition-colors group-hover:text-accent sm:text-[19px]">
            {question}
          </span>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex-shrink-0"
        >
          <Plus
            className={`h-5 w-5 transition-colors ${isOpen ? 'text-accent' : 'text-paper-faint group-hover:text-ink-paper'}`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="ml-12 max-w-3xl pb-7 pr-6 text-[15px] leading-relaxed text-paper-soft sm:text-[16px]">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Faq() {
  const [openItems, setOpenItems] = useState({})

  // Scroll-driven backdrop drift — the blueprint grid behind the FAQ stack
  // moves at its own slow rate against the page scroll, adding parallax depth
  // without scrubbing the question text the user is reading.
  const { ref: faqSectionRef, transform: gridTransform } = useScrollParallax({
    range: [0, -80],
  })

  const toggleItem = key => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div>
      <Seo
        title="FAQ — Small Business Websites in Baytown, TX"
        description="Common questions about working with TaylorURL — timelines, pricing, who owns what, and what happens after launch. Plain answers from an independent Baytown web designer."
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
        eyebrow="// 01 — FAQ"
        title="Common questions, honest answers."
        description="The questions I get most from owners — about timelines, how it works, who owns what, and what happens after launch."
      />

      <section ref={faqSectionRef} className="relative overflow-hidden bg-paper py-24 sm:py-32">
        <motion.div
          style={{ transform: gridTransform }}
          className="grid-blueprint-paper-fine absolute inset-0 opacity-40 will-change-transform"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-[1080px] px-6 sm:px-10 lg:px-16">
          <div className="space-y-20">
            {FAQ_CATEGORIES.map((category, catIndex) => (
              <motion.div
                key={category.title}
                {...fadeInUp}
                transition={{ delay: catIndex * 0.08 }}
              >
                <div className="border-hair-paper flex items-baseline gap-5 border-b pb-5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                    {String(catIndex + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold tracking-tightest text-ink-paper">
                    {category.title}
                  </h2>
                  <span className="text-paper-faint ml-auto font-mono text-[10px] uppercase tracking-[0.22em]">
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        eyebrow="// Next — Ask anything"
        heading="Still have"
        accentText="questions?"
        description="Send me a message. I get back within 24 hours, with an honest answer."
        primaryLabel="Get in touch"
        primaryTo="/contact"
      />
    </div>
  )
}
