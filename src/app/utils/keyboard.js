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
 * The label, not the key. What the handlers actually test is `metaKey ||
 * ctrlKey`, which covers both platforms without asking what this one is; this
 * is only the glyph a reader is shown.
 *
 * The trailing space after Ctrl is deliberate. Every call site writes
 * `${modifierLabel()}K`, and "CtrlK" is not a shortcut anybody can read.
 *
 * Rendered on the server there is no platform to read, so it answers with the
 * Mac glyph and the client corrects it after mounting. Answering during the
 * first client render instead would have the markup disagree with the server's
 * on every Windows machine, which React repairs by throwing the tree away.
 */
export function modifierLabel() {
  if (typeof navigator === 'undefined') return '⌘'
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl '
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
