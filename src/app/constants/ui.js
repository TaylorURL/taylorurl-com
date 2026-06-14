/**
 * Unified UI primitive class strings — single source of truth for buttons,
 * inputs, cards, badges, and section headers across the site. Keeping these as
 * shared constants guarantees consistent radius, padding, motion, and focus
 * behavior everywhere without per-file drift. Tailwind's `transition` utility
 * animates a curated property set (transform, colors, shadow) — not layout —
 * so it is safe for the `:active`/`hover` micro-interactions below. Keyboard
 * focus rings are applied globally in index.css, so they are intentionally
 * omitted here.
 */

// Buttons — standard (px-7 py-3.5) and large (px-8 py-4) sizes.
export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-blue-600/20 transition duration-200 ease-out hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/25 active:scale-[0.97]'

export const BTN_PRIMARY_LG =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm shadow-blue-600/20 transition duration-200 ease-out hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/25 active:scale-[0.97]'

export const BTN_PRIMARY_SM =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-blue-500 active:scale-[0.97]'

// Secondary / outline on light surfaces.
export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-7 py-3.5 text-[15px] font-semibold text-gray-900 transition duration-200 ease-out hover:border-gray-400 hover:bg-gray-50 active:scale-[0.97]'

export const BTN_SECONDARY_LG =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-8 py-4 text-base font-semibold text-gray-900 transition duration-200 ease-out hover:border-gray-400 hover:bg-gray-50 active:scale-[0.97]'

// Secondary / outline on dark (gray-900) surfaces.
export const BTN_SECONDARY_DARK =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-7 py-3.5 text-[15px] font-semibold text-gray-200 transition duration-200 ease-out hover:border-gray-500 hover:bg-gray-800 active:scale-[0.97]'

export const BTN_SECONDARY_DARK_LG =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-8 py-4 text-base font-semibold text-gray-200 transition duration-200 ease-out hover:border-gray-500 hover:bg-gray-800 active:scale-[0.97]'

// Form input (shared by every text/email/select control).
export const INPUT =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 transition duration-200 ease-out placeholder:text-gray-400 focus:border-blue-600 focus:bg-surface-overlay focus:outline-none focus:ring-2 focus:ring-blue-600/15'

// Cards — interactive (lifts on hover) and static.
export const CARD =
  'rounded-2xl border border-gray-200 bg-surface-raised p-6 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5'

export const CARD_STATIC = 'rounded-2xl border border-gray-200 bg-surface-raised p-6'

export const CARD_DARK =
  'rounded-2xl border border-gray-800 bg-gray-900/60 p-6 backdrop-blur-sm transition duration-300 ease-out hover:border-gray-700'

// Badges / pills.
export const BADGE =
  'inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600'

export const BADGE_BLUE =
  'inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700'

// Section header pieces.
export const EYEBROW = 'text-sm font-semibold uppercase tracking-wider text-blue-600'

export const SECTION_H2 = 'text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl'

export const SECTION_H2_DARK = 'text-3xl font-bold tracking-tight text-white sm:text-4xl'
