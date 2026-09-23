// One reload, and what stops it becoming two.
//
// A document whose build has been replaced under it recovers by fetching a new
// one, and that is the whole of the recovery: the new document names the new
// chunks. What it must never become is a loop, so the moment a reload is asked
// for is written down and a second ask inside the window is refused - the
// reader gets a screen they can act on instead of a tab that reloads forever.
//
// Held here rather than in the boundary because two places ask for that reload
// now. The boundary asks when a chunk failure has already reached it, and
// `lazyWithRetry` asks earlier, as soon as it can prove the build this document
// is running from has been superseded. They are the same reload and they share
// one budget; two guards would have let each spend the other's.
const RELOAD_GUARD_KEY = 'taylorurl:chunk-reload-at'
const RELOAD_GUARD_MS = 20000

/**
 * Whether this tab has already been reloaded for a chunk failure just now.
 *
 * @returns {boolean} True while the guard window is still open.
 */
export function recentlyReloaded() {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY))
    return Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS
  } catch {
    return false
  }
}

/**
 * Records that the reload is being asked for now.
 */
export function markReloaded() {
  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    // Private-mode or storage-disabled: fall through; worst case is the
    // fallback UI instead of an auto-reload, which is still recoverable.
  }
}
