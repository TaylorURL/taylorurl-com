import { m } from 'framer-motion'
import { Users, Monitor } from 'lucide-react'
import PageHero from '@components/page-bands/PageHero'
import CtaBanner from '@components/conversion/CtaBanner'
import CtaSection from '@components/conversion/CtaSection'
import Seo from '@components/Seo'
import { MAX_MS, fadeInUp, staggerChild } from '@constants/animations'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { ABOUT } from '@data/pages/about'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import { BIO_NAME, BIO_TEXT, BIO_TITLE } from '@lib/mail/bio.js'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
import CountUp from '@reactbits/CountUp/CountUp'
import { AccentGradient } from '@reactbits/kit'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

// The card under the figures names where the work happens, and the mark over it
// is part of that claim rather than decoration: a heart for the town the studio
// works in, a globe for an offer that reaches anywhere.
const PlaceIcon = ABOUT.place.icon

// The values fill their rows exactly or the panel's own ground shows through
// the shortfall as an empty cell, and the two sites do not carry the same
// number of them.
const VALUE_COLUMNS = ABOUT.values.length % 2 === 0 ? 'md:grid-cols-2' : 'md:grid-cols-3'
const VALUE_COUNT = String(ABOUT.values.length).padStart(2, '0')

/**
 * The one face on the site, at the foot of the story that explains it.
 *
 * The portrait used to hang on the home page, the contact page, the first step
 * of the configurator and the head of the chat panel, from a time when the
 * company and the person were the same thing. They are not, and a face repeated
 * across five surfaces makes the claim that they still are: a reader who meets
 * it on the front door reads a one-man shop, whatever the sentence beside it
 * says about a team.
 *
 * So it is drawn once, here, where the page has already said who does the work
 * and the founder is the last thing left to say. The title carries the weight -
 * a name over "Founder and CEO" is a seat in a company, and the same name over
 * a photograph anywhere else is just the company.
 *
 * The name, the title and the paragraph are the studio's one bio, read from the
 * module the mail signs off with, so the person a reply arrives from is the
 * person this page introduces.
 */
function Founder() {
  return (
    <div className="border-hair-paper mt-4 flex flex-col gap-6 border-t pt-8 sm:flex-row sm:gap-7">
      <img
        src="/images/trenton-taylor.webp"
        srcSet="/images/trenton-taylor.webp 1x, /images/trenton-taylor@2x.webp 2x"
        alt={BIO_NAME}
        width="96"
        height="96"
        loading="lazy"
        decoding="async"
        className="border-hair-paper-strong h-24 w-24 shrink-0 rounded-md border object-cover"
      />
      <div className="max-w-[52ch]">
        <p className="text-[15px] font-semibold text-ink-paper">{BIO_NAME}</p>
        <p className="section-label-sm mt-1 text-accent">{BIO_TITLE}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-paper-soft">{BIO_TEXT}</p>
      </div>
    </div>
  )
}

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
        eyebrow={ABOUT.hero.eyebrow}
        title={ABOUT.hero.title}
        description={ABOUT.hero.description}
      />

      <section ref={storyRef} className="section-y relative overflow-hidden bg-paper">
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
              <Founder />
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

          <div
            className={`panel-static bg-hair mt-12 grid gap-px overflow-hidden ${VALUE_COLUMNS}`}
          >
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
                        {String(i + 1).padStart(2, '0')} / {VALUE_COUNT}
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
                      <Monitor className="h-3 w-3" /> Us
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
          eyebrow={ABOUT.closing.eyebrow}
          heading={ABOUT.closing.heading}
          accentText={ABOUT.closing.accentText}
          description={ABOUT.closing.description}
          primaryTo="/contact"
          primaryLabel="Send an Enquiry"
        />
      ) : (
        <CtaSection
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
