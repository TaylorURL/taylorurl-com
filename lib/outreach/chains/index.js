/**
 * Every chain the sender writes, in the order their letters are registered in.
 *
 * Adding a chain is adding a file beside these and a line here. Nothing else
 * has to be edited: the registry derives the letters, the families, the days
 * between steps and the lookup from whatever it is handed, and the console
 * draws whatever the registry holds.
 *
 * All four are here. The first two put their letters in the registry, because
 * the same words go to every business in a segment. The draft preview and the
 * new-business letter register none: their words are written for the one
 * business they are going to, so what their manifests hold is the shape - the
 * days, the sender, the expiry - and the senders take the words off the row.
 *
 * Order matters only in that it fixes the order of the derived registry, which
 * is the order the console lists letters in. The introduction is first because
 * it always was.
 */

import introduction from './introduction.js'
import lawsuit from './lawsuit.js'
import preview from './preview.js'
import newBusiness from './new-business.js'

export const CHAINS = Object.freeze([introduction, lawsuit, preview, newBusiness])

export { introduction, lawsuit, preview, newBusiness }
