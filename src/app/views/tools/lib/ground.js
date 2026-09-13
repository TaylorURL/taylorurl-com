import { GROUNDS } from '@constants/grounds'

export const GROUND = GROUNDS.paper

/** The label over a field, and the line a refused field carries. */
export const FIELD_LABEL = `section-label-sm mb-2 block ${GROUND.meta}`

export const FIELD_FAULT = 'mt-2 text-[13px] leading-snug text-[color:var(--danger-on-paper)]'

/** The line a run that did not finish carries, under the form rather than a field. */
export const RUN_FAULT = 'text-[14px] leading-snug text-[color:var(--danger-on-paper)]'

/**
 * The light sheet, pinned against the setting rather than moving with it.
 *
 * A surface whose ground is fixed light — a chequerboard standing for
 * transparency, a white plate a logo is being judged against — needs ink that
 * is fixed with it, or the dark setting writes pale type onto white.
 */
export const SHEET = GROUNDS.sheet
