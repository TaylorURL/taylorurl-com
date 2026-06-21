import { motion, useReducedMotion } from 'framer-motion'
import {
  BAY_FILL,
  BAYTOWN,
  BBOX,
  COASTLINE,
  PIXELS_PER_MILE,
  ROADS,
  TOWNS,
  VIEWBOX_HEIGHT,
  project,
} from './baytownMapData'

/**
 * Geographically accurate, to-scale map of the Baytown / Galveston Bay /
 * Houston corridor, drawn in the site's engineering-blueprint vocabulary
 * (hairline strokes, accent ink, mono labels, paper feel). Every spatial
 * element comes from real coordinates projected through a single Web Mercator
 * transform (see `baytownMapData.js`): the bay outline is OpenStreetMap
 * coastline, the highways are real I-10 / I-610 / Beltway 8 / SH-146 / SH-225
 * alignments, and the towns sit at their true lat/lng — so relative distances
 * and bearings are correct (downtown Houston ~24 mi west of Baytown, Mont
 * Belvieu to the NE, the ship-channel towns to the south).
 *
 * On first paint the map runs a one-off cinematic intro: the bay coastline and
 * highways draw themselves in via stroke-dasharray, the town markers drop in,
 * and only then do the ambient loops (cars on I-10, boats on the bay, drifting
 * clouds) take over. Respects `prefers-reduced-motion` — those users see the
 * final state immediately. Theme follows the parent `.hero-surface`.
 */

// Color tokens — channeled through CSS variables so light/dark mode tracks the
// hero-surface theme. Safari only resolves var() inside `style`, not SVG
// presentation attributes, so every colored fill/stroke goes through `style`.
const HAIR = 'var(--hair)'
const HAIR_STRONG = 'var(--hair-strong)'
const INK_FAINT = 'var(--ink-faint)'
const INK_MUTE = 'var(--ink-mute)'
const INK_SOFT = 'var(--ink-soft)'
const INK = 'var(--ink)'
const ACCENT = 'var(--accent)'
const ACCENT_HI = 'var(--accent-hi)'
const ROAD_SHADOW = 'var(--map-road-shadow)'
const PAPER_FILL = 'var(--map-paper-fill)'
const GLOW = 'var(--map-glow)'

const EASE_DRIFT = [0.45, 0, 0.55, 1]
const EASE_DRAW = [0.65, 0, 0.35, 1]
const EASE_REVEAL = [0.22, 1, 0.36, 1]

// Intro timing — coordinated with HeroSection. Bump HERO_INTRO_END_S together
// with this file when retuning the cadence. The Baytown "you are here" pin is
// the last intro element to land: PIN_DELAY (1.85) + 0.2 stagger + PIN_DUR +
// 0.15 settle ≈ 2.65s, then HERO_INTRO_END_S adds a deliberate beat before the
// hero content reveals so the map visibly completes first.
const COASTLINE_DELAY = 0
const COASTLINE_DUR = 1.5
const ROAD_DELAY = 0.55
const ROAD_DUR = 1.45
const DETAIL_DELAY = 1.55
const DETAIL_DUR = 0.55
const PIN_DELAY = 1.85
const PIN_DUR = 0.45
const VEHICLE_DELAY = 2.15

export const HERO_INTRO_END_S = 3.2

const VIEWBOX = `0 0 1200 ${VIEWBOX_HEIGHT}`

// Projected anchor points (all flow through the single `project()` transform).
const BAYTOWN_PT = project(BAYTOWN.lng, BAYTOWN.lat)
const TOWN_PTS = TOWNS.map(town => ({ ...town, ...project(town.lng, town.lat) }))

// Longest chain of each driveable route — used as the motion path for cars.
const I10_DRIVE = ROADS.i10[0]
const TX146_DRIVE = ROADS.tx146[0]

// Highway shields, anchored at real points that sit on each route.
const SHIELDS = [
  { label: 'I-10', wide: false, strong: true, ...project(-95.04, 29.781) },
  { label: '146', wide: false, strong: false, ...project(-94.935, 29.64) },
  { label: '225', wide: false, strong: false, ...project(-95.19, 29.726) },
  { label: 'BW 8', wide: true, strong: false, ...project(-95.165, 29.86) },
  { label: '610', wide: false, strong: false, ...project(-95.265, 29.74) },
  { label: '99', wide: false, strong: false, ...project(-94.835, 29.78) },
  { label: '330', wide: false, strong: false, ...project(-94.952, 29.77) },
]

