import { m } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { useTheme } from '@hooks/theme/useTheme'
import Magnet from '@reactbits/Magnet/Magnet'
import { LazyAurora } from '@reactbits/LazyBg'
import BbbSeal from '@components/reviews/BbbSeal'
import { PUBLISHES_REVIEWS } from '../../../../lib/site/current.js'

// The wash the aurora is seen through, and how far the button pulls at a
// cursor.
const AURORA =
  'pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]'
const MAGNET_PADDING = 80

/**
 * The leading button of the closing band, pulled toward a cursor.
 *
 * @param {object} props
 * @param {string} props.to - Where the button goes.
 * @param {import('react').ReactNode} props.children - The label.
 */
export function CtaButton({ to, children }) {
  return (
    <Magnet padding={MAGNET_PADDING} magnetStrength={4}>
      <Link to={to} className="btn btn-primary group">
        {children}
        <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </Magnet>
  )
}

/**
 * The band a page closes on: the heading on one side, and the supporting line,
 * the buttons and the seal on the other. `@components/CtaBanner` and
 * `@components/CtaSection` put different buttons in it and nothing else, because
 * a reader meeting the two on consecutive pages reads any difference between
 * them as a difference in the page.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title - Heading content.
 * @param {string} props.description - Supporting line beside the buttons.
 * @param {string} [props.eyebrow] - Standing label above the heading.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the band
 *   sits on. A dark slab carries the aurora.
 * @param {import('react').ReactNode} props.children - The buttons.
 */
export default function CtaBand({
  title,
  description,
  eyebrow = 'Next',
  ground = 'dark',
  children,
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
            {children}

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
