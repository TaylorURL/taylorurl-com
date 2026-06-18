import { motion } from 'framer-motion'
import { fadeInUp, staggerChild } from '@constants/animations'
import { WHY_WEBSITE_CARDS } from '@data/home'
import { SECTION_H2 } from '@constants/ui'

export default function WhyWebsiteSection() {
  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-surface-base py-14 sm:py-24">
      <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div {...fadeInUp} className="mb-10 text-center sm:mb-16">
          <h2 className={`mb-4 ${SECTION_H2}`}>
            Why a website <span className="logo-wave-dark">earns its keep</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Six concrete ways a real website pays back the investment for a local business in
            Baytown, Houston, and the surrounding Texas communities.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {WHY_WEBSITE_CARDS.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={i}
                {...staggerChild(i)}
                whileHover={{ y: -5 }}
                className="group rounded-2xl border border-gray-200 bg-surface-raised p-5 transition-all duration-300 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 sm:p-8"
              >
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 transition-all duration-300 group-hover:bg-blue-50">
                  <Icon
                    className="h-6 w-6 text-gray-900 transition-colors group-hover:text-blue-600"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-gray-900">{item.title}</h3>
                <p className="leading-relaxed text-gray-600">{item.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
