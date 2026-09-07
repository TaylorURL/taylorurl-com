import { m } from 'framer-motion'
import { ArrowUpRight, PencilLine } from 'lucide-react'
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import ReviewCarousel from '@components/reviews/ReviewCarousel'
import ReviewStandingRail from '@components/reviews/ReviewStandingRail'
import { reviewSourceFill, reviewSourceInk, reviewSourceMark } from '@components/marks/reviewMarks'
import { fadeInUp } from '@constants/animations'
import { useScrollSwell } from '@hooks/scroll/useScrollSwell'
import { BIO_TEXT, BIO_TITLE } from '@lib/mail/bio.js'
import { CLIENT_REVIEW_LIST, QUOTED_SOURCES, reviewSourcesWith } from '@data/reputation/reviews'
import { AccentGradient } from '@reactbits/kit'

export default function TestimonialsSection() {
  // Every listing a reader can go and check, and the two the buttons answer
  // with. They are pulled apart on purpose: a review is asked for wherever the
  // business most wants the next one, which is the accreditation while there is
  // one, and "see all of them" has to land where the words actually are, which
  // is whichever network the quotes above were published on. Pointing both at
  // the same place is how a reader ends up on a profile holding nothing.
  const readable = reviewSourcesWith('reads')
  const writeTo = reviewSourcesWith('writes')[0]
  const holdsTheQuotes = QUOTED_SOURCES[0]

  // The three things a reader takes in here, in the order they are met.
  const heading = useScrollSwell()
  const rail = useScrollSwell()
  const actions = useScrollSwell()

  return (
    <section className="section-y-lg border-hair-paper relative overflow-hidden border-t bg-paper">
      <div
        className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.ledger}`}
        aria-hidden="true"
      />
      <div className="container-rail relative flex flex-col gap-12 md:gap-16">
        <m.div {...fadeInUp}>
          <m.div
            ref={heading.ref}
            style={heading.style}
            className="border-hair-paper grid items-end gap-10 border-b pb-16 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="section-label mb-5 text-accent">Reviews</p>
              <h2 className="display-2 font-semibold leading-[1.02] tracking-tightest text-ink-paper [text-wrap:balance]">
                Owners who <br />
                <AccentGradient>hired me.</AccentGradient>
              </h2>
            </div>
            {/* The ratings rail inside is a scroller of fixed-width badges, and a
              scroller's own content is as wide as everything on it. Left to size
              itself this column would be asked for the width of all five badges
              laid end to end and would take it out of the headline beside it. */}
            <div className="flex min-w-0 flex-col items-start gap-7 lg:items-end">
              <div className="flex items-start gap-4 lg:flex-row-reverse">
                <img
                  src="/images/trenton-taylor.webp"
                  srcSet="/images/trenton-taylor.webp 1x, /images/trenton-taylor@2x.webp 2x"
                  alt=""
                  width="72"
                  height="72"
                  loading="lazy"
                  decoding="async"
                  className="border-hair-paper-strong h-[72px] w-[72px] shrink-0 rounded-md border object-cover"
                />
                <div className="max-w-[46ch] lg:text-right">
                  <p className="text-[14px] font-semibold text-ink-paper">
                    Trenton Taylor{' '}
                    <span className="text-paper-faint font-normal">· {BIO_TITLE}</span>
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-paper-soft">{BIO_TEXT}</p>
                </div>
              </div>
              <ReviewStandingRail />

              {/*
              Every listing the same business is reviewed on, each in its own
              colour. The colours are the point rather than decoration: a row set
              in one house ink reads as a list this site wrote, and the only
              thing worth saying here is that these are other people's pages and
              a reader can go and look at any of them.
            */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 lg:justify-end">
                {readable.map(source => {
                  const Mark = reviewSourceMark(source.key)
                  return (
                    <a
                      key={source.key}
                      href={source.reads}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ '--review-ink': reviewSourceInk(source.key) }}
                      className="group -my-3 flex min-h-[44px] items-center gap-2 py-3 text-[13px] font-medium text-paper-soft transition-colors hover:text-[color:var(--review-ink)]"
                    >
                      {Mark && <Mark className="h-4 w-4" style={{ color: 'var(--mark-brand)' }} />}
                      {source.label}
                    </a>
                  )
                })}
              </div>
            </div>
          </m.div>
        </m.div>

        <m.div ref={rail.ref} style={rail.style}>
          <ReviewCarousel reviews={CLIENT_REVIEW_LIST} />
        </m.div>

        <m.div
          ref={actions.ref}
          style={actions.style}
          className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
        >
          {writeTo && (
            <a
              href={writeTo.writes}
              target="_blank"
              rel="noopener noreferrer"
              style={{ '--review-fill': reviewSourceFill(writeTo.key) }}
              className="btn group bg-[color:var(--review-fill)] text-[color:var(--on-accent)] hover:bg-[color:color-mix(in_srgb,var(--review-fill)_84%,var(--scrim-ink))]"
            >
              <PencilLine aria-hidden="true" className="h-3.5 w-3.5" />
              Leave a Review on {writeTo.label}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          )}
          {holdsTheQuotes && (
            <a
              href={holdsTheQuotes.reads}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary group"
            >
              See All Reviews
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          )}
        </m.div>
      </div>
    </section>
  )
}
