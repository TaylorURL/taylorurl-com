import { motion } from 'framer-motion'
import {
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
import CtaSection from '@components/CtaSection'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { BUSINESS_ID, SERVICE_AREAS, breadcrumbSchema } from '@constants/seo'
import { useScrollParallax } from '@hooks/useScrollParallax'

const SERVICES = [
  {
    icon: Palette,
    title: 'A brand-new website',
    description:
      'Designed from scratch around your business and the customers you’re trying to reach. No off-the-shelf templates — it looks and feels like you, not a theme half your competitors are using.',
    features: [
      'Designed around your business, not a template',
      'Looks great on phones, tablets, and computers',
      'Small touches that make it feel premium',
      'Built for the customers you actually want',
    ],
    mockup: 'default',
  },
  {
    icon: Code2,
    title: 'Redoing your current site',
    description:
      'If your site looks dated or isn’t bringing in business, I rebuild it from the ground up so you finally look as good online as you do in person.',
    features: [
      'Fresh, modern look from the ground up',
      'Keep what’s working, drop the clutter',
      'Noticeably faster pages',
      'Cleaned up so Google can actually find you',
    ],
    mockup: 'code',
  },
  {
    icon: Zap,
    title: 'Online booking, ordering, and tools',
    description:
      'Online booking, ordering, customer logins, quote forms, simple dashboards — when you need more than a basic site, I build the tools that fit how you actually run things, and tie them into the apps you already use.',
    features: [
      'Custom tools built for how you work',
      'Online booking, ordering, and quote forms',
      'Connects to the apps you already use',
      'Fast and easy for customers to use',
    ],
    mockup: 'analytics',
  },
  {
    icon: Wrench,
    title: 'Looking after it after launch',
    description:
      'Keeping the site online, fast, safe, and backed up. The tech side stays out of your way so you never have to think about it.',
    features: [
      'Hosting and domain set up for you',
      'Security kept current in the background',
      'Watched around the clock with daily backups',
      'A direct line to the person who built it',
    ],
    mockup: 'dashboard',
  },
]

const CAPABILITIES = [
  { icon: Smartphone, label: 'Works on every phone' },
  { icon: Search, label: 'Shows up on Google' },
  { icon: Shield, label: 'Locked down and safe' },
  { icon: Globe, label: 'Domain set up for you' },
  { icon: RefreshCw, label: 'Easy content updates' },
  { icon: Zap, label: 'Quick page loads' },
]

export default function Services() {
  return (
    <div>
      <Seo
        title="Small Business Website Services — Baytown, TX"
        description="Custom websites, redesigns, online booking, and hosting for shops, restaurants, trades, and pros in Baytown, Mont Belvieu, Pasadena, Deer Park, and the Houston area."
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
            name: 'Small business websites and online tools',
            provider: { '@id': BUSINESS_ID },
            areaServed: SERVICE_AREAS.map(name => ({
              '@type': 'City',
              name,
              containedInPlace: { '@type': 'State', name: 'Texas' },
            })),
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: 'Small business website services',
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
        eyebrow="// 01 — What I do"
        title="Built, hosted, and looked after — all by me."
        description="Custom websites, redesigns, and online tools for shops, restaurants, trades, and pros around Baytown and the Houston area."
      />

      {/* Services — alternating split layout */}
      <section className="relative overflow-hidden bg-paper py-24 sm:py-36">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <div className="divide-y divide-hair-paper border-y border-hair-paper">
            {SERVICES.map((service, i) => {
              const Icon = service.icon
              const isReversed = i % 2 === 1
              return (
                <motion.div
                  key={service.title}
                  {...staggerChild(i, 0.08)}
                  className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24"
                >
                  <div className={isReversed ? 'lg:order-2' : ''}>
                    <div className="mb-6 flex items-baseline justify-between border-b border-hair-paper pb-4">
                      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                        {String(i + 1).padStart(2, '0')} / 04
                      </span>
                      <Icon className="h-6 w-6 text-ink-paper" strokeWidth={1.25} />
                    </div>
                    <h3 className="mb-5 text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink-paper">
                      {service.title}
                    </h3>
                    <p className="mb-8 text-[16px] leading-relaxed text-paper-soft sm:text-[17px]">
                      {service.description}
                    </p>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {service.features.map(feature => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 border-t border-hair-paper pt-3 text-[14px] leading-snug text-paper-soft"
                        >
                          <Check
                            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent"
                            strokeWidth={2}
                          />
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

      {/* Capabilities strip — engineering spec list */}
      <section className="relative overflow-hidden border-t border-hair bg-bg py-20 text-ink sm:py-28">
        <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div {...fadeInUp} className="mb-12 border-b border-hair pb-8">
            <p className="mb-4 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              // Comes with every site
            </p>
            <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
              Six things every site I build comes with.
            </h2>
          </motion.div>
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-hair bg-hair md:grid-cols-3 lg:grid-cols-6">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon
              return (
                <motion.div
                  key={cap.label}
                  {...staggerChild(i, 0.04)}
                  className="flex flex-col gap-3 bg-bg p-5 text-left"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="text-[13px] font-medium leading-snug text-ink">
                    {cap.label}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Service area */}
      <section className="relative overflow-hidden border-t border-hair-paper bg-paper py-20 sm:py-28">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div {...fadeInUp} className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                <span className="h-px w-8 bg-accent" />
                // Where I work
              </p>
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink-paper">
                Local businesses across
                <br />
                <span className="text-accent">the Houston area.</span>
              </h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-paper-soft lg:text-right">
              Based in Baytown, TX. I work with shops, restaurants, trades, contractors, and
              independent pros across the surrounding towns and neighborhoods.
            </p>
          </motion.div>

          <motion.div
            {...fadeInUp}
            transition={{ delay: 0.1 }}
            className="mt-10 flex flex-wrap gap-x-3 gap-y-2 border-t border-hair-paper pt-8"
          >
            {SERVICE_AREAS.map(area => (
              <span
                key={area}
                className="rounded-sm border border-hair-paper-strong px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-soft"
              >
                {area}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      <CtaSection
        variant="dark"
        eyebrow="// Next — Let's talk"
        title={
          <>
            Ready to <span className="text-accent">talk it through</span>?
          </>
        }
        description="Tell me what your business needs. You get an honest answer and a clear plan to work from."
      />
    </div>
  )
}
