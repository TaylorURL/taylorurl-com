import { useEffect } from 'react'

// The control the boot held, between the moment React takes the page's events
// over and the moment the page is live enough to answer it.
let held = null

/**
 * Ends the boot's hold on presses and keeps the last one it caught.
 *
 * Called immediately before the root is hydrated, because that is the instant
 * the presses stop being the boot's: `hydrateRoot` puts React's own listeners
 * on the page in the same call, and from there a press on markup it has not
 * adopted yet is one React hydrates on the spot and answers itself. Held any
 * later, a press in that gap would be answered twice - once by React and once
 * when it was handed back - which on a toggle is the same as not at all.
 *
 * The boot is written by the prerender and is absent wherever the page was not
 * served by it (the dev server, a test), so its absence is read as nothing
 * pressed.
 */
export function takeEarlyPress() {
  held = typeof window.__earlyPress === 'function' ? window.__earlyPress() : null
}

/**
 * Presses again the control a reader pressed before the page could answer it.
 *
 * The page is prerendered and on screen well before the bundle that drives it,
 * and every button on it - a question on the FAQ, a group in the bar, the menu
 * on a phone - does nothing until then. The boot holds the last one pressed in
 * that window (see `vite/boot-source.js`), and this hands it to the page once
 * the page has mounted, so the press a reader already made is the one that
 * opens the thing they pressed.
 *
 * Scheduled from the root's first effect rather than pressed inside it. The
 * root commits before the boundaries under it are adopted, and a click on a
 * part still waiting is one React adopts on the spot before it answers - but
 * not from inside an effect, where React is still finishing a commit and will
 * not start another. Pressed there, the click reached the FAQ question while
 * its boundary was still waiting and was dropped exactly as the reader's own
 * press had been. A task later the commit is over and the click is answered.
 *
 * A control the first render replaced, or one that has been disabled since, is
 * left alone: what a reader pressed is no longer what is there.
 */
export function useEarlyPress() {
  useEffect(() => {
    const control = held
    held = null
    if (!control) return undefined
    const press = setTimeout(() => {
      if (control.isConnected && !control.disabled) control.click()
    }, 0)
    return () => clearTimeout(press)
  }, [])
}
