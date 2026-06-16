import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import MockupCarousel from '@components/MockupCarousel'
import TypingRotator from '@components/TypingRotator'
import { BTN_PRIMARY } from '@constants/ui'

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[90vh] items-center overflow-hidden">
      <div className="absolute inset-0 bg-gray-950" />
      <div className="grid-pattern-blue absolute inset-0 opacity-[0.06]" />
      <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-600/20 blur-[120px] sm:h-[600px] sm:w-[900px]" />
      <div className="absolute bottom-0 right-0 h-[300px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/10 blur-[100px] sm:h-[400px] sm:w-[600px]" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-16 sm:gap-12 sm:py-20 lg:grid-cols-[1fr_400px] lg:gap-16 lg:py-24">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
            </span>
            Serving the Greater Houston area
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6 text-3xl font-bold leading-[1.08] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl"
          >
            Modern websites for
            <br />
            local <TypingRotator />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-8 max-w-md text-base leading-relaxed text-gray-400 sm:mb-10 sm:text-lg"
          >
            I&apos;m Trenton. I build websites and JavaScript applications for local businesses.
            Hand-coded React, clean design, direct relationship with the developer who writes the
            code.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex"
          >
            <Link to="/contact" className={`group ${BTN_PRIMARY}`}>
              Start a project
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-12 flex items-center gap-3 text-sm text-gray-500 sm:gap-6"
          >
            <div className="flex -space-x-2">
              {['bg-orange-500', 'bg-blue-600', 'bg-emerald-500', 'bg-violet-500'].map(
                (color, i) => (
                  <div
                    key={i}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-950 ${color} text-[10px] font-bold text-white`}
                  >
                    {['MR', 'JM', 'SC', 'DK'][i]}
                  </div>
                )
              )}
            </div>
            <span>
              Working with <strong className="text-gray-300">50+</strong> local businesses across
              the area
            </span>
          </motion.div>
        </div>

        {/* Browser mockup carousel - desktop only */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="hidden lg:flex lg:items-center lg:justify-center"
        >
          <MockupCarousel />
        </motion.div>
      </div>
    </section>
  )
}
