import { motion } from 'framer-motion'
import { ArrowRight, Layers, Rocket, Shield, Users } from 'lucide-react'
import PageHero from '@components/PageHero'
import CtaBanner from '@components/CtaBanner'

const STATS = [
  { value: '100+', label: 'Projects Delivered' },
  { value: '3+', label: 'Years Experience' },
  { value: '100mi', label: 'Service Radius' },
  { value: '24/7', label: 'Support Available' },
]

const APPROACH_STEPS = [
  {
    step: '01',
    title: 'Discovery',
    description:
      'We learn about your business, goals, and target audience to create a strategy that works.',
  },
  {
    step: '02',
    title: 'Design',
    description:
      'Custom designs crafted to reflect your brand and convert visitors into customers.',
  },
  {
    step: '03',
    title: 'Develop',
    description:
      'We build your site with modern technologies, optimized for speed and performance.',
  },
  {
    step: '04',
    title: 'Deploy & Support',
    description:
      'Launch your site and provide ongoing maintenance to keep everything running smoothly.',
  },
]

const DIFFERENTIATORS = [
  {
    icon: Rocket,
    title: 'Fast Turnaround',
    description: 'Most projects completed within 2-4 weeks, not months.',
  },
  {
    icon: Shield,
    title: 'No Hidden Fees',
    description: 'Clear, upfront quotes with no surprise charges.',
  },
  {
    icon: Layers,
    title: 'Modern Stack',
    description: 'Built with technologies that scale as your business grows.',
  },
  {
    icon: Users,
    title: 'Direct Communication',
    description: 'Work directly with the developer, no middlemen.',
  },
]

export default function About() {
  return (
    <div>
      <PageHero
        title="About TaylorURL"
        description="A web development agency helping Houston-area businesses establish a powerful online presence."
      />

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="mb-6 text-4xl font-bold text-gray-900">
                Building Websites That <span className="logo-wave-dark">Drive Results</span>
              </h2>
              <div className="space-y-5 text-lg text-gray-600">
                <p>
                  TaylorURL is a web development agency based in Houston, Texas, founded by Trenton
                  Taylor with a simple mission: help local businesses succeed online without
                  breaking the bank.
                </p>
                <p>
                  We specialize in creating fast, modern, and mobile-friendly websites that not only
                  look great but actually convert visitors into customers. Every project is built
                  with care, using the same technologies trusted by enterprise companies.
                </p>
                <p>
                  Unlike large agencies with complex processes and high overhead, we keep things
                  simple. You work directly with the developer, get a clear upfront quote, and
                  receive ongoing support that ensures your website continues to perform.
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-2 gap-6"
            >
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center"
                >
                  <div className="mb-2 text-3xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              Why Choose <span className="logo-wave-dark">TaylorURL</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              We do things differently than traditional agencies.
            </p>
          </motion.div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {DIFFERENTIATORS.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                    <Icon className="h-6 w-6 text-gray-900" strokeWidth={1.5} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              Our <span className="logo-wave-dark">Process</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              A straightforward approach to getting your business online.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {APPROACH_STEPS.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative"
              >
                <div className="mb-4 text-5xl font-bold text-gray-100">{item.step}</div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
                {i < APPROACH_STEPS.length - 1 && (
                  <div className="absolute right-0 top-8 hidden text-gray-300 lg:block">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        heading="Ready to Get"
        accentText="Started?"
        description="Let's discuss your project and see how we can help your business grow online."
        secondaryLabel="View Our Work"
        secondaryTo="/work"
      />
    </div>
  )
}
