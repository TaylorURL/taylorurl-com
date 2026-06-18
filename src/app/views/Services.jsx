import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Code2,
  Globe,
  Palette,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  Wrench,
  Zap,
} from 'lucide-react'
import PageHero from '@components/PageHero'
import BrowserMockup from '@components/BrowserMockup'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { BTN_PRIMARY, SECTION_H2 } from '@constants/ui'
import { BUSINESS_ID, SERVICE_AREAS, breadcrumbSchema } from '@constants/seo'

const SERVICES = [
  {
    icon: Palette,
    title: 'Custom websites for local businesses',
    description:
      'Designed from scratch around your brand and your customers. No off-the-shelf templates — the site looks and feels like your business, not a stock theme everyone else is using.',
    features: [
      'Designed around your brand, not a theme',
      'Looks great on phones, tablets, and computers',
      'Polished little touches that feel premium',
      'Built for the customers you actually serve',
    ],
    mockup: 'default',
  },
  {
    icon: Code2,
    title: 'Website redesigns',
    description:
      'If your current site looks dated or is not bringing in business, I rebuild it from the ground up so you finally look as good online as you are in person.',
    features: [
      'Fresh, modern look from the ground up',
      'Keep what works, drop the clutter',
      'Noticeably faster pages',
      'Cleaned up so Google can find you',
    ],
    mockup: 'code',
  },
  {
    icon: Zap,
    title: 'Online tools and custom features',
    description:
      'Online booking, ordering, customer portals, quote forms, simple dashboards. When you need more than a basic site, I build the tools that fit how you run the business — and connect them to the apps you already use.',
    features: [
      'Custom tools built for your business',
      'Online booking, ordering, and quote forms',
      'Plays nice with the apps you already use',
      'Fast, smooth, and easy for customers',
    ],
    mockup: 'analytics',
  },
  {
    icon: Wrench,
    title: 'Ongoing care and updates',
    description:
      'Keeping the site online, fast, safe, and backed up. The technical stuff happens in the background so you never have to think about it.',
    features: [
      'Website hosting and domain set up',
      'Security kept current, behind the scenes',
      'Watched around the clock with daily backups',
      'A direct line to the person who built your site',
    ],
    mockup: 'default',
  },
]

const CAPABILITIES = [
  { icon: Smartphone, label: 'Works on every phone' },
  { icon: Search, label: 'Found on Google' },
  { icon: Shield, label: 'Locked down safe' },
  { icon: Globe, label: 'Domain set up for you' },
  { icon: RefreshCw, label: 'Easy content updates' },
  { icon: Zap, label: 'Quick page loads' },
]

export default function Services() {
  return (
    <div>
      <Seo
        title="Web Development Services in Baytown, TX"
        description="Custom websites, redesigns, JavaScript apps, SEO, and hosting for Baytown, Mont Belvieu, Pasadena, Deer Park, and Houston-area businesses."
        path="/services"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Services', path: '/services' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: 'Web Development',
            name: 'Web development and JavaScript application development',
            provider: { '@id': BUSINESS_ID },
            areaServed: SERVICE_AREAS.map(name => ({
              '@type': 'City',
              name,
              containedInPlace: { '@type': 'State', name: 'Texas' },
            })),
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: 'Web development services',
              itemListElement: SERVICES.map(service => ({
                '@type': 'Offer',
                itemOffered: {
                  '@type': 'Service',
                  name: service.title,
                  description: service.description,
                },
              })),
            },
          },
        ]}
      />
      <PageHero
        title="Web development in Baytown, TX"
        description="Custom websites, redesigns, and JavaScript applications for Baytown, Mont Belvieu, Pasadena, Deer Park, and Houston-area businesses — built, hosted, and maintained from one source."
      />

      {/* Services grid — alternating layout */}
      <section className="relative overflow-hidden bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="space-y-12 sm:space-y-20">
            {SERVICES.map((service, i) => {
              const Icon = service.icon
              const isReversed = i % 2 === 1
              return (
                <motion.div
                  key={service.title}
                  {...staggerChild(i, 0.15)}
                  className={`grid items-center gap-6 lg:grid-cols-2 lg:gap-10 ${isReversed ? 'lg:direction-rtl' : ''}`}
                >
                  <div className={isReversed ? 'lg:order-2' : ''}>
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                      <Icon className="h-6 w-6 text-blue-600" strokeWidth={1.5} />
                    </div>
                    <h3 className="mb-3 text-2xl font-bold text-gray-900">{service.title}</h3>
                    <p className="mb-6 text-base text-gray-600 sm:text-lg">{service.description}</p>
                    <ul className="space-y-3">
                      {service.features.map(feature => (
                        <li key={feature} className="flex items-center gap-3 text-gray-700">
                          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                            <Check className="h-3 w-3 text-blue-600" strokeWidth={3} />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={isReversed ? 'lg:order-1' : ''}>
                    <BrowserMockup
                      url={`yourbusiness.com${i === 1 ? '/before-after' : i === 2 ? '/performance' : ''}`}
                      variant={service.mockup}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Capabilities strip */}
      <section className="border-y border-gray-200 bg-gray-50 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mb-8 text-center">
            <h2 className="text-lg font-semibold text-gray-900">Standard with every build</h2>
          </motion.div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon
              return (
                <motion.div
                  key={cap.label}
                  {...staggerChild(i, 0.05)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-surface-overlay p-4 text-center transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <Icon className="h-5 w-5 text-blue-600" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-gray-700">{cap.label}</span>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Service area */}
      <section className="border-t border-gray-200 bg-surface-base py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div {...fadeInUp}>
            <h2 className="mb-3 text-xl font-bold text-gray-900 sm:text-2xl">
              Serving local businesses across the Houston area
            </h2>
            <p className="mb-6 text-base text-gray-600">
              Based in Baytown, TX and working with shops, restaurants, trades, contractors, and
              independent professionals across the surrounding communities.
            </p>
            <p className="text-sm leading-relaxed text-gray-500">
              {SERVICE_AREAS.join(' · ')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-gray-200 bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className={`mb-4 ${SECTION_H2}`}>
              Ready to <span className="logo-wave-dark">talk through it</span>?
            </h2>
            <p className="mb-8 text-base text-gray-600 sm:text-lg">
              Tell me what your business needs. You get a direct answer and a clear scope to work
              from.
            </p>
            <div className="flex justify-center">
              <Link to="/contact" className={`group ${BTN_PRIMARY}`}>
                Get in Touch
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
