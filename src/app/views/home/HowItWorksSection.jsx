import { motion } from 'framer-motion'
import { fadeInUp } from '@constants/animations'
import { HOW_IT_WORKS_STEPS } from '@data/home'
import { SECTION_H2 } from '@constants/ui'

export default function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-surface-base py-14 sm:py-24">
      <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className={`mb-4 ${SECTION_H2}`}>
            Dead <span className="logo-wave-dark">Simple</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            No onboarding decks. No kickoff meetings. Just a straight path from
            &quot;my business needs a website&quot; to live.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {HOW_IT_WORKS_STEPS.map((item, i) => (
              <motion.div
                key={i}
                {...fadeInUp}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-600 text-lg font-bold text-blue-600 sm:mb-6 sm:h-16 sm:w-16 sm:text-2xl">
                  {item.step}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-gray-900">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
