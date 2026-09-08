import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { m } from 'framer-motion'
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { fadeInUp } from '@constants/animations'
import { ABOUT } from '@data/pages/about'
import { CLIENT_PROJECTS } from '@data/portfolio'
import { useScrollSwell } from '@hooks/scroll/useScrollSwell'
import WorkDeck from './WorkDeck'

/**
 * Who builds it, answered with what has been built.
 *
 * Everything above this band is the offer and everything below it is the
 * evidence, and between them the page makes one claim it cannot show: that a
 * small team builds the site and brings the business customers. A portrait
 * stood here for a while, and a portrait is a claim of the same kind as the
 * sentence beside it - a face is not proof that anybody answers the phone. The
 * client sites are, because each one is a business that let a stranger rebuild
 * the thing its customers arrive on, and there are eleven of them.
 *
 * So the sentence stays and the evidence changes: the headline claims a small
 * team, and the row underneath is what that team shipped, each frame carrying
 * the live hostname and a way through to how it was built.
 *
 * The sentences are the about page's, read from its own record rather than
 * transcribed. The claim exists in one place, and a band on the front door that
 * quietly disagrees with the page it links to is worse than no band.
 *
 * The depth is in `WorkDeck`, and it is a rotation rather than a decoration:
 * the frames stand on a rail that turns them as it carries them past, so the
 * one being read faces the reader square and its neighbours are edging away.
 * The rail advances itself, and holds still while a pointer is over it.
 */
export default function SmallTeamSection() {
  // The claim swells as its turn comes round; the deck under it does not. The
  // frames on that rail are already turning as they travel, and a band that
  // scaled them at the same time would be two motions arguing over one row.
  //
  // It grows off its own left edge because the deck is set to that same edge
  // and stays where it is. Grown from the middle the headline steps twenty
  // pixels out of the line the frames underneath it are still holding, which
  // reads as the margin slipping rather than as the words coming forward.
  const heading = useScrollSwell({ origin: 'left' })

  return (
    <section className="section-y-lg border-hair-paper relative isolate overflow-x-clip border-t bg-paper">
      <div
        className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.quiet}`}
        aria-hidden="true"
      />

      <m.div {...fadeInUp} className="container-rail relative">
        {/* The claim on the left and the qualification on the right, so the
            headline keeps a measure it can be set at and the paragraph is not
            one line of eighty characters underneath it. */}
        <m.div
          ref={heading.ref}
          style={heading.style}
          className="xl:grid xl:grid-cols-[1.15fr_0.85fr] xl:items-end xl:gap-16"
        >
          <div>
            <p className="section-label mb-5 flex items-center gap-3 text-accent">
              <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
              Who Builds It
            </p>
            <h2 className="display-3 max-w-[17ch] font-semibold leading-[1.04] tracking-tightest text-ink-paper [text-wrap:balance]">
              {ABOUT.hero.title}
            </h2>
          </div>

          <div className="mt-7 xl:mt-0 xl:pb-2">
            <p className="max-w-[46ch] text-[16px] leading-relaxed text-paper-soft sm:text-[17px]">
              {ABOUT.hero.description}
            </p>
            <Link
              to="/portfolio"
              className="group mt-7 inline-flex min-h-[44px] touch-manipulation items-center gap-2 text-[15px] font-semibold text-[color:var(--accent-loud)] transition-colors duration-200 hover:text-ink-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            >
              See the Work
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </m.div>

        <div className="mt-12 lg:mt-16">
          <WorkDeck projects={CLIENT_PROJECTS} />
        </div>
      </m.div>
    </section>
  )
}
