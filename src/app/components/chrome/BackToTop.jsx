import { AnimatePresence, m } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { useScrolledPast } from '@hooks/scroll/useScrolledPast'
import { chromeRise } from '@constants/animations'

const SHOW_THRESHOLD = 400

export default function BackToTop() {
  const visible = useScrolledPast(SHOW_THRESHOLD)

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <AnimatePresence>
      {visible && (
        <m.button
          type="button"
          initial={chromeRise.initial}
          animate={chromeRise.animate}
          exit={chromeRise.exit}
          transition={chromeRise.transition}
          whileTap={{ transform: 'translateY(0px) scale(0.94)' }}
          onClick={scrollToTop}
          // One rail down the corner: this and the assistant's launcher stand
          // off the same edge at every width and sit a clear gap apart, so the
          // two never read as two corners a half-step out of line.
          className="group fixed bottom-24 right-4 z-[var(--z-float)] flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-[var(--r-control)] bg-paper text-ink-paper shadow-[var(--raise)] transition-colors duration-200 ease-out-soft hover:bg-ink-paper hover:text-paper active:scale-[0.96] sm:right-6"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4 transition-transform duration-200 ease-out-soft group-hover:-translate-y-0.5" />
        </m.button>
      )}
    </AnimatePresence>
  )
}
