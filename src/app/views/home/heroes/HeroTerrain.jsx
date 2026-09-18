import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// The mesh: columns across, rows away from the camera. Enough to read as a
// surface, few enough that a phone draws every frame in well under its budget.
const COLS = 72
const ROWS = 34
// How far the ground rolls on its own, and how hard it lifts under the pointer.
const DRIFT = 0.000025
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
 * accent at the device's own pixel density so every line is a line.
 *
 * A single still frame is drawn instead of the rotation in two cases: for
 * anyone who asked for less motion, and on a device whose pointer is coarse.
 * The rolling exists to be lifted under a pointer that rests on it, and a
 * touch screen has no pointer resting anywhere, so on a phone the loop draws
 * the same field over and over for an interaction that cannot happen - on the
 * hardware that can least afford it. A frame of this mesh is ~2,400 projected
 * points and ~2,450 stroked segments, which is a long task at every repaint
 * under a phone's CPU, and a loop of long tasks never lets the main thread go
 * quiet. The page stays interactive-in-name-only for as long as the hero is on
 * screen, and every one of those frames is charged as blocking time.
 *
 * The drawing also waits for the document rather than racing it. Nothing reads
 * this canvas - it is decoration, and aria-hidden - so there is no reason for
 * it to hold the main thread while the page it sits behind is still being
 * adopted.
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
    let idle = 0
    let running = true
    let onScreen = true
    let started = false
    let torn = false
    // A coarse pointer is a finger, and a finger does not rest on the ground
    // waiting for it to lift. The rotation is drawn for an interaction that
    // cannot be had there, so the field is drawn once and left alone.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const still = reduced || coarse
    // The lift follows the pointer while it is over the page and fades out
    // where it last stood when the pointer leaves, so it never travels on its
    // own to some resting point.
    const pointer = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, strength: 0, over: false }
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

    // The projected mesh, held flat as x,y pairs and written over in place. The
    // grid is a fixed size, so building it out of fresh arrays each frame only
    // handed the collector ~2,450 of them sixty times a second.
    const points = new Float32Array(ROWS * COLS * 2)

    // Row r sits at depth t in [0,1], 0 nearest. Perspective pulls the far rows
    // together toward a horizon set a little above the vertical centre.
    const project = (col, row, lift, at) => {
      const t = row / (ROWS - 1)
      const depth = 0.18 + t * 0.82
      const scale = 1 / depth
      const cx = width / 2
      const horizon = height * 0.42
      const base = horizon + ((1 - t) * height * 0.66 * scale) / 4.6
      points[at] = cx + ((col / (COLS - 1) - 0.5) * width * 1.9 * scale) / 1.9
      points[at + 1] = base - lift * (0.35 + (1 - t) * 0.65) * height * 0.22 * scale * 0.4
    }

    const draw = time => {
      ctx.clearRect(0, 0, width, height)
      pointer.x += (pointer.tx - pointer.x) * 0.035
      pointer.y += (pointer.ty - pointer.y) * 0.035
      pointer.strength += ((onScreen && pointer.over ? 1 : 0) - pointer.strength) * 0.02

      const shift = time * DRIFT
      for (let r = 0; r < ROWS; r += 1) {
        const t = r / (ROWS - 1)
        for (let c = 0; c < COLS; c += 1) {
          const u = c / (COLS - 1)
          let h = noise(u * 6.5, t * 5 + shift * 6) - 0.5
          // A roll of higher ground across the middle distance, like the frames in the pack.
          h += Math.sin(u * 3.1 + shift * 4) * 0.12 * Math.exp(-((t - 0.45) ** 2) * 14)
          // The pointer lifts the ground under it.
          const dx = u - pointer.x
          const dy = 1 - t - pointer.y
          const d2 = dx * dx + dy * dy * 2.2
          h += LIFT * pointer.strength * Math.exp(-d2 / (LIFT_RADIUS * LIFT_RADIUS))
          project(c, r, h, (r * COLS + c) * 2)
        }
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
          const o = (r * COLS + c) * 2
          if (c === 0) ctx.moveTo(points[o], points[o + 1])
          else ctx.lineTo(points[o], points[o + 1])
        }
        ctx.stroke()
      }
      for (let c = 0; c < COLS; c += 1) {
        ctx.beginPath()
        for (let r = 0; r < ROWS; r += 1) {
          const o = (r * COLS + c) * 2
          if (r === 0) ctx.moveTo(points[o], points[o + 1])
          else ctx.lineTo(points[o], points[o + 1])
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
          const near = (r * COLS + c) * 2
          const far = ((r + 1) * COLS + c + 1) * 2
          ctx.moveTo(points[near], points[near + 1])
          ctx.lineTo(points[far], points[far + 1])
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
      if (!pointer.over) {
        pointer.x = pointer.tx
        pointer.y = pointer.ty
        pointer.over = true
      }
    }
    const onLeave = () => {
      pointer.over = false
    }
    const onVisibility = () => {
      if (document.hidden || !onScreen) {
        cancelAnimationFrame(frame)
        running = false
      } else if (!running && !still && started) {
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

    const begin = () => {
      if (torn) return
      started = true
      resize()
      window.addEventListener('resize', resize)
      // The lift is the only thing the pointer listeners feed, and a still
      // field has nothing for them to move, so they are not bound at all there.
      if (!still) {
        window.addEventListener('pointermove', onMove, { passive: true })
        document.addEventListener('pointerleave', onLeave)
        document.addEventListener('mouseleave', onLeave)
      }
      document.addEventListener('visibilitychange', onVisibility)
      observer.observe(host)
      ground.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      if (still) {
        draw(0)
        running = false
      } else {
        frame = requestAnimationFrame(loop)
      }
    }

    // The page first, then the decoration. Whichever of the two the browser
    // offers, both put the first frame after the document has finished loading
    // and the main thread has a moment spare; the timeout is the ceiling on how
    // long the field waits when the thread never goes quiet on its own.
    // Called back through `window` rather than off a held reference, because a
    // browser method pulled off it and called bare is an illegal invocation.
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const soon = () => {
      if (torn) return
      idle = hasIdle
        ? window.requestIdleCallback(begin, { timeout: 1200 })
        : window.setTimeout(begin, 120)
    }
    if (document.readyState === 'complete') soon()
    else window.addEventListener('load', soon, { once: true })

    return () => {
      torn = true
      running = false
      cancelAnimationFrame(frame)
      if (idle) {
        if (hasIdle) window.cancelIdleCallback(idle)
        else window.clearTimeout(idle)
      }
      window.removeEventListener('load', soon)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      observer.disconnect()
      ground.disconnect()
    }
  }, [reduced])

  return <canvas ref={canvasRef} aria-hidden="true" />
}
