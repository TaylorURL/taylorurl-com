import { m } from 'framer-motion'
import { Users, Monitor } from 'lucide-react'
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import CtaSection from '@components/conversion/CtaSection'
import Seo from '@components/Seo'
import { MAX_MS, fadeInUp, staggerChild } from '@constants/animations'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { ABOUT } from '@data/pages/about'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import { BIO_TITLE } from '@lib/mail/bio.js'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
import CountUp from '@reactbits/CountUp/CountUp'
import { AccentGradient } from '@reactbits/kit'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

// The card under the figures names where the work happens, and the mark over it
// is part of that claim rather than decoration: a heart for the town the studio
// works in, a globe for an offer that reaches anywhere.
const PlaceIcon = ABOUT.place.icon

export default function About() {
  // Scroll-driven parallax — the stats column rises as the story section
  // scrolls past, creating depth against the narrative copy beside it.
  const { ref: storyRef, transform: statsTransform } = useScrollParallax({
    range: [50, -50],
  })

  return (
    <div>
      <Seo
        title={ABOUT.seo.title}
        description={ABOUT.seo.description}
        path="/about"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'About', path: '/about' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            url: `${SITE_URL}/about`,
            mainEntity: { '@id': BUSINESS_ID },
            about: {
              '@type': 'Person',
              '@id': `${SITE_URL}/#trenton`,
              name: 'Trenton Taylor',
              jobTitle: BIO_TITLE,
              worksFor: { '@id': BUSINESS_ID },
              url: `${SITE_URL}/about`,
            },
          },
        ]}
      />
      <PageHero
        draft="plan"
        eyebrow={ABOUT.hero.eyebrow}
        title={ABOUT.hero.title}
        description={ABOUT.hero.description}
      />

      <section ref={storyRef} className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.ledger}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
            <m.div {...fadeInUp} className="flex flex-col gap-6">
              <p className="section-label text-accent">{ABOUT.story.eyebrow}</p>
              <h2 className="display-3 font-semibold leading-[1.04] tracking-tightest text-ink-paper [text-wrap:balance]">
                {ABOUT.story.heading}
              </h2>
              <div className="space-y-6 text-[17px] leading-relaxed text-paper-soft">
                {ABOUT.story.paragraphs.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </m.div>

            {/* The drift and the reveal both want a transform on this
                element, and an explicit one wins outright over a variant's, so
                held together the reveal's travel is dropped without saying so.
                The drift takes the outer element, the reveal the inner one. */}
            <m.div style={{ transform: statsTransform }} className="will-change-transform">
              <m.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }}>
                <p className="section-label-sm text-paper-faint mb-5">The Numbers</p>
                <div className="panel-static bg-hair-paper grid grid-cols-2 gap-px overflow-hidden">
                  {ABOUT.stats.map(stat => (
                    <div key={stat.label} className="bg-paper p-6">
                      <div className="display-4 font-mono font-semibold leading-none text-ink-paper">
                        {stat.to ? (
                          <>
                            <CountUp to={stat.to} duration={MAX_MS} />
                            {stat.suffix}
                          </>
                        ) : (
                          stat.value
                        )}
                        {stat.unit && <span className="text-accent">{stat.unit}</span>}
                      </div>
                      <div className="section-label-sm text-paper-faint mt-3">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="panel-static mt-3 bg-paper p-6">
                  <div className="flex items-start gap-3">
                    <PlaceIcon
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent"
                      strokeWidth={1.5}
                    />
                    <div>
                      <p className="section-label-sm text-accent">{ABOUT.place.label}</p>
                      <p className="mt-2 text-[14px] leading-relaxed text-paper-soft">
                        {ABOUT.place.body}
                      </p>
                    </div>
                  </div>
                </div>
              </m.div>
            </m.div>
          </div>
        </div>
      </section>

      <section
        data-ground="band"
        className="border-hair section-y relative overflow-hidden border-t bg-bg text-ink"
      >
        <div className={`absolute inset-0 ${GROUNDS.band.grid} ${DRAFTS.iso}`} aria-hidden="true" />
        <div className="container-rail relative">
          <m.div
            {...fadeInUp}
            className="border-hair grid items-end gap-10 border-b pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="section-label mb-6 block text-accent">{ABOUT.work.eyebrow}</p>
              <h2 className="display-3 font-semibold leading-[1.02] tracking-tightest text-ink [text-wrap:balance]">
                {ABOUT.work.headingLine} <br />
                <AccentGradient>{ABOUT.work.accentText}</AccentGradient>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-ink-soft lg:text-right">
              {ABOUT.work.lede}
            </p>
          </m.div>

          <div className="panel-static bg-hair mt-12 grid gap-px overflow-hidden md:grid-cols-2">
            {ABOUT.values.map((item, i) => {
              const Icon = item.icon
              return (
                <m.div key={item.title} {...staggerChild(i, 0.06)}>
                  <SpotlightCard
                    className="group flex h-full flex-col gap-6 bg-bg p-8 sm:p-10"
                    spotlightColor="var(--spotlight)"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[10px] tabular-nums tracking-tight text-ink-faint">
                        {String(i + 1).padStart(2, '0')} / 04
                      </span>
                      <Icon
                        className="h-5 w-5 text-ink transition-colors duration-200 ease-out-soft group-hover:text-accent"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <h3 className="mb-3 text-[22px] font-semibold leading-tight tracking-tight text-ink">
                        {item.title}
                      </h3>
                      <p className="text-[15px] leading-relaxed text-ink-soft">
                        {item.description}
                      </p>
                    </div>
                  </SpotlightCard>
                </m.div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-hair-paper section-y relative overflow-hidden border-t bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.column}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <m.div
            {...fadeInUp}
            className="border-hair-paper grid items-end gap-10 border-b pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="section-label mb-6 block text-accent">{ABOUT.processIntro.eyebrow}</p>
              <h2 className="display-3 font-semibold leading-[1.02] tracking-tightest text-ink-paper [text-wrap:balance]">
                {ABOUT.processIntro.headingLine} <br />
                <AccentGradient>{ABOUT.processIntro.accentText}</AccentGradient>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
              {ABOUT.processIntro.lede}
            </p>
          </m.div>

          <div className="panel-static bg-hair-paper mt-12 grid gap-px overflow-hidden md:grid-cols-2">
            {ABOUT.process.map((step, i) => (
              <m.div
                key={step.num}
                {...staggerChild(i, 0.06)}
                className="flex flex-col justify-between gap-7 bg-paper p-8 sm:p-10"
              >
                <div className="flex flex-col gap-7">
                  <div className="flex items-baseline justify-between">
                    <span className="text-paper-faint display-3 font-mono font-semibold leading-none">
                      {step.num}
                    </span>
                    <span className="section-label-sm text-accent">Phase / 04</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-ink-paper">
                      {step.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-paper-soft">
                      {step.description}
                    </p>
                  </div>
                </div>
                <div className="border-hair-paper grid grid-cols-1 gap-px overflow-hidden border-t pt-5 sm:grid-cols-2">
                  <div className="pr-4">
                    <p className="section-label-sm text-paper-faint mb-2 flex items-center gap-2">
                      <Users className="h-3 w-3" /> You
                    </p>
                    <p className="text-[13px] text-paper-soft">{step.you}</p>
                  </div>
                  <div className="border-hair-paper border-l pl-4">
                    <p className="section-label-sm mb-2 flex items-center gap-2 text-accent">
                      <Monitor className="h-3 w-3" /> Me
                    </p>
                    <p className="text-[13px] text-paper-soft">{step.me}</p>
                  </div>
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* The studio's closing band has one thing to do next and sends the
          reader to /start. The second site has no /start — every page there
          ends at the enquiry form — so it closes on the band whose buttons are
          addressable rather than on a link to a route that is not built. */}
      {IS_SECOND_SITE ? (
        <CtaBanner
          draft="quiet"
          eyebrow={ABOUT.closing.eyebrow}
          heading={ABOUT.closing.heading}
          accentText={ABOUT.closing.accentText}
          description={ABOUT.closing.description}
          primaryTo="/contact"
          primaryLabel="Send an Enquiry"
        />
      ) : (
        <CtaSection
          draft="quiet"
          eyebrow={ABOUT.closing.eyebrow}
          title={
            <>
              {`${ABOUT.closing.heading} `}
              <span className="text-accent">{ABOUT.closing.accentText}</span>.
            </>
          }
          description={ABOUT.closing.description}
        />
      )}
    </div>
  )
}
