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

const SERVICES = [
  {
    icon: Palette,
    title: 'Custom Websites',
    description:
      'No templates. No drag-and-drop builders. I design your site from scratch so it actually looks like your business.',
    features: [
      'Designed around your brand, not a theme',
      'Looks great on every screen size',
      "Smooth animations that don't feel cheap",
      'Your colors, your fonts, your vibe',
    ],
    mockup: 'default',
  },
  {
    icon: Code2,
    title: 'Website Redesigns',
    description:
      "Already have a site that looks outdated or runs like garbage? I'll rebuild it from the ground up with real code.",
    features: [
      'Full redesign with modern tech',
      'Keep your content, ditch the clutter',
      'Faster load times guaranteed',
      'SEO cleanup so Google notices',
    ],
    mockup: 'code',
  },
  {
    icon: Zap,
    title: 'Speed That Matters',
    description:
      'Slow sites lose customers. Google penalizes them too. I make sure yours is fast — actually fast, not "fast for a website."',
    features: [
      'Under 2 second load times',
      'Google Core Web Vitals optimized',
      'Images & assets compressed right',
      "Code split so nothing loads that shouldn't",
    ],
    mockup: 'analytics',
  },
  {
    icon: Wrench,
    title: 'I Handle Everything After',
    description:
      "Hosting, updates, security, backups — the boring stuff that breaks sites when nobody's watching. I watch it.",
    features: [
      'Hosting, SSL, & domain setup',
      'Security patches as they drop',
      'Uptime monitoring & daily backups',
      'Direct access to the developer who built it',
    ],
    mockup: 'default',
  },
]

const CAPABILITIES = [
  { icon: Smartphone, label: 'Responsive Design' },
  { icon: Search, label: 'SEO Optimization' },
  { icon: Shield, label: 'Security Hardening' },
  { icon: Globe, label: 'Domain & DNS' },
  { icon: RefreshCw, label: 'Content Updates' },
  { icon: Zap, label: 'Speed Optimization' },
]

const TECH_STACK = [
  'React',
  'JavaScript',
  'Tailwind CSS',
  'Node.js',
  'AWS',
  'Vercel',
  'Git',
  'Framer Motion',
  'Vite',
  'HTML5',
  'CSS3',
]

export default function Services() {
  return (
    <div>
      <Seo
        title="Web Development Services"
        description="Custom website development, redesigns, SEO, and ongoing maintenance for businesses in Baytown, Houston, and surrounding Texas areas. Hand-coded sites built by one developer who outperforms templates."
        path="/services"
      />
      <PageHero
        title="What I Do"
        description="Custom websites and redesigns. I build it, host it, and keep it running. That's the whole pitch."
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
            <h2 className="text-lg font-semibold text-gray-900">All of This Comes Standard</h2>
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

      {/* Tech stack */}
      <section className="relative overflow-hidden bg-gray-950 py-16">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mb-8 text-center">
            <h2 className="text-lg font-semibold text-white">Our Stack</h2>
            <p className="mt-2 text-sm text-gray-500">
              The same tools the big companies use — without the big company attitude.
            </p>
          </motion.div>
          <div className="flex flex-wrap justify-center gap-3">
            {TECH_STACK.map((tech, i) => (
              <motion.span
                key={tech}
                {...staggerChild(i, 0.04)}
                className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-gray-200 bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className={`mb-4 ${SECTION_H2}`}>
              Sounds <span className="logo-wave-dark">Good</span>?
            </h2>
            <p className="mb-8 text-base text-gray-600 sm:text-lg">
              Tell us what you need. We&apos;ll give you a straight answer and a real price.
            </p>
            <div className="flex justify-center">
              <Link to="/pricing" className={`group ${BTN_PRIMARY}`}>
                Get a Quote
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
