/**
 * The site's colour setting, which is light and only light.
 *
 * It used to be a choice between light, dark and the machine's preference,
 * stored per reader and offered from the bar, the footer and the console. The
 * redesign took the choice away: one set of colours is one set to get right,
 * and a local business owner skimming for a phone number has no use for a
 * second. The hook stays so the few places that ask still get an answer, and
 * the answer is the same one the inline block in `index.html` stamps before
 * the first paint.
 */

/** Fired when the setting changes, which it now never does. Kept for readers. */
export const THEME_EVENT = 'taylorurl:theme'

/** Every setting there is. */
export const THEMES = ['light']

const STATE = Object.freeze({ choice: 'light', resolved: 'light', setChoice: () => {} })

/** @returns {{ choice: 'light', resolved: 'light', setChoice: () => void }} */
export function useTheme() {
  return STATE
}
