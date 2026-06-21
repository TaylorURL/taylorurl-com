import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Globe } from 'lucide-react'
import PageHero from '@components/PageHero'
import CtaSection from '@components/CtaSection'
import Seo from '@components/Seo'
import { PORTFOLIO_PROJECTS } from '@data/portfolio'
import { breadcrumbSchema } from '@constants/seo'
import { useScrollParallax } from '@hooks/useScrollParallax'

// Logical viewports the iframes are rendered at before being CSS-scaled to fit
// their device frames. Desktop uses a 1280×800 stage to render the site at a
// real desktop layout; the phone uses a 390×844 (iPhone-class) stage so the
// embedded SPA renders its mobile breakpoint rather than a squished desktop.
const DESKTOP_LOGICAL_WIDTH = 1280
const DESKTOP_LOGICAL_HEIGHT = 800
const PHONE_LOGICAL_WIDTH = 390
const PHONE_LOGICAL_HEIGHT = 844

// If the live iframe doesn't fire onLoad within this window we assume the
// site refused framing (X-Frame-Options / CSP) and swap to a fresh screenshot.
// Cross-origin frames don't reliably fire onError on framing refusal, so the
// timeout is the only dependable signal.
const IFRAME_LOAD_TIMEOUT_MS = 8000

// Live iframes mount when the row is within this distance of the viewport
// and unmount when it scrolls beyond. Embedded SPAs are expensive — gating
// on a tight rootMargin keeps the concurrent live-app count to the 1–2 rows
// the user is actually about to see, instead of all 6 booting at page load.
const LIVE_MOUNT_ROOT_MARGIN = '400px 0px 400px 0px'

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
const MOCKUP_REVEAL = (fromLeft) => ({
  initial: { opacity: 0, x: fromLeft ? -36 : 36 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: '-12% 0px' },
  transition: { duration: 0.6, ease: REVEAL_EASE, delay: 0.08 },
})
// Reduced-motion variant — render in place with no transforms or fades.
const STATIC_REVEAL = { initial: false }

// Fresh server-rendered screenshot from thum.io. The query param busts thum.io's
// cache so the fallback also reflects the current site, not a stale snapshot.
function buildFallbackScreenshotUrl(url, cacheBuster, width, height) {
  return `https://image.thum.io/get/width/${width}/crop/${height}/${url}?_=${cacheBuster}`
}

