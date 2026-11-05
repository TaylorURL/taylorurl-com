import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Pause, Play, ThumbsUp } from 'lucide-react'
import { CheckList } from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import GoogleLogo from '@components/marks/GoogleLogo'
import TrustpilotLogo from '@components/marks/TrustpilotLogo'
import { reviewSourceInk, reviewSourceMark } from '@components/marks/reviewMarks'
import ReviewStars from '@components/reviews/ReviewStars'
import { BBB_PROFILE_URL, bbbAccredited } from '@data/reputation/bbb'
import { reviewSource } from '@data/reputation/reviews'
import { useMediaQuery } from '@hooks/useMediaQuery'
import { leadOf } from './boardData'

/**
 * A change asked for by text and done the same morning, drawn as the thread
 * it happened in. It is the shortest way to say what working with a one-person
 * studio is like.
 */
export function TextThread() {
  return (
    <figure className={`${CARD} flex h-full flex-col gap-3 p-6 sm:p-8`}>
      <figcaption className={`${TYPE.h3} mb-2`}>Changes, the same day</figcaption>
      <p className="mr-10 rounded-[16px] rounded-bl-[6px] bg-white/[0.07] px-4 py-3 text-[15px] leading-[1.5] text-ink">
        Closing at 3 on Friday for the holiday. Can you put that on the site?
      </p>
      <p className="ml-10 rounded-[16px] rounded-br-[6px] bg-[var(--blue)] px-4 py-3 text-[15px] leading-[1.5] text-white">
        Done. It’s on the home page, and your Google hours match.
      </p>
    </figure>
  )
}

/** What one monthly price covers, as a short list in a card. */
export function Monthly({ items }) {
  return (
    <div className={`${CARD} h-full p-6 sm:p-8`}>
      <h3 className={`${TYPE.h3} mb-6`}>One monthly price covers it</h3>
      <CheckList items={items} />
    </div>
  )
}

/**
 * Where a review was left, in that network's own logo and its own rating.
 *
 * The logo is the network's published mark rather than its name in this site's
 * type - Trustpilot's wordmark, Google's four-colour G - because that shape is
 * what tells a reader at a glance that somebody other than this site holds the
 * words. It links to the profile they can be read on. The stars beside it are
 * the review's own count drawn the way that network draws stars; a network that
 * only asks whether somebody recommends a business gets its thumb, never five
 * stars nobody left.
 */
export function ReviewNetwork({ review }) {
  const network = reviewSource(review.source)
  if (!network) return null
  const Mark = reviewSourceMark(review.source)
  const logo =
    review.source === 'trustpilot' ? (
      <TrustpilotLogo className="h-[22px] w-auto shrink-0" title="Trustpilot" />
    ) : (
      <>
        {review.source === 'google' ? (
          <GoogleLogo className="h-[22px] w-[22px] shrink-0" title="" />
        ) : (
          Mark && <Mark className="h-[22px] w-[22px]" style={{ color: 'var(--mark-brand)' }} />
        )}
        <span>{review.source === 'google' ? 'Google Reviews' : network.label}</span>
      </>
    )
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
      <a
        href={network.reads}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${network.longLabel}: read the reviews`}
        className="relative flex touch-manipulation items-center gap-2 text-[16px] font-medium text-ink transition-opacity duration-150 before:absolute before:-inset-3 before:content-[''] hover:opacity-80"
      >
        {logo}
      </a>
      {typeof review.rating === 'number' ? (
        <ReviewStars rating={review.rating} source={review.source} size={20} />
      ) : (
        network.endorses && (
          <span
            className="flex items-center gap-2 text-[15px] font-semibold"
            style={{ color: reviewSourceInk(review.source) }}
          >
            <ThumbsUp className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            {network.endorses}
          </span>
        )
      )}
    </div>
  )
}

/**
 * A review, quoted as its first sentences, with who wrote it and where. A
 * network that rates out of five gets its score; one that only recommends says
 * so. The score is always the review's own.
 */
export function Quote({ review, sentences = 1, className = '' }) {
  const lead = leadOf(review.quote, sentences)
  return (
    <figure className={className}>
      <ReviewNetwork review={review} />
      <blockquote className="max-w-[30ch] text-[26px] font-medium leading-[1.3] tracking-[-0.02em] text-ink [text-wrap:pretty] sm:text-[32px]">
        “{lead}”
      </blockquote>
      <figcaption className={`${TYPE.small} mt-5`}>
        {review.name}, {review.business} ·{' '}
        {review.rating
          ? `${review.rating}/5 on ${review.network}`
          : `Recommends on ${review.network}`}
      </figcaption>
    </figure>
  )
}

/**
 * The BBB accreditation, as a way to the profile that carries it.
 *
 * BBB holds no review to quote, so it cannot take a turn among the quotes; it
 * stands beside them instead, as the thing a buyer checks to find out whether
 * the company behind them is real. It is drawn the way `@data/reputation/bbb`
 * says every surface draws it - BBB's torch in BBB's own blue with the claim in
 * words - and it is drawn only while the seal is held, so the words cannot
 * outlast the accreditation.
 */
export function BbbAccredited({ className = '' }) {
  const network = reviewSource('bbb')
  const Mark = reviewSourceMark('bbb')
  if (!bbbAccredited() || !BBB_PROFILE_URL || !network) return null
  return (
    <a
      href={BBB_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${network.longLabel}: see the BBB profile`}
      className={`${CARD} group inline-flex min-h-[48px] items-center gap-3 py-2 pl-3 pr-4 text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-ink/10 ${className}`.trim()}
    >
      {Mark && (
        <Mark
          className="h-6 w-6 shrink-0"
          style={{ color: 'var(--bbb-blue)' }}
          aria-hidden="true"
        />
      )}
      <span>{network.longLabel}</span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-ink-mute transition-colors duration-150 group-hover:text-ink"
        strokeWidth={2}
        aria-hidden="true"
      />
    </a>
  )
}

