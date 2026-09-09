import { useRef } from 'react'
import { MAX_MS } from '@constants/animations'

const GlareHover = ({
  width = '500px',
  height = '500px',
  background = 'var(--glare-ground)',
  borderRadius = 'var(--r-feature)',
  borderColor = 'var(--glare-edge)',
  children,
  glareColor = 'var(--shine-sweep)',
  glareOpacity = 0.5,
  glareAngle = -45,
  glareSize = 250,
  transitionDuration = MAX_MS * 1000,
  playOnce = false,
  className = '',
  style = {},
  ...rest
}) => {
  // The opacity is mixed in by CSS rather than read out of a hex here, so the
  // glare takes any colour syntax the caller has - a token included.
  const rgba = `color-mix(in srgb, ${glareColor} ${glareOpacity * 100}%, transparent)`

  const overlayRef = useRef(null)

  // The glare is written to the node as an inline transition, which is past the
  // reach of the stylesheet's reduced-motion rule, so the preference is read
  // here. It is read on the hover rather than held, so a reader changing it
  // mid-visit is answered without a reload.
  const travel = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'none'
      : `${transitionDuration}ms var(--ease-out-soft)`

  const animateIn = () => {
    const el = overlayRef.current
    if (!el) return

    el.style.transition = 'none'
    el.style.backgroundPosition = '-100% -100%, 0 0'
    el.style.transition = travel()
    el.style.backgroundPosition = '100% 100%, 0 0'
  }

  const animateOut = () => {
    const el = overlayRef.current
    if (!el) return

    if (playOnce) {
      el.style.transition = 'none'
      el.style.backgroundPosition = '-100% -100%, 0 0'
    } else {
      el.style.transition = travel()
      el.style.backgroundPosition = '-100% -100%, 0 0'
    }
  }

  const overlayStyle = {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(${glareAngle}deg,
        transparent 60%,
        ${rgba} 70%,
        transparent 100%)`,
    backgroundSize: `${glareSize}% ${glareSize}%, 100% 100%`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: '-100% -100%, 0 0',
    pointerEvents: 'none',
  }

  // The glare is the whole of what this element is for, so it states nothing
  // about how the children under it are laid out or how wide they sit. It used
  // to be a centred grid, which a caller that wanted its own layout could only
  // half undo: overriding the display left `justify-items: center` behind, and
  // that alone is enough to shrink a block-level child to its contents.
  return (
    <div
      {...rest}
      className={`relative cursor-pointer overflow-hidden border ${className}`}
      style={{
        width,
        height,
        background,
        borderRadius,
        borderColor,
        ...style,
      }}
      onMouseEnter={animateIn}
      onMouseLeave={animateOut}
    >
      <div ref={overlayRef} style={overlayStyle} />
      {children}
    </div>
  )
}

export default GlareHover
