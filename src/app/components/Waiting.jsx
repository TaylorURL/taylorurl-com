import { m } from 'framer-motion'
import { waitFade } from '@constants/animations'
import { useDeferredWait } from '@hooks/useDeferredWait'

/**
 * The one thing the site shows while it is still working.
 *
 * Every wait on the site draws this, so a session being read back and a page
 * still arriving look like the same site doing the same thing. The mark is the
 * pulsing hairline the console's tables already use for rows that have not
 * landed, rather than a spinner none of the rest of the interface carries.
 *
 * Nothing here decides when to appear. That belongs to `useDeferredWait`, which
 * keeps a wait short enough to skip from ever being drawn and one long enough to
 * notice from vanishing before it can be read.
 *
 * A wait holds the height of the screen rather than collapsing to the size of
 * the placeholder, so the page behind it does not jump when the content lands.
 *
 * The live region is mounted empty and takes its line only once the wait is
 * drawn. A screen reader is told about the waits a sighted reader is shown and
 * about no others: a page that arrives inside the delay would otherwise be
 * announced as loading on its way to being announced as arrived.
 *
 * @param {{visible: boolean, label?: string}} props - `visible` fades the
 *   placeholder in and out. `label` is the line under the mark; without one the
 *   mark stands alone and only a screen reader is told.
 */
export default function Waiting({ visible, label }) {
  return (
    <m.div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-3"
      initial={waitFade.initial}
      animate={visible ? waitFade.animate : waitFade.initial}
      transition={waitFade.transition}
    >
      <span
        aria-hidden="true"
        className="block h-px w-24 animate-pulse rounded-sm bg-[color:var(--paper-ink-faint)]"
      />
      {visible &&
        (label ? (
          <span className="text-[13px] text-[color:var(--paper-ink-faint)]">{label}</span>
        ) : (
          <span className="sr-only">Loading</span>
        ))}
    </m.div>
  )
}

/**
 * The same placeholder for a wait whose end nobody controls - a page still
 * downloading, where React puts the fallback up and takes it down on its own.
 *
 * A wait that turns out to be short is never drawn, but once the thing arrives
 * it goes on screen immediately, because holding it back would mean holding
 * back the page behind it.
 *
 * @param {{label?: string}} props - As `Waiting`, less `visible`, which this
 *   decides.
 */
export function DeferredWaiting(props) {
  const { visible } = useDeferredWait(true)
  return <Waiting {...props} visible={visible} />
}
