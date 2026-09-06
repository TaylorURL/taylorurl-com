import { useCallback, useEffect, useState } from 'react'

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

function media() {
  return window.matchMedia(DARK_QUERY)
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
 * The reader's light or dark setting.
 *
 * The choice is one of three: light, dark, or system, which follows the
 * operating system and keeps following it as it changes. It is stamped on the
 * document element as `data-theme`, which is where the stylesheet's palettes
 * hang, and it survives a reload in localStorage — read back by the script in
 * the page head so the first paint is already in the right palette.
 *
 * Every localStorage call is wrapped: a browser in a private context throws on
 * the read as well as the write, and a theme control that throws is worse than
 * one that forgets.
 *
 * @returns {{choice: 'light'|'dark'|'system', resolved: 'light'|'dark',
 *   setChoice: (next: 'light'|'dark'|'system') => void}}
 */
export function useTheme() {
  // The prerender pass has no window to read a preference from and paints
  // nothing, so it stands on the default and the browser corrects it.
  const [choice, setStored] = useState(() =>
    typeof window === 'undefined' ? DEFAULT_THEME : storedChoice()
  )
  const [resolved, setResolved] = useState(() =>
    typeof window === 'undefined' ? 'light' : choice === 'system' ? systemTheme() : choice
  )

  useEffect(() => {
    const stamp = () => {
      const next = applyTheme(choice)
      setResolved(next)
      window.dispatchEvent(new Event(THEME_EVENT))
    }
    stamp()

    // Only while the choice is `system`: a reader who picked light has asked
    // for light on a machine that turns dark at sunset.
    if (choice !== 'system') return undefined
    const query = media()
    query.addEventListener('change', stamp)
    return () => query.removeEventListener('change', stamp)
  }, [choice])

  useEffect(() => {
    // Another tab is the same account and the same preference, so a change
    // there lands here without a reload.
    const reread = event => {
      if (event.key && event.key !== THEME_KEY) return
      setStored(storedChoice())
    }
    window.addEventListener('storage', reread)
    return () => window.removeEventListener('storage', reread)
  }, [])

  const setChoice = useCallback(next => {
    if (!THEMES.includes(next)) return
    setStored(next)
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      // Nothing to do; the setting holds for this visit and the next one starts
      // from the default again.
    }
  }, [])

  return { choice, resolved, setChoice }
}