// Graticule: faint horizontal/vertical lines at 0.1° lat/lng intervals across
// the sheet — blueprint texture rather than a real lat/lng overlay.
const GRATICULE_LATS = (() => {
  const lines = []
  const start = Math.ceil(BBOX.south * 10) / 10
  for (let lat = start; lat <= BBOX.north; lat = +(lat + 0.1).toFixed(2)) {
    lines.push(project(BBOX.west, lat).y)
  }
  return lines
})()
const GRATICULE_LNGS = (() => {
  const lines = []
  const start = Math.ceil(BBOX.west * 10) / 10
  for (let lng = start; lng <= BBOX.east; lng = +(lng + 0.1).toFixed(2)) {
    lines.push(project(lng, BBOX.south).x)
  }
  return lines
})()

// Houston downtown skyline glyph, drawn relative to Houston's projected point.
const HOUSTON_PT = project(-95.3698, 29.7604)
const SKYLINE = [
  { dx: -22, top: -18, w: 5, h: 18 },
  { dx: -15, top: -26, w: 6, h: 26 },
  { dx: -7, top: -34, w: 7, h: 34 },
  { dx: 2, top: -42, w: 7, h: 42, ant: true },
  { dx: 11, top: -30, w: 7, h: 30 },
  { dx: 20, top: -22, w: 6, h: 22 },
]

