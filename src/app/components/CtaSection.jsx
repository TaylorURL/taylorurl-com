import { m } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { useTheme } from '@hooks/useTheme'
import Magnet from '@reactbits/Magnet/Magnet'
import { LazyAurora } from '@reactbits/LazyBg'
import BbbSeal from '@components/BbbSeal'
import { PUBLISHES_REVIEWS, SITE } from '../../../lib/site/current.js'

// The wash the aurora is seen through, and how far the button pulls at a
// cursor. Both are stated identically in `@components/CtaBanner`: the two are
// one band at two sizes, and a reader meeting them on consecutive pages reads
// any difference between them as a difference in the page.
const AURORA =
  'pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]'
const MAGNET_PADDING = 80

/**
 * The closing call to action for a page with one thing to do next, so the
 * button is fixed at /start rather than passed in. `@components/CtaBanner` is
 * the same band with addressable buttons, for pages that offer a choice.
 *
 * `title` takes a node rather than a string because most callers wrap part of
 * the heading in an accent gradient.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title - Heading content.
 * @param {string} props.description - Supporting line beside the button.
 * @param {string} [props.eyebrow] - Standing label above the heading.
 * @param {'plan' | 'ledger' | 'column' | 'node' | 'hatch' | 'iso' | 'quiet'}
 *   [props.draft] - What the closing band's field draws.
 * @param {'band' | 'foot' | 'hero' | 'card'} [props.seam] - How the field meets
 *   the band's own edges. It holds its foot alone by default: the top edge
 *   carries the accent rule and the aurora behind it, and the aurora is drawn
 *   under the field, so a head fade would pour the ground over its brightest
 *   part.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the band
 *   sits on.
 */
export default function CtaSection({
  title,
  description,
  eyebrow = 'Next',
  ground = 'dark',
  draft = 'quiet',
  seam = 'foot',
}) {
  const tone = GROUNDS[ground]
  // The aurora is drawn for a slab and nothing else. It is additive light, so
  // over the field it is a smear rather than a glow, and under the light
  // setting there is no slab left for it to be drawn over: a ground standing
  // down takes the field's own values, whatever it was asked for.
  const { resolved } = useTheme()
  const slab = resolved === 'dark' && (ground === 'dark' || ground === 'band')

  return (
    <section {...tone.attrs} className={`relative overflow-hidden border-t ${tone.section}`}>
      {slab && (
        <div className={AURORA} aria-hidden="true">
          <LazyAurora amplitude={1} blend={0.6} speed={0.6} />
        </div>
      )}
      <div
        className={`absolute inset-0 ${tone.grid} ${DRAFTS[draft]} ${SEAMS[seam]}`.trimEnd()}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${slab ? 'via-accent/40' : 'via-accent/30'} to-transparent`}
        aria-hidden="true"
      />

      <div className="container-rail relative py-28 sm:py-36">
        <m.div {...fadeInUp} className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="section-label mb-4 text-accent">{eyebrow}</p>
            <h2
              className={`display-2 font-semibold leading-[1.02] tracking-tightest [text-wrap:balance] ${tone.title}`}
            >
              {title}
            </h2>
          </div>
          <div className="flex flex-col items-start gap-8 lg:items-end lg:text-right">
            <p className={`max-w-md text-[16px] leading-relaxed ${tone.body}`}>{description}</p>
            <Magnet padding={MAGNET_PADDING} magnetStrength={4}>
              <Link to="/start" className="btn btn-primary group">
                Start a Project
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Magnet>

            {/*
              The seal closes the band, under the ask rather than beside it.
              This is the last thing on the page, and the question it answers -
              whether the company on the other end of that button is a real one
              somebody vouches for - is the one left standing once a reader has
              decided they want the work. It takes the column's own alignment,
              so it sits under the button either way and reads as the ask's own
              footing rather than as a second thing to click.

              `@components/BbbSeal` holds what BBB's artwork is owed, and draws
              nothing at all where there is no accreditation to show. It is the
              accreditation of the business the reviews belong to, so only that
              site draws it - the same gate `@components/Footer` puts on it.
            */}
            {PUBLISHES_REVIEWS ? <BbbSeal /> : null}
          </div>
        </m.div>
      </div>
    </section>
  )
}
