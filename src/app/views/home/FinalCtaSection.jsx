import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight, Clock, Mail, MessageSquareOff, Phone, ReceiptText } from 'lucide-react'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { fadeInUp } from '@constants/animations'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, START_LINK, SUPPORT_EMAIL } from '@constants/navigation'
import Magnet from '@reactbits/Magnet/Magnet'
import { AccentGradient } from '@reactbits/kit'
import { HOME } from '@data/taylorwebsite/homeTaylorwebsite'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/**
 * The closing call: the ask on the left, and what answering it gets you on the
 * right.
 *
 * It stands on the page's own ground rather than on a slab of its own. The
 * three sections above it are paper, and a black band under the last of them
 * reads as a different page stitched on rather than as the end of this one -
 * and under the dark setting it was the one surface that could not follow the
 * reader's choice. What carries the weight instead is a single panel on the
 * lit plane, which is an object the page can put down at any size and which
 * mixes itself from whichever ground the setting chose.
 *
 * The three promises used to be one line of the faintest ink on the page, set
 * at twelve pixels and broken mid-phrase by the wrap. They are the most
 * persuasive thing here - an hour, a price before any work, nobody selling at
 * you - so they are given the right-hand half of the panel, one to a row, on
 * their own paper with the plane showing round it.
 */

// What answering the call gets you, in the order it happens. The words are the
// ones this section already carried; what changed is that they are now the
// second thing read rather than the last thing squinted at.
const STUDIO_REPLIES = [
  { Icon: Clock, label: 'Usually a reply within the hour' },
  { Icon: ReceiptText, label: 'A plan and a price before any work starts' },
  { Icon: MessageSquareOff, label: 'No sales pitch' },
]

/**
 * The three, for whichever site is building. The middle one is a plan and a
 * price on a site that sells a website and a scope and a price on a site that
 * sells work to order, and the third is the promise each site is actually
 * making: nobody selling at you, against the exclusions being named before you
 * buy rather than after.
 */
const REPLIES = IS_SECOND_SITE ? HOME.cta.replies : STUDIO_REPLIES

export default function FinalCtaSection() {
  return (
    <section className="section-y-lg border-hair-paper relative overflow-hidden border-t bg-paper">
      <div
        className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.quiet} ${SEAMS.foot}`}
        aria-hidden="true"
      />
      <div className="container-rail relative">
        <m.div
          {...fadeInUp}
          className="panel-plane card-lift relative overflow-hidden rounded-[var(--r-feature)]"
        >
          {/* The panel is lit from its top left corner, which is where the
              plane's own gradient starts. The edge says so. */}
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent"
            aria-hidden="true"
          />
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.15fr_1fr] lg:items-stretch lg:gap-14 lg:p-14">
            <div className="flex flex-col gap-6 lg:py-2">
              {IS_SECOND_SITE ? (
                <>
                  <p className="section-label flex items-center gap-3 text-accent">
                    <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
                    {HOME.cta.eyebrow}
                  </p>
                  <h2 className="display-3 font-semibold leading-[1.04] tracking-tightest text-[color:var(--plane-ink)] [text-wrap:balance]">
                    {HOME.cta.heading} <AccentGradient>{HOME.cta.accentText}</AccentGradient>.
                  </h2>
                  <p className="max-w-[44ch] text-[16px] leading-relaxed text-[color:var(--plane-ink-soft)] sm:text-[17px]">
                    {HOME.cta.description}
                  </p>
                </>
              ) : (
                <>
                  <p className="section-label flex items-center gap-3 text-accent">
                    <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
                    Let’s Talk
                  </p>
                  <h2 className="display-3 font-semibold leading-[1.04] tracking-tightest text-[color:var(--plane-ink)] [text-wrap:balance]">
                    Ready to <AccentGradient>be the one they call</AccentGradient>?
                  </h2>
                  <p className="max-w-[44ch] text-[16px] leading-relaxed text-[color:var(--plane-ink-soft)] sm:text-[17px]">
                    You tell us what the business does and which customers you want. Hosting,
                    backups, monitoring, and the small changes after launch stay with us.
                  </p>
                </>
              )}
              <div className="mt-auto flex flex-col gap-5 pt-4">
                <Magnet padding={70} magnetStrength={3.5} wrapperClassName="self-start">
                  {/* Both sites end at the enquiry form, so the destination is
                      the same on either; what moves is the label, because "a
                      plan and a price" is what a website costs and a scope is
                      what work to order costs. */}
                  <Link to="/contact" className="btn btn-primary group">
                    {IS_SECOND_SITE ? START_LINK.label : 'Get a Plan and a Price'}
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </Magnet>
                {/* The other two doors, said quietly. A closing call that offers
                    one way in is a closing call that loses whoever would rather
                    dial than type. */}
                <div className="flex flex-wrap items-center gap-x-6">
                  <DirectLine icon={Phone} href={COMPANY_PHONE_HREF} label={COMPANY_PHONE} />
                  <DirectLine icon={Mail} href={`mailto:${SUPPORT_EMAIL}`} label={SUPPORT_EMAIL} />
                </div>
              </div>
            </div>

            <div className="plane-inset flex flex-col p-6 sm:p-8">
              <p className="section-label-sm text-paper-faint">What Happens Next</p>
              <ul className="flex flex-1 flex-col">
                {REPLIES.map((reply, index) => (
                  <li
                    key={reply.label}
                    className={`border-hair-paper flex flex-1 items-center gap-4 py-5 ${
                      index ? 'border-t' : ''
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="border-hair-paper flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-control)] border bg-[color:var(--wash-accent)] text-accent"
                    >
                      <reply.Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[15px] font-medium leading-snug text-ink-paper">
                      {reply.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </m.div>
      </div>
    </section>
  )
}

/** A way in that is not the button: the number, and the address. */
function DirectLine(props) {
  const { icon: Icon, href, label } = props
  return (
    <a
      href={href}
      className="inline-flex min-h-[44px] touch-manipulation items-center gap-2 text-[15px] font-medium text-[color:var(--plane-ink-soft)] transition-colors duration-200 hover:text-[color:var(--accent-loud)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label}
    </a>
  )
}
