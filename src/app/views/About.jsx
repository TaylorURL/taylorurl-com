import { motion } from 'framer-motion'
import { Code2, Headphones, Zap, Shield, Heart, Users, Monitor } from 'lucide-react'
import PageHero from '@components/PageHero'
import CtaSection from '@components/CtaSection'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { useScrollParallax } from '@hooks/useScrollParallax'

const VALUES = [
  {
    icon: Code2,
    title: 'Custom-built, not templated',
    description:
      'Every site is built from scratch for your business. No Wix, no Squarespace, no theme everyone else is using. The result is faster, sharper, and yours.',
  },
  {
    icon: Headphones,
    title: 'You talk to me directly',
    description:
      'No account managers, no support tickets, no waiting days for a reply. You text or call me, and I handle it.',
  },
  {
    icon: Zap,
    title: 'Live in two to four weeks',
    description:
      'Most sites are up and running in under a month. I don’t pad the timeline with endless meetings or paperwork. You tell me about the business, I build the site.',
  },
  {
    icon: Shield,
    title: 'Built for local businesses',
    description:
      'I work with shops, restaurants, trades, contractors, and independent pros — businesses that need to look the part online and have one person to call when something needs to change.',
  },
]

const STATS = [
  { value: '2-4', unit: 'wk', label: 'Average build time' },
  { value: '97+', unit: '', label: 'Average PageSpeed score' },
  { value: '50+', unit: '', label: 'Clients served' },
  { value: '24/7', unit: '', label: 'Support after launch' },
]

const PROCESS = [
  {
    num: '01',
    title: 'You reach out',
    description:
      'Tell me about the business and what you need. A few sentences is plenty — no thirty-field intake form.',
    you: 'Send me a message',
    me: 'Reply same day',
  },
  {
    num: '02',
    title: 'I plan it out',
    description:
      'I lay out the pages, the structure, and the look of the site. You approve the plan before any building starts.',
    you: 'Look it over and give feedback',
    me: 'Show you designs you can actually see',
  },
  {
    num: '03',
    title: 'I build it',
    description:
      'Clean design, sharp photos, and fast pages. You get progress updates the whole way and can ask for changes at any point.',
    you: 'Review and request changes',
    me: 'Build, test, and polish',
  },
  {
    num: '04',
    title: 'Launch and look after it',
    description:
      'Your site goes live. I keep it online, safe, and up to date so the tech side never lands on you.',
    you: 'Run the business',
    me: 'Keep everything running',
  },
]

