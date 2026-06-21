import { motion, useReducedMotion } from 'framer-motion'

/**
 * Hand-built illustrated map of the Baytown / Houston corridor — drawn in the
 * site's engineering-blueprint vocabulary (hairline strokes, accent ink, mono
 * labels). Sits behind the hero copy as a featured co-star: traffic flows
 * along I-10, boats drift across Trinity Bay, the downtown skyline twinkles,
 * service-radius rings ripple out from a Baytown pin that targets each
 * satellite town the studio serves, and a plane traces its vapor trail across
 * the top of the sheet.
 *
 * On first paint the map runs a one-off cinematic intro: the bay coastline,
 * highways, and supporting detail draw themselves in via stroke-dasharray;
 * markers settle in; only then do the ambient loops (cars, boat, clouds,
 * radar sweep, service rings, plane) and the hero copy take over. Respects
 * `prefers-reduced-motion` — those users see the final state immediately.
 * Theme follows the parent `.hero-surface`, which re-keys ink/hair/accent
 * tokens against the user's system color scheme.
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

// ─── ROAD NETWORK ──────────────────────────────────────────────────────────
// More undulating curves than the prior straight runs — gives the highways
// the dipping cadence of a real freeway corridor.
const I10_PATH =
  'M -40 412 C 80 404, 160 392, 240 398 S 380 422, 460 414 S 600 396, 680 408 S 820 426, 900 416 S 1040 398, 1120 410 L 1260 412'
const TX146_PATH =
  'M 682 -10 C 680 60, 686 110, 678 170 S 668 270, 682 320 S 690 410, 680 470 S 686 560, 692 620'
const SH225_PATH =
  'M 200 540 C 280 538, 360 542, 440 538 S 580 530, 660 538 S 800 544, 880 540'
const SHIP_CHANNEL_PATH =
  'M -40 600 C 120 596, 260 588, 380 596 S 540 612, 660 604 S 800 596, 900 612 S 1080 624, 1260 632'
const TRINITY_RIVER_PATH =
  'M 660 -10 C 678 50, 670 110, 666 170 C 660 220, 678 260, 686 300 C 696 350, 706 400, 720 450 C 740 510, 778 560, 808 610 C 826 638, 838 666, 832 712'
// Beltway 8 — the outer Houston loop, traced as a generous ellipse east of
// downtown. Adds a second ring road for navigational depth.
const BELTWAY_PATH =
  'M 480 380 C 480 280, 360 220, 260 230 C 160 240, 100 320, 110 410 C 120 500, 200 560, 300 558 C 400 556, 480 480, 480 380 Z'
// I-610 inner loop — the immediate downtown ring. Smaller, tighter.
const LOOP610_PATH =
  'M 380 380 C 380 320, 320 280, 260 282 C 200 284, 160 330, 162 388 C 164 446, 210 484, 268 484 C 326 484, 380 440, 380 380 Z'

// ─── COASTLINE ─────────────────────────────────────────────────────────────
// Much higher-fidelity trace of Galveston Bay + Trinity Bay shoreline. The
// path threads from the upper-east shore down past Smith Point, around
// Bolivar Peninsula at the bottom, and back across the bay floor toward the
// Houston Ship Channel entrance. Every kink in the line is a real-ish inlet
// or headland rather than the gentle quadratics of the prior blocky outline.
const COASTLINE_PATH =
  'M 1260 260 ' +
  'C 1180 270, 1110 286, 1050 308 ' +
  'C 990 332, 952 360, 938 396 ' +
  'C 928 422, 940 446, 962 462 ' +
  'C 992 484, 1024 492, 1058 504 ' +
  'C 1098 520, 1140 540, 1166 572 ' +
  'C 1182 592, 1184 614, 1170 632 ' +
  'C 1150 658, 1118 668, 1086 676 ' +
  'L 1052 684 ' +
  'C 1098 690, 1144 696, 1188 712 ' +
  'C 1218 722, 1242 736, 1260 754 ' +
  'L 1260 800 ' +
  'L 360 800 ' +
  'C 410 770, 470 748, 540 730 ' +
  'C 612 712, 686 700, 758 686 ' +
  'C 820 674, 876 658, 920 632 ' +
  'C 956 612, 974 588, 968 562 ' +
  'C 962 534, 940 514, 912 502 ' +
  'C 880 488, 846 480, 814 472 ' +
  'C 782 462, 758 444, 752 418 ' +
  'C 748 396, 762 374, 786 358 ' +
  'C 820 336, 862 320, 902 304 ' +
  'C 962 282, 1024 270, 1086 262 ' +
  'C 1140 256, 1198 252, 1260 252 ' +
  'Z'

// Bathymetry — three nested isolines inside the bay, each one offset inward
// from the coastline. Subtly suggest water depth and stop the bay from
// reading as a flat color block.
const BATHY_OUTER =
  'M 1240 290 C 1180 298, 1120 314, 1070 336 C 1010 360, 974 388, 962 420 C 952 446, 968 470, 992 488 C 1024 510, 1062 522, 1098 538 C 1130 552, 1148 572, 1146 590 C 1142 612, 1116 626, 1086 632 C 1010 644, 940 650, 870 666 C 798 682, 738 706, 700 736'
const BATHY_MID =
  'M 1230 326 C 1180 336, 1130 352, 1090 374 C 1042 398, 1010 422, 1002 450 C 996 474, 1014 494, 1040 510 C 1066 524, 1094 536, 1116 552 C 1130 564, 1132 578, 1120 590 C 1100 608, 1058 614, 1014 624 C 940 636, 868 654, 808 686'
const BATHY_INNER =
  'M 1218 364 C 1172 372, 1132 386, 1100 406 C 1066 426, 1044 446, 1042 468 C 1042 488, 1062 504, 1086 516 C 1102 524, 1108 534, 1098 544 C 1080 562, 1040 568, 998 578 C 932 594, 872 614, 824 642'

// ─── ISLANDS ───────────────────────────────────────────────────────────────
// Atkinson Island, Pelican Island, and a handful of marsh dots. The shapes
// are stylized but read as discrete land bodies in the bay water.
const ATKINSON_ISLAND_PATH =
  'M 904 528 C 924 524, 942 530, 950 542 C 958 556, 952 572, 938 580 C 922 588, 902 586, 890 576 C 880 568, 880 552, 888 542 C 893 535, 898 530, 904 528 Z'
const PELICAN_ISLAND_PATH =
  'M 854 642 C 870 638, 884 642, 890 650 C 894 658, 888 668, 876 672 C 862 676, 848 672, 844 664 C 842 656, 846 648, 854 642 Z'
const MARSH_DOTS = [
  { x: 826, y: 526, r: 2.2 },
  { x: 850, y: 558, r: 1.4 },
  { x: 882, y: 612, r: 1.8 },
  { x: 968, y: 612, r: 1.4 },
  { x: 990, y: 568, r: 1.6 },
]

// ─── DOWNTOWN SKYLINE ──────────────────────────────────────────────────────
// More buildings, varied silhouettes (flat-topped, pitched, antenna). Reads
// closer to the real Houston skyline density without overcrowding.
const DOWNTOWN_BUILDINGS = [
  { x: 186, y: 308, w: 12, h: 50 },
  { x: 200, y: 290, w: 14, h: 68 },
  { x: 216, y: 268, w: 18, h: 90 },
  { x: 236, y: 242, w: 16, h: 116 },
  { x: 254, y: 254, w: 20, h: 104, ant: true },
  { x: 276, y: 220, w: 24, h: 138 },
  { x: 302, y: 198, w: 28, h: 160, ant: true },
  { x: 332, y: 226, w: 22, h: 132 },
  { x: 356, y: 246, w: 18, h: 112 },
  { x: 376, y: 232, w: 22, h: 126, pitched: true },
  { x: 400, y: 264, w: 18, h: 94 },
  { x: 420, y: 280, w: 16, h: 78 },
  { x: 438, y: 298, w: 12, h: 60 },
]

const DOWNTOWN_LIGHTS = [
  { x: 240, y: 268 },
  { x: 260, y: 256 },
  { x: 282, y: 244 },
  { x: 290, y: 222 },
  { x: 308, y: 226 },
  { x: 312, y: 270 },
  { x: 338, y: 252 },
  { x: 360, y: 282 },
  { x: 384, y: 252 },
  { x: 406, y: 296 },
  { x: 218, y: 304 },
  { x: 428, y: 312 },
]

const BAYTOWN_BLOCKS = Array.from({ length: 24 }, (_, i) => {
  const col = i % 6
  const row = Math.floor(i / 6)
  return { x: 604 + col * 22, y: 458 + row * 22, w: 16, h: 16 }
})

const SATELLITE_TOWNS = [
  { name: 'Pasadena', x: 380, y: 520, align: 'end' },
  { name: 'Deer Park', x: 520, y: 510, align: 'middle' },
  { name: 'La Porte', x: 640, y: 558, align: 'middle' },
  { name: 'Mont Belvieu', x: 1018, y: 332, align: 'start' },
  { name: 'Channelview', x: 460, y: 460, align: 'middle' },
  { name: 'Highlands', x: 700, y: 348, align: 'middle' },
]

// Baytown pin location, in viewBox coords. Used as the anchor for service
// rings, radar sweep, and the satellite-town arcs.
const BAYTOWN_X = 680
const BAYTOWN_Y = 580

// Pre-compute a smooth Bezier arc from the Baytown pin to each satellite
// town. The control point is offset perpendicular to the chord so the arc
// bows out cleanly instead of cutting through the highway grid.
const SATELLITE_ARCS = SATELLITE_TOWNS.map(t => {
  const dx = t.x - BAYTOWN_X
  const dy = t.y - BAYTOWN_Y
  const mx = (BAYTOWN_X + t.x) / 2
  const my = (BAYTOWN_Y + t.y) / 2
  const len = Math.max(Math.hypot(dx, dy), 1)
  // Perpendicular offset, scaled with chord length so longer arcs bow more.
  const bow = Math.min(len * 0.22, 90)
  const cx = mx + (-dy / len) * bow
  const cy = my + (dx / len) * bow
  return { name: t.name, d: `M ${BAYTOWN_X} ${BAYTOWN_Y} Q ${cx} ${cy} ${t.x} ${t.y}` }
})

// Topographic contour lines — three faint, slightly offset closed loops that
// suggest gentle terrain inland of the city without competing with the road
// network for the eye. Drawn behind everything urban.
const TOPO_CONTOURS = [
  'M 60 240 C 160 200, 280 200, 380 226 C 480 250, 540 296, 540 348 C 540 400, 478 442, 380 462 C 282 482, 178 472, 110 432 C 62 404, 32 360, 36 312 C 38 280, 46 256, 60 240 Z',
  'M 80 256 C 168 220, 268 220, 358 244 C 446 268, 500 308, 500 350 C 500 392, 446 428, 358 446 C 270 464, 184 456, 124 422 C 86 400, 60 364, 64 322 C 66 298, 72 274, 80 256 Z',
  'M 102 274 C 178 244, 258 246, 332 266 C 408 286, 454 318, 454 352 C 454 386, 408 416, 332 432 C 256 448, 184 442, 134 414 C 102 396, 84 368, 88 336 C 90 314, 96 292, 102 274 Z',
]

const CLOUDS = [
  { y: 70, scale: 1.0, delay: 0, duration: 60 },
  { y: 140, scale: 0.72, delay: 22, duration: 78 },
  { y: 36, scale: 0.55, delay: 44, duration: 92 },
  { y: 102, scale: 0.84, delay: 12, duration: 70 },
]

const BOAT_ROUTES = [
  { d: 'M 920 720 Q 1020 660 1100 600', duration: 48, delay: 2 },
  { d: 'M 1080 480 Q 980 520 880 540', duration: 64, delay: 14 },
]

// Plane path — a long graceful arc across the top quarter of the map.
const PLANE_PATH =
  'M -80 180 C 200 140, 480 120, 760 132 C 960 142, 1120 170, 1280 200'

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
        className="absolute inset-0 h-full w-full opacity-[0.86]"
      >
        <defs>
          <linearGradient id="bay-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.34" />
            <stop offset="55%" stopColor={ACCENT} stopOpacity="0.18" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.06" />
          </linearGradient>

          <linearGradient id="bay-sheen" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="vignette-mask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="38%" stopColor="#000" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
          </linearGradient>

          <radialGradient id="downtown-fade" cx="0.5" cy="0.65" r="0.6">
            <stop offset="0%" stopColor={ACCENT_HI} stopOpacity="0.22" />
            <stop offset="80%" stopColor={ACCENT_HI} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="pin-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.7" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sweep-grad" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={ACCENT_HI} stopOpacity="0.55" />
            <stop offset="55%" stopColor={ACCENT_HI} stopOpacity="0.18" />
            <stop offset="100%" stopColor={ACCENT_HI} stopOpacity="0" />
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
            {/* Sparse speckle — a few seeded dots per tile. Acts as paper grain
                without needing an SVG filter (which can be expensive). */}
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
            {/* Wake — soft trailing ripples */}
            <path
              d="M -14 6 Q -10 9 -4 7 Q 0 6 4 7 Q 10 9 14 6"
              fill="none"
              style={{ stroke: ACCENT_HI, strokeOpacity: 0.35 }}
              strokeWidth="0.5"
              strokeLinecap="round"
            />
            <path
              d="M -10 9 Q -4 11 4 10 Q 10 9 12 8"
              fill="none"
              style={{ stroke: ACCENT_HI, strokeOpacity: 0.2 }}
              strokeWidth="0.4"
              strokeLinecap="round"
            />
            {/* Hull */}
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
            <path
              d="M 0 -8 L 5.5 1 L 0 1 Z"
              style={{ fill: ACCENT_HI, fillOpacity: 0.95 }}
            />
            <path
              d="M 0 -6 L -4.5 1 L 0 1 Z"
              style={{ fill: ACCENT, fillOpacity: 0.78 }}
            />
            {/* Flag */}
            <line
              x1="0"
              y1="-8"
              x2="2.5"
              y2="-6.5"
              style={{ stroke: ACCENT }}
              strokeWidth="0.5"
            />
          </symbol>

          <symbol id="car-east" viewBox="-7 -3 14 6" overflow="visible">
            <rect
              x="-6.2"
              y="-2"
              width="12.4"
              height="4"
              rx="1.2"
              style={{ fill: ACCENT }}
            />
            <rect
              x="-2.5"
              y="-1.6"
              width="5"
              height="2.4"
              rx="0.5"
              fill="#dfe9ff"
              fillOpacity="0.92"
            />
            <circle cx="-4" cy="2" r="0.9" fill="#0a0a0a" />
            <circle cx="4" cy="2" r="0.9" fill="#0a0a0a" />
            {/* Headlights leading edge */}
            <rect
              x="5.6"
              y="-1.2"
              width="0.8"
              height="2.4"
              style={{ fill: '#fffaa8' }}
            />
          </symbol>

          <symbol id="car-west" viewBox="-7 -3 14 6" overflow="visible">
            <rect
              x="-6.2"
              y="-2"
              width="12.4"
              height="4"
              rx="1.2"
              style={{ fill: ACCENT_HI }}
            />
            <rect
              x="-2.5"
              y="-1.6"
              width="5"
              height="2.4"
              rx="0.5"
              fill="#dfe9ff"
              fillOpacity="0.92"
            />
            <circle cx="-4" cy="2" r="0.9" fill="#0a0a0a" />
            <circle cx="4" cy="2" r="0.9" fill="#0a0a0a" />
            <rect
              x="-6.4"
              y="-1.2"
              width="0.8"
              height="2.4"
              style={{ fill: '#ffd2a8' }}
            />
          </symbol>

          <symbol id="plane" viewBox="-16 -8 32 16" overflow="visible">
            {/* Fuselage */}
            <path
              d="M -14 0 L 8 -1.4 L 14 0 L 8 1.4 Z"
              style={{ fill: INK_SOFT, stroke: ACCENT_HI }}
              strokeWidth="0.5"
            />
            {/* Wings */}
            <path
              d="M 0 -1 L 6 -7 L 9 -7 L 4 -1 Z"
              style={{ fill: INK_MUTE }}
            />
            <path
              d="M 0 1 L 6 7 L 9 7 L 4 1 Z"
              style={{ fill: INK_MUTE }}
            />
            {/* Tail */}
            <path
              d="M -12 -0.5 L -10 -4 L -8 -4 L -10 -0.5 Z"
              style={{ fill: INK_MUTE }}
            />
          </symbol>

          <path id="i10-route" d={I10_PATH} />

          <mask id="bay-clip">
            <rect width="1200" height="800" fill="black" />
            <path d={COASTLINE_PATH} fill="white" />
            <path d={ATKINSON_ISLAND_PATH} fill="black" />
            <path d={PELICAN_ISLAND_PATH} fill="black" />
          </mask>
        </defs>

        {/* PAPER GRAIN — sub-pixel speckle across the whole sheet for tactile
            depth. Sits very low in the stack so nothing else loses contrast. */}
        <rect
          x="0"
          y="0"
          width="1200"
          height="800"
          fill="url(#grain-pattern)"
          opacity="0.4"
        />

        {/* TOPOGRAPHIC CONTOURS — faint inland terrain rings. Pure decoration:
            adds altitude variation behind the city grid. */}
        <motion.g
          fill="none"
          style={{ stroke: HAIR }}
          strokeWidth="0.6"
          {...fadeIntro(DETAIL_DELAY + 0.05, DETAIL_DUR + 0.1)}
        >
          {TOPO_CONTOURS.map((d, i) => (
            <path
              key={`topo-${i}`}
              d={d}
              strokeDasharray={i === 0 ? '0' : '3 5'}
              style={{ strokeOpacity: 0.55 - i * 0.12 }}
            />
          ))}
        </motion.g>

        {/* WATER — Trinity / Galveston Bay fill (no stroke yet; the coastline
            draws in on top as the intro's first beat). The sheen overlay adds
            a subtle directional light to the water. */}
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
          <path d={COASTLINE_PATH} fill="url(#bay-sheen)" />
        </motion.g>

        {/* BATHYMETRY — depth isolines inside the bay. Each one is faint and
            sits underneath everything floating on the water. */}
        <motion.g
          fill="none"
          strokeLinecap="round"
          {...fadeIntro(COASTLINE_DELAY + 0.6, 0.9)}
        >
          <path
            d={BATHY_OUTER}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.32 }}
            strokeWidth="0.7"
            strokeDasharray="1 4"
          />
          <path
            d={BATHY_MID}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.24 }}
            strokeWidth="0.7"
            strokeDasharray="1 5"
          />
          <path
            d={BATHY_INNER}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.18 }}
            strokeWidth="0.7"
            strokeDasharray="1 6"
          />
        </motion.g>

        {/* COASTLINE — first thing to draw itself in. */}
        <motion.path
          d={COASTLINE_PATH}
          fill="none"
          pathLength={1}
          strokeDasharray={1}
          style={{ stroke: ACCENT_HI, strokeOpacity: 0.7 }}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...drawIntro(COASTLINE_DELAY, COASTLINE_DUR)}
        />

        {/* ISLANDS — small detached land bodies in the bay. */}
        <motion.g {...fadeIntro(COASTLINE_DELAY + 0.9, 0.6)}>
          <path
            d={ATKINSON_ISLAND_PATH}
            style={{ fill: PAPER_FILL, stroke: ACCENT_HI, strokeOpacity: 0.6 }}
            strokeWidth="1"
          />
          <path
            d={PELICAN_ISLAND_PATH}
            style={{ fill: PAPER_FILL, stroke: ACCENT_HI, strokeOpacity: 0.55 }}
            strokeWidth="0.9"
          />
          {MARSH_DOTS.map((m, i) => (
            <circle
              key={`marsh-${i}`}
              cx={m.x}
              cy={m.y}
              r={m.r}
              style={{ fill: ACCENT_HI, fillOpacity: 0.55 }}
            />
          ))}
        </motion.g>

        {/* RAIL TIES — quiet texture along the channel. */}
        <motion.g
          style={{ stroke: HAIR_STRONG }}
          strokeWidth="0.8"
          {...fadeIntro(DETAIL_DELAY, DETAIL_DUR)}
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <line
              key={`tie-${i}`}
              x1={20 + i * 20}
              y1="638"
              x2={20 + i * 20}
              y2="646"
            />
          ))}
        </motion.g>

        {/* DOWNTOWN HALO — a soft accent-blue puddle behind the skyline so
            it reads as the brightest urban node on the sheet. */}
        <motion.ellipse
          cx="312"
          cy="320"
          rx="200"
          ry="120"
          fill="url(#downtown-fade)"
          {...fadeIntro(DETAIL_DELAY + 0.1, 0.9)}
        />

        {/* ROUTE GLOW — accent-blue bloom under the main highways. Drawn first
            so it sits beneath the road shadows and the road strokes. */}
        <motion.g
          fill="none"
          strokeLinecap="round"
          style={{ filter: 'blur(7px)' }}
          {...fadeIntro(ROAD_DELAY + 0.15, 0.9)}
        >
          <path d={I10_PATH} style={{ stroke: GLOW }} strokeWidth="10" />
          <path
            d={TX146_PATH}
            style={{ stroke: GLOW, strokeOpacity: 0.85 }}
            strokeWidth="7.5"
          />
        </motion.g>

        {/* ROAD SHADOWS — wider faint stroke under the line for depth. Fade in
            with the roads they're behind. */}
        <motion.g
          fill="none"
          strokeLinecap="round"
          {...fadeIntro(ROAD_DELAY, 0.8)}
        >
          <path d={I10_PATH} style={{ stroke: ROAD_SHADOW }} strokeWidth="7" />
          <path
            d={TX146_PATH}
            style={{ stroke: ROAD_SHADOW, strokeOpacity: 0.9 }}
            strokeWidth="6"
          />
          <path
            d={SH225_PATH}
            style={{ stroke: ROAD_SHADOW, strokeOpacity: 0.8 }}
            strokeWidth="5"
          />
          <path
            d={SHIP_CHANNEL_PATH}
            style={{ stroke: ROAD_SHADOW, strokeOpacity: 0.65 }}
            strokeWidth="3.5"
          />
        </motion.g>

        {/* SECONDARY RING ROADS — Beltway 8 and I-610 inner loop. Drawn
            before the primary corridors so they sit visually beneath them. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d={BELTWAY_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: INK_FAINT }}
            strokeWidth="1.6"
            {...drawIntro(ROAD_DELAY + 0.35, ROAD_DUR - 0.15)}
          />
          <motion.path
            d={LOOP610_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: INK_FAINT, strokeOpacity: 0.8 }}
            strokeWidth="1.3"
            {...drawIntro(ROAD_DELAY + 0.45, ROAD_DUR - 0.2)}
          />
        </g>

        {/* PRIMARY ROADS — drawn in stroke-by-stroke. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d={I10_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: INK_SOFT }}
            strokeWidth="3.6"
            {...drawIntro(ROAD_DELAY, ROAD_DUR)}
          />
          <motion.path
            d={TX146_PATH}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: INK_MUTE }}
            strokeWidth="2.8"
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
        </g>

        {/* DASHED OVERLAYS — ship channel dashes + flowing I-10 lane dashes.
            The I-10 dashes get a slow animated dashoffset so the lane stripes
            appear to crawl east, suggesting traffic flow even between cars. */}
        <motion.g
          fill="none"
          strokeLinecap="round"
          {...fadeIntro(DETAIL_DELAY, DETAIL_DUR)}
        >
          <path
            d={SHIP_CHANNEL_PATH}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.7 }}
            strokeWidth="1.6"
            strokeDasharray="2 4"
          />
          <motion.path
            d={I10_PATH}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.7 }}
            strokeWidth="0.9"
            strokeDasharray="8 12"
            initial={false}
            animate={reduced ? undefined : { strokeDashoffset: [0, -40] }}
            transition={
              reduced
                ? undefined
                : { duration: 2.6, repeat: Infinity, ease: 'linear' }
            }
          />
          <motion.path
            d={TX146_PATH}
            style={{ stroke: ACCENT_HI, strokeOpacity: 0.55 }}
            strokeWidth="0.8"
            strokeDasharray="6 10"
            initial={false}
            animate={reduced ? undefined : { strokeDashoffset: [0, -32] }}
            transition={
              reduced
                ? undefined
                : { duration: 3.4, repeat: Infinity, ease: 'linear' }
            }
          />
        </motion.g>

        {/* SMALLER STREETS — Baytown street grid. */}
        <motion.g
          style={{ stroke: HAIR }}
          strokeWidth="0.7"
          {...fadeIntro(DETAIL_DELAY + 0.1, DETAIL_DUR)}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`bt-h-${i}`}
              x1={592}
              y1={450 + i * 22}
              x2={732}
              y2={450 + i * 22}
            />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={`bt-v-${i}`}
              x1={592 + i * 22}
              y1={450}
              x2={592 + i * 22}
              y2={560}
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

        {/* DOWNTOWN HOUSTON SKYLINE — more buildings, varied silhouettes
            (flat-topped, pitched, antennae). */}
        <motion.g {...fadeIntro(DETAIL_DELAY + 0.15, DETAIL_DUR + 0.1)}>
          <line
            x1="176"
            y1="358"
            x2="452"
            y2="358"
            style={{ stroke: INK_MUTE }}
            strokeWidth="1"
          />
          {DOWNTOWN_BUILDINGS.map((b, i) => (
            <g key={`bld-${i}`}>
              {/* Subtle drop shadow plate behind the building */}
              <rect
                x={b.x + 1.4}
                y={b.y + 1.6}
                width={b.w}
                height={b.h}
                style={{ fill: ROAD_SHADOW, fillOpacity: 0.45 }}
              />
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                style={{ fill: PAPER_FILL, stroke: INK_MUTE }}
                strokeWidth="0.8"
              />
              {/* Pitched roof — small triangular cap */}
              {b.pitched && (
                <path
                  d={`M ${b.x - 1} ${b.y} L ${b.x + b.w / 2} ${b.y - 7} L ${b.x + b.w + 1} ${b.y}`}
                  style={{ fill: PAPER_FILL, stroke: INK_MUTE }}
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
              )}
              {/* Antenna / spire */}
              {b.ant && (
                <>
                  <line
                    x1={b.x + b.w / 2}
                    y1={b.y}
                    x2={b.x + b.w / 2}
                    y2={b.y - 12}
                    style={{ stroke: INK_MUTE }}
                    strokeWidth="0.7"
                  />
                  <circle
                    cx={b.x + b.w / 2}
                    cy={b.y - 13}
                    r="1"
                    style={{ fill: ACCENT_HI }}
                  />
                </>
              )}
              {/* Window rows */}
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
                reduced ? undefined : { opacity: [0.25, 1, 0.4, 0.9, 0.3] }
              }
              transition={{
                duration: 3 + (i % 4) * 0.6,
                delay: VEHICLE_DELAY + i * 0.32,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.g>

        {/* SERVICE ARCS — graceful Bezier arcs from the Baytown pin to each
            satellite town. Each arc draws in after the road skeleton lands
            and then pulses subtly. Visually ties the studio's location to
            every town it serves. */}
        <g fill="none" strokeLinecap="round">
          {SATELLITE_ARCS.map((arc, i) => (
            <motion.path
              key={`arc-${arc.name}`}
              d={arc.d}
              pathLength={1}
              strokeDasharray={1}
              style={{ stroke: ACCENT_HI, strokeOpacity: 0.55 }}
              strokeWidth="1.1"
              {...drawIntro(PIN_DELAY + 0.4 + i * 0.08, 0.8)}
            />
          ))}
        </g>

        {/* SUBURB MARKERS — drop in after the road skeleton lands. */}
        <g>
          {SATELLITE_TOWNS.map((s, i) => (
            <motion.g
              key={`s-${i}`}
              {...dropIntro(PIN_DELAY + i * 0.04, PIN_DUR)}
            >
              <circle
                cx={s.x}
                cy={s.y}
                r="4.2"
                fill="none"
                style={{ stroke: INK_MUTE }}
                strokeWidth="0.9"
              />
              <circle
                cx={s.x}
                cy={s.y}
                r="1.8"
                style={{ fill: ACCENT_HI }}
              />
              {/* Subtle pulse on each satellite — staggered so the eye
                  doesn't read them as a single beat. */}
              {!reduced && (
                <motion.circle
                  cx={s.x}
                  cy={s.y}
                  r="4.2"
                  fill="none"
                  style={{
                    stroke: ACCENT,
                    transformOrigin: 'center',
                    transformBox: 'fill-box',
                  }}
                  strokeWidth="0.8"
                  initial={{ scale: 1, opacity: 0.6 }}
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
              x={
                t.align === 'end'
                  ? t.x - 8
                  : t.align === 'start'
                    ? t.x + 8
                    : t.x
              }
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
          <text
            x="800"
            y="448"
            style={{ fill: ACCENT_HI, fillOpacity: 0.7 }}
            fontSize="7"
            letterSpacing="2"
          >
            GALVESTON BAY
          </text>
          <text
            x="918"
            y="552"
            style={{ fill: INK_FAINT }}
            fontSize="6.5"
            letterSpacing="2"
          >
            ATKINSON IS.
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
            <rect
              x="-14"
              y="-10"
              width="28"
              height="20"
              style={{ fill: PAPER_FILL, stroke: INK_SOFT }}
              strokeWidth="1"
            />
            <text
              textAnchor="middle"
              y="4"
              style={{ fill: INK_SOFT }}
              fontWeight="600"
            >
              I-10
            </text>
          </g>
          <g transform="translate(700 188)">
            <rect
              x="-14"
              y="-10"
              width="28"
              height="20"
              style={{ fill: PAPER_FILL, stroke: INK_MUTE }}
              strokeWidth="0.9"
            />
            <text
              textAnchor="middle"
              y="4"
              style={{ fill: INK_MUTE }}
              fontWeight="600"
            >
              146
            </text>
          </g>
          <g transform="translate(220 540)">
            <rect
              x="-14"
              y="-10"
              width="28"
              height="20"
              style={{ fill: PAPER_FILL, stroke: INK_MUTE }}
              strokeWidth="0.9"
            />
            <text
              textAnchor="middle"
              y="4"
              style={{ fill: INK_MUTE }}
              fontWeight="600"
            >
              225
            </text>
          </g>
          <g transform="translate(132 416)">
            <rect
              x="-16"
              y="-10"
              width="32"
              height="20"
              style={{ fill: PAPER_FILL, stroke: INK_FAINT }}
              strokeWidth="0.8"
            />
            <text
              textAnchor="middle"
              y="4"
              style={{ fill: INK_MUTE }}
              fontWeight="600"
              fontSize="7"
            >
              BW 8
            </text>
          </g>
          <g transform="translate(266 482)">
            <rect
              x="-14"
              y="-10"
              width="28"
              height="20"
              style={{ fill: PAPER_FILL, stroke: INK_FAINT }}
              strokeWidth="0.8"
            />
            <text
              textAnchor="middle"
              y="4"
              style={{ fill: INK_MUTE }}
              fontWeight="600"
              fontSize="7"
            >
              610
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

        {/* PLANE — sweeps across the upper sheet on a graceful arc with a
            soft vapor trail that fades out behind it. */}
        {!reduced && (
          <>
            <motion.path
              d={PLANE_PATH}
              fill="none"
              style={{ stroke: INK_FAINT, strokeOpacity: 0.4 }}
              strokeWidth="0.8"
              strokeDasharray="1 6"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: -200 }}
              transition={{
                duration: 22,
                delay: VEHICLE_DELAY + 4,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
            <motion.g
              animate={{ offsetDistance: ['0%', '100%'] }}
              style={{
                offsetPath: `path('${PLANE_PATH}')`,
                offsetRotate: 'auto',
              }}
              transition={{
                duration: 38,
                delay: VEHICLE_DELAY + 5,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <use href="#plane" x="-16" y="-8" width="32" height="16" />
            </motion.g>
          </>
        )}

        {/* CARS on I-10 — eastbound and westbound. Ambient loops start after
            the road draw-in completes. The <use> stays at authored size. */}
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{
            offsetPath: `path('${I10_PATH}')`,
            offsetRotate: 'auto',
          }}
          transition={{
            duration: 26,
            delay: VEHICLE_DELAY,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <use href="#car-east" x="-7" y="-3" width="14" height="6" />
        </motion.g>
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{
            offsetPath: `path('${I10_PATH}')`,
            offsetRotate: 'auto',
          }}
          transition={{
            duration: 30,
            delay: VEHICLE_DELAY + 12,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <use href="#car-east" x="-7" y="-3" width="14" height="6" />
        </motion.g>
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['100%', '0%'] }}
          style={{
            offsetPath: `path('${I10_PATH}')`,
            offsetRotate: 'auto',
          }}
          transition={{
            duration: 34,
            delay: VEHICLE_DELAY + 4,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <use href="#car-west" x="-7" y="-3" width="14" height="6" />
        </motion.g>
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['100%', '0%'] }}
          style={{
            offsetPath: `path('${I10_PATH}')`,
            offsetRotate: 'auto',
          }}
          transition={{
            duration: 40,
            delay: VEHICLE_DELAY + 18,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <use href="#car-west" x="-7" y="-3" width="14" height="6" />
        </motion.g>

        {/* CAR on TX-146. */}
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{
            offsetPath: `path('${TX146_PATH}')`,
            offsetRotate: 'auto',
          }}
          transition={{
            duration: 30,
            delay: VEHICLE_DELAY + 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <use href="#car-east" x="-7" y="-3" width="14" height="6" />
        </motion.g>

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

        {/* BAYTOWN "YOU ARE HERE" MARKER — pinned at Baytown. Drops in last,
            then becomes the focal beacon: ambient glow puddle, service-radius
            rings rippling outward, and a rotating radar sweep that quietly
            scans the corridor. */}
        <motion.g
          transform={`translate(${BAYTOWN_X} ${BAYTOWN_Y})`}
          {...dropIntro(PIN_DELAY + 0.2, PIN_DUR + 0.15)}
        >
          {/* Ambient glow underneath the pin — soft halo for depth */}
          <circle cx="0" cy="0" r="56" fill="url(#pin-glow)" />

          {/* Service-radius rings — three concentric, fading outward */}
          {!reduced && (
            <>
              <motion.circle
                cx="0"
                cy="0"
                r="6"
                fill="none"
                style={{
                  stroke: ACCENT,
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                }}
                strokeWidth="1.2"
                initial={{ scale: 1, opacity: 0.75 }}
                animate={{ scale: 6, opacity: 0 }}
                transition={{
                  duration: 3.2,
                  delay: VEHICLE_DELAY,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
              <motion.circle
                cx="0"
                cy="0"
                r="6"
                fill="none"
                style={{
                  stroke: ACCENT,
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                }}
                strokeWidth="1"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 6, opacity: 0 }}
                transition={{
                  duration: 3.2,
                  delay: VEHICLE_DELAY + 1.1,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
              <motion.circle
                cx="0"
                cy="0"
                r="6"
                fill="none"
                style={{
                  stroke: ACCENT_HI,
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                }}
                strokeWidth="0.8"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 6, opacity: 0 }}
                transition={{
                  duration: 3.2,
                  delay: VEHICLE_DELAY + 2.2,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />

              {/* Radar sweep — a soft wedge that rotates around the pin */}
              <motion.g
                style={{ transformOrigin: '0px 0px' }}
                animate={{ rotate: 360 }}
                transition={{
                  duration: 9,
                  delay: VEHICLE_DELAY,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <path
                  d="M 0 0 L 50 -22 A 55 55 0 0 1 50 22 Z"
                  fill="url(#sweep-grad)"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="55"
                  y2="0"
                  style={{ stroke: ACCENT_HI, strokeOpacity: 0.6 }}
                  strokeWidth="0.7"
                />
              </motion.g>

              {/* Static range graticule — the radar's reference rings */}
              <circle
                cx="0"
                cy="0"
                r="22"
                fill="none"
                style={{ stroke: ACCENT, strokeOpacity: 0.18 }}
                strokeWidth="0.5"
                strokeDasharray="2 4"
              />
              <circle
                cx="0"
                cy="0"
                r="42"
                fill="none"
                style={{ stroke: ACCENT, strokeOpacity: 0.12 }}
                strokeWidth="0.5"
                strokeDasharray="2 5"
              />
            </>
          )}

          {/* targeting crosshair */}
          <line
            x1="-14"
            y1="0"
            x2="-7"
            y2="0"
            style={{ stroke: ACCENT_HI }}
            strokeWidth="1"
          />
          <line
            x1="7"
            y1="0"
            x2="14"
            y2="0"
            style={{ stroke: ACCENT_HI }}
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="-14"
            x2="0"
            y2="-7"
            style={{ stroke: ACCENT_HI }}
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="7"
            x2="0"
            y2="14"
            style={{ stroke: ACCENT_HI }}
            strokeWidth="1"
          />
          {/* core dot — outer ring, accent core, white center */}
          <circle
            cx="0"
            cy="0"
            r="6.5"
            fill="none"
            style={{ stroke: ACCENT }}
            strokeWidth="0.9"
          />
          <circle cx="0" cy="0" r="5" style={{ fill: ACCENT }} />
          <circle cx="0" cy="0" r="2.2" fill="#fff" />

          {/* callout flag */}
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-34"
            style={{ stroke: ACCENT }}
            strokeWidth="1.1"
          />
          <g transform="translate(0 -54)">
            {/* shadow plate */}
            <rect
              x="-43"
              y="-13"
              width="88"
              height="22"
              style={{ fill: ROAD_SHADOW, fillOpacity: 0.55 }}
            />
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
          <circle
            cx="0"
            cy="0"
            r="30"
            fill="none"
            style={{ stroke: INK_FAINT }}
            strokeWidth="0.9"
          />
          <circle
            cx="0"
            cy="0"
            r="24"
            fill="none"
            style={{ stroke: HAIR_STRONG }}
            strokeWidth="0.6"
          />
          <circle
            cx="0"
            cy="0"
            r="18"
            fill="none"
            style={{ stroke: HAIR }}
            strokeWidth="0.5"
            strokeDasharray="1 3"
          />
          {/* Cardinal + intercardinal tick marks */}
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i * Math.PI) / 8
            const x1 = Math.cos(a) * 26
            const y1 = Math.sin(a) * 26
            const x2 = Math.cos(a) * (i % 4 === 0 ? 32 : 29)
            const y2 = Math.sin(a) * (i % 4 === 0 ? 32 : 29)
            return (
              <line
                key={`cr-tk-${i}`}
                x1={x1.toFixed(2)}
                y1={y1.toFixed(2)}
                x2={x2.toFixed(2)}
                y2={y2.toFixed(2)}
                style={{ stroke: INK_FAINT, strokeOpacity: i % 4 === 0 ? 1 : 0.55 }}
                strokeWidth={i % 4 === 0 ? 0.9 : 0.5}
              />
            )
          })}
          <line
            x1="0"
            y1="-32"
            x2="0"
            y2="32"
            style={{ stroke: INK_FAINT }}
            strokeWidth="0.5"
          />
          <line
            x1="-32"
            y1="0"
            x2="32"
            y2="0"
            style={{ stroke: INK_FAINT }}
            strokeWidth="0.5"
          />
          {/* Needle */}
          <path
            d="M 0 -24 L 5 0 L 0 24 L -5 0 Z"
            style={{ fill: PAPER_FILL, stroke: INK_SOFT }}
            strokeWidth="0.9"
          />
          <path
            d="M 0 -24 L 5 0 L -5 0 Z"
            style={{ fill: ACCENT }}
          />
          {/* Center pivot */}
          <circle
            cx="0"
            cy="0"
            r="1.8"
            style={{ fill: PAPER_FILL, stroke: ACCENT }}
            strokeWidth="0.7"
          />
          <text
            textAnchor="middle"
            y="-36"
            fontSize="8"
            letterSpacing="2"
            style={{ fill: ACCENT_HI }}
            fontWeight="600"
          >
            N
          </text>
          <text
            textAnchor="middle"
            y="42"
            fontSize="7"
            letterSpacing="2"
            style={{ fill: INK_FAINT }}
          >
            S
          </text>
          <text
            textAnchor="middle"
            x="-36"
            y="3"
            fontSize="7"
            letterSpacing="2"
            style={{ fill: INK_FAINT }}
          >
            W
          </text>
          <text
            textAnchor="middle"
            x="36"
            y="3"
            fontSize="7"
            letterSpacing="2"
            style={{ fill: INK_FAINT }}
          >
            E
          </text>
        </motion.g>

        {/* SCALE BAR — bottom right. */}
        <motion.g
          transform="translate(1010 740)"
          fontFamily="'Geist Mono', ui-monospace, monospace"
          {...fadeIntro(DETAIL_DELAY + 0.35, DETAIL_DUR + 0.1)}
        >
          <line
            x1="0"
            y1="0"
            x2="120"
            y2="0"
            style={{ stroke: INK_MUTE }}
            strokeWidth="0.9"
          />
          <line
            x1="0"
            y1="-3"
            x2="0"
            y2="3"
            style={{ stroke: INK_MUTE }}
            strokeWidth="0.9"
          />
          {/* Sub-ticks every 10 units */}
          {Array.from({ length: 11 }).map((_, i) => (
            <line
              key={`sc-${i}`}
              x1={i * 12}
              y1="-1.5"
              x2={i * 12}
              y2="1.5"
              style={{ stroke: INK_FAINT }}
              strokeWidth="0.5"
            />
          ))}
          <line
            x1="40"
            y1="-3"
            x2="40"
            y2="3"
            style={{ stroke: INK_MUTE }}
            strokeWidth="0.8"
          />
          <line
            x1="80"
            y1="-3"
            x2="80"
            y2="3"
            style={{ stroke: INK_MUTE }}
            strokeWidth="0.8"
          />
          <line
            x1="120"
            y1="-3"
            x2="120"
            y2="3"
            style={{ stroke: INK_MUTE }}
            strokeWidth="0.9"
          />
          <text
            x="60"
            y="14"
            textAnchor="middle"
            fontSize="7"
            letterSpacing="2"
            style={{ fill: INK_FAINT }}
          >
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
          <line
            x1="0"
            y1="-6"
            x2="36"
            y2="-6"
            style={{ stroke: ACCENT }}
            strokeWidth="1.2"
          />
          <text y="8" fontSize="9" letterSpacing="2.5" style={{ fill: ACCENT }}>
            // SHEET 01 — SERVICE AREA
          </text>
          <text y="26" fontSize="7" letterSpacing="3" style={{ fill: INK_FAINT }}>
            HOUSTON METRO · GULF COAST
          </text>
          <text y="42" fontSize="6.5" letterSpacing="3" style={{ fill: INK_FAINT }}>
            REV 5 · TAYLORURL LLC
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
