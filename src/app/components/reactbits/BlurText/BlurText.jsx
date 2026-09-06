import { m, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, useMemo } from 'react'
import { EASE, MAX_MS } from '@constants/animations'

// Where a word ends up once it has arrived. Reduced motion starts every word
// here and leaves it there: the blur is the whole of the effect and a filter is
// one of the things MotionConfig cannot still.
const SETTLED = { filter: 'blur(0px)', opacity: 1, y: 0 }

const buildKeyframes = (from, steps) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))])

  const keyframes = {}
  keys.forEach(k => {
    keyframes[k] = [from[k], ...steps.map(s => s[k])]
  })
  return keyframes
}

const BlurText = ({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = EASE,
  onAnimationComplete,
  stepDuration = 0.2,
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('')
  const [inView, setInView] = useState(false)
  const reduced = useReducedMotion()
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(ref.current)
        }
      },
      { threshold, rootMargin }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  const defaultFrom = useMemo(
    () =>
      direction === 'top'
        ? { filter: 'blur(10px)', opacity: 0, y: -50 }
        : { filter: 'blur(10px)', opacity: 0, y: 50 },
    [direction]
  )

  const defaultTo = useMemo(
    () => [
      {
        filter: 'blur(5px)',
        opacity: 0.5,
        y: direction === 'top' ? 5 : -5,
      },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ],
    [direction]
  )

  const fromSnapshot = reduced ? SETTLED : (animationFrom ?? defaultFrom)
  const toSnapshots = reduced ? [SETTLED] : (animationTo ?? defaultTo)

  const stepCount = toSnapshots.length + 1
  // A word is built out of steps, so its length is arithmetic rather than a
  // stated number and the cap has to be applied to what the arithmetic gives.
  const totalDuration = Math.min(stepDuration * (stepCount - 1), MAX_MS)
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1)
  )

  return (
    <span ref={ref} className={`blur-text ${className} inline-flex flex-wrap`}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots)

        const spanTransition = {
          duration: reduced ? 0 : totalDuration,
          times,
          delay: reduced ? 0 : (index * delay) / 1000,
          ease: easing,
        }

        return (
          <m.span
            className="inline-block will-change-[transform,filter,opacity]"
            key={index}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
          >
            {segment === ' ' ? '\u00A0' : segment}
            {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
          </m.span>
        )
      })}
    </span>
  )
}

export default BlurText
