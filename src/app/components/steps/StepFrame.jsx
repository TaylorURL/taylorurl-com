import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { EASE } from '@constants/animations'

const DURATION = 0.42

/**
 * The window a sequence's steps pass through, one at a time, and the line that
 * tells a screen reader which step has arrived.
 *
 * A step arrives from the side the frame is travelling and the step it
 * replaces leaves the other way, and the frame eases between the two heights
 * rather than snapping, so the controls under it stay near the hand that
 * reached for them. Reduced motion collapses both to a swap.
 *
 * @param {object} props
 * @param {Array<{ id: string, label: string }>} props.steps
 * @param {number} props.active - The step in front.
 * @param {1 | -1} props.direction - Which way the frame is travelling.
 * @param {number} props.shift - How far a step travels on its way in and out.
 * @param {string} [props.className] - Classes for the box the step is drawn in.
 * @param {React.ReactNode} props.children - The step in front, as drawn.
 */
export default function StepFrame({ steps, active, direction, shift, className, children }) {
  const reduced = useReducedMotion()
  const [height, setHeight] = useState(null)
  const panelRef = useRef(null)

  const step = steps[active]
  const transition = { duration: reduced ? 0 : DURATION, ease: EASE }
  const variants = useMemo(
    () => ({
      enter: travel => ({ opacity: 0, x: travel < 0 ? -shift : shift }),
      center: { opacity: 1, x: 0 },
      exit: travel => ({ opacity: 0, x: travel < 0 ? shift : -shift }),
    }),
    [shift]
  )

  // The height the frame holds, taken from the step standing in it. The step
  // on its way out is out of the flow by then, and a step that grows as it is
  // answered - a form turning into its confirmation, a list gaining a row -
  // moves the frame with it.
  useEffect(() => {
    const element = panelRef.current
    if (!element) return undefined

    // Layout pixels rather than the painted box, so a page the browser is
    // scaling reports the height the frame has to hold rather than the height
    // it happens to be drawn at.
    const measure = () => setHeight(element.offsetHeight)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [active])

  // The panel on its way out releases its node after the one arriving has
  // claimed the slot, so only a mounting node is taken.
  const holdPanel = node => {
    if (node) panelRef.current = node
  }

  return (
    <>
      <p role="status" className="sr-only">
        {`Step ${active + 1} of ${steps.length}. ${step.label}.`}
      </p>

      <m.div
        initial={false}
        animate={height === null ? {} : { height }}
        transition={transition}
        // The clip the height animation needs would also cut the focus ring
        // off any control sitting against the edge of the step, because a
        // field paints its ring outside its own box. The negative margin and
        // the padding cancel, so the content stays where it was and the ring
        // has somewhere to land.
        className="relative -mx-1 overflow-hidden px-1"
      >
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <m.div
            key={step.id}
            ref={holdPanel}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className={className}
          >
            {children}
          </m.div>
        </AnimatePresence>
      </m.div>
    </>
  )
}
