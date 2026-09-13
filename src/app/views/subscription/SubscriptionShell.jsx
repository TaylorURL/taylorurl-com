import { m } from 'framer-motion'
import WaysOnward from '@components/conversion/WaysOnward'
import { fadeInUpMount, rise } from '@constants/animations'
import { useAnnounceGround } from '@hooks/theme/useOnDarkBackground'

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
 * @param {import('react').ReactNode} [props.children] - what the reader still
 *   has to do, set between the detail and the two ways onward
 */
export default function SubscriptionShell({ eyebrow, heading, body, children }) {
  useAnnounceGround()

  return (
    <div
      data-ground="dark"
      className="relative flex min-h-[calc(100dvh-80px)] items-center overflow-hidden bg-bg pb-16 pt-32 text-ink sm:pb-20 sm:pt-44"
    >
      <div className="container-rail-prose relative">
        <p className="section-label mb-6 text-accent">{eyebrow}</p>

        <m.h1
          {...fadeInUpMount}
          className="display-3 font-semibold leading-[1.05] tracking-tightest text-ink [text-wrap:balance]"
        >
          {heading}
        </m.h1>

        {body && (
          <m.p {...rise(0.08)} className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-soft">
            {body}
          </m.p>
        )}

        {children && <m.div {...rise(0.16)}>{children}</m.div>}

        <WaysOnward delay={0.24} />
      </div>
    </div>
  )
}
