import { motion } from 'framer-motion'
import { ArrowRight, Plus } from 'lucide-react'
import Seo from '@components/Seo'
import CtaSection from '@components/CtaSection'
import SpigotHero from './spigot/SpigotHero'
import SpigotCodeCard from './spigot/SpigotCodeCard'
import { fadeInUp, staggerChild } from '@constants/animations'
import { SITE_URL, breadcrumbSchema } from '@constants/seo'
import {
  SPIGOT_CAPABILITIES,
  SPIGOT_FAQ,
  SPIGOT_PROCESS,
  SPIGOT_STACK,
  SPIGOT_STORY,
} from '@data/spigot'

/** Mono section label — house style, with a short Spigot-orange rule. */
function SectionLabel({ children }) {
  return (
    <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-mute">
      <span className="h-px w-8" style={{ backgroundColor: 'var(--c-orange)' }} />
      {children}
    </p>
  )
}

/** Paper-surface variant of the section label. */
function SectionLabelPaper({ children }) {
  return (
    <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-mute">
      <span className="h-px w-8" style={{ backgroundColor: 'var(--c-orange)' }} />
      {children}
    </p>
  )
}

export default function Spigot() {
  return (
    <div className="spigot-scope">
      <Seo
        title="Spigot & Paper Plugin Development"
        description="Custom Minecraft server plugins built in Java by Trenton Taylor of TaylorURL. Bespoke gameplay, minigames, economies, and admin tools for Spigot and Paper — shipped with full source."
        path="/spigot"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Spigot Development', path: '/spigot' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: 'Minecraft Plugin Development',
            name: 'Custom Spigot and Paper plugin development',
            provider: { '@id': `${SITE_URL}/#business` },
            description:
              'Custom server-side Minecraft plugins in Java — gameplay, minigames, economies, integrations, and admin tooling for Spigot and Paper.',
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: 'Minecraft plugin development',
              itemListElement: SPIGOT_CAPABILITIES.map(item => ({
                '@type': 'Offer',
                itemOffered: {
                  '@type': 'Service',
                  name: item.title,
                  description: item.description,
                },
              })),
            },
          },
        ]}
      />

      <SpigotHero />

      {/* The story — TaylorURL -> Minecraft -> Spigot, the tri-colour spine. */}
      <section className="border-hair relative overflow-hidden border-t bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint-fine absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div {...fadeInUp} className="mb-14 max-w-3xl">
            <SectionLabel>// How the pieces fit</SectionLabel>
            <h2 className="text-[clamp(1.9rem,3.6vw,2.8rem)] font-semibold leading-[1.04] tracking-tightest text-ink">
              One developer, building where your players already are.
            </h2>
          </motion.div>

          <div className="relative">
            {/* Connecting spectrum line (desktop) */}
            <div
              className="tri-fill absolute left-0 right-0 top-[34px] hidden h-px opacity-60 lg:block"
              aria-hidden="true"
            />
            <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
              {SPIGOT_STORY.map((node, i) => (
                <motion.div key={node.label} {...staggerChild(i, 0.1)} className="relative">
                  <div className="mb-6 flex items-center gap-4">
                    <span
                      className="relative z-10 grid h-[18px] w-[18px] place-items-center rounded-full"
                      style={{ backgroundColor: node.color }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-bg" />
                    </span>
                    {i < SPIGOT_STORY.length - 1 && (
                      <ArrowRight
                        className="h-4 w-4 text-ink-faint lg:hidden"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <p
                    className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em]"
                    style={{ color: node.color }}
                  >
                    {node.role}
                  </p>
                  <h3 className="mb-3 text-[22px] font-semibold tracking-tight text-ink">
                    {node.label}
                  </h3>
                  <p className="max-w-sm text-[15px] leading-relaxed text-ink-soft">
                    {node.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What I build — capabilities grid on paper. */}
      <section
        id="what-i-build"
        className="border-hair-paper relative scroll-mt-24 overflow-hidden border-t bg-paper py-24 text-ink-paper sm:py-32"
      >
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div {...fadeInUp} className="border-hair-paper mb-12 border-b pb-8">
            <SectionLabelPaper>// What I build</SectionLabelPaper>
            <div className="grid items-end gap-6 lg:grid-cols-[1.5fr_1fr]">
              <h2 className="text-[clamp(1.9rem,3.6vw,2.8rem)] font-semibold leading-[1.04] tracking-tightest text-ink-paper">
                Six kinds of plugin,
                <br />
                one blank slate.
              </h2>
              <p className="max-w-md text-[15px] leading-relaxed text-paper-soft lg:text-right">
                Most jobs land in one of these buckets, or a mix of them. Everything is written from
                scratch for your server, not reskinned off a marketplace.
              </p>
            </div>
          </motion.div>

          <div className="grid gap-px overflow-hidden border border-[color:var(--paper-hair)] bg-[color:var(--paper-hair)] sm:grid-cols-2 lg:grid-cols-3">
            {SPIGOT_CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon
              return (
                <motion.article
                  key={cap.title}
                  {...staggerChild(i, 0.05)}
                  className="group relative flex flex-col gap-5 bg-paper p-8"
                >
                  {/* Top accent bar in this card's brand colour */}
                  <span
                    className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                    style={{ backgroundColor: cap.color }}
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-sm"
                      style={{ backgroundColor: `color-mix(in srgb, ${cap.color} 14%, transparent)` }}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.5} style={{ color: cap.color }} />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <h3 className="mb-2.5 text-[19px] font-semibold tracking-tight text-ink-paper">
                      {cap.title}
                    </h3>
                    <p className="text-[14px] leading-relaxed text-paper-soft">{cap.description}</p>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      {/* Code sample + the stack. */}
      <section className="border-hair relative overflow-hidden border-t bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto grid w-full max-w-[1280px] gap-14 px-6 sm:px-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-16">
          <motion.div {...fadeInUp} className="order-2 lg:order-1">
            <SpigotCodeCard />
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-ink-faint">
              // A sneak + right-click ability with a cooldown. The kind of small mechanic a plugin
              is made of.
            </p>
          </motion.div>

          <motion.div {...fadeInUp} transition={{ delay: 0.08 }} className="order-1 lg:order-2">
            <SectionLabel>// The stack</SectionLabel>
            <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
              Built like production
              <br />
              software, because it is.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Modern Java on the Paper API, backed by real databases and the libraries the ecosystem
              actually runs on. Async where it counts, versioned, and handed over with the source.
            </p>

            <div className="border-hair mt-8 flex flex-wrap gap-x-3 gap-y-2 border-t pt-8">
              {SPIGOT_STACK.map(tool => (
                <span
                  key={tool}
                  className="border-hair-strong rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft transition-colors duration-200 hover:border-[color:var(--c-orange)] hover:text-ink"
                >
                  {tool}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Process — numbered build path, on paper. */}
      <section className="border-hair-paper relative overflow-hidden border-t bg-paper py-24 text-ink-paper sm:py-32">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div {...fadeInUp} className="border-hair-paper mb-12 border-b pb-8">
            <SectionLabelPaper>// How a build goes</SectionLabelPaper>
            <h2 className="max-w-3xl text-[clamp(1.9rem,3.6vw,2.8rem)] font-semibold leading-[1.04] tracking-tightest text-ink-paper">
              From a one-line idea to a jar on your server.
            </h2>
          </motion.div>

          <div className="border-hair-paper divide-hair-paper divide-y border-y">
            {SPIGOT_PROCESS.map((step, i) => (
              <motion.div
                key={step.title}
                {...staggerChild(i, 0.06)}
                className="grid gap-4 py-8 md:grid-cols-[auto_1fr] md:gap-10 lg:py-10"
              >
                <div className="flex items-baseline gap-4 md:w-64">
                  <span className="font-mono text-[13px] tracking-[0.1em] text-paper-faint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-[clamp(1.3rem,2.2vw,1.7rem)] font-semibold tracking-tight text-ink-paper">
                    {step.title}
                  </h3>
                </div>
                <p className="max-w-2xl text-[15px] leading-relaxed text-paper-soft md:pt-1">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — native, zero-JS accordion. */}
      <section className="border-hair relative overflow-hidden border-t bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[900px] px-6 sm:px-10 lg:px-16">
          <motion.div {...fadeInUp} className="mb-12">
            <SectionLabel>// Straight answers</SectionLabel>
            <h2 className="text-[clamp(1.9rem,3.6vw,2.8rem)] font-semibold leading-[1.04] tracking-tightest text-ink">
              Questions that come up first.
            </h2>
          </motion.div>

          <div className="border-hair divide-hair divide-y border-y">
            {SPIGOT_FAQ.map((item, i) => (
              <motion.details key={item.q} {...staggerChild(i, 0.05)} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[16px] font-medium text-ink transition-colors duration-200 hover:text-[color:var(--c-orange)] sm:text-[17px]">
                  {item.q}
                  <Plus
                    className="h-4 w-4 flex-shrink-0 text-ink-mute transition-transform duration-300 ease-out group-open:rotate-45"
                    strokeWidth={2}
                  />
                </summary>
                <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-soft sm:text-[15px]">
                  {item.a}
                </p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        variant="dark"
        eyebrow="// Next — Let's build"
        title={
          <>
            Got a server that needs{' '}
            <span style={{ color: 'var(--c-orange)' }}>its own plugin</span>?
          </>
        }
        description="Tell me the mechanic you have in mind. You get an honest read on scope and a clear plan to build it."
      />
    </div>
  )
}
