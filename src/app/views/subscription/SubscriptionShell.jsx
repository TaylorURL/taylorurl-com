import { useEffect } from 'react'
import { m } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import Magnet from '@reactbits/Magnet/Magnet'
import { fadeInUpMount } from '@constants/animations'
import { announceGroundChange } from '@hooks/theme/useOnDarkBackground'

/**
 * The frame both list pages report into.
 *
 * A page reached from a link in an email carries one fact and two ways onward,
 * so the layout is a single column at a reading measure on the blueprint
 * ground the rest of the site uses. The eyebrow states which of the two the
 * page is on, and changes with it as the request settles.
 *
 * @param {object} props
 * @param {string} props.eyebrow - the standing label above the heading
 * @param {string} props.heading
 * @param {string} [props.body] - one line of detail, omitted while working
 * @param {'plan' | 'hatch'} [props.draft] - what the panel's field draws. The
 *   shell answers for both outcomes of one transaction and they are otherwise
 *   the same page, so the drawing is what tells them apart: a confirmation is
 *   drawn on the plan, and a withdrawal on the section hatch that means the
 *   thing shown is closed.
 * @param {import('react').ReactNode} [props.children] - what the reader still
 *   has to do, set between the detail and the two ways onward
 */
export default function SubscriptionShell({ eyebrow, heading, body, draft = 'plan', children }) {
  // The bar above reads the ground by sampling the page, and a view that
  // arrives in its own chunk lands after that reading was taken. This says so.
  useEffect(() => announceGroundChange(), [])

  return (
    <div
      data-ground="dark"
      className="relative flex min-h-[calc(100dvh-80px)] items-center overflow-hidden bg-bg pb-16 pt-32 text-ink sm:pb-20 sm:pt-44"
    >
      <div
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS[draft]}`}
        aria-hidden="true"
      />

      <div className="container-rail-prose relative">
        <p className="section-label mb-6 text-accent">{eyebrow}</p>

        <m.h1
          {...fadeInUpMount}
          className="display-3 font-semibold leading-[1.05] tracking-tightest text-ink [text-wrap:balance]"
        >
          {heading}
        </m.h1>

        {body && (
          <m.p
            {...fadeInUpMount}
            transition={{ ...fadeInUpMount.transition, delay: 0.08 }}
            className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-soft"
          >
            {body}
          </m.p>
        )}

        {children && (
          <m.div {...fadeInUpMount} transition={{ ...fadeInUpMount.transition, delay: 0.16 }}>
            {children}
          </m.div>
        )}

        <m.div
          {...fadeInUpMount}
          transition={{ ...fadeInUpMount.transition, delay: 0.24 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <Magnet padding={60} magnetStrength={5}>
            <Link to="/" className="btn btn-primary group">
              Return to Home
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Magnet>
          <Magnet padding={60} magnetStrength={5}>
            <Link to="/contact" className="btn btn-secondary">
              Get in Touch
            </Link>
          </Magnet>
        </m.div>
      </div>
    </div>
  )
}