export default function About() {
  // Scroll-driven parallax — the stats column rises as the story section
  // scrolls past, creating depth against the narrative copy beside it.
  const { ref: storyRef, transform: statsTransform } = useScrollParallax({
    range: [60, -60],
  })

  return (
    <div>
      <Seo
        title="About Trenton Taylor — Baytown Web Designer"
        description="I'm Trenton Taylor, an independent Baytown, TX web designer building custom websites for shops, trades, and small businesses across the Houston area."
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
              jobTitle: 'Website Designer',
              worksFor: { '@id': BUSINESS_ID },
              url: `${SITE_URL}/about`,
            },
          },
        ]}
      />
      <PageHero
        eyebrow="// 01 — About me"
        title="One person, custom-built websites, a direct line."
        description="I'm Trenton Taylor — TaylorURL LLC is me. I work with local businesses around Baytown and the Houston area, from the first call all the way through every change you ever need after launch."
      />

      {/* Story + stats */}
      <section
        ref={storyRef}
        className="relative overflow-hidden bg-paper py-24 sm:py-32"
      >
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
            <motion.div {...fadeInUp}>
              <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                <span className="h-px w-8 bg-accent" />
                // My story
              </p>
              <h2 className="text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.04] tracking-tightest text-ink-paper">
                I build websites for Baytown and Houston-area small businesses.
              </h2>
              <div className="mt-10 space-y-6 text-[17px] leading-relaxed text-paper-soft">
                <p>
                  I started the business in Baytown because the local shops around me —
                  restaurants, trades, salons, independent pros — kept ending up with one of
                  two outcomes: a generic agency site that cost too much, or a dated DIY
                  page that no longer matched the business.
                </p>
                <p>
                  Neither one works for long. So I build sites the way the best businesses
                  online do: clean design, fast pages, and ongoing care from the person who
                  built it. No sales reps, no support queue, no handoffs.
                </p>
                <p>
                  You get a site that’s quick, easy on the eyes, and built around the
                  customers you actually want — with a direct line to me whenever something
                  needs to change. No platform you’re stuck on, no monthly fees that creep
                  up, no surprises.
                </p>
              </div>
            </motion.div>

            <motion.div
              {...fadeInUp}
              transition={{ delay: 0.1 }}
              style={{ transform: statsTransform }}
              className="will-change-transform"
            >
              <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                // The numbers
              </p>
              <div className="grid grid-cols-2 gap-px overflow-hidden border border-hair-paper bg-hair-paper">
                {STATS.map(stat => (
                  <div key={stat.label} className="bg-paper p-6">
                    <div className="font-mono text-[clamp(2rem,3.6vw,2.8rem)] font-semibold leading-none text-ink-paper">
                      {stat.value}
                      {stat.unit && <span className="text-accent">{stat.unit}</span>}
                    </div>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-px border border-hair-paper bg-paper p-6">
                <div className="flex items-start gap-3">
                  <Heart className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                      Baytown, TX
                    </p>
                    <p className="mt-2 text-[14px] leading-relaxed text-paper-soft">
                      Working with local businesses around Baytown, Mont Belvieu,
                      Channelview, Crosby, La Porte, Deer Park, Pasadena, and the rest of
                      the Houston area. The whole project happens by phone, text, and
                      email — no in-person meetings required.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="relative overflow-hidden border-t border-hair bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div
            {...fadeInUp}
            className="grid items-end gap-10 border-b border-hair pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                <span className="h-px w-8 bg-accent" />
                // 02 — How I work
              </p>
              <h2 className="text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.02] tracking-tightest text-ink">
                Why owners
                <br />
                <span className="text-accent">work with me.</span>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-ink-soft lg:text-right">
              Four things I won&apos;t budge on: direct, fast, custom, and built for the
              people actually running the shop.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-px overflow-hidden border border-hair bg-hair md:grid-cols-2">
            {VALUES.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.title}
                  {...staggerChild(i, 0.06)}
                  className="group flex flex-col gap-6 bg-bg p-8 sm:p-10"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                      {String(i + 1).padStart(2, '0')} / 04
                    </span>
                    <Icon
                      className="h-5 w-5 text-ink transition-colors duration-300 group-hover:text-accent"
                      strokeWidth={1.25}
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
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="relative overflow-hidden border-t border-hair-paper bg-paper py-24 sm:py-32">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div
            {...fadeInUp}
            className="grid items-end gap-10 border-b border-hair-paper pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                <span className="h-px w-8 bg-accent" />
                // 03 — Process
              </p>
              <h2 className="text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.02] tracking-tightest text-ink-paper">
                Four steps from
                <br />
                <span className="text-accent">first call to launch.</span>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
              No twelve-step onboarding. No project charts. No drawn-out planning. This is
              the whole thing, start to finish.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-px overflow-hidden border border-hair-paper bg-hair-paper md:grid-cols-2">
            {PROCESS.map((step, i) => (
              <motion.div
                key={step.num}
                {...staggerChild(i, 0.06)}
                className="flex flex-col gap-7 bg-paper p-8 sm:p-10"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[clamp(2.4rem,4vw,3.4rem)] font-semibold leading-none text-paper-faint">
                    {step.num}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                    Phase / 04
                  </span>
                </div>
                <div>
                  <h3 className="mb-3 text-[22px] font-semibold leading-tight tracking-tight text-ink-paper">
                    {step.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-paper-soft">
                    {step.description}
                  </p>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-px overflow-hidden border-t border-hair-paper pt-5">
                  <div className="pr-4">
                    <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                      <Users className="h-3 w-3" /> You
                    </p>
                    <p className="text-[13px] text-paper-soft">{step.you}</p>
                  </div>
                  <div className="border-l border-hair-paper pl-4">
                    <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                      <Monitor className="h-3 w-3" /> Me
                    </p>
                    <p className="text-[13px] text-paper-soft">{step.me}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        variant="dark"
        eyebrow="// 04 — Get in touch"
        title={
          <>
            Start a <span className="text-accent">conversation</span>.
          </>
        }
        description="Tell me what your business does and what you want from a website. You'll get an honest answer and a clear next step."
      />
    </div>
  )
}
