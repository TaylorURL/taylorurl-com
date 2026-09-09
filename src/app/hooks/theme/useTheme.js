import { useCallback, useEffect, useSyncExternalStore } from 'react'

/** Where the choice is kept, and the key the pre-paint script in the page head reads. */
export const THEME_KEY = 'taylorurl_theme'

/**
 * Fired on the window when the stamped theme changes, so anything reading a
 * resolved token value off the document hears about it. A CSS custom property
 * has no change event of its own, and the layers that read one draw into a
 * canvas rather than into the DOM.
 */
export const THEME_EVENT = 'taylorurl:theme'

/** The three a reader can pick between, in the order the control offers them. */
export const THEMES = ['light', 'dark', 'system']

const DARK_QUERY = '(prefers-color-scheme: dark)'

// One query object for the document, because a listener is registered against
// the object rather than against the string: a second `matchMedia` call for the
// same query answers the same question from a different handle, and removing a
// listener through that handle removes nothing.
let query = null

function media() {
  if (!query) query = window.matchMedia(DARK_QUERY)
  return query
}

/** What `system` means at this moment. */
function systemTheme() {
  return media().matches ? 'dark' : 'light'
}

/**
 * The setting a reader who has never picked one gets.
 *
 * Light rather than system: the site is drawn light first, and a visitor whose
 * machine turns dark at sunset has not asked this site for anything. System
 * stays on the control for anyone who does want it followed.
 */
export const DEFAULT_THEME = 'light'

function storedChoice() {
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    return THEMES.includes(raw) ? raw : DEFAULT_THEME
  } catch {
    // Private browsing refuses the read, and the default stands.
    return DEFAULT_THEME
  }
}

/**
 * Hand the browser's own chrome the ground the page is standing on.
 *
 * The head ships a theme-color for each setting, answering the system
 * preference, which is the right question only until a reader picks a setting
 * of their own. From that moment the document carries one palette and the
 * preference carries another, and the address bar is the one surface still
 * following the wrong one.
 *
 * The value is read back off the document rather than restated here, so the
 * chrome is whatever `--paper` resolved to under the setting just stamped and
 * there is no second copy of the colour to fall out of step. Dropping the
 * media query is what lets the survivor apply unconditionally; the setting is
 * re-stamped whenever the choice or the system preference moves, so the value
 * cannot go stale while the page is open.
 */
function paintChrome() {
  const ground = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  if (!ground) return
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.removeAttribute('media')
    meta.setAttribute('content', ground)
  })
}

/**
 * Put a choice on the document.
 *
 * `system` is resolved here rather than stamped, because CSS reads an attribute
 * value and not an intention: the sheet defines light and dark, and the word
 * between them is this file's business.
 *
 * @param {'light'|'dark'|'system'} choice
 * @returns {'light'|'dark'} what the document now carries
 */
export function applyTheme(choice) {
  const resolved = choice === 'system' ? systemTheme() : choice
  document.documentElement.setAttribute('data-theme', resolved)
  paintChrome()
  return resolved
}

/**
 * The setting, held once for the document rather than once for each reader.
 *
 * There is one setting, so there is one copy of it and React subscribes to that
 * copy. Holding it in the hook's own state gave every caller a copy instead:
 * the drawer's control, the footer's, and every section that swaps a light
 * capture for a dark one each kept their own. A press moved the copy that was
 * pressed and stamped the document, so the palette turned while the other
 * control still showed the old word and the home page's shots stayed on their
 * light captures, which is a white rectangle in the middle of a dark page.
 */
const readers = new Set()

// The choice and what it resolves to, as one object, because a subscription
// re-renders on identity: a new object every read would re-render every caller
// on every pass, and a value that never changes identity would re-render none
// of them when the setting moved.
let state = null

// What the prerender pass stands on. It has no window to read a preference from
// and paints nothing, so it takes the default and the browser corrects it.
const SERVER_STATE = Object.freeze({ choice: DEFAULT_THEME, resolved: 'light' })

