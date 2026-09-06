import { m } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { staggerChild } from '@constants/animations'
import { useScrollFocus } from '@hooks/useScrollFocus'

/**
 * The card the home page's second section is laid out in, and the two surfaces
 * an artefact stands on inside it.
 *
 * Both sites draw this band and neither draws the same thing on it: the studio
 * puts a client's site, a measured score and the board that watches them on the
 * plane, and the second site - which has no portfolio, no scores and no board -
 * puts the terms of each service line there instead. What they share is the
 * card, so a card restyled is restyled once and the two bands cannot drift into
 * two different objects.
 */

/**
 * A capability card: a heading, a sentence, a way in, and the thing itself.
 *
 * The artefact sits on a lit plane rather than inside a second box. A card that
 * draws a border around its own picture reads as two panels; a plane the
 * picture stands on and runs out of reads as a view of something larger, which
 * is what lets four cards of different heights still scan as a set.
 *
 * The corner mark is the card's affordance and not a second control: it belongs
 * to the same link the label does, so the card offers one tab stop and one
 * destination however many places the pointer can find it.
 *
 * The card is two elements rather than one because it answers to two different
 * clocks. The outer one is the grid cell and the arrival - where the card sits
 * in the row, and the one-time reveal as the band comes up - and the inner one
 * is the surface, which is sized and lit by where the card is on the screen for
 * as long as the reader is on the page. Both write opacity, and a card that put
 * them on the same element would have the arrival and the pass fighting over
 * it.
 */
export function Card({ title, blurb, to, cta, children, index, wide }) {
  const { ref, transform, opacity } = useScrollFocus()

  return (
    <m.article
      ref={ref}
      {...staggerChild(index, 0.06)}
      className={`flex flex-col ${wide ? 'md:col-span-2' : ''}`}
    >
      <m.div
        style={{ transform, opacity }}
        className="card-lift group/card relative flex flex-1 flex-col overflow-hidden bg-paper"
      >
        <div className="flex flex-col gap-3 p-8 pr-16 sm:p-10 sm:pr-20">
          <h3 className="display-6 font-semibold leading-[1.15] tracking-tight text-ink-paper [text-wrap:balance]">
            {title}
          </h3>
          <p className="max-w-[48ch] text-[15px] leading-relaxed text-paper-soft">{blurb}</p>
          <Link
            to={to}
            className="inline-flex min-h-[44px] touch-manipulation items-center gap-2 self-start text-[14px] font-semibold text-accent transition-colors duration-200 hover:text-[color:var(--accent-hi)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] active:scale-[0.97]"
          >
            {cta}
            <span
              aria-hidden="true"
              className="border-hair-paper-strong text-paper-faint absolute right-8 top-8 flex h-8 w-8 items-center justify-center rounded-[var(--r-control)] border bg-[color:var(--paper-field)] transition-colors duration-200 before:absolute before:-inset-1.5 before:content-[''] group-hover/card:border-[color:var(--accent)] group-hover/card:bg-accent group-hover/card:text-[color:var(--on-accent)] sm:right-10 sm:top-10"
            >
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
        {children}
      </m.div>
    </m.article>
  )
}

/** The tinted foot, for a card whose artefact is a line of text. */
export function Foot({ children, className = '' }) {
  return <div className={`card-foot mt-auto ${className}`}>{children}</div>
}

/** The lit plane, for a card with a real object to stand on it. */
export function Plane({ children, className = '' }) {
  return <div className={`card-plane mt-auto ${className}`}>{children}</div>
}
