import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Globe } from 'lucide-react'
import PageHero from '@components/PageHero'
import CtaSection from '@components/CtaSection'
import Seo from '@components/Seo'
import {
  PORTFOLIO_PROJECTS,
  portfolioPreviewSrc,
  portfolioScreenshotServiceUrl,
} from '@data/portfolio'
import { breadcrumbSchema } from '@constants/seo'
import { useScrollParallax } from '@hooks/useScrollParallax'
import GlareHover from '@reactbits/GlareHover/GlareHover'
import DecryptedText from '@reactbits/DecryptedText/DecryptedText'
import ShinyText from '@reactbits/ShinyText/ShinyText'

// Curve and reveal config — matches the rest of the site's motion language.
// Transform/opacity only so the browser can keep the work on the compositor
// thread instead of triggering layout/paint passes.
const REVEAL_EASE = [0.22, 1, 0.36, 1]
const ROW_REVEAL = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-12% 0px' },
  transition: { duration: 0.55, ease: REVEAL_EASE },
}
const MOCKUP_REVEAL = fromLeft => ({
  initial: { opacity: 0, x: fromLeft ? -36 : 36 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: '-12% 0px' },
  transition: { duration: 0.6, ease: REVEAL_EASE, delay: 0.08 },
})
// Reduced-motion variant — render in place with no transforms or fades.
const STATIC_REVEAL = { initial: false }

