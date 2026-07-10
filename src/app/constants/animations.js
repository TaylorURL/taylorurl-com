// Shared Framer Motion variants. Curves match the design system (ease-out
// `[0.22, 1, 0.36, 1]`), durations are capped at 0.45s, and inViewport reveals
// fire once. Reduced-motion is honored globally via `<MotionConfig
// reducedMotion="user">` in main.jsx, so variants here intentionally do not
// double-handle the preference.

const EASE = [0.22, 1, 0.36, 1]

export const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-10% 0px' },
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
  viewport: { once: true, margin: '-10% 0px' },
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
