/**
 * Text made safe to write into a message's markup.
 *
 * It sits in a file of its own, with nothing imported, because the sheet in
 * `frame.js` reads the studio's identity and the identity reads the bio, and the
 * bio escapes too. Held in any of those three, one of the others would import
 * the file that imports it.
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escape text for an element body or a double-quoted attribute. */
export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, character => HTML_ENTITIES[character])
}
