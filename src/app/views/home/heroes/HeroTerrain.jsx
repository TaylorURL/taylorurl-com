import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// The mesh: columns across, rows away from the camera. Enough to read as a
// surface, few enough that a phone draws every frame in well under its budget.
const COLS = 72
const ROWS = 34
// How far the ground rolls on its own, and how hard it lifts under the pointer.
const DRIFT = 0.00005
const LIFT = 0.42
const LIFT_RADIUS = 0.22

/** Two-octave value noise over a lattice, smooth enough to read as ground. */
function makeNoise() {
  const size = 256
  const lattice = new Float32Array(size * size)
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = Math.random()
  const at = (x, y) => lattice[((y & (size - 1)) * size + (x & (size - 1))) >>> 0]
  const fade = t => t * t * (3 - 2 * t)
  const sample = (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = fade(x - x0)
    const fy = fade(y - y0)
    const a = at(x0, y0)
    const b = at(x0 + 1, y0)
    const c = at(x0, y0 + 1)
    const d = at(x0 + 1, y0 + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
  return (x, y) => sample(x, y) * 0.68 + sample(x * 2.3 + 17, y * 2.3 + 31) * 0.32
}

/** Reads the accent the section is standing in, so the mesh recolours with the ground. */
function readInk(el) {
  const styles = getComputedStyle(el)
  return {
    line: styles.getPropertyValue('--accent').trim() || '#3d76ff',
    bright: styles.getPropertyValue('--accent-hi').trim() || '#4f86ff',
  }
}

/**
 * A wireframe terrain drawn live behind the hero. The ground rolls toward the
 * reader on its own, lifts where the pointer rests, and is drawn in the site's
 * accent at the device's own pixel density so every line is a line. Anyone
 * who asked for less motion is handed a single still frame.
 */
export default function HeroTerrain() {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const host = canvas.parentElement
    const noise = makeNoise()

    let width = 0
    let height = 0
    let dpr = 1
    let frame = 0
    let running = true
    let onScreen = true
    const pointer = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, strength: 0 }
    let ink = readInk(host)

    const resize = () => {
      const rect = host.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ink = readInk(host)
    }

    // Row r sits at depth t in [0,1], 0 nearest. Perspective pulls the far rows
    // together toward a horizon set a little above the vertical centre.
    const project = (col, row, lift) => {
      const t = row / (ROWS - 1)
      const depth = 0.18 + t * 0.82
      const scale = 1 / depth
      const cx = width / 2
      const horizon = height * 0.42
      const x = cx + ((col / (COLS - 1) - 0.5) * width * 1.9 * scale) / 1.9
      const base = horizon + ((1 - t) * height * 0.66 * scale) / 4.6
      return [x, base - lift * (0.35 + (1 - t) * 0.65) * height * 0.22 * scale * 0.4]
    }

    const draw = time => {
      ctx.clearRect(0, 0, width, height)
      pointer.x += (pointer.tx - pointer.x) * 0.06
      pointer.y += (pointer.ty - pointer.y) * 0.06
      pointer.strength += ((onScreen ? 1 : 0) - pointer.strength) * 0.04

      const shift = time * DRIFT
      const points = new Array(ROWS)
      for (let r = 0; r < ROWS; r += 1) {
        const row = new Array(COLS)
        const t = r / (ROWS - 1)
        for (let c = 0; c < COLS; c += 1) {
          const u = c / (COLS - 1)
          let h = noise(u * 6.5, t * 5 + shift * 6) - 0.5
          // A roll of higher ground across the middle distance, like the frames in the pack.
          h += Math.sin(u * 3.1 + shift * 4) * 0.12 * Math.exp(-((t - 0.45) ** 2) * 14)
          // The pointer lifts the ground under it.
          const dx = u - pointer.x
          const dy = (1 - t) - pointer.y
          const d2 = dx * dx + dy * dy * 2.2
          h += LIFT * pointer.strength * Math.exp(-d2 / (LIFT_RADIUS * LIFT_RADIUS))
          row[c] = project(c, r, h)
        }
        points[r] = row
      }

      ctx.lineWidth = 1
      ctx.lineJoin = 'round'
      // Far rows fade toward the horizon; near rows carry the full accent.
      for (let r = 0; r < ROWS; r += 1) {
        const t = r / (ROWS - 1)
        ctx.globalAlpha = 0.14 + (1 - t) * 0.62
        ctx.strokeStyle = t < 0.3 ? ink.line : ink.bright
        ctx.beginPath()
        for (let c = 0; c < COLS; c += 1) {
          const [x, y] = points[r][c]
          if (c === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      for (let c = 0; c < COLS; c += 1) {
        ctx.beginPath()
        for (let r = 0; r < ROWS; r += 1) {
          const [x, y] = points[r][c]
          if (r === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.globalAlpha = 0.34
        ctx.strokeStyle = ink.line
        ctx.stroke()
      }
      // The diagonals that turn the quads into the triangles of the reference.
      ctx.globalAlpha = 0.16
      ctx.strokeStyle = ink.line
      ctx.beginPath()
      for (let r = 0; r < ROWS - 1; r += 1) {
        for (let c = 0; c < COLS - 1; c += 1) {
          const [x0, y0] = points[r][c]
          const [x1, y1] = points[r + 1][c + 1]
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
        }
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const loop = time => {
      if (!running) return
      draw(time)
      frame = requestAnimationFrame(loop)
    }

    const onMove = event => {
      const rect = host.getBoundingClientRect()
      pointer.tx = (event.clientX - rect.left) / rect.width
      pointer.ty = (event.clientY - rect.top) / rect.height
    }
    const onLeave = () => {
      pointer.tx = 0.5
      pointer.ty = 0.6
    }
    const onVisibility = () => {
      if (document.hidden || !onScreen) {
        cancelAnimationFrame(frame)
        running = false
      } else if (!running && !reduced) {
        running = true
        frame = requestAnimationFrame(loop)
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      onVisibility()
    })
    const ground = new MutationObserver(() => {
      ink = readInk(host)
    })

    resize()
    if (reduced) {
      draw(0)
      running = false
    } else {
      frame = requestAnimationFrame(loop)
    }

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    observer.observe(host)
    ground.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      observer.disconnect()
      ground.disconnect()
    }
  }, [reduced])

  return <canvas ref={canvasRef} aria-hidden="true" />
}