// Committed WebP capture of the project, with a live thum.io screenshot
// swapped in if the capture fails to load. The stage keeps the site's dark
// ground behind the image and fades the preview in once it arrives.
function PreviewImage({ project, device, priority, stageClassName }) {
  const [loaded, setLoaded] = useState(false)
  const [useFallback, setUseFallback] = useState(false)

  const src = useFallback
    ? portfolioScreenshotServiceUrl(project, device)
    : portfolioPreviewSrc(project, device)

  return (
    <div className={`relative overflow-hidden bg-bg ${stageClassName}`}>
      <img
        src={src}
        alt={`${project.name} website preview`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setUseFallback(true)}
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}

function DesktopMockup({ project, index }) {
  return (
    <GlareHover
      width="100%"
      height="100%"
      background="transparent"
      borderColor="transparent"
      borderRadius="14px"
      glareColor="#ffffff"
      glareOpacity={0.28}
      glareAngle={-40}
      glareSize={260}
      transitionDuration={900}
      className="border-hair-paper !block overflow-hidden rounded-[14px] border bg-paper shadow-[0_30px_80px_-40px_rgba(10,10,10,0.35)]"
    >
      <div className="border-hair-paper flex items-center gap-1.5 border-b bg-paper px-4 py-2.5">
        <span className="bg-paper-faint/60 h-2 w-2 rounded-full" />
        <span className="bg-paper-faint/60 h-2 w-2 rounded-full" />
        <span className="bg-paper-faint/60 h-2 w-2 rounded-full" />
        <div className="border-hair-paper bg-bg/40 text-paper-faint ml-3 flex flex-1 items-center gap-1.5 truncate rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]">
          <Globe className="h-3 w-3" strokeWidth={1.75} />
          <span className="truncate">{project.displayUrl}</span>
        </div>
        <span className="text-paper-faint hidden font-mono text-[9px] uppercase tracking-[0.22em] sm:inline">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <PreviewImage
        project={project}
        device="desktop"
        priority={index === 0}
        stageClassName="aspect-[16/10] w-full"
      />
    </GlareHover>
  )
}

function PhoneMockup({ project, index }) {
  return (
    <div className="border-hair-paper relative w-[200px] rounded-[2.25rem] border bg-ink-paper p-[6px] shadow-[0_30px_60px_-25px_rgba(10,10,10,0.55)] sm:w-[228px]">
      <div className="relative overflow-hidden rounded-[1.85rem] bg-bg">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-1.5">
          <span className="h-4 w-20 rounded-full bg-ink-paper" />
        </div>
        <PreviewImage
          project={project}
          device="phone"
          priority={index === 0}
          stageClassName="aspect-[390/844] w-full"
        />
      </div>
    </div>
  )
}

function PortfolioRow({ project, index }) {
  const prefersReducedMotion = useReducedMotion()

  // Scroll-driven mockup parallax — the device frames drift up across the row's
  // own scroll window so the imagery feels alive against the static copy. The
  // hook handles reduced-motion (range collapses to 0).
  const { ref: parallaxRef, transform: mockupTransform } = useScrollParallax({
    range: [70, -70],
  })

  const mockupsOnLeft = index % 2 === 1
  const numberLabel = String(index + 1).padStart(2, '0')

  const rowReveal = prefersReducedMotion ? STATIC_REVEAL : ROW_REVEAL
  const mockupReveal = prefersReducedMotion ? STATIC_REVEAL : MOCKUP_REVEAL(mockupsOnLeft)

  return (
    <article className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
      <motion.div
        {...rowReveal}
        className={`lg:col-span-5 ${mockupsOnLeft ? 'lg:order-2 lg:pl-4' : 'lg:order-1 lg:pr-4'}`}
      >
        <p className="text-paper-faint mb-5 font-mono text-[10px] uppercase tracking-[0.24em]">
          <DecryptedText
            text={`// ${numberLabel} — Client`}
            animateOn="view"
            sequential
            speed={40}
            maxIterations={12}
          />
        </p>
        <h3 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05] tracking-tight text-ink-paper">
          {project.name}
        </h3>
        {project.tagline && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            <ShinyText text={project.tagline} color="#2f6bff" shineColor="#bcd2ff" speed={4} />
          </p>
        )}
        <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-paper-soft sm:text-[16px]">
          {project.description}
        </p>
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${project.name} in a new tab`}
          className="border-hair-paper group mt-8 inline-flex items-center gap-2 border-t pt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent transition-colors hover:text-ink-paper"
        >
          Visit live site
          <span className="text-paper-faint truncate normal-case tracking-normal group-hover:text-paper-soft">
            {project.displayUrl}
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </motion.div>

      <motion.div
        {...mockupReveal}
        className={`lg:col-span-7 ${mockupsOnLeft ? 'lg:order-1' : 'lg:order-2'}`}
      >
        <motion.div
          ref={parallaxRef}
          style={{ transform: mockupTransform }}
          className="relative will-change-transform"
        >
          <DesktopMockup project={project} index={index} />
          <div
            className={`mt-6 flex justify-center lg:absolute lg:bottom-[-48px] lg:mt-0 ${
              mockupsOnLeft ? 'lg:right-[-28px] lg:justify-end' : 'lg:left-[-28px] lg:justify-start'
            }`}
          >
            <PhoneMockup project={project} index={index} />
          </div>
        </motion.div>
      </motion.div>
    </article>
  )
}

export default function Portfolio() {
  return (
    <div>
      <Seo
        title="Recent Client Websites — Baytown, TX"
        description="A look at recent websites I've built for small businesses around Baytown, Houston, and Southeast Texas. Every one is live and earning its keep."
        path="/portfolio"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Portfolio', path: '/portfolio' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'TaylorURL portfolio',
            url: 'https://taylorurl.com/portfolio',
            hasPart: PORTFOLIO_PROJECTS.map(project => ({
              '@type': 'WebSite',
              name: project.name,
              url: project.url,
              description: project.description,
            })),
          },
        ]}
      />
      <PageHero
        eyebrow="// 01 — Portfolio"
        title="Recent client work."
        description="A look at sites I've built for businesses around Baytown and Houston. Every one is custom-built, hosted, and looked after by me."
      />

      <section className="relative overflow-hidden bg-paper py-24 sm:py-32 lg:py-40">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <div className="flex flex-col gap-32 sm:gap-40 lg:gap-56">
            {PORTFOLIO_PROJECTS.map((project, index) => (
              <PortfolioRow key={project.url} project={project} index={index} />
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        variant="dark"
        eyebrow="// Next — Your site"
        title={
          <>
            Want your business <span className="text-accent">in this list</span>?
          </>
        }
        description="Tell me what your business needs and I'll put together a plan. Most sites are live in two to four weeks."
      />
    </div>
  )
}
