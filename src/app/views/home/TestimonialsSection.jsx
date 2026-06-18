import { motion } from 'framer-motion'
import TrustpilotWidget from '@components/TrustpilotWidget'
import { staggerChild } from '@constants/animations'
import { SECTION_H2 } from '@constants/ui'

export default function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-surface-base py-14 sm:py-24">
      <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-10 text-center sm:mb-16">
          <h2 className={`mb-4 ${SECTION_H2}`}>
            What clients <span className="logo-wave-dark">say</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Verified reviews from the local businesses I build and maintain sites for.
          </p>
        </div>

        <motion.div {...staggerChild(0)} className="mx-auto max-w-4xl">
          <TrustpilotWidget />
        </motion.div>
      </div>
    </section>
  )
}
