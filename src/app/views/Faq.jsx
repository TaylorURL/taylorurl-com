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
        a: "Local businesses — shops, restaurants, trades, contractors, salons, dentists, realtors, law firms, independent professionals, and anyone else running a real business in the community. If you have customers in your area and need a real online presence, you're the kind of client I work with.",
      },
      {
        q: 'How long does it take to build a site?',
        a: "Usually 2 to 4 weeks from start to launch. I don't drag things out with endless meetings and revision rounds. You tell me what you want, I build it, you give feedback, I ship it.",
      },
      {
        q: 'What do you need from me to get started?',
        a: "Not much. Your logo (if you have one), any photos you want used, and a rough idea of what your business does. I handle everything else — writing, design, structure. If you don't have content ready, I can work with you on that too.",
      },
      {
        q: 'Can you redesign my existing site?',
        a: "Absolutely. I do full redesigns all the time. I'll look at what you have, figure out what's working and what isn't, and build something better from scratch. No lipstick-on-a-pig situations.",
      },
    ],
  },
  {
    title: 'How I Work',
    questions: [
      {
        q: 'What does ongoing maintenance include?',
        a: "Hosting, security updates, performance monitoring, bug fixes, SSL certificates, backups, and minor content changes. Basically, everything it takes to keep your site fast, secure, and online. You never have to think about the technical stuff — that's the whole point of working with one developer instead of an agency.",
      },
      {
        q: 'What makes you different from agencies?',
        a: 'I write real code, and I work directly with the local businesses I build for. No account managers, no ticket systems, no agency overhead between you and the person actually building your site. You talk to me, I do the work, and I stick around after launch.',
      },
      {
        q: 'Do you use WordPress, Wix, or Squarespace?',
        a: "No. I write real code using modern frameworks like React. No third-party platforms, no page builders, no drag-and-drop tools. Your site is custom-built, loads fast, and isn't held hostage by some platform's subscription fees or limitations.",
      },
      {
        q: 'Can you build a web app, not just a marketing site?',
        a: 'Yes. A lot of local businesses need more than static pages — booking flows, customer portals, online ordering, quote forms, internal tools. I build those as real JavaScript applications using React, so they actually feel like modern software instead of a duct-taped plugin.',
      },
    ],
  },
  {
    title: 'After Launch',
    questions: [
      {
        q: 'Do I own my website?',
        a: "Yes, 100%. The code, the design, all of it — it's yours. If you ever want to leave, I hand everything over. No lock-in, no hostage situations.",
      },
      {
        q: 'Can I update content myself?',
        a: "Depends on the setup. Some sites come with a content management system where you can edit text and images yourself. For others, just shoot me a message and I'll make changes same-day. Either way, you're covered.",
      },
      {
        q: 'What if I need changes after launch?',
        a: "Small stuff like text edits and image swaps are included in ongoing maintenance. For bigger changes — new pages, new features — we'll scope it out together before I get started. No surprises.",
      },
      {
        q: 'Do you only work with local businesses in Houston?',
        a: "I'm based in Baytown, Texas and a lot of the local businesses I work with are in the Houston area, but I'll happily work with local businesses anywhere. Everything I do is remote-friendly. As long as you can hop on a call or send a text, we're good.",
      },
      {
        q: 'What happens if I want to cancel?',
        a: "You cancel. That's it. No contracts locking you in for a year. If you want to stop maintenance, I'll hand over all your files and code. I'd rather earn your business every month than trap you into staying.",
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
        description="Common questions about working with TaylorURL — a solo developer building modern websites and JavaScript applications for local businesses in Baytown, Houston, and beyond. Straight answers about timelines, process, and how I work directly with the businesses I build for."
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