// Tracks the rendered width of `ref` and returns the scale needed to fit a
// logical viewport of `logicalWidth` into it.
function useStageScale(logicalWidth) {
  const ref = useRef(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const stage = ref.current
    if (!stage) return
    const updateScale = () => {
      const width = stage.getBoundingClientRect().width
      if (width > 0) setScale(width / logicalWidth)
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [logicalWidth])

  return { ref, scale }
}

// True while the row sits within the expanded viewport. The two preview
// iframes in a row only mount their `src` when this flips true, and unmount
// when it flips back — so the page never has more than the rows around the
// fold paying for an embedded SPA at a time.
function useIsRowNearViewport(rootMargin = LIVE_MOUNT_ROOT_MARGIN) {
  const ref = useRef(null)
  const [isNear, setIsNear] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsNear(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setIsNear(entry.isIntersecting)
      },
      { rootMargin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [rootMargin])

  return { ref, isNear }
}

// Shared iframe attribute set — every preview frame stays purely visual:
// non-interactive, non-focusable, non-scrollable. `credentialless` loads
// the iframe in an ephemeral storage partition so the browser never offers
// saved credentials for the embedded origin (unknown attr is ignored on
// browsers that don't support it).
const PREVIEW_IFRAME_PROPS = {
  'aria-hidden': true,
  tabIndex: -1,
  inert: true,
  scrolling: 'no',
  loading: 'lazy',
  credentialless: true,
  sandbox: 'allow-scripts allow-same-origin',
}

function LivePreviewFrame({
  project,
  logicalWidth,
  logicalHeight,
  isLive,
  useFallback,
  fallbackCacheBuster,
  onFallback,
  stageClassName,
  fallbackObjectClassName = 'object-cover object-top',
}) {
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const { ref: stageRef, scale } = useStageScale(logicalWidth)

  // Reset the load state when the iframe is unmounted (scrolled away) or when
  // the fallback path is swapped in, so the fade-in plays again on remount.
  useEffect(() => {
    setPreviewLoaded(false)
  }, [useFallback, isLive])

  useEffect(() => {
    if (!isLive || useFallback || previewLoaded) return
    const timeoutId = window.setTimeout(onFallback, IFRAME_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timeoutId)
  }, [isLive, useFallback, previewLoaded, onFallback])

  const livePreview = !useFallback ? (
    <iframe
      {...PREVIEW_IFRAME_PROPS}
      src={project.url}
      title={`${project.name} live preview`}
      onLoad={() => setPreviewLoaded(true)}
      onError={onFallback}
      style={{
        width: `${logicalWidth}px`,
        height: `${logicalHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        overflow: 'hidden',
      }}
      className={`pointer-events-none absolute left-0 top-0 border-0 transition-opacity duration-500 ${
        previewLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    />
  ) : (
    <img
      src={buildFallbackScreenshotUrl(
        project.url,
        fallbackCacheBuster,
        logicalWidth,
        logicalHeight,
      )}
      alt={`${project.name} website preview`}
      loading="lazy"
      decoding="async"
      onLoad={() => setPreviewLoaded(true)}
      className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500 ${fallbackObjectClassName} ${
        previewLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )

  return (
    <div ref={stageRef} className={`relative overflow-hidden bg-bg ${stageClassName}`}>
      {isLive && livePreview}

      {(!isLive || !previewLoaded) && (
        <div className="absolute inset-0 grid place-items-center bg-bg">
          {isLive && (
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
              Loading
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function DesktopMockup({ project, index, isLive, useFallback, fallbackCacheBuster, onFallback }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-hair-paper bg-paper shadow-[0_30px_80px_-40px_rgba(10,10,10,0.35)]">
      <div className="flex items-center gap-1.5 border-b border-hair-paper bg-paper px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-paper-faint/60" />
        <span className="h-2 w-2 rounded-full bg-paper-faint/60" />
        <span className="h-2 w-2 rounded-full bg-paper-faint/60" />
        <div className="ml-3 flex flex-1 items-center gap-1.5 truncate rounded-full border border-hair-paper bg-bg/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">
          <Globe className="h-3 w-3" strokeWidth={1.75} />
          <span className="truncate">{project.displayUrl}</span>
        </div>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.22em] text-paper-faint sm:inline">
          Live · {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <LivePreviewFrame
        project={project}
        logicalWidth={DESKTOP_LOGICAL_WIDTH}
        logicalHeight={DESKTOP_LOGICAL_HEIGHT}
        isLive={isLive}
        useFallback={useFallback}
        fallbackCacheBuster={fallbackCacheBuster}
        onFallback={onFallback}
        stageClassName="aspect-[16/10] w-full"
      />
    </div>
  )
}

function PhoneMockup({ project, isLive, useFallback, fallbackCacheBuster, onFallback }) {
  return (
    <div className="relative w-[200px] rounded-[2.25rem] border border-hair-paper bg-ink-paper p-[6px] shadow-[0_30px_60px_-25px_rgba(10,10,10,0.55)] sm:w-[228px]">
      <div className="relative overflow-hidden rounded-[1.85rem] bg-bg">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-1.5">
          <span className="h-4 w-20 rounded-full bg-ink-paper" />
        </div>
        <LivePreviewFrame
          project={project}
          logicalWidth={PHONE_LOGICAL_WIDTH}
          logicalHeight={PHONE_LOGICAL_HEIGHT}
          isLive={isLive}
          useFallback={useFallback}
          fallbackCacheBuster={fallbackCacheBuster}
          onFallback={onFallback}
          stageClassName="aspect-[390/844] w-full"
          fallbackObjectClassName="object-cover object-top"
        />
      </div>
    </div>
  )
}

function PortfolioRow({ project, index }) {
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackCacheBuster, setFallbackCacheBuster] = useState(0)
  const { ref: rowRef, isNear: isLive } = useIsRowNearViewport()
  const prefersReducedMotion = useReducedMotion()

  const triggerFallback = useCallback(() => {
    setUseFallback(true)
    setFallbackCacheBuster(Date.now())
  }, [])

  const mockupsOnLeft = index % 2 === 1
  const numberLabel = String(index + 1).padStart(2, '0')

  const rowReveal = prefersReducedMotion ? STATIC_REVEAL : ROW_REVEAL
  const mockupReveal = prefersReducedMotion ? STATIC_REVEAL : MOCKUP_REVEAL(mockupsOnLeft)

  return (
    <article
      ref={rowRef}
      className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16"
    >
      <motion.div
        {...rowReveal}
        className={`lg:col-span-5 ${mockupsOnLeft ? 'lg:order-2 lg:pl-4' : 'lg:order-1 lg:pr-4'}`}
      >
        <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-paper-faint">
          // {numberLabel} — Client
        </p>
        <h3 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05] tracking-tight text-ink-paper">
          {project.name}
        </h3>
        {project.tagline && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            {project.tagline}
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
          className="group mt-8 inline-flex items-center gap-2 border-t border-hair-paper pt-5 font-mono text-[11px] uppercase tracking-[0.2em] font-semibold text-accent transition-colors hover:text-ink-paper"
        >
          Visit live site
          <span className="truncate text-paper-faint normal-case tracking-normal group-hover:text-paper-soft">
            {project.displayUrl}
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </motion.div>

      <motion.div
        {...mockupReveal}
        className={`lg:col-span-7 ${mockupsOnLeft ? 'lg:order-1' : 'lg:order-2'}`}
      >
        <div className="relative">
          <DesktopMockup
            project={project}
            index={index}
            isLive={isLive}
            useFallback={useFallback}
            fallbackCacheBuster={fallbackCacheBuster}
            onFallback={triggerFallback}
          />
          <div
            className={`mt-6 flex justify-center lg:absolute lg:mt-0 lg:bottom-[-48px] ${
              mockupsOnLeft ? 'lg:right-[-28px] lg:justify-end' : 'lg:left-[-28px] lg:justify-start'
            }`}
          >
            <PhoneMockup
              project={project}
              isLive={isLive}
              useFallback={useFallback}
              fallbackCacheBuster={fallbackCacheBuster}
              onFallback={triggerFallback}
            />
          </div>
        </div>
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
