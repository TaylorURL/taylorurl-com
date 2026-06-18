import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { BTN_PRIMARY, SECTION_H2 } from '@constants/ui'
import { breadcrumbSchema } from '@constants/seo'

const FAQ_CATEGORIES = [
  {
    title: 'Getting Started',
    questions: [
      {
        q: 'Who do you build websites for?',
        a: 'Local businesses — shops, restaurants, trades, contractors, salons, dentists, realtors, law firms, and independent pros. If you serve a defined area and need to look great online, you are the kind of client I work with.',
      },
      {
        q: 'How long does a build take?',
        a: 'Most websites are up and running in two to four weeks. No endless meetings or revision rounds. You tell me about the business, I build it, you give feedback, I put it online.',
      },
      {
        q: 'What do you need from me to get started?',
        a: 'Your logo if you have one, any photos you want used, and a clear sense of what your business does. I handle the writing, design, and the look of the site. If your content is not ready, we can put it together as we go.',
      },
      {
        q: 'Can you redesign an existing site?',
        a: 'Yes. I do full redesigns all the time. I look at what you have, figure out what works and what does not, and rebuild from the ground up. I rethink how the pages are laid out, not just the colors.',
      },
    ],
  },
  {
    title: 'How I Work',
    questions: [
      {
        q: 'What does ongoing care include?',
        a: 'Keeping the site online, keeping it safe, keeping it fast, fixing anything that breaks, daily backups, and small content changes. Pretty much everything needed to keep your site running smoothly.',
      },
      {
        q: 'How is this different from working with an agency?',
        a: 'I build the site, and you work directly with me. No account managers, no support tickets, no layers between you and the person making the site. You text me, I handle it, and I stick around after launch.',
      },
      {
        q: 'Do you use WordPress, Wix, or Squarespace?',
        a: 'No. I build custom sites from scratch — no Wix, no Squarespace, no drag-and-drop builders. The result is faster, safer, and not tied to a monthly subscription you can never escape.',
      },
      {
        q: 'Can you build more than a basic website?',
        a: 'Yes. Plenty of local businesses need more than a few pages — online booking, customer accounts, ordering, quote forms, simple back-office tools. I build those custom to fit how you work, and connect them to the apps you already use.',
      },
    ],
  },
  {
    title: 'After Launch',
    questions: [
      {
        q: 'Do I own the website?',
        a: 'Yes, completely. The site is yours. If you ever decide to move on, everything is handed over. No lock-in.',
      },
      {
        q: 'Can I update content myself?',
        a: 'It depends on the setup. Some sites come with a simple editor so you can change text and photos yourself. For others, you send me a quick request and the change goes live the same day. Either way works.',
      },
      {
        q: 'What if I need changes after launch?',
        a: 'Small updates — text edits, photo swaps — are included in your ongoing care. Bigger changes like new pages or new features get a quick price up front before any work starts.',
      },
      {
        q: 'Do you only work with businesses in the Houston area?',
        a: 'I am based in Baytown and most of my clients are around Houston, but I work with local businesses anywhere. The whole project can be handled by phone, text, and email.',
      },
      {
        q: 'What happens if I want to cancel?',
        a: 'You can stop the ongoing care plan any time. No annual contracts. If you leave, your whole site is handed over. I would rather earn your business every month than tie you to a contract.',
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
        title="FAQ — Web Development in Baytown, TX"
        description="Common questions about working with TaylorURL LLC — a Baytown, TX developer building websites and apps for Houston-area businesses."
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
        title="Frequently asked questions"
        description="Common questions about working with a Baytown, TX web developer. Direct answers on timelines, process, ownership, and ongoing support."
      />

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
              Still have <span className="logo-wave">questions</span>?
            </h2>
            <p className="mb-8 text-base text-gray-400 sm:text-lg">
              Send me a message. I respond within 24 hours.
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
