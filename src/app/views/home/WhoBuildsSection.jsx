import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { ABOUT } from '@data/pages/about'
import { CLIENT_PROJECTS } from '@data/portfolio'
import Reveal from '@components/page-bands/Reveal'
import Portrait from '@components/people/Portrait'
import { BIO_NAME, BIO_TITLE } from '@lib/mail/bio.js'
import WorkDeck from './WorkDeck'

/**
 * Who builds it, answered with what has been built.
 *
 * Everything above this band is the offer and everything below it is the
 * evidence, and between them the page answers the question a reader has by now:
 * who is on the other end. It answers the way a person would - a sentence in the
 * first person, the face and the name under it - rather than by announcing how
 * many people there are, which a reader believes less the more often it is
 * said. The row underneath is what got built, each frame carrying the live
 * hostname and a way through to how it was built.
 *
 * The sentences are the about page's, read from its own record rather than
 * transcribed. The claim exists in one place, and a band on the front door that
 * quietly disagrees with the page it links to is worse than no band.
 */
export default function WhoBuildsSection() {
  return (
    <section className="section-y-lg border-hair-paper relative isolate overflow-x-clip border-t bg-paper">
      <div className="container-rail relative">
        {/* The claim on the left and the qualification on the right, so the
            headline keeps a measure it can be set at and the paragraph is not
            one line of eighty characters underneath it. */}
        <div className="xl:grid xl:grid-cols-[1.15fr_0.85fr] xl:items-end xl:gap-16">
          <Reveal>
            <p className="section-label mb-5 flex items-center gap-3 text-accent">
              <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
              Who Builds It
            </p>
            <h2 className="display-3 max-w-[17ch] font-semibold leading-[1.04] tracking-tightest text-ink-paper [text-wrap:balance]">
              {ABOUT.hero.title}
            </h2>
          </Reveal>

          <Reveal className="mt-7 xl:mt-0 xl:pb-2">
            <p className="max-w-[46ch] text-[16px] leading-relaxed text-paper-soft sm:text-[17px]">
              {ABOUT.hero.description}
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Portrait size={56} alt="" />
              <div>
                <p className="text-[15px] font-semibold text-ink-paper">{BIO_NAME}</p>
                <p className="section-label-sm mt-1 text-accent">{BIO_TITLE}</p>
              </div>
            </div>
            <Link
              to="/portfolio"
              className="group mt-7 inline-flex min-h-[44px] touch-manipulation items-center gap-2 text-[15px] font-semibold text-[color:var(--accent-loud)] transition-colors duration-200 hover:text-ink-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            >
              See the Work
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </div>

        <Reveal className="mt-12 lg:mt-16">
          <WorkDeck projects={CLIENT_PROJECTS} />
        </Reveal>
      </div>
    </section>
  )
}
