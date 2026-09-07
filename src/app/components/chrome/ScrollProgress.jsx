import { m, useScroll } from 'framer-motion'

/** The read-progress hairline across the top of every page. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll()

  return (
    <m.div
      className="fixed left-0 right-0 top-0 z-[var(--z-scrim)] h-px origin-left bg-accent"
      style={{ scaleX: scrollYProgress, willChange: 'transform' }}
      aria-hidden="true"
    />
  )
}
