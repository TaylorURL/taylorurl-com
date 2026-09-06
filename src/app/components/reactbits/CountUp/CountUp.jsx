import { useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

/*
 * The count is driven by writing `textContent`, which is something only a
 * browser does. Rendered on the server the span therefore comes back empty, and
 * the figure inside it is missing from the served markup altogether: on /about
 * that left the measured PageSpeed average and the count of client sites live
 * as two blank cells until the bundle booted, and blank for good to a crawler
 * or a reader whose JavaScript never arrives. Two of the four numbers on the
 * page were not being shown at all.
 *
 * So the element is rendered carrying the figure it counts to, and the run up
 * to it is laid over that afterwards. The reset down to the starting figure is
 * a layout effect rather than an ordinary one, which is what keeps it ahead of
 * the paint: an ordinary effect lets the browser draw the target first and the
 * zero after it, and the reader watches the number fall before it climbs.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd,
}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const motionValue = useMotionValue(direction === 'down' ? to : from)

  const damping = 20 + 40 * (1 / duration)
  const stiffness = 100 * (1 / duration)

  const springValue = useSpring(motionValue, {
    damping,
    stiffness,
  })

  const start = direction === 'down' ? to : from
  const target = direction === 'down' ? from : to

  const isInView = useInView(ref, { once: true, margin: '0px 0px 15% 0px' })

  const getDecimalPlaces = num => {
    const str = num.toString()

    if (str.includes('.')) {
      const decimals = str.split('.')[1]

      if (parseInt(decimals) !== 0) {
        return decimals.length
      }
    }

    return 0
  }

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to))

  const formatValue = useCallback(
    latest => {
      const hasDecimals = maxDecimals > 0

      const options = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
      }

      const formattedNumber = Intl.NumberFormat('en-US', options).format(latest)

      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber
    },
    [maxDecimals, separator]
  )

  useIsomorphicLayoutEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(start)
    }
  }, [start, formatValue])

  useEffect(() => {
    if (!isInView || !startWhen) return

    if (typeof onStart === 'function') onStart()

    // The count runs on a spring, and a spring driving text rather than a
    // transform is outside what MotionConfig can still. Asked for less motion,
    // the figure is simply the figure: the number is the point and the run up to
    // it is the flourish.
    if (reduced) {
      if (ref.current) ref.current.textContent = formatValue(target)
      if (typeof onEnd === 'function') onEnd()
      return
    }

    const timeoutId = setTimeout(() => {
      motionValue.set(target)
    }, delay * 1000)

    const durationTimeoutId = setTimeout(
      () => {
        if (typeof onEnd === 'function') onEnd()
      },
      delay * 1000 + duration * 1000
    )

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(durationTimeoutId)
    }
  }, [
    isInView,
    startWhen,
    motionValue,
    target,
    delay,
    onStart,
    onEnd,
    duration,
    reduced,
    formatValue,
  ])

  useEffect(() => {
    const unsubscribe = springValue.on('change', latest => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest)
      }
    })

    return () => unsubscribe()
  }, [springValue, formatValue])

  // The figure is the element's own content, so a page that is only ever read
  // and never run still carries it. Every later render produces the same string,
  // so React never touches the text the count is writing.
  return (
    <span className={className} ref={ref}>
      {formatValue(target)}
    </span>
  )
}
