import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { BTN_PRIMARY, SECTION_H2 } from '@constants/ui'

const FAQ_CATEGORIES = [
  {
    title: 'Getting Started',
    questions: [
      {
        q: 'Who do you build websites for?',
        a: 'Local businesses — shops, restaurants, trades, contractors, salons, dentists, realtors, law firms, and independent professionals. If you serve a defined geographic area and need a real online presence, you are the kind of client I work with.',
      },
      {
        q: 'How long does a build take?',
        a: 'Most projects launch in two to four weeks. There are no endless meetings or revision rounds. You describe the work, I build it, you give feedback, I ship it.',
      },
      {
        q: 'What do you need from me to get started?',
        a: 'Your logo if you have one, any photos you want used, and a clear sense of what the business does. I handle the writing, design, and structure. If content is not ready, I can work with you to put it together.',
      },
      {
        q: 'Can you redesign an existing site?',
        a: 'Yes. I do full redesigns regularly. I review what you have, identify what works and what does not, and rebuild on a modern stack. The structure is reconsidered, not just the visuals.',
      },
    ],
  },
  {
    title: 'How I Work',
    questions: [
      {
        q: 'What does ongoing maintenance include?',
        a: 'Hosting, security updates, performance monitoring, bug fixes, SSL certificates, backups, and minor content changes. Effectively, everything required to keep the site fast, secure, and online.',
      },
      {
        q: 'How is this different from working with an agency?',
        a: 'I write the code, and you work directly with me. No account managers, no ticket systems, no overhead between you and the person building the site. You message me, I handle it, and I stay on after launch.',
      },
      {
        q: 'Do you use WordPress, Wix, or Squarespace?',
        a: 'No. I build with modern frameworks like React. No third-party platforms, no page builders, no drag-and-drop tools. The site is custom code that loads fast and is not tied to a platform subscription.',
      },
      {
        q: 'Can you build a web app, not just a marketing site?',
        a: 'Yes. Many local businesses need more than static pages — booking flows, customer portals, online ordering, quote forms, internal tools. I build those as real React applications that integrate with the systems you already use.',
      },
    ],
  },
  {
    title: 'After Launch',
    questions: [
      {
        q: 'Do I own the website?',
        a: 'Yes, in full. The code and the design belong to you. If you ever decide to move on, everything is handed over. No lock-in.',
      },
      {
        q: 'Can I update content myself?',
        a: 'It depends on the setup. Some sites include a content management system so you can edit text and images directly. For others, you send me a request and changes go out same-day. Either model is supported.',
      },
      {
        q: 'What if I need changes after launch?',
        a: 'Small updates like text edits and image swaps are included in ongoing maintenance. Larger changes — new pages or new features — are scoped separately before any work starts.',
      },
      {
        q: 'Do you only work with businesses in the Houston area?',
        a: 'I am based in Baytown and most of my clients are in the Houston area, but I work with local businesses anywhere. The work is remote-friendly end-to-end.',
      },
      {
        q: 'What happens if I want to cancel?',
        a: 'You can stop maintenance at any time. No annual contracts. If you leave, all files and code are handed over. I would rather earn the engagement each month than rely on a lock-in clause.',
      },
    ],
  },
]

function FaqItem({ question, answer, isOpen, onToggle, index, panelId }) {
  return (
    <motion.div {...staggerChild(index, 0.05)} className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-gray-900"
      >
        <span className="text-base font-medium text-gray-900 sm:text-lg">{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
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
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-4 leading-relaxed text-gray-600 sm:pr-12">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
        title="FAQ"
        description="Common questions about working with TaylorURL — an independent developer building modern websites and JavaScript applications for local businesses in Baytown, Houston, and beyond. Direct answers on timelines, process, ownership, and ongoing support."
        path="/faq"
        schema={{
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
        }}
      />
      <PageHero title="Frequently Asked Questions" description="Straight answers. No runaround." />

      <section className="relative bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.02]" />
        <div className="relative mx-auto max-w-3xl px-6">
          {FAQ_CATEGORIES.map((category, catIndex) => (
            <motion.div
              key={category.title}
              {...fadeInUp}
              transition={{ duration: 0.5, delay: catIndex * 0.15 }}
              className={catIndex > 0 ? 'mt-16' : ''}
            >
              <h2 className={`mb-6 ${SECTION_H2}`}>
                <span className="logo-wave-dark">{category.title}</span>
              </h2>
              <div className="rounded-2xl border border-gray-200 bg-gray-50/50 px-4 sm:px-6">
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
                      panelId={`faq-panel-${key}`}
                    />
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-gray-950 py-12 sm:py-20">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
              Still Have <span className="logo-wave">Questions</span>?
            </h2>
            <p className="mb-8 text-base text-gray-400 sm:text-lg">
              I don&apos;t bite. Shoot me a message and I&apos;ll get back to you fast.
            </p>
            <a href="/contact" className={BTN_PRIMARY}>
              Get in Touch
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
