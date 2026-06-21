import { motion, useReducedMotion } from 'framer-motion'

/**
 * Hand-built illustrated map of the Baytown / Houston corridor — drawn in the
 * site's engineering-blueprint vocabulary (hairline strokes, accent ink, mono
 * labels). Sits behind the hero copy as a featured co-star: cars run along
 * I-10, a boat drifts across Trinity Bay, downtown lights twinkle, clouds
 * drift, and a pulsing accent marker pins Baytown.
 *
 * On first paint the map runs a one-off cinematic intro: the bay coastline,
 * highways, and supporting detail draw themselves in via stroke-dasharray;
 * markers settle in; only then do the ambient loops (cars, boat, clouds) and
 * the hero copy take over. Respects `prefers-reduced-motion` — those users see
 * the final state immediately. Theme follows the parent `.hero-surface`, which
 * re-keys ink/hair/accent tokens against the user's system color scheme.
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
// with this file when retuning the cadence.
const COASTLINE_DELAY = 0
const COASTLINE_DUR = 1.5
const ROAD_DELAY = 0.55
const ROAD_DUR = 1.45
const DETAIL_DELAY = 1.55
const DETAIL_DUR = 0.55
const PIN_DELAY = 1.85
const PIN_DUR = 0.45
const VEHICLE_DELAY = 2.15

export const HERO_INTRO_END_S = 2.0

const I10_PATH = 'M -40 410 Q 180 390 360 412 T 720 410 T 1080 408 L 1260 410'
const TX146_PATH = 'M 680 -10 L 678 240 Q 676 360 686 480 L 690 620'
const SH225_PATH = 'M 200 540 Q 360 540 520 538 T 820 540'
const SHIP_CHANNEL_PATH = 'M -40 600 Q 260 588 540 596 T 900 612 L 1260 632'
const TRINITY_RIVER_PATH =
  'M 660 -10 Q 678 80 666 170 Q 650 250 690 340 Q 720 420 770 510 Q 810 580 830 660'
const BELTWAY_PATH = 'M 380 380 a 170 130 0 1 0 -2 0 z'
const COASTLINE_PATH =
  'M 1200 360 L 1200 800 L 360 800 Q 520 700 660 660 Q 800 620 920 600 Q 1020 588 1100 540 Q 1170 500 1200 460 Z'

const DOWNTOWN_BUILDINGS = [
  { x: 196, y: 290, w: 14, h: 68 },
  { x: 214, y: 268, w: 18, h: 90 },
  { x: 236, y: 244, w: 22, h: 114 },
  { x: 262, y: 226, w: 26, h: 132 },
  { x: 292, y: 210, w: 30, h: 148 },
  { x: 326, y: 236, w: 22, h: 122 },
  { x: 352, y: 256, w: 18, h: 102 },
  { x: 374, y: 274, w: 16, h: 84 },
  { x: 394, y: 296, w: 14, h: 62 },
]

const DOWNTOWN_LIGHTS = [
  { x: 245, y: 268 },
  { x: 270, y: 254 },
  { x: 300, y: 232 },
  { x: 305, y: 270 },
  { x: 333, y: 254 },
  { x: 360, y: 286 },
  { x: 220, y: 304 },
  { x: 386, y: 312 },
]

const BAYTOWN_BLOCKS = Array.from({ length: 18 }, (_, i) => {
  const col = i % 6
  const row = Math.floor(i / 6)
  return { x: 612 + col * 22, y: 472 + row * 22, w: 16, h: 16 }
})

const SATELLITE_TOWNS = [
  { name: 'Pasadena', x: 380, y: 520, align: 'end' },
  { name: 'Deer Park', x: 520, y: 510, align: 'middle' },
  { name: 'La Porte', x: 640, y: 558, align: 'middle' },
  { name: 'Mont Belvieu', x: 1018, y: 332, align: 'start' },
  { name: 'Channelview', x: 460, y: 460, align: 'middle' },
  { name: 'Highlands', x: 700, y: 348, align: 'middle' },
]

const SUBURB_DOTS = [
  { x: 380, y: 520 },
  { x: 520, y: 510 },
  { x: 640, y: 558 },
  { x: 1018, y: 332 },
  { x: 460, y: 460 },
  { x: 700, y: 348 },
]

const CLOUDS = [
  { y: 70, scale: 1, delay: 0, duration: 60 },
  { y: 140, scale: 0.72, delay: 22, duration: 78 },
  { y: 36, scale: 0.55, delay: 44, duration: 92 },
]

export default function BaytownMap() {
  const reduced = useReducedMotion()

  // Common stroke-draw intro for solid roads / coastline. With `pathLength=1`
  // the dash math is normalized regardless of the path's real length.
  const drawIntro = (delay, duration) =>
    reduced
      ? { initial: false, animate: { strokeDashoffset: 0 } }
      : {
          initial: { strokeDashoffset: 1 },
          animate: { strokeDashoffset: 0 },
          transition: { duration, delay, ease: EASE_DRAW },
        }

  // Standard fade-in used for everything that's solid (rects, dashes,
  // labels, frame chrome). Mirrors the existing site reveal vocabulary.
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

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-[0.82]"
      >
        <defs>
          <linearGradient id="bay-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
            <stop offset="60%" stopColor={ACCENT} stopOpacity="0.16" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.06" />
          </linearGradient>

          <linearGradient id="vignette-mask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="38%" stopColor="#000" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.38" />
          </linearGradient>

          <pattern
            id="wave-pattern"
            x="0"
            y="0"
            width="42"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 8 Q 10 2 21 8 T 42 8"
              fill="none"
              style={{ stroke: ACCENT_HI, strokeOpacity: 0.42 }}
              strokeWidth="1"
            />
          </pattern>

          <symbol id="cloud" viewBox="0 0 80 24" overflow="visible">
            <path
              d="M 4 18 Q 4 8 16 8 Q 18 0 30 4 Q 38 -2 48 4 Q 60 0 64 10 Q 76 10 76 18 Z"
              fill="none"
              style={{ stroke: INK_FAINT }}
              strokeWidth="0.9"
            />
          </symbol>

          <symbol id="boat" viewBox="-12 -12 24 24" overflow="visible">
            <path
              d="M -8 4 L 8 4 L 6 8 L -6 8 Z"
              style={{ fill: INK_SOFT, stroke: ACCENT_HI }}
              strokeWidth="0.7"
            />
            <line x1="0" y1="4" x2="0" y2="-7" style={{ stroke: ACCENT_HI }} strokeWidth="0.9" />
            <path d="M 0 -7 L 5 1 L 0 1 Z" style={{ fill: ACCENT_HI, fillOpacity: 0.95 }} />
            <path d="M 0 -5 L -4 1 L 0 1 Z" style={{ fill: ACCENT, fillOpacity: 0.75 }} />
          </symbol>

          <symbol id="car-east" viewBox="-7 -3 14 6" overflow="visible">
            <rect x="-6" y="-2" width="12" height="4" rx="1.2" style={{ fill: ACCENT }} />
            <rect x="-2.5" y="-1.6" width="5" height="2.4" rx="0.5" fill="#dfe9ff" fillOpacity="0.92" />
            <circle cx="-4" cy="2" r="0.9" fill="#0a0a0a" />
            <circle cx="4" cy="2" r="0.9" fill="#0a0a0a" />
          </symbol>

          <symbol id="car-west" viewBox="-7 -3 14 6" overflow="visible">
            <rect x="-6" y="-2" width="12" height="4" rx="1.2" style={{ fill: ACCENT_HI }} />
            <rect x="-2.5" y="-1.6" width="5" height="2.4" rx="0.5" fill="#dfe9ff" fillOpacity="0.92" />
            <circle cx="-4" cy="2" r="0.9" fill="#0a0a0a" />
            <circle cx="4" cy="2" r="0.9" fill="#0a0a0a" />
          </symbol>

          <path id="i10-route" d={I10_PATH} />
          <path id="boat-route" d="M 920 720 Q 1020 660 1100 600" />

          <mask id="bay-clip">
            <rect width="1200" height="800" fill="black" />
            <path d={COASTLINE_PATH} fill="white" />
          </mask>
        </defs>

        {/* WATER — Trinity / Galveston Bay fill (no stroke yet; the coastline
            draws in on top as the intro's first beat). */}
        <motion.g {...fadeIntro(0, 0.7)}>
          <path d={COASTLINE_PATH} fill="url(#bay-fill)" />
          <rect
            x="0"
            y="0"
            width="1200"
            height="800"
            fill="url(#wave-pattern)"
            mask="url(#bay-clip)"
          />
        </motion.g>

        {/* COASTLINE — first thing to draw itself in. */}
        <motion.path
          d={COASTLINE_PATH}
          fill="none"
          pathLength={1}
          strokeDasharray={1}
          style={{ stroke: ACCENT_HI, strokeOpacity: 0.6 }}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...drawIntro(COASTLINE_DELAY, COASTLINE_DUR)}
        />

        {/* RAIL TIES — quiet texture along the channel. */}
        <motion.g style={{ stroke: HAIR_STRONG }} strokeWidth="0.8" {...fadeIntro(DETAIL_DELAY, DETAIL_DUR)}>
          {Array.from({ length: 60 }).map((_, i) => (
            <line key={`tie-${i}`} x1={20 + i * 20} y1="638" x2={20 + i * 20} y2="646" />
          ))}
        </motion.g>

        {/* ROUTE GLOW — accent-blue bloom under the main highways. Drawn first
            so it sits beneath the road shadows and the road strokes. */}
        <motion.g
          fill="none"
          strokeLinecap="round"
          style={{ filter: 'blur(6px)' }}
          {...fadeIntro(ROAD_DELAY + 0.15, 0.9)}
        >
          <path d={I10_PATH} style={{ stroke: GLOW }} strokeWidth="9" />
          <path d={TX146_PATH} style={{ stroke: GLOW, strokeOpacity: 0.85 }} strokeWidth="7" />
        </motion.g>

        {/* ROAD SHADOWS — wider faint stroke under the line for depth. Fade in
            with the roads they're behind. */}
        <motion.g fill="none" strokeLinecap="round" {...fadeIntro(ROAD_DELAY, 0.8)}>
          <path d={I10_PATH} style={{ stroke: ROAD_SHADOW }} strokeWidth="7" />
          <path d={TX146_PATH} style={{ stroke: ROAD_SHADOW, strokeOpacity: 0.9 }} strokeWidth="6" />
          <path d={SH225_PATH} style={{ stroke: ROAD_SHADOW, strokeOpacity: 0.8 }} strokeWidth="5" />
          <path d={SHIP_CHANNEL_PATH} style={{ stroke: ROAD_SHADOW, strokeOpacity: 0.65 }} strokeWidth="3.5" />
        </motion.g>

        {/* PRIMARY ROADS — drawn in stroke-by-stroke. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d={I10_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: INK_SOFT }}
            strokeWidth="3.4"
            {...drawIntro(ROAD_DELAY, ROAD_DUR)}
          />
          <motion.path
            d={TX146_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: INK_MUTE }}
            strokeWidth="2.6"
            {...drawIntro(ROAD_DELAY + 0.1, ROAD_DUR)}
          />
          <motion.path
            d={SH225_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: INK_MUTE }}
            strokeWidth="2.0"
            {...drawIntro(ROAD_DELAY + 0.2, ROAD_DUR - 0.15)}
          />
          <motion.path
            d={TRINITY_RIVER_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: ACCENT, strokeOpacity: 0.6 }}
            strokeWidth="2.0"
            {...drawIntro(ROAD_DELAY + 0.3, ROAD_DUR - 0.1)}
          />
          <motion.path
            d={BELTWAY_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: INK_FAINT }}
            strokeWidth="1.4"
            {...drawIntro(ROAD_DELAY + 0.4, ROAD_DUR - 0.2)}
          />
        </g>

        {/* DASHED OVERLAYS — ship channel dashes + I-10 lane dashes. The
            dashed pattern can't share the strokeDashoffset draw trick, so they
            fade in after the solid roads land. */}
        <motion.g fill="none" strokeLinecap="round" {...fadeIntro(DETAIL_DELAY, DETAIL_DUR)}>
          <path
            d={SHIP_CHANNEL_PATH}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.7 }}
            strokeWidth="1.6"
            strokeDasharray="2 4"
          />
          <path
            d={I10_PATH}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.7 }}
            strokeWidth="0.9"
            strokeDasharray="8 12"
          />
        </motion.g>

        {/* SMALLER STREETS — Baytown street grid. */}
        <motion.g style={{ stroke: HAIR }} strokeWidth="0.7" {...fadeIntro(DETAIL_DELAY + 0.1, DETAIL_DUR)}>
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={`bt-h-${i}`}
              x1={592}
              y1={464 + i * 22}
              x2={732}
              y2={464 + i * 22}
            />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={`bt-v-${i}`}
              x1={592 + i * 22}
              y1={464}
              x2={592 + i * 22}
              y2={552}
            />
          ))}
        </motion.g>

        {/* SUBURBAN BLOCKS — Baytown. */}
        <motion.g {...fadeIntro(DETAIL_DELAY + 0.1, DETAIL_DUR)}>
          {BAYTOWN_BLOCKS.map((b, i) => (
            <rect
              key={`bl-${i}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              style={{ fill: HAIR_STRONG, stroke: INK_FAINT }}
              strokeWidth="0.5"
            />
          ))}
        </motion.g>

        {/* DOWNTOWN HOUSTON SKYLINE. */}
        <motion.g {...fadeIntro(DETAIL_DELAY + 0.15, DETAIL_DUR + 0.1)}>
          <line
            x1="180"
            y1="358"
            x2="412"
            y2="358"
            style={{ stroke: INK_MUTE }}
            strokeWidth="1"
          />
          {DOWNTOWN_BUILDINGS.map((b, i) => (
            <g key={`bld-${i}`}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                style={{ fill: PAPER_FILL, stroke: INK_MUTE }}
                strokeWidth="0.8"
              />
              {Array.from({ length: Math.floor(b.h / 8) }).map((_, j) => (
                <line
                  key={`w-${i}-${j}`}
                  x1={b.x + 2}
                  y1={b.y + 4 + j * 8}
                  x2={b.x + b.w - 2}
                  y2={b.y + 4 + j * 8}
                  style={{ stroke: INK_FAINT }}
                  strokeWidth="0.3"
                />
              ))}
            </g>
          ))}

          {/* TWINKLING LIGHTS — start their loop after the intro lands. */}
          {DOWNTOWN_LIGHTS.map((l, i) => (
            <motion.rect
              key={`lt-${i}`}
              x={l.x}
              y={l.y}
              width="1.8"
              height="1.8"
              style={{ fill: ACCENT_HI }}
              animate={
                reduced
                  ? undefined
                  : { opacity: [0.25, 1, 0.4, 0.9, 0.3] }
              }
              transition={{
                duration: 3 + (i % 4) * 0.6,
                delay: VEHICLE_DELAY + i * 0.35,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.g>

        {/* SUBURB MARKERS — drop in after the road skeleton lands. */}
        <g>
          {SUBURB_DOTS.map((s, i) => (
            <motion.g key={`s-${i}`} {...dropIntro(PIN_DELAY + i * 0.04, PIN_DUR)}>
              <circle cx={s.x} cy={s.y} r="3.4" fill="none" style={{ stroke: INK_MUTE }} strokeWidth="0.9" />
              <circle cx={s.x} cy={s.y} r="1.4" style={{ fill: INK_SOFT }} />
            </motion.g>
          ))}
        </g>

        {/* TOWN LABELS. */}
        <motion.g
          fontFamily="'Geist Mono', ui-monospace, monospace"
          fontSize="9"
          letterSpacing="2"
          style={{ fill: INK_SOFT }}
          {...fadeIntro(DETAIL_DELAY + 0.2, DETAIL_DUR + 0.1)}
        >
          <text x="296" y="386" textAnchor="middle" letterSpacing="3">
            HOUSTON
          </text>
          {SATELLITE_TOWNS.map(t => (
            <text
              key={t.name}
              x={t.align === 'end' ? t.x - 8 : t.align === 'start' ? t.x + 8 : t.x}
              y={t.y + 14}
              textAnchor={t.align}
              style={{ fill: INK_MUTE }}
              fontSize="8"
              letterSpacing="1.8"
            >
              {t.name.toUpperCase()}
            </text>
          ))}
          <text
            x="940"
            y="700"
            style={{ fill: ACCENT_HI, fillOpacity: 0.95 }}
            fontSize="8"
            letterSpacing="2"
          >
            TRINITY BAY
          </text>
        </motion.g>

        {/* HIGHWAY SHIELDS. */}
        <motion.g
          fontFamily="'Geist Mono', ui-monospace, monospace"
          fontSize="8"
          letterSpacing="1"
          {...fadeIntro(DETAIL_DELAY + 0.25, DETAIL_DUR + 0.1)}
        >
          <g transform="translate(540 384)">
            <rect x="-14" y="-10" width="28" height="20" style={{ fill: PAPER_FILL, stroke: INK_SOFT }} strokeWidth="1" />
            <text textAnchor="middle" y="4" style={{ fill: INK_SOFT }} fontWeight="600">
              I-10
            </text>
          </g>
          <g transform="translate(700 188)">
            <rect x="-14" y="-10" width="28" height="20" style={{ fill: PAPER_FILL, stroke: INK_MUTE }} strokeWidth="0.9" />
            <text textAnchor="middle" y="4" style={{ fill: INK_MUTE }} fontWeight="600">
              146
            </text>
          </g>
          <g transform="translate(220 540)">
            <rect x="-14" y="-10" width="28" height="20" style={{ fill: PAPER_FILL, stroke: INK_MUTE }} strokeWidth="0.9" />
            <text textAnchor="middle" y="4" style={{ fill: INK_MUTE }} fontWeight="600">
              225
            </text>
          </g>
        </motion.g>

        {/* DRIFTING CLOUDS — ambient loop, kicks in after intro. */}
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

        {/* CARS on I-10 — eastbound and westbound. Ambient loops start after
            the road draw-in completes. The <use> stays at authored size. */}
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{ offsetPath: `path('${I10_PATH}')`, offsetRotate: 'auto' }}
          transition={{ duration: 26, delay: VEHICLE_DELAY, repeat: Infinity, ease: 'linear' }}
        >
          <use href="#car-east" x="-7" y="-3" width="14" height="6" />
        </motion.g>
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['100%', '0%'] }}
          style={{ offsetPath: `path('${I10_PATH}')`, offsetRotate: 'auto' }}
          transition={{ duration: 34, delay: VEHICLE_DELAY + 4, repeat: Infinity, ease: 'linear' }}
        >
          <use href="#car-west" x="-7" y="-3" width="14" height="6" />
        </motion.g>

        {/* CAR on TX-146. */}
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{ offsetPath: `path('${TX146_PATH}')`, offsetRotate: 'auto' }}
          transition={{ duration: 30, delay: VEHICLE_DELAY + 8, repeat: Infinity, ease: 'linear' }}
        >
          <use href="#car-east" x="-7" y="-3" width="14" height="6" />
        </motion.g>

        {/* BOAT drifting on the bay. */}
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{ offsetPath: `path('M 900 720 Q 1020 660 1100 600')`, offsetRotate: 'auto' }}
          transition={{ duration: 48, delay: VEHICLE_DELAY + 2, repeat: Infinity, ease: EASE_DRIFT }}
        >
          <motion.g
            animate={reduced ? undefined : { y: [0, -1.5, 0] }}
            transition={{ duration: 4.2, delay: VEHICLE_DELAY, repeat: Infinity, ease: 'easeInOut' }}
          >
            <use href="#boat" x="-12" y="-12" width="24" height="24" />
          </motion.g>
        </motion.g>

        {/* BAYTOWN "YOU ARE HERE" MARKER — pinned at Baytown. Drops in last. */}
        <motion.g transform="translate(680 580)" {...dropIntro(PIN_DELAY + 0.2, PIN_DUR + 0.15)}>
          {/* outer pulse rings — start after the marker drops in */}
          {!reduced && (
            <>
              <motion.g
                initial={{ scale: 1, opacity: 0.75 }}
                animate={{ scale: 5, opacity: 0 }}
                transition={{ duration: 2.6, delay: VEHICLE_DELAY, repeat: Infinity, ease: 'easeOut' }}
                style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
              >
                <circle cx="0" cy="0" r="6" fill="none" style={{ stroke: ACCENT }} strokeWidth="1.2" />
              </motion.g>
              <motion.g
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 5, opacity: 0 }}
                transition={{ duration: 2.6, delay: VEHICLE_DELAY + 1.3, repeat: Infinity, ease: 'easeOut' }}
                style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
              >
                <circle cx="0" cy="0" r="6" fill="none" style={{ stroke: ACCENT }} strokeWidth="1" />
              </motion.g>
            </>
          )}
          {/* targeting crosshair */}
          <line x1="-12" y1="0" x2="-7" y2="0" style={{ stroke: ACCENT_HI }} strokeWidth="1" />
          <line x1="7" y1="0" x2="12" y2="0" style={{ stroke: ACCENT_HI }} strokeWidth="1" />
          <line x1="0" y1="-12" x2="0" y2="-7" style={{ stroke: ACCENT_HI }} strokeWidth="1" />
          <line x1="0" y1="7" x2="0" y2="12" style={{ stroke: ACCENT_HI }} strokeWidth="1" />
          {/* core dot */}
          <circle cx="0" cy="0" r="5.5" style={{ fill: ACCENT }} />
          <circle cx="0" cy="0" r="2.2" fill="#fff" />

          {/* callout flag */}
          <line x1="0" y1="0" x2="0" y2="-32" style={{ stroke: ACCENT }} strokeWidth="1.1" />
          <g transform="translate(0 -52)">
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
          transform="translate(1100 110)"
          fontFamily="'Geist Mono', ui-monospace, monospace"
          {...fadeIntro(DETAIL_DELAY + 0.3, DETAIL_DUR + 0.1)}
        >
          <circle cx="0" cy="0" r="26" fill="none" style={{ stroke: INK_FAINT }} strokeWidth="0.9" />
          <circle cx="0" cy="0" r="20" fill="none" style={{ stroke: HAIR_STRONG }} strokeWidth="0.6" />
          <line x1="0" y1="-28" x2="0" y2="28" style={{ stroke: INK_FAINT }} strokeWidth="0.6" />
          <line x1="-28" y1="0" x2="28" y2="0" style={{ stroke: INK_FAINT }} strokeWidth="0.6" />
          <path d="M 0 -22 L 4 0 L 0 22 L -4 0 Z" style={{ fill: PAPER_FILL, stroke: INK_SOFT }} strokeWidth="0.9" />
          <path d="M 0 -22 L 4 0 L -4 0 Z" style={{ fill: ACCENT }} />
          <text
            textAnchor="middle"
            y="-32"
            fontSize="8"
            letterSpacing="2"
            style={{ fill: ACCENT_HI }}
            fontWeight="600"
          >
            N
          </text>
        </motion.g>

        {/* SCALE BAR — bottom right. */}
        <motion.g
          transform="translate(1010 740)"
          fontFamily="'Geist Mono', ui-monospace, monospace"
          {...fadeIntro(DETAIL_DELAY + 0.35, DETAIL_DUR + 0.1)}
        >
          <line x1="0" y1="0" x2="120" y2="0" style={{ stroke: INK_MUTE }} strokeWidth="0.9" />
          <line x1="0" y1="-3" x2="0" y2="3" style={{ stroke: INK_MUTE }} strokeWidth="0.9" />
          <line x1="40" y1="-2" x2="40" y2="2" style={{ stroke: INK_FAINT }} strokeWidth="0.7" />
          <line x1="80" y1="-2" x2="80" y2="2" style={{ stroke: INK_FAINT }} strokeWidth="0.7" />
          <line x1="120" y1="-3" x2="120" y2="3" style={{ stroke: INK_MUTE }} strokeWidth="0.9" />
          <text x="60" y="14" textAnchor="middle" fontSize="7" letterSpacing="2" style={{ fill: INK_FAINT }}>
            10 MI · APPROX
          </text>
        </motion.g>

        {/* GEOGRAPHIC ANCHOR — bottom left. */}
        <motion.g
          transform="translate(40 740)"
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
          transform="translate(40 56)"
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
        </motion.g>

        {/* BOTTOM VIGNETTE — pushes the eye toward the headline. */}
        <rect
          x="0"
          y="0"
          width="1200"
          height="800"
          fill="url(#vignette-mask)"
        />
      </svg>
    </div>
  )
}
