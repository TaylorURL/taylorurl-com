/**
 * The design contract these encode: monochrome, with blue (`var(--accent)`) as
 * the only emphasis colour; hairline borders and sharp corners so surfaces read
 * as engineered rather than decorative; motion capped at 220ms, ease-out.
 * Anything that breaks one of those rules doesn't belong here.
 */

// Variants differ only in surface and border treatment — never in geometry.
// Every button is rectangular, 2px radius, mono uppercase, arrow indicator.

const BTN_BASE =
  'inline-flex items-center justify-center gap-2.5 rounded-sm font-mono text-[11px] uppercase tracking-[0.18em] font-semibold transition duration-200 ease-out-soft active:scale-[0.98]'

export const BTN_PRIMARY = `${BTN_BASE} bg-accent text-white px-6 py-3.5 hover:bg-[color:var(--accent-hi)] shadow-[0_10px_30px_-12px_var(--accent-glow)]`
export const BTN_PRIMARY_LG = `${BTN_BASE} bg-accent text-white px-7 py-4 text-[12px] hover:bg-[color:var(--accent-hi)] shadow-[0_14px_36px_-12px_var(--accent-glow)]`
export const BTN_PRIMARY_SM = `${BTN_BASE} bg-accent text-white px-4 py-2.5 text-[10px] hover:bg-[color:var(--accent-hi)]`

export const BTN_GHOST =
  'inline-flex items-center justify-center gap-2.5 rounded-sm border border-hair-paper-strong px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink-paper transition duration-200 ease-out-soft hover:bg-ink-paper hover:text-paper active:scale-[0.98]'
export const BTN_GHOST_LG =
  'inline-flex items-center justify-center gap-2.5 rounded-sm border border-hair-paper-strong px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] font-semibold text-ink-paper transition duration-200 ease-out-soft hover:bg-ink-paper hover:text-paper active:scale-[0.98]'

export const BTN_GHOST_DARK =
  'inline-flex items-center justify-center gap-2.5 rounded-sm border border-hair-strong px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink transition duration-200 ease-out-soft hover:bg-ink hover:text-bg active:scale-[0.98]'
export const BTN_GHOST_DARK_LG =
  'inline-flex items-center justify-center gap-2.5 rounded-sm border border-hair-strong px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] font-semibold text-ink transition duration-200 ease-out-soft hover:bg-ink hover:text-bg active:scale-[0.98]'

export const INPUT =
  'w-full rounded-sm border border-hair-paper-strong bg-paper px-4 py-3.5 font-sans text-[15px] text-ink-paper transition duration-200 ease-out-soft placeholder:text-paper-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'

export const INPUT_DARK =
  'w-full rounded-sm border border-hair-strong bg-surface-1 px-4 py-3.5 font-sans text-[15px] text-ink transition duration-200 ease-out-soft placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'

export const CARD =
  'group relative rounded-sm border border-hair-paper bg-paper p-7 transition duration-300 ease-out-soft hover:border-hair-paper-strong'

export const CARD_STATIC = 'relative rounded-sm border border-hair-paper bg-paper p-7'

export const CARD_DARK =
  'group relative rounded-sm border border-hair bg-surface-1 p-7 transition duration-300 ease-out-soft hover:border-hair-strong'

export const BADGE =
  'inline-flex items-center gap-1.5 rounded-sm border border-hair-paper-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-soft'

export const BADGE_BLUE =
  'inline-flex items-center gap-1.5 rounded-sm border border-accent/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-accent'

export const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.22em] text-accent'

export const EYEBROW_MUTE = 'font-mono text-[11px] uppercase tracking-[0.22em] text-paper-faint'

export const EYEBROW_MUTE_DARK = 'font-mono text-[11px] uppercase tracking-[0.22em] text-ink-faint'

export const SECTION_H2 =
  'text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.04] tracking-tightest text-ink-paper'

export const SECTION_H2_DARK =
  'text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.04] tracking-tightest text-ink'

export const HERO_H1_DARK =
  'text-[clamp(2.6rem,7vw,5.6rem)] font-semibold leading-[0.98] tracking-tightest text-ink'

export const HERO_H1 =
  'text-[clamp(2.6rem,7vw,5.6rem)] font-semibold leading-[0.98] tracking-tightest text-ink-paper'
