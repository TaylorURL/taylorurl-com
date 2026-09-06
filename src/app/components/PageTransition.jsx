import { AnimatePresence, m } from 'framer-motion'
import { pageEnter } from '@constants/animations'

/**
 * The change from one page to the next.
 *
 * The page being left fades out before the page arriving is drawn, rather than
 * the two dissolving through each other: two pages of type on top of each other
 * for a fifth of a second is harder to read than either of them alone. What
 * arrives then arrives in parts - the wrapper carries `page-arrive`, and the
 * stylesheet brings the page's own sections up under it one after another, so a
 * page assembles rather than appearing all at once.
 *
 * `initial={false}` keeps the first page of a visit out of the wrapper's fade.
 * The site is prerendered, so that page is already in the HTML the browser
 * painted; fading the whole of it in would mean hiding something the visitor can
 * see and showing it again. Its sections still arrive on the stylesheet's own
 * timing, which runs without waiting for React.
 *
 * The wrapper is a real element in the layout, so where the page sat in a flex
 * or grid parent it now sits one level down. `className` is how that parent's
 * arrangement is carried across the gap; a page whose parent is an ordinary
 * block needs nothing.
 *
 * The page's own drawing module rides in on `style` rather than on a class or
 * an attribute, and it has to be this element rather than the one above it:
 * the outgoing page is held here while it fades, and it has to keep the module
 * it was drawn on until it is gone.
 *
 * @param {{routeKey: string, onArrive?: () => void, className?: string,
 *   style?: React.CSSProperties, children: React.ReactNode}} props - `routeKey` is what counts as a different
 *   page: a section that keeps its own chrome across several URLs passes one key
 *   for all of them, so moving inside it does not tear the chrome down.
 *   `onArrive` runs once the outgoing page has gone, which is where anything
 *   that would otherwise jump the page under a reader still looking at it
 *   belongs.
 */
export default function PageTransition({ routeKey, onArrive, className, style, children }) {
  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={onArrive}>
      <m.div
        key={routeKey}
        className={className}
        style={style}
        initial={pageEnter.initial}
        animate={pageEnter.animate}
        exit={pageEnter.exit}
        transition={pageEnter.transition}
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}
