import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Code2, Palette, Wrench, Zap } from 'lucide-react'
import PageHero from '@components/PageHero'

const SERVICES = [
  {
    icon: Palette,
    title: 'Website Design & Development',
    description: 'Custom websites built from scratch with modern technologies and best practices.',
    features: [
      'Responsive design for all devices',
      'SEO-optimized structure',
      'Fast page load times',
      'Custom animations and interactions',
      'Content management integration',
    ],
  },
  {
    icon: Code2,
    title: 'React Application Development',
    description: 'Complex web applications built with React and modern JavaScript frameworks.',
    features: [
      'Component-based architecture',
      'State management solutions',
      'API integration',
      'Real-time features',
      'Progressive Web Apps (PWA)',
    ],
  },
  {
    icon: Zap,
    title: 'Performance Optimization',
    description: 'Make your existing website faster and improve user experience.',
    features: [
      'Core Web Vitals improvement',
      'Image and asset optimization',
      'Code splitting and lazy loading',
      'Caching strategies',
      'Performance monitoring setup',
    ],
  },
  {
    icon: Wrench,
    title: 'Ongoing Maintenance & Support',
    description: 'Keep your website running smoothly with continuous support.',
    features: [
      'Regular updates and patches',
      'Bug fixes and troubleshooting',
      'Content updates',
      'Performance monitoring',
      'Security updates',
    ],
  },
]

export default function Services() {
  return (
    <div>
      <PageHero
        title="Services"
        description="Comprehensive web development services tailored to your business needs."
      />

      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-8 md:grid-cols-2">
            {SERVICES.map((service, i) => {
              const Icon = service.icon
              return (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  whileHover={{ y: -5 }}
                  className="group rounded-2xl border border-gray-200 bg-white p-8 transition-all duration-300 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5"
                >
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-50">
                    <Icon
                      className="h-6 w-6 text-gray-900 transition-colors group-hover:text-blue-600"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-gray-900">{service.title}</h3>
                  <p className="mb-5 text-gray-600">{service.description}</p>
                  <ul className="space-y-3">
                    {service.features.map(feature => (
                      <li key={feature} className="flex items-start gap-3 text-sm text-gray-600">
                        <Check
                          className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600"
                          strokeWidth={2}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-200 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              Ready to <span className="logo-wave-dark">Get Started</span>?
            </h2>
            <p className="mb-6 text-gray-600">
              Let's discuss your project and create a custom solution for your business.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/pricing"
                className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-all duration-300 hover:scale-105 hover:bg-blue-700"
              >
                Get a Quote
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/work"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-900 transition-all duration-300 hover:scale-105 hover:bg-gray-100"
              >
                View My Work
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
