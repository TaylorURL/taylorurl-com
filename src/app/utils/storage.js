/**
 * One of the browser's own stores, where there is one.
 *
 * A browser set to block site data throws on the accessor itself rather than
 * answering empty, so reaching it is what has to be guarded. The prerender pass
 * has neither store, and is answered the same way.
 *
 * @param {'localStorage'|'sessionStorage'} name Which store.
 * @returns {Storage|null}
 */
export function browserStore(name) {
  try {
    return globalThis[name] ?? null
  } catch {
    return null
  }
}
