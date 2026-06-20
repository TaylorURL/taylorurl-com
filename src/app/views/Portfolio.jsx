import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Globe } from 'lucide-react'
import PageHero from '@components/PageHero'
import CtaSection from '@components/CtaSection'
import Seo from '@components/Seo'
import { staggerChild } from '@constants/animations'
import { PORTFOLIO_PROJECTS } from '@data/portfolio'
import { breadcrumbSchema } from '@constants/seo'

const PREVIEW_FRAME_WIDTH = 1440
const PREVIEW_FRAME_HEIGHT = 900

function buildLivePreviewUrl(url, cacheBuster) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}__preview=${cacheBuster}`
}

function PortfolioCard({ project, index }) {
  const [frameLoaded, setFrameLoaded] = useState(false)

  // One cache-buster per page load — ensures the iframe always requests a fresh
  // copy of the live site instead of reusing the browser's HTTP cache.
  const livePreviewUrl = useMemo(
    () => buildLivePreviewUrl(project.url, Date.now()),
    [project.url]
  )

  return (
    <motion.a
      {...staggerChild(index, 0.08)}
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col bg-paper transition-colors duration-300 hover:bg-ink-paper/[0.02]"
      aria-label={`Open ${project.name} in a new tab`}
    >
      {/* Browser-chrome plate */}
      <div className="relative overflow-hidden border-b border-hair-paper">
        <div className="flex items-center gap-1.5 border-b border-hair-paper bg-paper px-4 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-paper-faint" />
          <span className="h-1.5 w-1.5 rounded-full bg-paper-faint" />
          <span className="h-1.5 w-1.5 rounded-full bg-paper-faint" />
          <div className="ml-3 flex flex-1 items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">
            <Globe className="h-3 w-3" strokeWidth={1.75} />
            <span className="truncate">{project.displayUrl}</span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper-faint">
            Live · {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        <div
          className="relative aspect-[16/10] w-full overflow-hidden bg-bg"
          style={{ containerType: 'inline-size' }}
        >
          <iframe
            src={livePreviewUrl}
            title={`${project.name} live website preview`}
            loading="lazy"
            referrerPolicy="no-referrer"
            tabIndex={-1}
            aria-hidden="true"
            onLoad={() => setFrameLoaded(true)}
            width={PREVIEW_FRAME_WIDTH}
            height={PREVIEW_FRAME_HEIGHT}
            style={{
              width: `${PREVIEW_FRAME_WIDTH}px`,
              height: `${PREVIEW_FRAME_HEIGHT}px`,
              transform: `scale(calc(100cqw / ${PREVIEW_FRAME_WIDTH}))`,
              transformOrigin: 'top left',
            }}
            className={`pointer-events-none absolute left-0 top-0 border-0 transition-opacity duration-500 ${
              frameLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {!frameLoaded && (
            <div className="absolute inset-0 grid place-items-center bg-bg">
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  Loading live preview
                </p>
                <p className="mt-2 text-[clamp(1.4rem,3vw,2.2rem)] font-semibold tracking-tight text-ink">
                  {project.name}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description plate */}
      <div className="flex flex-1 flex-col gap-6 p-7 sm:p-8">
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
            // Client
          </p>
          <h3 className="text-[24px] font-semibold leading-tight tracking-tight text-ink-paper transition-colors group-hover:text-accent">
            {project.name}
          </h3>
        </div>
        <p className="text-[14px] leading-relaxed text-paper-soft sm:text-[15px]">
          {project.description}
        </p>
        <span className="inline-flex items-center gap-2 border-t border-hair-paper pt-5 font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-accent">
          Visit live site
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.a>
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

      <section className="relative overflow-hidden bg-paper py-20 sm:py-28">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <div className="grid gap-px overflow-hidden border border-hair-paper bg-hair-paper md:grid-cols-2">
            {PORTFOLIO_PROJECTS.map((project, index) => (
              <PortfolioCard key={project.url} project={project} index={index} />
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
        description="Tell me what your business needs and I will put together a plan. Most websites are live in two to four weeks."
      />
    </div>
  )
}
