import { motion } from 'framer-motion'
import { fadeInUp, staggerChild } from '@constants/animations'
import { WHY_WEBSITE_CARDS } from '@data/home'

export default function WhyWebsiteSection() {
  return (
    <section className="relative border-t border-gray-200 bg-white py-24 overflow-hidden">
      <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div {...fadeInUp} className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
            Why You <span className="logo-wave-dark">Need a Website</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Your competitors already have one. Let&apos;s be real about why it matters.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {WHY_WEBSITE_CARDS.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={i}
                {...staggerChild(i)}
                whileHover={{ y: -5 }}
                className="group rounded-2xl border border-gray-200 bg-white p-8 transition-all duration-300 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5"
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
