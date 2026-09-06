import { useEffect, useRef } from 'react'

const SETTLED = 'translate3d(0px, 0px, 0)'

const Magnet = ({
  children,
  padding = 100,
  disabled = false,
  magnetStrength = 2,
  wrapperClassName = '',
  innerClassName = '',
  ...props
}) => {
  const magnetRef = useRef(null)
  const innerRef = useRef(null)

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return

    const settle = () => {
      inner.style.transform = SETTLED
      inner.style.transitionTimingFunction = 'var(--ease-in-out-soft)'
    }

    // Following the pointer needs a pointer to follow: on touch there is none,
    // and under a reduced-motion setting the offset is not wanted.
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (disabled || !fine.matches || still.matches) {
      settle()
      return
    }

    let frame = 0
    let next = null

    // The offset is written to the node rather than held in state: it changes
    // with every frame the pointer moves, and state would re-render the whole
    // subtree that often.
    const apply = () => {
      frame = 0
      inner.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
      inner.style.transitionTimingFunction = next.active
        ? 'var(--ease-out-soft)'
        : 'var(--ease-in-out-soft)'
    }

    const handleMouseMove = e => {
      const node = magnetRef.current
      if (!node) return

      const { left, top, width, height } = node.getBoundingClientRect()
      const centerX = left + width / 2
      const centerY = top + height / 2
      const inRange =
        Math.abs(centerX - e.clientX) < width / 2 + padding &&
        Math.abs(centerY - e.clientY) < height / 2 + padding

      next = inRange
        ? {
            x: (e.clientX - centerX) / magnetStrength,
            y: (e.clientY - centerY) / magnetStrength,
            active: true,
          }
        : { x: 0, y: 0, active: false }

      if (!frame) frame = requestAnimationFrame(apply)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (frame) cancelAnimationFrame(frame)
      settle()
    }
  }, [padding, disabled, magnetStrength])

  return (
    <div
      ref={magnetRef}
      className={wrapperClassName}
      style={{ position: 'relative', display: 'inline-block' }}
      {...props}
    >
      <div
        ref={innerRef}
        className={`transition-transform duration-300 ${innerClassName}`}
        style={{
          transform: SETTLED,
          transitionTimingFunction: 'var(--ease-in-out-soft)',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default Magnet
