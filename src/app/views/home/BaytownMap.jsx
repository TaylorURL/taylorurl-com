import { motion, useReducedMotion } from 'framer-motion'

/**
 * Hand-built illustrated map of the Baytown / Houston corridor — drawn in the
 * site's engineering-blueprint vocabulary (hairline strokes, accent ink, mono
 * labels). Lives behind the hero copy as ambient, animated wallpaper:
 * cars run along I-10, a boat drifts across Trinity Bay, downtown lights
 * twinkle, clouds drift, and a pulsing accent marker pins Baytown — TaylorURL's
 * home. Honors `prefers-reduced-motion` via framer-motion.
 */

const HAIR = 'rgba(255, 255, 255, 0.18)'
const HAIR_FAINT = 'rgba(255, 255, 255, 0.10)'
const INK_FAINT = 'rgba(255, 255, 255, 0.32)'
const INK_MUTE = 'rgba(255, 255, 255, 0.5)'
const INK_SOFT = 'rgba(255, 255, 255, 0.72)'
const ACCENT = '#2f6bff'
const ACCENT_HI = '#4f86ff'

const EASE_DRIFT = [0.45, 0, 0.55, 1]

const I10_PATH = 'M -40 410 Q 180 390 360 412 T 720 410 T 1080 408 L 1260 410'
const TX146_PATH = 'M 680 -10 L 678 240 Q 676 360 686 480 L 690 620'
const SH225_PATH = 'M 200 540 Q 360 540 520 538 T 820 540'
const SHIP_CHANNEL_PATH = 'M -40 600 Q 260 588 540 596 T 900 612 L 1260 632'
const TRINITY_RIVER_PATH =
  'M 660 -10 Q 678 80 666 170 Q 650 250 690 340 Q 720 420 770 510 Q 810 580 830 660'