// Two boats drifting on the bay — routes are real bay-interior coordinates.
const buildPath = coords =>
  coords
    .map(([lng, lat], i) => {
      const p = project(lng, lat)
      return `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    })
    .join(' ')

const BOAT_ROUTES = [
  {
    d: buildPath([
      [-94.94, 29.61],
      [-94.84, 29.52],
      [-94.74, 29.45],
    ]),
    duration: 54,
    delay: 2,
  },
  {
    d: buildPath([
      [-94.62, 29.56],
      [-94.74, 29.6],
      [-94.86, 29.55],
    ]),
    duration: 66,
    delay: 16,
  },
]

// Truthful scale bar: a real 10-mile span in projected pixels.
const SCALE_MILES = 10
const SCALE_PX = SCALE_MILES * PIXELS_PER_MILE

const CLOUDS = [
  { y: 70, scale: 1.0, delay: 0, duration: 60 },
  { y: 150, scale: 0.72, delay: 22, duration: 78 },
  { y: 36, scale: 0.55, delay: 44, duration: 92 },
  { y: 110, scale: 0.84, delay: 12, duration: 70 },
]

export default function BaytownMap() {
  const reduced = useReducedMotion()

  // Stroke-draw intro for roads / coastline. With `pathLength=1` the dash math
  // is normalized regardless of the path's real length.
  const drawIntro = (delay, duration) =>
    reduced
      ? { initial: false, animate: { strokeDashoffset: 0 } }
      : {
          initial: { strokeDashoffset: 1 },
          animate: { strokeDashoffset: 0 },
          transition: { duration, delay, ease: EASE_DRAW },
        }

  const fadeIntro = (delay, duration = 0.55) =>
    reduced
      ? { initial: false, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration, delay, ease: EASE_REVEAL },
        }

  const dropIntro = (delay, duration = 0.5) =>
    reduced
      ? { initial: false, animate: { opacity: 1, y: 0, scale: 1 } }
      : {
          initial: { opacity: 0, y: -6, scale: 0.6 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration, delay, ease: EASE_REVEAL },
        }

  // Shared stroke-draw props for an array of route polylines.
  const drawPaths = (paths, delay, duration, props) =>
    paths.map((d, i) => (
      <motion.path
        key={i}
        d={d}
        pathLength={1}
        strokeDasharray={1}
        {...props}
        {...drawIntro(delay + i * 0.05, duration)}
      />
    ))

  // Ambient breathing/parallax wrapper for the geographic layer — keeps the
  // map subtly alive after the intro settles. Chrome (compass, scale, frame
  // labels) sits OUTSIDE this group so it stays rock-steady. Reduced motion
  // gets the static end-state.
  const ambientMotion = reduced
    ? { initial: false, animate: { scale: 1, x: 0, y: 0 } }
    : {
        initial: { scale: 1, x: 0, y: 0 },
        animate: {
          scale: [1, 1.012, 1.006, 1],
          x: [0, 4, -3, 0],
          y: [0, -3, 2, 0],
        },
        transition: {
          duration: 26,
          delay: VEHICLE_DELAY,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Slight negative inset + oversized SVG gives us overscan headroom
          beyond `slice` cover behavior — the map always bleeds past every
          edge on both desktop and mobile aspect ratios. */}
      <svg
        viewBox={VIEWBOX}
        preserveAspectRatio="xMidYMid slice"
        className="absolute -inset-[5%] h-[110%] w-[110%] opacity-[0.86]"
      >
        <defs>
          <linearGradient id="bay-fill" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.32" />
            <stop offset="55%" stopColor={ACCENT} stopOpacity="0.17" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.07" />
          </linearGradient>

          <linearGradient id="bay-sheen" x1="0" y1="0" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="vignette-mask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="42%" stopColor="#000" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
          </linearGradient>

          <radialGradient id="downtown-fade" cx="0.5" cy="0.55" r="0.6">
            <stop offset="0%" stopColor={ACCENT_HI} stopOpacity="0.2" />
            <stop offset="80%" stopColor={ACCENT_HI} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="pin-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.65" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>

          <pattern
            id="wave-pattern"
            x="0"
            y="0"
            width="44"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 8 Q 11 2 22 8 T 44 8"
              fill="none"
              style={{ stroke: ACCENT_HI, strokeOpacity: 0.5 }}
              strokeWidth="1"
            />
          </pattern>

          <pattern
            id="grain-pattern"
            x="0"
            y="0"
            width="240"
            height="240"
            patternUnits="userSpaceOnUse"
          >
            {/* Sparse seeded speckle — paper grain without an SVG filter. */}
            {Array.from({ length: 36 }).map((_, i) => {
              const r = (i * 9301 + 49297) % 233280
              const x = (r % 240).toFixed(1)
              const y = (Math.floor(r / 240) % 240).toFixed(1)
              return (
                <circle
                  key={`gr-${i}`}
                  cx={x}
                  cy={y}
                  r="0.5"
                  style={{ fill: INK_FAINT, fillOpacity: 0.4 }}
                />
              )
            })}
          </pattern>

          <symbol id="cloud" viewBox="0 0 80 24" overflow="visible">
            <path
              d="M 4 18 Q 4 8 16 8 Q 18 0 30 4 Q 38 -2 48 4 Q 60 0 64 10 Q 76 10 76 18 Z"
              fill="none"
              style={{ stroke: INK_FAINT }}
              strokeWidth="0.9"
            />
            <path
              d="M 12 18 Q 16 14 22 16 Q 30 12 36 16"
              fill="none"
              style={{ stroke: INK_FAINT, strokeOpacity: 0.5 }}
              strokeWidth="0.6"
            />
          </symbol>

          <symbol id="boat" viewBox="-14 -14 28 28" overflow="visible">
            <path
              d="M -14 6 Q -10 9 -4 7 Q 0 6 4 7 Q 10 9 14 6"
              fill="none"
              style={{ stroke: ACCENT_HI, strokeOpacity: 0.35 }}
              strokeWidth="0.5"
              strokeLinecap="round"
            />
            <path
              d="M -8 4 L 8 4 L 6 8 L -6 8 Z"
              style={{ fill: INK_SOFT, stroke: ACCENT_HI }}
              strokeWidth="0.7"
            />
            <line
              x1="0"
              y1="4"
              x2="0"
              y2="-8"
              style={{ stroke: ACCENT_HI }}
              strokeWidth="0.9"
            />
            <path d="M 0 -8 L 5.5 1 L 0 1 Z" style={{ fill: ACCENT_HI }} />
            <path
              d="M 0 -6 L -4.5 1 L 0 1 Z"
              style={{ fill: ACCENT, fillOpacity: 0.78 }}
            />
          </symbol>

          <symbol id="car-east" viewBox="-7 -3 14 6" overflow="visible">
            <rect x="-6.2" y="-2" width="12.4" height="4" rx="1.2" style={{ fill: ACCENT }} />
            <rect
              x="-2.5"
              y="-1.6"
              width="5"
              height="2.4"
              rx="0.5"
              fill="#dfe9ff"
              fillOpacity="0.92"
            />
            <rect x="5.6" y="-1.2" width="0.8" height="2.4" style={{ fill: '#fffaa8' }} />
          </symbol>

          <symbol id="car-west" viewBox="-7 -3 14 6" overflow="visible">
            <rect x="-6.2" y="-2" width="12.4" height="4" rx="1.2" style={{ fill: ACCENT_HI }} />
            <rect
              x="-2.5"
              y="-1.6"
              width="5"
              height="2.4"
              rx="0.5"
              fill="#dfe9ff"
              fillOpacity="0.92"
            />
            <rect x="-6.4" y="-1.2" width="0.8" height="2.4" style={{ fill: '#ffd2a8' }} />
          </symbol>

          <mask id="bay-clip">
            <rect width="1200" height={VIEWBOX_HEIGHT} fill="black" />
            <path d={BAY_FILL} fill="white" />
          </mask>
        </defs>

        {/* PAPER GRAIN — sub-pixel speckle for tactile depth. */}
        <rect
          x="0"
          y="0"
          width="1200"
          height={VIEWBOX_HEIGHT}
          fill="url(#grain-pattern)"
          opacity="0.4"
        />

        {/* WATER — Galveston + Trinity Bay fill, wave texture, light sheen. */}
        <motion.g {...fadeIntro(0, 0.7)}>
          <path d={BAY_FILL} fill="url(#bay-fill)" />
          <rect
            x="0"
            y="0"
            width="1200"
            height={VIEWBOX_HEIGHT}
            fill="url(#wave-pattern)"
            mask="url(#bay-clip)"
          />
          <path d={BAY_FILL} fill="url(#bay-sheen)" />
        </motion.g>

        {/* COASTLINE — the real shoreline, drawing itself in first. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d={COASTLINE.main}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.72 }}
            strokeWidth="1.8"
            {...drawIntro(COASTLINE_DELAY, COASTLINE_DUR)}
          />
          <motion.path
            d={COASTLINE.bolivar}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.6 }}
            strokeWidth="1.4"
            {...drawIntro(COASTLINE_DELAY + 0.25, COASTLINE_DUR)}
          />
          <motion.path
            d={COASTLINE.galveston}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.5 }}
            strokeWidth="1.2"
            {...drawIntro(COASTLINE_DELAY + 0.45, COASTLINE_DUR)}
          />
        </g>

        {/* SHIP CHANNEL — the dredged shipping lane crossing the bay toward
            the Houston turning basin, as a dashed accent water route. */}
        <motion.g fill="none" strokeLinecap="round" {...fadeIntro(COASTLINE_DELAY + 0.7, 0.9)}>
          {ROADS.ship.map((d, i) => (
            <path
              key={i}
              d={d}
              style={{ stroke: ACCENT_HI, strokeOpacity: 0.55 }}
              strokeWidth="1.4"
              strokeDasharray="2 4"
            />
          ))}
        </motion.g>

        {/* DOWNTOWN HALO — soft accent puddle behind the Houston skyline. */}
        <motion.ellipse
          cx={HOUSTON_PT.x}
          cy={HOUSTON_PT.y - 6}
          rx="150"
          ry="96"
          fill="url(#downtown-fade)"
          {...fadeIntro(DETAIL_DELAY + 0.1, 0.9)}
        />

        {/* ROUTE GLOW — accent bloom under the primary corridors. */}
        <motion.g
          fill="none"
          strokeLinecap="round"
          style={{ filter: 'blur(7px)' }}
          {...fadeIntro(ROAD_DELAY + 0.15, 0.9)}
        >
          {I10_DRIVE && <path d={I10_DRIVE} style={{ stroke: GLOW }} strokeWidth="9" />}
          {TX146_DRIVE && (
            <path d={TX146_DRIVE} style={{ stroke: GLOW, strokeOpacity: 0.85 }} strokeWidth="7" />
          )}
        </motion.g>

        {/* ROAD SHADOWS — faint wider stroke under the lines for depth. */}
        <motion.g fill="none" strokeLinecap="round" {...fadeIntro(ROAD_DELAY, 0.8)}>
          {ROADS.i10.map((d, i) => (
            <path key={`s10-${i}`} d={d} style={{ stroke: ROAD_SHADOW }} strokeWidth="6.5" />
          ))}
          {ROADS.tx146.map((d, i) => (
            <path
              key={`s146-${i}`}
              d={d}
              style={{ stroke: ROAD_SHADOW, strokeOpacity: 0.9 }}
              strokeWidth="5.5"
            />
          ))}
        </motion.g>

        {/* SECONDARY ROADS — Beltway 8 and the I-610 inner loop. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {drawPaths(ROADS.bw8, ROAD_DELAY + 0.35, ROAD_DUR - 0.15, {
            style: { stroke: INK_FAINT },
            strokeWidth: 1.6,
          })}
          {drawPaths(ROADS.i610, ROAD_DELAY + 0.45, ROAD_DUR - 0.2, {
            style: { stroke: INK_FAINT, strokeOpacity: 0.85 },
            strokeWidth: 1.4,
          })}
        </g>

        {/* PRIMARY ROADS — I-10, SH-146, SH-225. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {drawPaths(ROADS.i10, ROAD_DELAY, ROAD_DUR, {
            style: { stroke: INK_SOFT },
            strokeWidth: 3.4,
          })}
          {drawPaths(ROADS.tx146, ROAD_DELAY + 0.1, ROAD_DUR, {
            style: { stroke: INK_MUTE },
            strokeWidth: 2.6,
          })}
          {drawPaths(ROADS.tx225, ROAD_DELAY + 0.2, ROAD_DUR - 0.15, {
            style: { stroke: INK_MUTE },
            strokeWidth: 2.0,
          })}
        </g>

        {/* I-10 LANE DASHES — slow crawl east to suggest flowing traffic. */}
        {I10_DRIVE && (
          <motion.path
            d={I10_DRIVE}
            fill="none"
            strokeLinecap="round"
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.7 }}
            strokeWidth="0.9"
            strokeDasharray="8 12"
            initial={false}
            animate={reduced ? undefined : { strokeDashoffset: [0, -40] }}
            transition={
              reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: 'linear' }
            }
          />
        )}

        {/* DOWNTOWN HOUSTON SKYLINE — a compact glyph at Houston's real point. */}
        <motion.g {...fadeIntro(DETAIL_DELAY + 0.15, DETAIL_DUR + 0.1)}>
          {SKYLINE.map((b, i) => (
            <g key={`bld-${i}`}>
              <rect
                x={HOUSTON_PT.x + b.dx}
                y={HOUSTON_PT.y + b.top}
                width={b.w}
                height={-b.top}
                style={{ fill: PAPER_FILL, stroke: INK_MUTE }}
                strokeWidth="0.7"
              />
              {b.ant && (
                <line
                  x1={HOUSTON_PT.x + b.dx + b.w / 2}
                  y1={HOUSTON_PT.y + b.top}
                  x2={HOUSTON_PT.x + b.dx + b.w / 2}
                  y2={HOUSTON_PT.y + b.top - 7}
                  style={{ stroke: INK_MUTE }}
                  strokeWidth="0.6"
                />
              )}
            </g>
          ))}
        </motion.g>

        {/* TOWN MARKERS — drop in at their projected positions. */}
        <g>
          {TOWN_PTS.map((s, i) => (
            <motion.g key={s.name} {...dropIntro(PIN_DELAY + i * 0.04, PIN_DUR)}>
              <circle cx={s.x} cy={s.y} r="4" fill="none" style={{ stroke: INK_MUTE }} strokeWidth="0.9" />
              <circle cx={s.x} cy={s.y} r="1.7" style={{ fill: ACCENT_HI }} />
              {!reduced && (
                <motion.circle
                  cx={s.x}
                  cy={s.y}
                  r="4"
                  fill="none"
                  style={{ stroke: ACCENT, transformOrigin: 'center', transformBox: 'fill-box' }}
                  strokeWidth="0.8"
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{
                    duration: 3.4,
                    delay: VEHICLE_DELAY + 1.2 + i * 0.45,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              )}
            </motion.g>
          ))}
        </g>

        {/* TOWN + WATER LABELS. */}
        <motion.g
          fontFamily="'Geist Mono', ui-monospace, monospace"
          {...fadeIntro(DETAIL_DELAY + 0.2, DETAIL_DUR + 0.1)}
        >
          {TOWN_PTS.map(t => (
            <text
              key={t.name}
              x={t.x + t.dx}
              y={t.y + t.dy}
              textAnchor={t.anchor}
              style={{ fill: t.primary ? INK_SOFT : INK_MUTE }}
              fontSize={t.primary ? 11 : 8}
              letterSpacing={t.primary ? 3 : 1.8}
            >
              {t.name.toUpperCase()}
            </text>
          ))}
          <text
            x={project(-94.72, 29.62).x}
            y={project(-94.72, 29.62).y}
            textAnchor="middle"
            style={{ fill: ACCENT_HI, fillOpacity: 0.9 }}
            fontSize="9"
            letterSpacing="3"
          >
            TRINITY BAY
          </text>
          <text
            x={project(-94.92, 29.5).x}
            y={project(-94.92, 29.5).y}
            textAnchor="middle"
            style={{ fill: ACCENT_HI, fillOpacity: 0.78 }}
            fontSize="9"
            letterSpacing="3"
          >
            GALVESTON BAY
          </text>
        </motion.g>

        {/* HIGHWAY SHIELDS — placed on their routes. */}
        <motion.g
          fontFamily="'Geist Mono', ui-monospace, monospace"
          fontSize="8"
          letterSpacing="1"
          {...fadeIntro(DETAIL_DELAY + 0.25, DETAIL_DUR + 0.1)}
        >
          {SHIELDS.map(shield => (
            <g key={shield.label} transform={`translate(${shield.x} ${shield.y})`}>
              <rect
                x={shield.wide ? -16 : -14}
                y="-10"
                width={shield.wide ? 32 : 28}
                height="20"
                style={{
                  fill: PAPER_FILL,
                  stroke: shield.strong ? INK_SOFT : INK_MUTE,
                }}
                strokeWidth={shield.strong ? 1 : 0.9}
              />
              <text
                textAnchor="middle"
                y="4"
                style={{ fill: shield.strong ? INK_SOFT : INK_MUTE }}
                fontWeight="600"
                fontSize={shield.wide ? 7 : 8}
              >
                {shield.label}
              </text>
            </g>
          ))}
        </motion.g>

        {/* DRIFTING CLOUDS — ambient. */}
        <g>
          {CLOUDS.map((c, i) => (
            <motion.use
              key={`cl-${i}`}
              href="#cloud"
              x="0"
              y={c.y}
              width={80 * c.scale}
              height={24 * c.scale}
              animate={reduced ? undefined : { x: [-160, 1320] }}
              transition={{
                duration: c.duration,
                delay: VEHICLE_DELAY + c.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </g>

        {/* CARS on I-10 — eastbound + westbound ambient loops. */}
        {I10_DRIVE &&
          [
            { dir: ['0%', '100%'], car: 'car-east', duration: 26, delay: 0 },
            { dir: ['0%', '100%'], car: 'car-east', duration: 30, delay: 12 },
            { dir: ['100%', '0%'], car: 'car-west', duration: 34, delay: 4 },
            { dir: ['100%', '0%'], car: 'car-west', duration: 40, delay: 18 },
          ].map((v, i) => (
            <motion.g
              key={`car-${i}`}
              animate={reduced ? undefined : { offsetDistance: v.dir }}
              style={{ offsetPath: `path('${I10_DRIVE}')`, offsetRotate: 'auto' }}
              transition={{
                duration: v.duration,
                delay: VEHICLE_DELAY + v.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <use href={`#${v.car}`} x="-7" y="-3" width="14" height="6" />
            </motion.g>
          ))}

        {/* BOATS drifting on the bay. */}
        {BOAT_ROUTES.map((r, i) => (
          <motion.g
            key={`boat-${i}`}
            animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
            style={{ offsetPath: `path('${r.d}')`, offsetRotate: 'auto' }}
            transition={{
              duration: r.duration,
              delay: VEHICLE_DELAY + r.delay,
              repeat: Infinity,
              ease: EASE_DRIFT,
            }}
          >
            <motion.g
              animate={reduced ? undefined : { y: [0, -1.5, 0] }}
              transition={{
                duration: 4.2 + i * 0.6,
                delay: VEHICLE_DELAY,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <use href="#boat" x="-14" y="-14" width="28" height="28" />
            </motion.g>
          </motion.g>
        ))}

        {/* BAYTOWN "YOU ARE HERE" MARKER — pinned at Baytown's real point.
            Drops in last, then holds a soft glow and a gentle service ping. */}
        <motion.g
          transform={`translate(${BAYTOWN_PT.x} ${BAYTOWN_PT.y})`}
          {...dropIntro(PIN_DELAY + 0.2, PIN_DUR + 0.15)}
        >
          <circle cx="0" cy="0" r="50" fill="url(#pin-glow)" />

          {!reduced &&
            [0, 1.1, 2.2].map((delay, i) => (
              <motion.circle
                key={`ring-${i}`}
                cx="0"
                cy="0"
                r="6"
                fill="none"
                style={{ stroke: ACCENT, transformOrigin: 'center', transformBox: 'fill-box' }}
                strokeWidth={1.2 - i * 0.2}
                initial={{ scale: 1, opacity: 0.7 - i * 0.1 }}
                animate={{ scale: 6, opacity: 0 }}
                transition={{
                  duration: 3.4,
                  delay: VEHICLE_DELAY + delay,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            ))}

          {/* targeting crosshair */}
          {[
            [-13, 0, -6, 0],
            [6, 0, 13, 0],
            [0, -13, 0, -6],
            [0, 6, 0, 13],
          ].map((l, i) => (
            <line
              key={`ch-${i}`}
              x1={l[0]}
              y1={l[1]}
              x2={l[2]}
              y2={l[3]}
              style={{ stroke: ACCENT_HI }}
              strokeWidth="1"
            />
          ))}
          <circle cx="0" cy="0" r="6.5" fill="none" style={{ stroke: ACCENT }} strokeWidth="0.9" />
          <circle cx="0" cy="0" r="5" style={{ fill: ACCENT }} />
          <circle cx="0" cy="0" r="2.2" fill="#fff" />

          {/* callout flag */}
          <line x1="0" y1="0" x2="0" y2="-34" style={{ stroke: ACCENT }} strokeWidth="1.1" />
          <g transform="translate(0 -54)">
            <rect x="-43" y="-13" width="88" height="22" style={{ fill: ROAD_SHADOW, fillOpacity: 0.55 }} />
            <rect
              x="-44"
              y="-14"
              width="88"
              height="22"
              style={{ fill: PAPER_FILL, stroke: ACCENT }}
              strokeWidth="1.1"
            />
            <text
              textAnchor="middle"
              y="1"
              fontFamily="'Geist Mono', ui-monospace, monospace"
              fontSize="9"
              letterSpacing="2.5"
              style={{ fill: INK }}
            >
              BAYTOWN
            </text>
            <text
              textAnchor="middle"
              y="22"
              fontFamily="'Geist Mono', ui-monospace, monospace"
              fontSize="6.5"
              letterSpacing="3"
              style={{ fill: ACCENT_HI }}
            >
              YOU ARE HERE
            </text>
          </g>
        </motion.g>

        {/* COMPASS ROSE — top right. */}
        <motion.g
          transform="translate(1092 168)"
          fontFamily="'Geist Mono', ui-monospace, monospace"
          {...fadeIntro(DETAIL_DELAY + 0.3, DETAIL_DUR + 0.1)}
        >
          <circle cx="0" cy="0" r="30" fill="none" style={{ stroke: INK_FAINT }} strokeWidth="0.9" />
          <circle cx="0" cy="0" r="24" fill="none" style={{ stroke: HAIR_STRONG }} strokeWidth="0.6" />
          <circle
            cx="0"
            cy="0"
            r="18"
            fill="none"
            style={{ stroke: HAIR }}
            strokeWidth="0.5"
            strokeDasharray="1 3"
          />
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i * Math.PI) / 8
            const outer = i % 4 === 0 ? 32 : 29
            return (
              <line
                key={`cr-tk-${i}`}
                x1={(Math.cos(a) * 26).toFixed(2)}
                y1={(Math.sin(a) * 26).toFixed(2)}
                x2={(Math.cos(a) * outer).toFixed(2)}
                y2={(Math.sin(a) * outer).toFixed(2)}
                style={{ stroke: INK_FAINT, strokeOpacity: i % 4 === 0 ? 1 : 0.55 }}
                strokeWidth={i % 4 === 0 ? 0.9 : 0.5}
              />
            )
          })}
          <path d="M 0 -24 L 5 0 L 0 24 L -5 0 Z" style={{ fill: PAPER_FILL, stroke: INK_SOFT }} strokeWidth="0.9" />
          <path d="M 0 -24 L 5 0 L -5 0 Z" style={{ fill: ACCENT }} />
          <circle cx="0" cy="0" r="1.8" style={{ fill: PAPER_FILL, stroke: ACCENT }} strokeWidth="0.7" />
          <text textAnchor="middle" y="-36" fontSize="8" letterSpacing="2" style={{ fill: ACCENT_HI }} fontWeight="600">
            N
          </text>
          <text textAnchor="middle" y="42" fontSize="7" letterSpacing="2" style={{ fill: INK_FAINT }}>
            S
          </text>
          <text textAnchor="middle" x="-36" y="3" fontSize="7" letterSpacing="2" style={{ fill: INK_FAINT }}>
            W
          </text>
          <text textAnchor="middle" x="36" y="3" fontSize="7" letterSpacing="2" style={{ fill: INK_FAINT }}>
            E
          </text>
        </motion.g>

        {/* SCALE BAR — bottom right. Length is a real 10-mile span. */}
        <motion.g
          transform="translate(984 802)"
          fontFamily="'Geist Mono', ui-monospace, monospace"
          {...fadeIntro(DETAIL_DELAY + 0.35, DETAIL_DUR + 0.1)}
        >
          <line x1="0" y1="0" x2={SCALE_PX} y2="0" style={{ stroke: INK_MUTE }} strokeWidth="0.9" />
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <line
              key={`sc-${f}`}
              x1={f * SCALE_PX}
              y1="-3"
              x2={f * SCALE_PX}
              y2="3"
              style={{ stroke: INK_MUTE }}
              strokeWidth="0.8"
            />
          ))}
          <text
            x={SCALE_PX / 2}
            y="14"
            textAnchor="middle"
            fontSize="7"
            letterSpacing="2"
            style={{ fill: INK_FAINT }}
          >
            {SCALE_MILES} MI
          </text>
        </motion.g>

        {/* GEOGRAPHIC ANCHOR — bottom left, the Baytown reference point. */}
        <motion.g
          transform="translate(44 802)"
          fontFamily="'Geist Mono', ui-monospace, monospace"
          {...fadeIntro(DETAIL_DELAY + 0.35, DETAIL_DUR + 0.1)}
        >
          <text fontSize="8" letterSpacing="3" style={{ fill: INK_FAINT }}>
            29.7355° N · 94.9774° W
          </text>
          <text y="14" fontSize="7" letterSpacing="3" style={{ fill: INK_FAINT }}>
            HARRIS / CHAMBERS CO · TX
          </text>
        </motion.g>

        {/* TOP-LEFT FRAME LABEL. */}
        <motion.g
          transform="translate(44 150)"
          fontFamily="'Geist Mono', ui-monospace, monospace"
          {...fadeIntro(DETAIL_DELAY + 0.4, DETAIL_DUR + 0.1)}
        >
          <line x1="0" y1="-6" x2="36" y2="-6" style={{ stroke: ACCENT }} strokeWidth="1.2" />
          <text y="8" fontSize="9" letterSpacing="2.5" style={{ fill: ACCENT }}>
            // SHEET 01 — SERVICE AREA
          </text>
          <text y="26" fontSize="7" letterSpacing="3" style={{ fill: INK_FAINT }}>
            HOUSTON METRO · GULF COAST
          </text>
          <text y="42" fontSize="6.5" letterSpacing="3" style={{ fill: INK_FAINT }}>
            REV 6 · TAYLORURL LLC
          </text>
        </motion.g>

        {/* BOTTOM VIGNETTE — pushes the eye toward the headline. */}
        <rect x="0" y="0" width="1200" height={VIEWBOX_HEIGHT} fill="url(#vignette-mask)" />
      </svg>
    </div>
  )
}
