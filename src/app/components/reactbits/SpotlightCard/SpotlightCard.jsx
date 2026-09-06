import { useEffect, useMemo, useRef } from 'react'

const LIT = '0.6'
const DARK = '0'

const SpotlightCard = ({ children, className = '', spotlightColor = 'var(--spotlight)' }) => {
  const divRef = useRef(null)
  const frame = useRef(0)
  const next = useRef({ x: 0, y: 0 })

  // The spotlight's position and strength are written to the card as custom
  // properties and the gradient is built in the stylesheet. Held in state they
  // would re-render the card - and everything inside it - on every frame the
  // pointer crosses it.
  const handlers = useMemo(() => {
    const write = () => {
      frame.current = 0
      const node = divRef.current
      if (!node) return
      node.style.setProperty('--spot-x', `${next.current.x}px`)
      node.style.setProperty('--spot-y', `${next.current.y}px`)
    }

    const lit = on => {
      divRef.current?.style.setProperty('--spot-opacity', on ? LIT : DARK)
    }

    return {
      onMouseMove: e => {
        const node = divRef.current
        if (!node) return
        const rect = node.getBoundingClientRect()
        next.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        if (!frame.current) frame.current = requestAnimationFrame(write)
      },
      onMouseEnter: () => lit(true),
      onMouseLeave: () => lit(false),
      onFocus: () => lit(true),
      onBlur: () => lit(false),
    }
  }, [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return (
    <div
      ref={divRef}
      {...handlers}
      className={`spotlight-card relative overflow-hidden ${className}`}
      style={{ '--spotlight-color': spotlightColor }}
    >
      <span
        className="spotlight-card-glow pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      {children}
    </div>
  )
}

export default SpotlightCard