const BELTWAY_PATH = 'M 380 380 a 170 130 0 1 0 -2 0 z'

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

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-[0.58]"
      >
        <defs>
          <linearGradient id="bay-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
            <stop offset="60%" stopColor={ACCENT} stopOpacity="0.10" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.04" />
          </linearGradient>

          <linearGradient id="vignette-mask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="38%" stopColor="#000" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
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
              stroke={ACCENT_HI}
              strokeOpacity="0.28"
              strokeWidth="0.8"
            />
          </pattern>

          <symbol id="cloud" viewBox="0 0 80 24" overflow="visible">
            <path
              d="M 4 18 Q 4 8 16 8 Q 18 0 30 4 Q 38 -2 48 4 Q 60 0 64 10 Q 76 10 76 18 Z"
              fill="none"
              stroke={INK_FAINT}
              strokeWidth="0.7"
            />
          </symbol>

          <symbol id="boat" viewBox="-12 -12 24 24" overflow="visible">
            <path
              d="M -8 4 L 8 4 L 6 8 L -6 8 Z"
              fill={INK_SOFT}
              stroke={ACCENT_HI}
              strokeWidth="0.6"
            />
            <line x1="0" y1="4" x2="0" y2="-7" stroke={ACCENT_HI} strokeWidth="0.7" />
            <path d="M 0 -7 L 5 1 L 0 1 Z" fill={ACCENT_HI} fillOpacity="0.9" />
            <path d="M 0 -5 L -4 1 L 0 1 Z" fill={ACCENT} fillOpacity="0.7" />
          </symbol>

          <symbol id="car-east" viewBox="-7 -3 14 6" overflow="visible">
            <rect x="-6" y="-2" width="12" height="4" rx="1.2" fill={ACCENT} />
            <rect x="-2.5" y="-1.6" width="5" height="2.4" rx="0.5" fill="#dfe9ff" fillOpacity="0.85" />
            <circle cx="-4" cy="2" r="0.9" fill="#0a0a0a" />
            <circle cx="4" cy="2" r="0.9" fill="#0a0a0a" />
          </symbol>

          <symbol id="car-west" viewBox="-7 -3 14 6" overflow="visible">
            <rect x="-6" y="-2" width="12" height="4" rx="1.2" fill={ACCENT_HI} />
            <rect x="-2.5" y="-1.6" width="5" height="2.4" rx="0.5" fill="#dfe9ff" fillOpacity="0.85" />
            <circle cx="-4" cy="2" r="0.9" fill="#0a0a0a" />
            <circle cx="4" cy="2" r="0.9" fill="#0a0a0a" />
          </symbol>

          <path id="i10-route" d={I10_PATH} />
          <path id="boat-route" d="M 920 720 Q 1020 660 1100 600" />

          <mask id="bay-clip">
            <rect width="1200" height="800" fill="black" />
            <path
              d="M 1200 360 L 1200 800 L 360 800 Q 520 700 660 660 Q 800 620 920 600 Q 1020 588 1100 540 Q 1170 500 1200 460 Z"
              fill="white"
            />
          </mask>
        </defs>

        {/* WATER — Trinity / Galveston Bay */}
        <g>
          <path
            d="M 1200 360 L 1200 800 L 360 800 Q 520 700 660 660 Q 800 620 920 600 Q 1020 588 1100 540 Q 1170 500 1200 460 Z"
            fill="url(#bay-fill)"
            stroke={ACCENT_HI}
            strokeOpacity="0.35"
            strokeWidth="0.8"
          />
          <rect
            x="0"
            y="0"
            width="1200"
            height="800"
            fill="url(#wave-pattern)"
            mask="url(#bay-clip)"
          />
        </g>

        {/* RAIL TIES — quiet texture along the channel */}
        <g stroke={HAIR} strokeWidth="0.6">
          {Array.from({ length: 60 }).map((_, i) => (
            <line key={`tie-${i}`} x1={20 + i * 20} y1="638" x2={20 + i * 20} y2="646" />
          ))}
        </g>

        {/* ROAD SHADOWS — slightly wider faint stroke under the line for depth */}
        <g fill="none" strokeLinecap="round">
          <path d={I10_PATH} stroke="#000" strokeOpacity="0.55" strokeWidth="6" />
          <path d={TX146_PATH} stroke="#000" strokeOpacity="0.5" strokeWidth="5" />
          <path d={SH225_PATH} stroke="#000" strokeOpacity="0.45" strokeWidth="4" />
          <path d={SHIP_CHANNEL_PATH} stroke="#000" strokeOpacity="0.4" strokeWidth="3" />
        </g>

        {/* PRIMARY ROADS */}
        <g fill="none" strokeLinecap="round">
          <path d={I10_PATH} stroke={INK_SOFT} strokeWidth="2.2" />
          <path d={TX146_PATH} stroke={INK_MUTE} strokeWidth="1.8" />
          <path d={SH225_PATH} stroke={INK_MUTE} strokeWidth="1.4" />
          <path d={SHIP_CHANNEL_PATH} stroke={ACCENT_HI} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="2 4" />
          <path d={TRINITY_RIVER_PATH} stroke={ACCENT} strokeOpacity="0.45" strokeWidth="1.4" />
          <path d={BELTWAY_PATH} stroke={INK_FAINT} strokeWidth="1.1" />
        </g>

        {/* LANE DASHES on I-10 */}
        <path
          d={I10_PATH}
          fill="none"
          stroke={ACCENT_HI}
          strokeOpacity="0.55"
          strokeWidth="0.7"
          strokeDasharray="8 12"
        />

        {/* SMALLER STREETS — Baytown street grid */}
        <g stroke={HAIR_FAINT} strokeWidth="0.6">
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
        </g>

        {/* SUBURBAN BLOCKS — Baytown */}
        <g>
          {BAYTOWN_BLOCKS.map((b, i) => (
            <rect
              key={`bl-${i}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={HAIR}
              stroke={INK_FAINT}
              strokeWidth="0.4"
            />
          ))}
        </g>

        {/* DOWNTOWN HOUSTON SKYLINE */}
        <g>
          <line
            x1="180"
            y1="358"
            x2="412"
            y2="358"
            stroke={INK_MUTE}
            strokeWidth="0.8"
          />
          {DOWNTOWN_BUILDINGS.map((b, i) => (
            <g key={`bld-${i}`}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="#0a0a0a"
                stroke={INK_MUTE}
                strokeWidth="0.7"
              />
              {/* faint window grid */}
              {Array.from({ length: Math.floor(b.h / 8) }).map((_, j) => (
                <line
                  key={`w-${i}-${j}`}
                  x1={b.x + 2}
                  y1={b.y + 4 + j * 8}
                  x2={b.x + b.w - 2}
                  y2={b.y + 4 + j * 8}
                  stroke={INK_FAINT}
                  strokeWidth="0.25"
                />
              ))}
            </g>
          ))}

          {/* TWINKLING LIGHTS */}
          {DOWNTOWN_LIGHTS.map((l, i) => (
            <motion.rect
              key={`lt-${i}`}
              x={l.x}
              y={l.y}
              width="1.6"
              height="1.6"
              fill={ACCENT_HI}
              animate={
                reduced
                  ? undefined
                  : { opacity: [0.25, 1, 0.4, 0.9, 0.3] }
              }
              transition={{
                duration: 3 + (i % 4) * 0.6,
                delay: i * 0.35,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </g>

        {/* SUBURB MARKERS */}
        <g>
          {SUBURB_DOTS.map((s, i) => (
            <g key={`s-${i}`}>
              <circle cx={s.x} cy={s.y} r="3" fill="none" stroke={INK_MUTE} strokeWidth="0.7" />
              <circle cx={s.x} cy={s.y} r="1.2" fill={INK_SOFT} />
            </g>
          ))}
        </g>

        {/* TOWN LABELS */}
        <g
          fontFamily="'Geist Mono', ui-monospace, monospace"
          fontSize="9"
          letterSpacing="2"
          fill={INK_SOFT}
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
              fill={INK_MUTE}
              fontSize="8"
              letterSpacing="1.8"
            >
              {t.name.toUpperCase()}
            </text>
          ))}
          <text
            x="940"
            y="700"
            fill={ACCENT_HI}
            fillOpacity="0.85"
            fontSize="8"
            letterSpacing="2"
          >
            TRINITY BAY
          </text>
        </g>

        {/* HIGHWAY SHIELDS */}
        <g fontFamily="'Geist Mono', ui-monospace, monospace" fontSize="8" letterSpacing="1">
          <g transform="translate(540 384)">
            <rect x="-14" y="-10" width="28" height="20" fill="#0a0a0a" stroke={INK_SOFT} strokeWidth="0.8" />
            <text textAnchor="middle" y="4" fill={INK_SOFT} fontWeight="600">
              I-10
            </text>
          </g>
          <g transform="translate(700 188)">
            <rect x="-14" y="-10" width="28" height="20" fill="#0a0a0a" stroke={INK_MUTE} strokeWidth="0.7" />
            <text textAnchor="middle" y="4" fill={INK_MUTE} fontWeight="600">
              146
            </text>
          </g>
          <g transform="translate(220 540)">
            <rect x="-14" y="-10" width="28" height="20" fill="#0a0a0a" stroke={INK_MUTE} strokeWidth="0.7" />
            <text textAnchor="middle" y="4" fill={INK_MUTE} fontWeight="600">
              225
            </text>
          </g>
        </g>

        {/* DRIFTING CLOUDS */}
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
                delay: c.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </g>

        {/* CARS on I-10 — eastbound and westbound */}
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{ offsetPath: `path('${I10_PATH}')`, offsetRotate: 'auto' }}
          transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
        >
          <use href="#car-east" />
        </motion.g>
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['100%', '0%'] }}
          style={{ offsetPath: `path('${I10_PATH}')`, offsetRotate: 'auto' }}
          transition={{ duration: 34, repeat: Infinity, ease: 'linear', delay: 4 }}
        >
          <use href="#car-west" />
        </motion.g>

        {/* CAR on TX-146 */}
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{ offsetPath: `path('${TX146_PATH}')`, offsetRotate: 'auto' }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear', delay: 8 }}
        >
          <use href="#car-east" />
        </motion.g>

        {/* BOAT drifting on the bay */}
        <motion.g
          animate={reduced ? undefined : { offsetDistance: ['0%', '100%'] }}
          style={{ offsetPath: `path('M 900 720 Q 1020 660 1100 600')`, offsetRotate: 'auto' }}
          transition={{ duration: 48, repeat: Infinity, ease: EASE_DRIFT, delay: 2 }}
        >
          <motion.g
            animate={reduced ? undefined : { y: [0, -1.5, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <use href="#boat" />
          </motion.g>
        </motion.g>

        {/* BAYTOWN "YOU ARE HERE" MARKER — pinned at Baytown */}
        <g transform="translate(680 580)">
          {/* outer pulse rings */}
          {!reduced && (
            <>
              <motion.g
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 5, opacity: 0 }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
                style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
              >
                <circle cx="0" cy="0" r="6" fill="none" stroke={ACCENT} strokeWidth="1" />
              </motion.g>
              <motion.g
                initial={{ scale: 1, opacity: 0.55 }}
                animate={{ scale: 5, opacity: 0 }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut', delay: 1.3 }}
                style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
              >
                <circle cx="0" cy="0" r="6" fill="none" stroke={ACCENT} strokeWidth="0.8" />
              </motion.g>
            </>
          )}
          {/* targeting crosshair */}
          <line x1="-12" y1="0" x2="-7" y2="0" stroke={ACCENT_HI} strokeWidth="0.8" />
          <line x1="7" y1="0" x2="12" y2="0" stroke={ACCENT_HI} strokeWidth="0.8" />
          <line x1="0" y1="-12" x2="0" y2="-7" stroke={ACCENT_HI} strokeWidth="0.8" />
          <line x1="0" y1="7" x2="0" y2="12" stroke={ACCENT_HI} strokeWidth="0.8" />
          {/* core dot */}
          <circle cx="0" cy="0" r="5" fill={ACCENT} />
          <circle cx="0" cy="0" r="2" fill="#fff" />

          {/* callout flag */}
          <line x1="0" y1="0" x2="0" y2="-32" stroke={ACCENT} strokeWidth="0.9" />
          <g transform="translate(0 -52)">
            <rect
              x="-44"
              y="-14"
              width="88"
              height="22"
              fill="#0a0a0a"
              stroke={ACCENT}
              strokeWidth="0.9"
            />
            <text
              textAnchor="middle"
              y="1"
              fontFamily="'Geist Mono', ui-monospace, monospace"
              fontSize="9"
              letterSpacing="2.5"
              fill="#fff"
            >
              BAYTOWN
            </text>
            <text
              textAnchor="middle"
              y="22"
              fontFamily="'Geist Mono', ui-monospace, monospace"
              fontSize="6.5"
              letterSpacing="3"
              fill={ACCENT_HI}
            >
              YOU ARE HERE
            </text>
          </g>
        </g>

        {/* COMPASS ROSE — top right */}
        <g transform="translate(1100 110)" fontFamily="'Geist Mono', ui-monospace, monospace">
          <circle cx="0" cy="0" r="26" fill="none" stroke={INK_FAINT} strokeWidth="0.7" />
          <circle cx="0" cy="0" r="20" fill="none" stroke={HAIR_FAINT} strokeWidth="0.5" />
          <line x1="0" y1="-28" x2="0" y2="28" stroke={INK_FAINT} strokeWidth="0.5" />
          <line x1="-28" y1="0" x2="28" y2="0" stroke={INK_FAINT} strokeWidth="0.5" />
          <path d="M 0 -22 L 4 0 L 0 22 L -4 0 Z" fill="#0a0a0a" stroke={INK_SOFT} strokeWidth="0.7" />
          <path d="M 0 -22 L 4 0 L -4 0 Z" fill={ACCENT} />
          <text
            textAnchor="middle"
            y="-32"
            fontSize="8"
            letterSpacing="2"
            fill={ACCENT_HI}
            fontWeight="600"
          >
            N
          </text>
        </g>

        {/* SCALE BAR — bottom right */}
        <g
          transform="translate(1010 740)"
          fontFamily="'Geist Mono', ui-monospace, monospace"
        >
          <line x1="0" y1="0" x2="120" y2="0" stroke={INK_MUTE} strokeWidth="0.7" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke={INK_MUTE} strokeWidth="0.7" />
          <line x1="40" y1="-2" x2="40" y2="2" stroke={INK_FAINT} strokeWidth="0.6" />
          <line x1="80" y1="-2" x2="80" y2="2" stroke={INK_FAINT} strokeWidth="0.6" />
          <line x1="120" y1="-3" x2="120" y2="3" stroke={INK_MUTE} strokeWidth="0.7" />
          <text x="60" y="14" textAnchor="middle" fontSize="7" letterSpacing="2" fill={INK_FAINT}>
            10 MI · APPROX
          </text>
        </g>

        {/* GEOGRAPHIC ANCHOR — bottom left */}
        <g transform="translate(40 740)" fontFamily="'Geist Mono', ui-monospace, monospace">
          <text fontSize="8" letterSpacing="3" fill={INK_FAINT}>
            29.7355° N · 94.9774° W
          </text>
          <text y="14" fontSize="7" letterSpacing="3" fill={INK_FAINT}>
            HARRIS / CHAMBERS CO · TX
          </text>
        </g>

        {/* TOP-LEFT FRAME LABEL */}
        <g transform="translate(40 56)" fontFamily="'Geist Mono', ui-monospace, monospace">
          <line x1="0" y1="-6" x2="36" y2="-6" stroke={ACCENT} strokeWidth="1" />
          <text y="8" fontSize="9" letterSpacing="2.5" fill={ACCENT}>
            // SHEET 01 — SERVICE AREA
          </text>
          <text y="26" fontSize="7" letterSpacing="3" fill={INK_FAINT}>
            HOUSTON METRO · GULF COAST
          </text>
        </g>

        {/* BOTTOM VIGNETTE — pushes the eye toward the headline */}
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
