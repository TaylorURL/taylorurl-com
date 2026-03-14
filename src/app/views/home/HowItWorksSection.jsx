import { motion } from 'framer-motion'
import { fadeInUp } from '@constants/animations'
import { HOW_IT_WORKS_STEPS } from '@data/home'

export default function HowItWorksSection() {
  return (
    <section className="relative border-t border-gray-200 bg-white py-24 overflow-hidden">
      <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
            Dead <span className="logo-wave-dark">Simple</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            No onboarding decks. No kickoff meetings. Here&apos;s how it actually works.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((item, i) => (
              <motion.div
                key={i}
                {...fadeInUp}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-blue-600 text-2xl font-bold text-blue-600">
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
