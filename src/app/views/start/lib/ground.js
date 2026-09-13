import { GROUNDS } from '@constants/grounds'

/**
 * The ground the configurator is drawn on.
 *
 * The flow holds one frame in one place and moves its contents through it, so
 * every step shares a single ground rather than alternating the way a scrolling
 * page does. That ground is the site's paper treatment, taken from the shared
 * pair rather than restated, so a change to paper reaches the configurator with
 * everything else.
 */
export const GROUND = GROUNDS.paper

/** The rule-and-label head a block of the configurator opens with. */
export const BLOCK_LABEL = 'section-label text-accent'

export const BLOCK_META = `section-label-sm ${GROUND.meta}`

/**
 * The standing label above a panel's heading, the label over a field, the
 * heading itself, and the line a refused field carries.
 *
 * Two panels inside the configurator set the same four things, and holding
 * them apart is how one of them ends up a size away from the other. They sit
 * beside the block classes because they answer the same question: what a part
 * of the configurator is called, and how the type that calls it is set.
 */
export const PANEL_EYEBROW = 'section-label mb-5 block text-accent'

export const FIELD_LABEL = `section-label-sm mb-2 block ${GROUND.meta}`

export const PANEL_TITLE = `display-5 font-semibold leading-[1.08] tracking-tightest ${GROUND.title} [text-wrap:balance]`

export const FIELD_FAULT = 'mt-2 text-[13px] leading-snug text-[color:var(--danger-on-paper)]'

/** An answer drawn as a cell, once it is picked and before it is. */
export const CELL_CHECKED =
  'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)] peer-focus-visible:outline-[color:var(--on-accent)]'

export const CELL_UNCHECKED = `${GROUND.surface} ${GROUND.title} ${GROUND.wash} peer-focus-visible:outline-accent`
