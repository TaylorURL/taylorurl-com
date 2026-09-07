import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import { announceGroundChange } from '@hooks/theme/useOnDarkBackground'
import { HERO_OPENER_ID, HERO_VARIANTS } from './heroes'

// Long enough to read a headline and take in the figure beside it before the
// next presentation arrives.
const DWELL_MS = 10000
const FADE_S = 0.45

/** Fisher-Yates, so every ordering is as likely as every other. */
function shuffled(items) {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const held = out[i]
    out[i] = out[j]
    out[j] = held
  }
  return out
}

/**
 * The order the markup carries: the opener, then the rest as they are declared.
 *
 * The home page is prerendered, so the HTML a visitor receives already names
 * all four of these on the controls under the stage. A draw made while that
 * HTML is being adopted would name them differently in the browser than on the
 * page the browser was handed, and a page whose text disagrees with the one it
 * received is a page thrown out and built over again from nothing.
 */
function pinnedOrder() {
  const opener = HERO_VARIANTS.find(variant => variant.id === HERO_OPENER_ID) ?? HERO_VARIANTS[0]
  return [opener, ...HERO_VARIANTS.filter(variant => variant.id !== opener.id)]
}

/**
 * The order this visit sees. The opener is fixed, and the remaining three are
 * shuffled behind it, so the page always opens on the same frame and never
 * repeats the same sequence after it.
 */
function visitOrder() {
  const [opener, ...rest] = pinnedOrder()
  return [opener, ...shuffled(rest)]
}

/**
 * The homepage hero. It carries four presentations of the same offer and moves
 * between them on its own: a typographic sheet, a ruled artboard, a search
 * listing split by a seam, and the terms of a job set as an order form.
 *
 * Every visit opens on the same presentation, and the other three follow in a
 * fresh order, so the first thing a visitor sees is chosen while a second look
 * is still not the same sequence as the first.
 *
 * Anyone who asked for less motion gets the first presentation and no rotation.
 * Everyone else gets a control that stops it, which is what WCAG 2.2.2 asks of
 * anything that moves for longer than five seconds.
 */
export default function HeroSection() {
  const reduced = useReducedMotion()
  const [order, setOrder] = useState(pinnedOrder)
  const [index, setIndex] = useState(0)
  const [running, setRunning] = useState(!reduced)

  const active = order[index]
  const stageRef = useRef(null)
  const [onScreen, setOnScreen] = useState(true)

  // Drawn once the served page has been adopted, never while it is being read.
  // The opener leads either way, so the stage and the control under it hold
  // still; all that settles is which of the other three follows the first.
  useEffect(() => {
    setOrder(visitOrder())
  }, [])

  // A presentation is only worth changing while somebody is looking at it.
  // The four are not the same height on a narrow viewport, so a change made
  // while the reader is further down the page moves everything under them for
  // a hero that is not on screen to be seen changing. Off screen it waits.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const show = useCallback(next => {
    setIndex(next)
  }, [])

  // A tab nobody is looking at does not spend its turn. The dwell is a single
  // timer rather than a counter, because the rule under the control draws its
  // own progress and nothing here needs to know how far along it is.
  useEffect(() => {
    if (!running || !onScreen) return undefined
    const wait = () => setIndex(prev => (prev + 1) % order.length)
    let timer = document.hidden ? 0 : setTimeout(wait, DWELL_MS)
    const resume = () => {
      clearTimeout(timer)
      timer = document.hidden ? 0 : setTimeout(wait, DWELL_MS)
    }
    document.addEventListener('visibilitychange', resume)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [running, onScreen, index, order.length])

  // The navigation reads the ground under it by sampling the page, and nothing
  // scrolls when a presentation changes. It is told twice: once as the new
  // ground takes the wrapper, and once the outgoing presentation has finished
  // fading off the top of it.
  useEffect(() => {
    announceGroundChange()
    const settled = setTimeout(announceGroundChange, FADE_S * 1000 + 60)
    return () => clearTimeout(settled)
  }, [index])

  const Hero = active.Component

  return (
    <div
      ref={stageRef}
      className="relative isolate grid min-h-[max(100svh,var(--hero-floor))] bg-bg"
    >
      {/* The stage stands on its own floor rather than on whichever presentation
          is mounted, so nothing under the hero moves when one arrives. The
          outgoing one still leaves the flow the moment it starts to go, which
          keeps the two from stacking during the fade. */}
      <AnimatePresence initial={false} mode="popLayout">
        <m.div
          key={active.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : FADE_S, ease: 'linear' }}
          className="col-start-1 row-start-1 h-full"
        >
          <Hero />
        </m.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[var(--z-raised)] col-start-1 row-start-1 self-end sm:bottom-8">
        <div className="container-rail flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRunning(prev => !prev)}
            aria-pressed={running}
            className="btn btn-secondary pointer-events-auto h-11 w-11 flex-shrink-0 px-0 text-ink-mute hover:text-ink"
          >
            {running ? (
              <Pause className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Play className="h-3 w-3" aria-hidden="true" />
            )}
            <span className="sr-only">{running ? 'Stop the Slideshow' : 'Play the Slideshow'}</span>
          </button>

          {order.map((variant, i) => {
            const selected = i === index
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => {
                  setRunning(false)
                  show(i)
                }}
                aria-current={selected ? 'true' : undefined}
                className="group pointer-events-auto relative h-11 w-11 flex-shrink-0 cursor-pointer touch-manipulation hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] active:scale-[0.97]"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-colors duration-200 ${
                    selected ? 'bg-[color:var(--hairline-strong)]' : 'bg-[color:var(--hairline)]'
                  } group-hover:bg-[color:var(--hairline-strong)]`}
                />
                {/* How much of this one's turn has run, drawn over its own rule
                    so the change is never a jump cut. */}
                {selected ? (
                  <span
                    key={running ? index : 'held'}
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-1/2 h-px origin-left -translate-y-1/2 bg-accent ${
                      running ? 'hero-dwell' : 'scale-x-100'
                    }`}
                    style={
                      running
                        ? {
                            animationDuration: `${DWELL_MS}ms`,
                            animationPlayState: onScreen ? 'running' : 'paused',
                          }
                        : undefined
                    }
                  />
                ) : null}
                <span className="sr-only">{variant.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
