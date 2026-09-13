import { createContext, useContext } from 'react'

/**
 * The portal's surfaces, and how one reaches another.
 *
 * The same screens are opened from two places. A representative works them
 * on their own, one viewport tall, with nothing else on the screen; an admin
 * works them inside the console, under its bar and beside its column. Which
 * they are standing in decides nothing about what a screen says and everything
 * about what a link on it points at, so the addresses come from here and the
 * screens themselves carry none.
 *
 * Without this each screen would hold a hard `/staff/...` address, and every
 * one of them opened inside the console would throw the reader out of it - out
 * of the frame, out of the scope they had set, and onto a surface that looks
 * nothing like the one they pressed from.
 */

/**
 * Every surface, in the order the portal offers them.
 *
 * The call center leads because it is where the day is spent.
 *
 * `lede` is the line under the door on the portal front. It says what the
 * screen is for rather than what is on it, which is what somebody deciding
 * where to go needs.
 */
export const PORTAL_SURFACES = Object.freeze([
  {
    key: 'portal',
    label: 'Portal',
    title: 'Staff Portal',
    lede: 'Every screen behind the desk.',
  },
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

/** What the standalone portal publishes: four addresses, one per screen. */
const STANDALONE = Object.freeze({
  surfaces: Object.freeze(['portal', 'calls', 'management', 'resources']),
  hrefFor: (key, params) => {
    const path = key === 'portal' ? '/staff' : `/staff/${key}`
    const query = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, value]) => value)
    ).toString()
    return query ? `${path}?${query}` : path
  },
  openedOn: null,
  sets: false,
})

export const PortalNav = createContext(STANDALONE)

/**
 * @returns {{surfaces: readonly string[],
 *   hrefFor: (key: string, params?: Record<string, string|null|undefined>) => string,
 *   openedOn: string|null, sets: boolean}} Which surfaces this portal has, the
 *   address of each, the business the call center was opened on where one was
 *   named, and whether this is the portal the shift is set from.
 *
 * `sets` is false on the standalone portal and true in the console, and it is
 * the one line between what a representative may do and what the person who set
 * their shift may do. A representative controls the call screen and nothing
 * else: the figures they are read against are a reading rather than a set of
 * controls, and a screen that let them move their own target would make the
 * target mean nothing.
 */
export function usePortalNav() {
  return useContext(PortalNav)
}

/**
 * The surfaces a portal offers, as objects rather than keys.
 *
 * @param {readonly string[]} keys
 */
export function surfacesIn(keys) {
  return PORTAL_SURFACES.filter(one => keys.includes(one.key))
}
