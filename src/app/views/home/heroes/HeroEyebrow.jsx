import { m } from 'framer-motion'
import { rise } from '@constants/animations'

/**
 * The line a hero opens on: who the company is and where it works, the first of
 * the hero's pieces to land.
 */
export default function HeroEyebrow() {
  return (
    <m.p {...rise(0)} className="section-label-sm flex items-center gap-3 text-ink-mute">
      <span className="h-1.5 w-1.5 flex-shrink-0 bg-accent" aria-hidden="true" />
      TaylorURL LLC · Baytown, TX
    </m.p>
  )
}
