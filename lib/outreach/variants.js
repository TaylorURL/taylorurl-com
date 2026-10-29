/**
 * The letters the cold sender writes, derived from the chains that hold them.
 *
 * Every name this module exported before it still exports, and every one means
 * what it meant: the console imports the registry, the sender picks a letter
 * out of it, and the guard that will not let a segment be left with nothing
 * live is the same guard. What changed is where the letters come from.
 *
 * They used to be four constants in this file, with the registry written out
 * at the bottom as one entry per letter per segment. A fifth chain meant
 * editing this file, the switch in the send route that said which business was
 * on which chain, the constant holding the days between two letters, and the
 * report that worked out a letter's chain by looking for a word in its name.
 *
 * Now a chain is one file under ./chains, and the registry is derived from
 * them. The ids are unchanged - that is checked, letter for letter, against a
 * snapshot taken the day the chains took over - because an id is stored on
 * every message ever sent under it and a renamed id is a letter whose history
 * is suddenly attributed to nothing.
 *
 * `CHAIN_REGISTRY` is the whole of what the derivation answers, and it carries
 * four things this module could not: which chain a letter belongs to, which
 * chain a business is on, the day a step falls due, and the gap before a step.
 * The report and the sender read those rather than working them out again.
 */

import { createChains } from 'chainwork/core'
import { CHAINS } from './chains/index.js'
import { SEGMENTS, segmentOf } from './segments.js'

/** The chains, their letters, and everything read off both. */
export const CHAIN_REGISTRY = createChains({ chains: CHAINS, segments: SEGMENTS, segmentOf })

/** The chains themselves, for a console that lists them. */
export { CHAINS }

export const {
  VARIANTS,
  VARIANT_STATUSES,
  WEIGHT_MAX,
  letterSourceOf,
  stepOf,
  sendsAt,
  familyOf,
  familyHeld,
  familyAhead,
  fits,
  pickVariant,
  liveAhead,
  withSettings,
  wouldEmptySegment,
  variantById,
} = CHAIN_REGISTRY

/** The chain a letter id belongs to, looked up rather than read off its name. */
export const chainOfVariant = CHAIN_REGISTRY.chainOf

/** The chain a business is on: the one claiming its source, else the intro. */
export const chainForProspect = CHAIN_REGISTRY.chainFor

/** The day a step of a chain falls due, counted from the first letter. */
export const dueDayOf = CHAIN_REGISTRY.dueAt
