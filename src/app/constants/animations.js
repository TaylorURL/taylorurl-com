// Common animation variants for framer-motion
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

export const fadeInUpLarge = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

export const slideInLeft = {
  initial: { opacity: 0, x: -30 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
}

export const slideInRight = {
  initial: { opacity: 0, x: 30 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
}

export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },
}

export const staggerChild = (index, delay = 0.1) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { delay: index * delay, duration: 0.5 },
})

// Mount-based variants (for above-the-fold / page-load content)
export const fadeInUpMount = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export const slideInLeftMount = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
}

export const slideInRightMount = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
}

export const staggerChildMount = (index, delay = 0.1) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: index * delay, duration: 0.5 },
})
