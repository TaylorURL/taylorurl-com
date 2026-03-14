import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'

const FAQ_CATEGORIES = [
  {
    title: 'Getting Started',
    questions: [
      {
        q: 'How much does a website cost?',
        a: 'Most local business sites land between $1,500 and $5,000 depending on what you need. A simple 5-page site is on the lower end. Something with booking, e-commerce, or custom features costs more. We also offer ongoing maintenance for $99/mo so you never have to worry about updates or security.',
      },
      {
        q: 'How long does it take to build a site?',
        a: "Usually 2 to 4 weeks from start to launch. We don't drag things out with endless meetings and revision rounds. You tell us what you want, we build it, you give feedback, we ship it.",
      },
      {
        q: 'What do you need from me to get started?',
        a: "Not much. Your logo (if you have one), any photos you want used, and a rough idea of what you want. We handle everything else — writing, design, structure. If you don't have content ready, we can work with you on that too.",
      },
      {
        q: 'Can you redesign my existing site?',
        a: "Absolutely. We do full redesigns all the time. We'll look at what you have, figure out what's working and what isn't, and build something better from scratch. No lipstick-on-a-pig situations.",
      },
    ],
  },
  {
    title: 'Pricing & Payment',
    questions: [
      {
        q: 'What does the $99/mo maintenance include?',
        a: 'Hosting, security updates, performance monitoring, bug fixes, SSL certificates, backups, and minor content changes. Basically, everything it takes to keep your site fast, secure, and online. You never have to think about the technical stuff.',
      },
      {
        q: 'What makes you different from other agencies?',
        a: "We write real code. We don't hide behind page builders or templates and charge you agency prices for it. You talk directly to the people building your site — no account managers, no ticket systems. And we actually stick around after launch.",
      },
      {
        q: 'Do you use WordPress, Wix, or Squarespace?',
        a: "No. We write real code using modern frameworks like React. No third-party platforms, no page builders, no drag-and-drop tools. Your site is custom-built, loads fast, and isn't held hostage by some platform's subscription fees or limitations.",
      },
    ],
  },
  {
    title: 'After Launch',
    questions: [
      {
        q: 'Do I own my website?',
        a: "Yes, 100%. The code, the design, all of it — it's yours. If you ever want to leave, we hand everything over. No lock-in, no hostage situations.",
      },
      {
        q: 'Can I update content myself?',
        a: "Depends on the setup. Some sites come with a content management system where you can edit text and images yourself. For others, just shoot us a message and we'll make changes same-day. Either way, you're covered.",
      },
      {
        q: 'What if I need changes after launch?',
        a: "Small stuff like text edits and image swaps are included in your maintenance plan. For bigger changes — new pages, new features — we'll give you a quote. No surprises.",
      },
      {
        q: 'Do you only work with businesses in Houston?',
        a: "Nope. We're based in Baytown, Texas and a lot of our clients are in the Houston area, but we work with people everywhere. Everything we do is remote-friendly. As long as you can hop on a call or send a text, we're good.",
      },
      {
        q: 'What happens if I want to cancel?',
        a: "You cancel. That's it. No contracts locking you in for a year. If you want to stop maintenance, we'll hand over all your files and code. We'd rather earn your business every month than trap you into staying.",
      },
    ],
  },
]

function FaqItem({ question, answer, isOpen, onToggle, index }) {
  return (
    <motion.div {...staggerChild(index, 0.05)} className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-gray-900"
      >
        <span className="text-lg font-medium text-gray-900">{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="h-5 w-5 text-gray-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-12 leading-relaxed text-gray-600">{answer}</p>
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
        title="FAQ - Web Development Questions"
        description="Common questions about web development pricing, timelines, and working with TaylorURL in Baytown and Houston TX. Get straight answers about custom websites for your business."
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

      <section className="relative bg-white py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.02]" />
        <div className="relative mx-auto max-w-3xl px-6">
          {FAQ_CATEGORIES.map((category, catIndex) => (
            <motion.div
              key={category.title}
              {...fadeInUp}
              transition={{ duration: 0.5, delay: catIndex * 0.15 }}
              className={catIndex > 0 ? 'mt-16' : ''}
            >
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                <span className="logo-wave-dark">{category.title}</span>
              </h2>
              <div className="rounded-2xl border border-gray-200 bg-gray-50/50 px-6">
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
                    />
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-gray-950 py-20">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-white">
              Still Have <span className="logo-wave">Questions</span>?
            </h2>
            <p className="mb-8 text-lg text-gray-400">
              We don&apos;t bite. Shoot us a message and we&apos;ll get back to you fast.
            </p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white transition-all hover:bg-blue-500"
            >
              Get in Touch
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