function snapshot() {
  if (typeof window === 'undefined') return SERVER_STATE
  if (!state) {
    const choice = storedChoice()
    state = { choice, resolved: choice === 'system' ? systemTheme() : choice }
  }
  return state
}

/**
 * The same default, given to the render that adopts the prerendered markup.
 *
 * React hydrates by taking that markup as it stands rather than by comparing it
 * to what the component would draw, so a first client render already holding the
 * reader's setting leaves what the prerender wrote in place and nothing
 * afterwards goes back for it. The setting is right, the document is right, and
 * the markup between them is a visit old: the picker read Light under a dark
 * palette and stayed there, because a store that already agrees with itself
 * never publishes and so never re-renders anyone.
 *
 * A capture is safe from this - the ground picks between the pair in CSS - but
 * every reader that decides in JavaScript needs the render after hydration, and
 * answering the hydrating one with the prerender's own value is what produces
 * it. This is the only reader of `SERVER_STATE` that runs in a browser.
 */
function prerendered() {
  return SERVER_STATE
}

/**
 * Stamp a choice on the document and hand it to everyone reading.
 *
 * The stamp is unconditional and the publish is not. The page head sets the
 * attribute before the first paint but leaves the browser chrome alone, so the
 * first call of the visit has work to do even though it changes nothing.
 *
 * @param {'light'|'dark'|'system'} choice
 */
function commit(choice) {
  const resolved = applyTheme(choice)
  const current = snapshot()
  if (current.choice === choice && current.resolved === resolved) return
  state = { choice, resolved }
  window.dispatchEvent(new Event(THEME_EVENT))
  readers.forEach(reader => reader())
}

/** Another tab is the same device and the same preference, so it lands here. */
function reread(event) {
  if (event.key && event.key !== THEME_KEY) return
  commit(storedChoice())
}

/**
 * The machine's preference, followed only while the choice is `system`: a
 * reader who picked light has asked for light on a machine that turns dark at
 * sunset. The listener stays wired and the word is checked when it fires,
 * rather than the listener being rewired every time the word changes.
 */
function follow() {
  if (snapshot().choice !== 'system') return
  commit('system')
}

function subscribe(reader) {
  readers.add(reader)
  if (readers.size === 1) {
    window.addEventListener('storage', reread)
    media().addEventListener('change', follow)
  }
  return () => {
    readers.delete(reader)
    if (readers.size > 0) return
    window.removeEventListener('storage', reread)
    media().removeEventListener('change', follow)
  }
}

// The document is stamped once a visit, by whichever caller mounts first.
let stamped = false

/**
 * The reader's light or dark setting.
 *
 * The choice is one of three: light, dark, or system, which follows the
 * operating system and keeps following it as it changes. It is stamped on the
 * document element as `data-theme`, which is where the stylesheet's palettes
 * hang, and it survives a reload in localStorage — read back by the script in
 * the page head so the first paint is already in the right palette.
 *
 * Every caller reads the one setting and moves with it, so a press on any
 * control anywhere in the page is the same press to all of them.
 *
 * Every localStorage call is wrapped: a browser in a private context throws on
 * the read as well as the write, and a theme control that throws is worse than
 * one that forgets.
 *
 * @returns {{choice: 'light'|'dark'|'system', resolved: 'light'|'dark',
 *   setChoice: (next: 'light'|'dark'|'system') => void}}
 */
export function useTheme() {
  const { choice, resolved } = useSyncExternalStore(subscribe, snapshot, prerendered)

  useEffect(() => {
    if (stamped) return
    stamped = true
    commit(snapshot().choice)
  }, [])

  const setChoice = useCallback(next => {
    if (!THEMES.includes(next)) return
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      // Nothing to do; the setting holds for this visit and the next one starts
      // from the default again.
    }
    commit(next)
  }, [])

  return { choice, resolved, setChoice }
}
