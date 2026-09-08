import { useEffect, useState } from 'react'

/**
 * The two things every keyboard shortcut on the site has to agree about: which
 * modifier a reader is told to press, and when a bare key belongs to the page
 * rather than to whoever is typing into a field.
 *
 * Both were written for the console first. They live here rather than there
 * because the marketing bar needs the same answers, and two copies of a
 * platform sniff is how a shortcut ends up printed one way and bound another.
 */

const TYPING = /^(?:INPUT|TEXTAREA|SELECT)$/

/**
 * The glyph written wherever there is no keyboard to ask: the build's answer,
 * and every browser's first render, so those two always agree.
 */
const ASSUMED = '⌘'

/**
 * The label, not the key. What the handlers actually test is `metaKey ||
 * ctrlKey`, which covers both platforms without asking what this one is; this
 * is only the glyph a reader is shown.
 *
 * The trailing space after Ctrl is deliberate. Every call site writes
 * `${modifierLabel()}K`, and "CtrlK" is not a shortcut anybody can read.
 *
 * `window` is what says whether there is a keyboard to name, and `navigator` is
 * not. Node has carried a global `navigator` since 21 and answers `platform`
 * with the machine the build ran on - "Linux x86_64" - so a render at build
 * time asking for `navigator` gets a confident wrong answer rather than none,
 * and every page ships with Ctrl written into it.
 */
export function modifierLabel() {
  if (typeof window === 'undefined') return ASSUMED
  return /Mac|iPhone|iPad/.test(navigator.platform) ? ASSUMED : 'Ctrl '
}

/**
 * The same label, for a tree the browser adopts rather than builds.
 *
 * Every route is rendered to markup at build time and served whole, so the
 * first render in the browser has to come out as the markup it was handed; a
 * text node that does not match is a mismatch React repairs by throwing the
 * page away and drawing it again. The build has no keyboard, so it writes the
 * assumed glyph. This holds that glyph through the first render and answers for
 * the real keyboard once mounted, which is the one moment the two are allowed
 * to differ.
 *
 * Read at module scope instead - a constant computed once when the file is
 * imported - it answers for the browser during that first render, and the
 * markup disagrees on every platform the build machine is not.
 */
export function useModifierLabel() {
  const [modifier, setModifier] = useState(ASSUMED)
  useEffect(() => setModifier(modifierLabel()), [])
  return modifier
}

/**
 * Whether a bare keypress belongs to whatever the reader is writing in. A
 * shortcut on a plain letter is worth having and is also the fastest way to
 * make a form unusable, so every bare-key binding asks this first.
 */
export function isTyping(target) {
  if (!target) return false
  return Boolean(target.isContentEditable) || TYPING.test(target.tagName || '')
}
