// Shared Framer Motion variants. Curves match the design system (ease-out
// `[0.22, 1, 0.36, 1]`), durations are capped at 0.45s, and inViewport reveals
// fire once, before the thing they reveal has reached the screen. A reveal
// tripped once its subject is already in front of the reader is watched rather
// than met, and on a narrow viewport, where the sections arrive one at a time
// down a single column, being watched is the whole way down.
//
// `<MotionConfig reducedMotion="user">` in main.jsx carries the preference for
// every variant here, so none of them double-handles it. Its reach ends at
// Framer's own animations: a frame loop, a canvas, a CSS animation and a filter
// are all outside it and each has to read the preference for itself.

export const EASE = [0.22, 1, 0.36, 1]

// The ceiling every piece of motion on the site answers to, held as a number so
// a component that builds its length out of parts can hold itself to it rather
// than trusting the arithmetic to land under it.
export const MAX_MS = 0.45

export const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px 15% 0px' },
  transition: { duration: 0.4, ease: EASE },
}

export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25, ease: EASE },
}

export const staggerChild = (index, delay = 0.06) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px 15% 0px' },
  transition: { delay: index * delay, duration: 0.42, ease: EASE },
})

export const fadeInUpMount = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: EASE },
}

export const slideInLeftMount = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.45, ease: EASE },
}

export const slideInRightMount = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.45, ease: EASE },
}

// The page-to-page contract. Leaving is quicker than arriving: an exit a reader
// waits through is dead time, while an entrance that lands too fast is a cut.
export const PAGE_EXIT_MS = 0.16
export const PAGE_ENTER_MS = 0.24

// How long the whole change takes, for anything that has to hold a state for
// the length of it. The fixed chrome reads it: while a page is being replaced
// there is no settled ground under the bar to take ink from, so it stands on
// its own surface until there is one.
export const PAGE_CHANGE_MS = Math.round((PAGE_EXIT_MS + PAGE_ENTER_MS) * 1000)

export const pageEnter = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: PAGE_EXIT_MS, ease: EASE } },
  transition: { duration: PAGE_ENTER_MS, ease: EASE },
}

// What replaces a placeholder a reader has actually watched. Only opacity
// moves: the screen underneath has already been given its place by the wait, so
// the arrival is the picture resolving rather than anything travelling.
export const settleIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: PAGE_ENTER_MS, ease: EASE },
}

// What a piece of fixed chrome does at either end of its stay. It travels the
// short distance it sits in from its own edge, so it reads as coming in off the
// page rather than resolving in place, and it is over inside the time a page
// change takes: chrome answering a scroll is a smaller event than the page
// underneath it being replaced.
export const CHROME_MS = 0.25

export const chromeTransition = { duration: CHROME_MS, ease: EASE }

export const chromeRise = {
  initial: { opacity: 0, transform: 'translateY(12px)' },
  animate: { opacity: 1, transform: 'translateY(0px)' },
  exit: { opacity: 0, transform: 'translateY(12px)' },
  transition: chromeTransition,
}

export const chromeSlideIn = {
  initial: { opacity: 0, transform: 'translateX(12px)' },
  animate: { opacity: 1, transform: 'translateX(0px)' },
  exit: { opacity: 0, transform: 'translateX(12px)' },
  transition: chromeTransition,
}

// What a placeholder does at either end of a wait. It rises into place and
// leaves without moving, so the movement belongs to the arrival and the exit
// gets out of the way of whatever is replacing it.
export const waitFade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: EASE },
}
