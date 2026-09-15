import { createContext, useContext } from 'react'

/**
 * The portal's surfaces, and how one reaches another.
 *
 * The screens carry no addresses of their own. They are rendered inside the
 * console's work region, under its bar and beside its column, and a link
 * reading `/staff/calls` pressed in there would throw the reader out of the
 * console, out of the scope they had set, and onto a surface that looks nothing
 * like the one they pressed from. So the addresses are published by whatever is
 * holding the screens and come down through the context.
 *
 * There is one holder today. There were two - a standalone portal at `/staff`
 * and the console's section - and keeping both meant every screen was written
 * against a shell it could not name. The standalone one is gone and its
 * addresses redirect here, but the indirection stays: what it buys is that the
 * screens still state no address, which is the thing that let one of them move
 * without the other four being edited.
 */

/**
 * Every surface, in the order the portal offers them.
 *
 * The call center leads because it is where the day is spent.
 *
 * `lede` says what the screen is for rather than what is on it, which is what
 * somebody deciding where to go needs.
 */
export const PORTAL_SURFACES = Object.freeze([
  {
    key: 'calls',
    label: 'Call Center',
    title: 'Call Center',
    lede: 'Next lead, call history, and logging.',
  },
  {
    key: 'management',
    label: 'Management Center',
    title: 'Management Center',
    lede: "Today's numbers and the team.",
  },
  {
    key: 'resources',
    label: 'Resources Center',
    title: 'Resources Center',
    lede: 'Script, objections, and pricing.',
  },
])

/**
 * What is holding the screens, and where it publishes each of them.
 *
 * Null by default and read through a hook that refuses the default, the way the
 * staff context is. A screen drawn outside a portal has no addresses at all,
 * and a fallback here would hand it plausible ones that point at nothing.
 */
export const PortalNav = createContext(null)

/**
 * @returns {{surfaces: readonly string[],
 *   hrefFor: (key: string, params?: Record<string, string|null|undefined>) => string,
 *   openedOn: string|null, sets: boolean}} Which surfaces this portal has, the
 *   address of each, the business the call center was opened on where one was
 *   named, and whether this is the portal the shift is set from.
 *
 * `sets` is the one line between what a representative may do and what the
 * person who set their shift may do. A representative controls the call screen
 * and nothing else: the figures they are read against are a reading rather than
 * a set of controls, and a screen that let them move their own target would make
 * the target mean nothing.
 */
export function usePortalNav() {
  const held = useContext(PortalNav)
  if (!held) throw new Error('usePortalNav was called outside the staff portal')
  return held
}

/**
 * The surfaces a portal offers, as objects rather than keys.
 *
 * @param {readonly string[]} keys
 */
export function surfacesIn(keys) {
  return PORTAL_SURFACES.filter(one => keys.includes(one.key))
}
