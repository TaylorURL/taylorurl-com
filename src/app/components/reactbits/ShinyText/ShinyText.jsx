import { useState, useCallback, useEffect, useRef } from 'react'
import { m, useMotionValue, useTransform, useReducedMotion } from 'framer-motion'

/**
 * A light sweep travelling across a run of text.
 *
 * The sweep is a background position written on every frame, which is a repaint
 * on every frame, and it never ends. So it runs only while a reader could
 * actually be watching it: the tab in front of them, the text inside the
 * viewport, and the preference for motion unset. Off any of those the loop is
 * not merely idled but torn down, and the sweep parks fully clear of the text,
 * which is the text in its own colour.
 */
const ShinyText = ({
  text,
  disabled = false,
  speed = 2,
  className = '',
  color = 'var(--shine-base)',
  shineColor = 'var(--shine-sweep)',
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
}) => {
  const [isPaused, setIsPaused] = useState(false)
  const [watchable, setWatchable] = useState(false)
  const reduced = useReducedMotion()
  const spanRef = useRef(null)
  const progress = useMotionValue(0)
  const elapsedRef = useRef(0)
  const directionRef = useRef(direction === 'left' ? 1 : -1)

  const animationDuration = speed * 1000
  const delayDuration = delay * 1000

  useEffect(() => {
    const el = spanRef.current
    if (!el) return

    let onScreen = false
    const settle = () => setWatchable(onScreen && !document.hidden)

    const observer = new IntersectionObserver(entries => {
      onScreen = entries.some(entry => entry.isIntersecting)
      settle()
    })
    observer.observe(el)
    document.addEventListener('visibilitychange', settle)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', settle)
    }
  }, [])

  useEffect(() => {
    directionRef.current = direction === 'left' ? 1 : -1
    elapsedRef.current = 0
    progress.set(0)
  }, [direction, progress])

  useEffect(() => {
    if (reduced) {
      elapsedRef.current = 0
      progress.set(directionRef.current === 1 ? 0 : 100)
      return
    }
    if (disabled || isPaused || !watchable) return

    let frame = null
    let last = null

    const step = time => {
      if (last !== null) {
        elapsedRef.current += time - last

        if (yoyo) {
          const cycleDuration = animationDuration + delayDuration
          const fullCycle = cycleDuration * 2
          const cycleTime = elapsedRef.current % fullCycle

          if (cycleTime < animationDuration) {
            const p = (cycleTime / animationDuration) * 100
            progress.set(directionRef.current === 1 ? p : 100 - p)
          } else if (cycleTime < cycleDuration) {
            progress.set(directionRef.current === 1 ? 100 : 0)
          } else if (cycleTime < cycleDuration + animationDuration) {
            const reverseTime = cycleTime - cycleDuration
            const p = 100 - (reverseTime / animationDuration) * 100
            progress.set(directionRef.current === 1 ? p : 100 - p)
          } else {
            progress.set(directionRef.current === 1 ? 0 : 100)
          }
        } else {
          const cycleDuration = animationDuration + delayDuration
          const cycleTime = elapsedRef.current % cycleDuration

          if (cycleTime < animationDuration) {
            const p = (cycleTime / animationDuration) * 100
            progress.set(directionRef.current === 1 ? p : 100 - p)
          } else {
            progress.set(directionRef.current === 1 ? 100 : 0)
          }
        }
      }

      last = time
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [reduced, disabled, isPaused, watchable, yoyo, animationDuration, delayDuration, progress])

  // Maps progress onto a sweep that starts and ends fully off the text.
  const backgroundPosition = useTransform(progress, p => `${150 - p * 2}% center`)

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true)
  }, [pauseOnHover])

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false)
  }, [pauseOnHover])

  const gradientStyle = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  }

  return (
    <m.span
      ref={spanRef}
      className={`inline-block ${className}`}
      style={{ ...gradientStyle, backgroundPosition }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </m.span>
  )
}

export default ShinyText
