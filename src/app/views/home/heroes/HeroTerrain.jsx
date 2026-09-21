import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// The mesh: columns across, rows away from the camera. Enough to read as a
// surface, few enough that the device draws every frame inside its budget.
//
// A phone rolls the same ground at a coarser weave. The field is drawn at the
// width of a hand rather than a desktop, so the lines it drops were never far
// apart on that screen, and what it buys is the difference between a frame a
// phone can spend sixty times a second and one it cannot: 792 projected points
// against 2,448, and 748 diagonals against 2,343. The diagonals are the
// expensive half - one path holding a moveTo and a lineTo per cell - and they
// fall by two thirds.
const COLS = 72
const ROWS = 34
const PHONE_COLS = 36
const PHONE_ROWS = 22
// How far the ground rolls on its own, and how hard it lifts under the pointer.
const DRIFT = 0.000025
const LIFT = 0.42
const LIFT_RADIUS = 0.22
// The shortest gap between frames on a phone. A rolling field reads as rolling
// well under the display's own rate, and the drift is slow enough that thirty
// frames a second is indistinguishable from sixty - so half of them are handed
// back to the main thread rather than spent where nobody can see them.
const PHONE_FRAME_MS = 33

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
 * The ground rolls everywhere. What changes with the device is what the roll
 * costs and what else it carries.
 *
 * A phone draws a coarser weave at half the frame rate, and binds no pointer
 * listeners: a finger does not rest on the ground waiting for it to lift, so
 * the lift is the one part of this that a touch screen genuinely has no use
 * for. The roll is not - it is the whole of what the field does while nobody
 * is touching it, which on a phone is all of the time. Drawing the desktop's
 * mesh at the desktop's rate is what a phone cannot afford, rather than the
 * animation itself; at this density a frame is a third of the work and half as
 * many of them are asked for.
 *
 * A single still frame is drawn for one reader only: anyone who asked for less
 * motion. That is a request about motion and it is answered by not moving.
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
    let sized = false
    let torn = false
    // A coarse pointer is a finger, and a finger does not rest on the ground
    // waiting for it to lift - so a phone gets the roll without the lift, at a
    // weave and a frame rate it can carry. Only a reader who asked for less
    // motion gets a field that does not move.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const still = reduced
    const cols = coarse ? PHONE_COLS : COLS
    const rows = coarse ? PHONE_ROWS : ROWS
    const minFrameMs = coarse ? PHONE_FRAME_MS : 0
    // The lift is the only thing the pointer listeners feed, so they are bound
    // only where a pointer can rest on the field to be read.
    const lift = !still && !coarse
    // The lift follows the pointer while it is over the page and fades out
    // where it last stood when the pointer leaves, so it never travels on its
    // own to some resting point.
    const pointer = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, strength: 0, over: false }
    let ink = readInk(host)

    // Sizing the backing store clears whatever was drawn on it, and a still
    // field has no loop behind it to put the picture back. A phone fires a
    // resize every time its address bar slides away, so the frame is drawn
    // again here or the mesh is gone for the rest of the visit - which is why
    // the ground held on a desktop and vanished on the first scroll of a
    // phone. The measurement is compared before anything is written, because
    // the hero stands on `svh` and most of those events leave it exactly where
    // it was; a redraw is a long task on the hardware that sends the most of
    // them, and a store that is already the right size needs neither.
    const resize = () => {
      const rect = host.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const store = { w: Math.round(rect.width * ratio), h: Math.round(rect.height * ratio) }
      if (sized && store.w === canvas.width && store.h === canvas.height) return
      dpr = ratio
      width = rect.width
      height = rect.height
      canvas.width = store.w
      canvas.height = store.h
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ink = readInk(host)
      sized = true
      if (still && started) draw(0)
    }

    // The projected mesh, held flat as x,y pairs and written over in place. The
    // grid is a fixed size, so building it out of fresh arrays each frame only
    // handed the collector ~2,450 of them sixty times a second.
    const points = new Float32Array(rows * cols * 2)

    // Row r sits at depth t in [0,1], 0 nearest. Perspective pulls the far rows
    // together toward a horizon set a little above the vertical centre.
    const project = (col, row, rise, at) => {
      const t = row / (rows - 1)
      const depth = 0.18 + t * 0.82
      const scale = 1 / depth
      const cx = width / 2
      const horizon = height * 0.42
      const base = horizon + ((1 - t) * height * 0.66 * scale) / 4.6
      points[at] = cx + ((col / (cols - 1) - 0.5) * width * 1.9 * scale) / 1.9
      points[at + 1] = base - rise * (0.35 + (1 - t) * 0.65) * height * 0.22 * scale * 0.4
    }

    const draw = time => {
      ctx.clearRect(0, 0, width, height)
      pointer.x += (pointer.tx - pointer.x) * 0.035
      pointer.y += (pointer.ty - pointer.y) * 0.035
      pointer.strength += ((onScreen && pointer.over ? 1 : 0) - pointer.strength) * 0.02

      const shift = time * DRIFT
      for (let r = 0; r < rows; r += 1) {
        const t = r / (rows - 1)
        for (let c = 0; c < cols; c += 1) {
          const u = c / (cols - 1)
          let h = noise(u * 6.5, t * 5 + shift * 6) - 0.5
          // A roll of higher ground across the middle distance, like the frames in the pack.
          h += Math.sin(u * 3.1 + shift * 4) * 0.12 * Math.exp(-((t - 0.45) ** 2) * 14)
          // The pointer lifts the ground under it.
          const dx = u - pointer.x
          const dy = 1 - t - pointer.y
          const d2 = dx * dx + dy * dy * 2.2
          h += LIFT * pointer.strength * Math.exp(-d2 / (LIFT_RADIUS * LIFT_RADIUS))
          project(c, r, h, (r * cols + c) * 2)
        }
      }

      ctx.lineWidth = 1
      ctx.lineJoin = 'round'
      // Far rows fade toward the horizon; near rows carry the full accent.
      for (let r = 0; r < rows; r += 1) {
        const t = r / (rows - 1)
        ctx.globalAlpha = 0.14 + (1 - t) * 0.62
        ctx.strokeStyle = t < 0.3 ? ink.line : ink.bright
        ctx.beginPath()
        for (let c = 0; c < cols; c += 1) {
          const o = (r * cols + c) * 2
          if (c === 0) ctx.moveTo(points[o], points[o + 1])
          else ctx.lineTo(points[o], points[o + 1])
        }
        ctx.stroke()
      }
      for (let c = 0; c < cols; c += 1) {
        ctx.beginPath()
        for (let r = 0; r < rows; r += 1) {
          const o = (r * cols + c) * 2
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
      for (let r = 0; r < rows - 1; r += 1) {
        for (let c = 0; c < cols - 1; c += 1) {
          const near = (r * cols + c) * 2
          const far = ((r + 1) * cols + c + 1) * 2
          ctx.moveTo(points[near], points[near + 1])
          ctx.lineTo(points[far], points[far + 1])
        }
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // The next frame is asked for before this one is drawn, so a skipped frame
    // costs a comparison rather than a gap in the rotation. `time` is the
    // timestamp the browser hands the callback, which is what the drift is read
    // off too, so throttling changes how often the ground is redrawn and never
    // how fast it rolls.
    let drawn = -Infinity
    const loop = time => {
      if (!running) return
      frame = requestAnimationFrame(loop)
      if (time - drawn < minFrameMs) return
      drawn = time
      draw(time)
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
    // The setting changes the accent the mesh is drawn in, and a still field
    // has to be drawn again to take it for the same reason a resized one does.
    const ground = new MutationObserver(() => {
      ink = readInk(host)
      if (still && started) draw(0)
    })

    const begin = () => {
      if (torn) return
      started = true
      resize()
      window.addEventListener('resize', resize)
      if (lift) {
        window.addEventListener('pointermove', onMove, { passive: true })
        document.addEventListener('pointerleave', onLeave)
        document.addEventListener('mouseleave', onLeave)
      }
      document.addEventListener('visibilitychange', onVisibility)
      observer.observe(host)
      ground.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
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
