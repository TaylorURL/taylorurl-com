import { motion, useReducedMotion } from 'framer-motion'

/*
 * Refined, self-contained artwork for the /spigot page. Everything is inline
 * SVG so it renders at prerender time with no external fetches. The Minecraft
 * cue is kept deliberately subtle: a single small isometric plinth carrying
 * three brand-coloured cubes — blue (TaylorURL), green (Minecraft), orange
 * (Spigot) — rather than a busy voxel scene.
 */

// Dimetric (2:1) projection. Top face is a diamond of half-width A / half-height
// A/2; side faces are H tall.
const A = 32
const H = 27

/** Project a grid cell to the centre of its top face within the given origin. */
function project(gx, gy, gz, ox, oy) {
  return { cx: ox + (gx - gy) * A, cy: oy + (gx + gy) * (A / 2) - gz * H }
}

// Three-tone palettes per block. `hi` is the lit front-top edge.
const BLOCKS = {
  stone: { top: '#283039', left: '#171d25', right: '#0f141a', hi: '#3a4552' },
  blue: { top: '#5b86ff', left: '#2f6bff', right: '#1c47c0', hi: '#93b0ff' },
  green: { top: '#5cc064', left: '#46b24e', right: '#2c8637', hi: '#8ddb92' },
  orange: { top: '#ffab52', left: '#f0851f', right: '#bd5f0b', hi: '#ffca8c' },
}

const EDGE = 'rgba(3, 6, 10, 0.4)'

/** One isometric cube: back faces first so the top lands on top. */
function Cube({ gx, gy, gz, type, ox, oy }) {
  const { cx, cy } = project(gx, gy, gz, ox, oy)
  const b = BLOCKS[type]
  const top = `${cx},${cy - A / 2} ${cx + A},${cy} ${cx},${cy + A / 2} ${cx - A},${cy}`
  const left = `${cx - A},${cy} ${cx},${cy + A / 2} ${cx},${cy + A / 2 + H} ${cx - A},${cy + H}`
  const right = `${cx},${cy + A / 2} ${cx + A},${cy} ${cx + A},${cy + H} ${cx},${cy + A / 2 + H}`
  return (
    <g>
      <polygon points={left} fill={b.left} stroke={EDGE} strokeWidth="1" strokeLinejoin="round" />
      <polygon points={right} fill={b.right} stroke={EDGE} strokeWidth="1" strokeLinejoin="round" />
      <polygon points={top} fill={b.top} stroke={EDGE} strokeWidth="1" strokeLinejoin="round" />
      <polyline
        points={`${cx - A},${cy} ${cx},${cy + A / 2} ${cx + A},${cy}`}
        fill="none"
        stroke={b.hi}
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </g>
  )
}

// A neat 2x2 stone plinth (two layers) with three brand cubes on top and one
// open cell, so the composition breathes. Depth-sorted back-to-front.
const OX = 200
const OY = 150

const PLINTH = [
  { gx: 0, gy: 0, gz: 0, type: 'stone' },
  { gx: 1, gy: 0, gz: 0, type: 'stone' },
  { gx: 0, gy: 1, gz: 0, type: 'stone' },
  { gx: 1, gy: 1, gz: 0, type: 'stone' },
  { gx: 0, gy: 0, gz: -1, type: 'stone' },
  { gx: 1, gy: 0, gz: -1, type: 'stone' },
  { gx: 0, gy: 1, gz: -1, type: 'stone' },
  { gx: 1, gy: 1, gz: -1, type: 'stone' },
]

// Each colored cube floats on its own gentle rhythm.
const CUBES = [
  { gx: 0, gy: 0, type: 'blue', delay: 0 },
  { gx: 1, gy: 0, type: 'green', delay: 0.5 },
  { gx: 0, gy: 1, type: 'orange', delay: 1 },
]

/**
 * The hero showpiece: a small, premium isometric plinth carrying the three
 * brand cubes, each haloed in its own colour, over a soft tri-colour glow.
 * Honors reduced motion (the scene sits still).
 */
export function BlockMotif({ className = '' }) {
  const reduced = useReducedMotion()
  return (
    <svg
      viewBox="0 0 400 380"
      className={className}
      role="img"
      aria-label="Three isometric blocks — blue, green and orange — resting on a stone plinth, representing TaylorURL, Minecraft and Spigot."
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="halo-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2f6bff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2f6bff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="halo-green" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#46b24e" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#46b24e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="halo-orange" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f0851f" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f0851f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tri-beam" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#2f6bff" />
          <stop offset="52%" stopColor="#46b24e" />
          <stop offset="100%" stopColor="#f0851f" />
        </linearGradient>
      </defs>

      {/* Ambient tri glow */}
      <ellipse cx="200" cy="150" rx="180" ry="120" fill="url(#halo-blue)" opacity="0.5" />
      <ellipse cx="250" cy="170" rx="150" ry="110" fill="url(#halo-orange)" opacity="0.5" />

      {/* Ground shadow */}
      <ellipse cx={OX} cy="300" rx="120" ry="26" fill="rgba(0,0,0,0.4)" />

      {/* Plinth */}
      {PLINTH.map(block => (
        <Cube key={`p-${block.gx}-${block.gy}-${block.gz}`} {...block} ox={OX} oy={OY} />
      ))}

      {/* Floating brand cubes, each with a colour halo */}
      {CUBES.map(c => {
        const rest = project(c.gx, c.gy, 1.15, OX, OY)
        return (
          <motion.g
            key={c.type}
            animate={reduced ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: c.delay }}
          >
            <circle cx={rest.cx} cy={rest.cy + 4} r="46" fill={`url(#halo-${c.type})`} />
            <Cube gx={c.gx} gy={c.gy} gz={1.15} type={c.type} ox={OX} oy={OY} />
          </motion.g>
        )
      })}
    </svg>
  )
}

/**
 * The recurring tri-colour eyebrow marker — three small squares in the brand
 * order (blue, green, orange). Replaces the site's single accent tick on this
 * page so the spectrum reads on every section label.
 */
export function TriTick({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
      <span className="h-2 w-2 rounded-[1px]" style={{ backgroundColor: 'var(--c-blue)' }} />
      <span className="h-2 w-2 rounded-[1px]" style={{ backgroundColor: 'var(--c-green)' }} />
      <span className="h-2 w-2 rounded-[1px]" style={{ backgroundColor: 'var(--c-orange)' }} />
    </span>
  )
}
