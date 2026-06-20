import { useEffect, useRef } from 'react'

const DOT_SPACING = 30
const BASE_DOT_RADIUS = 1
const VERTICAL_AMPLITUDE = 14
const HORIZONTAL_AMPLITUDE = 6
const TIME_SCALE = 0.00045
const FIELD_FREQUENCY = 0.008
const EDGE_PADDING = 60
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const parseRgbColor = color => {
  const match = color.match(/rgba?\(([^)]+)\)/)
  if (!match) return [255, 255, 255]
  const parts = match[1].split(',').map(part => parseFloat(part.trim()))
  return [parts[0] | 0, parts[1] | 0, parts[2] | 0]
}

const sampleFlowField = (fx, fy, t) =>
  Math.sin(fx * 1.2 + t * 0.9) +
  Math.sin(fy * 0.9 + t * 1.1) +
  Math.sin((fx + fy) * 0.7 + t * 0.7) +
  Math.sin((fx - fy) * 0.5 + t * 0.55)

export default function TopographicDotField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const start = performance.now()

    let width = 0
    let height = 0
    let dpr = 1
    let resolvedColor = 'rgb(255, 255, 255)'
    let rafId = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      resolvedColor = getComputedStyle(canvas).color || resolvedColor
    }

    const drawFrame = elapsedMs => {
      if (!width || !height) return
      const t = elapsedMs * TIME_SCALE
      const [r, g, b] = parseRgbColor(resolvedColor)

      ctx.clearRect(0, 0, width, height)

      const cols = Math.ceil((width + EDGE_PADDING * 2) / DOT_SPACING)
      const rows = Math.ceil((height + EDGE_PADDING * 2) / DOT_SPACING)
      const offsetX = -EDGE_PADDING + ((width + EDGE_PADDING * 2) - cols * DOT_SPACING) / 2
      const offsetY = -EDGE_PADDING + ((height + EDGE_PADDING * 2) - rows * DOT_SPACING) / 2

      for (let i = 0; i <= cols; i += 1) {
        for (let j = 0; j <= rows; j += 1) {
          const x = offsetX + i * DOT_SPACING
          const y = offsetY + j * DOT_SPACING
          const fx = x * FIELD_FREQUENCY
          const fy = y * FIELD_FREQUENCY

          const wave = sampleFlowField(fx, fy, t) / 4
          const swell = wave * 0.5 + 0.5

          const dx = Math.cos(fx + t * 0.6) * HORIZONTAL_AMPLITUDE * 0.4
          const dy = wave * VERTICAL_AMPLITUDE

          const alpha = 0.18 + swell * 0.42
          const radius = BASE_DOT_RADIUS + swell * 0.9

          ctx.beginPath()
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
          ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const animate = now => {
      drawFrame(now - start)
      rafId = requestAnimationFrame(animate)
    }

    const stopAnimation = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    const startAnimation = () => {
      stopAnimation()
      if (motionQuery.matches) {
        drawFrame(0)
        return
      }
      rafId = requestAnimationFrame(animate)
    }

    resize()
    startAnimation()

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (motionQuery.matches) drawFrame(0)
    })
    resizeObserver.observe(canvas)

    const handleMotionChange = () => startAnimation()
    motionQuery.addEventListener?.('change', handleMotionChange)

    const handleVisibility = () => {
      if (document.hidden) stopAnimation()
      else startAnimation()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      motionQuery.removeEventListener?.('change', handleMotionChange)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-ink"
    />
  )
}