/** How far a swipe has to travel before it counts as asking for the next review. */
const SWIPE = 40

/**
 * Every client review, one at a time, moving on by itself.
 *
 * The quotes share one cell of a grid, so the band is as tall as the longest of
 * them from the first frame and the page under it never jumps as they change.
 * One fades up into place as the last fades up and out of it. The bar under
 * the quotes fills while one is held and the next arrives when it is full: the
 * bar's own animation is the clock (`review-hold` in the Tailwind config), so
 * what a reader sees filling and what moves the quotes on cannot drift apart.
 *
 * It holds still whenever a reader might be reading or reaching for it: while a
 * mouse is over it, while a key has put focus inside it, while it is off the
 * screen, and when they press pause. A dot shows any review straight away, and
 * a swipe on a phone moves one either way. Where the reader has asked for less
 * motion it never moves by itself at all, and the dots are the way through.
 *
 * `aside` stands at the far end of the row the dots are on, for what belongs
 * with the reviews without being one of them.
 *
 * Nothing moves until the browser has said it may. Both answers start false,
 * so the prerendered page and the first render agree, and a page whose reader
 * asked for less motion is never handed a clock the stylesheet has cut to
 * nothing - which would end the moment it began and spin through every review.
 */
export function QuoteCycle({ reviews, sentences = 1, aside = null }) {
  const [active, setActive] = useState(0)
  const [leaving, setLeaving] = useState(null)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [inView, setInView] = useState(false)
  const moves = useMediaQuery('(prefers-reduced-motion: no-preference)')
  const frame = useRef(null)
  const touch = useRef(null)
  const count = reviews.length
  const running = moves && inView && !paused && !hovered && !focused

  useEffect(() => {
    const node = frame.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const watch = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.4,
    })
    watch.observe(node)
    return () => watch.disconnect()
  }, [])

  function show(index) {
    const next = (index + count) % count
    if (next === active) return
    setLeaving(active)
    setActive(next)
  }

  if (count === 0) return null

  return (
    <div
      ref={frame}
      aria-roledescription="carousel"
      aria-label="What clients say"
      onPointerEnter={event => event.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={event => event.pointerType === 'mouse' && setHovered(false)}
      onFocus={event => event.target.matches(':focus-visible') && setFocused(true)}
      onBlur={event => !event.currentTarget.contains(event.relatedTarget) && setFocused(false)}
    >
      <div
        className="grid"
        aria-live={running ? 'off' : 'polite'}
        onTouchStart={event => {
          touch.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={event => {
          const start = touch.current
          touch.current = null
          const end = event.changedTouches[0]?.clientX
          if (start == null || end == null || Math.abs(end - start) < SWIPE) return
          show(end < start ? active + 1 : active - 1)
        }}
      >
        {reviews.map((review, index) => {
          const state =
            index === active
              ? 'translate-y-0 opacity-100 delay-200 duration-700'
              : index === leaving
                ? '-translate-y-3 opacity-0 duration-300'
                : 'translate-y-3 opacity-0 duration-300'
          return (
            <div
              key={review.displayUrl}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}`}
              inert={index !== active}
              className={`transition-[opacity,transform] ease-out-soft [grid-area:1/1] ${state}`}
            >
              <Quote review={review} sentences={sentences} />
            </div>
          )
        })}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
        <div className="flex items-center gap-2">
          <div className="-ml-1.5 flex items-center" role="group" aria-label="Choose a review">
            {reviews.map((review, index) => {
              const current = index === active
              return (
                <button
                  key={review.displayUrl}
                  type="button"
                  onClick={() => show(index)}
                  aria-label={`Review ${index + 1} of ${count}, from ${review.name}`}
                  aria-current={current ? 'true' : undefined}
                  className="group flex h-8 items-center px-1.5"
                >
                  <span
                    className={`relative block h-[6px] overflow-hidden rounded-full transition-[width,background-color] duration-500 ease-out-soft ${
                      current ? 'w-10 bg-ink/15' : 'w-[6px] bg-ink-faint group-hover:bg-ink-mute'
                    }`}
                  >
                    {current && (
                      <span
                        className={`absolute inset-0 origin-left rounded-full bg-ink ${moves ? 'animate-review-hold' : ''}`}
                        style={
                          moves ? { animationPlayState: running ? 'running' : 'paused' } : undefined
                        }
                        onAnimationEnd={moves ? () => show(active + 1) : undefined}
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          {moves && (
            <button
              type="button"
              onClick={() => setPaused(value => !value)}
              aria-label={paused ? 'Play the reviews' : 'Pause the reviews'}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-mute transition-colors duration-150 hover:bg-ink/10 hover:text-ink"
            >
              {paused ? (
                <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Pause className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
        {aside}
      </div>
    </div>
  )
}
