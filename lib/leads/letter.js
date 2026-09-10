/**
 * One message to one lead, rendered as a person writes rather than as a
 * campaign does.
 *
 * A lead raised a hand at the studio and somebody in the console is answering
 * them, so the message goes as an answer goes: the words that were typed, in a
 * plain sheet, with nothing added around them. No slab, no tracker, no
 * unsubscribe footer - this is one reply from a person, not an issue of
 * anything, and a draft that wants a sign-off carries its own so the composer
 * shows exactly what arrives.
 *
 * The text half is the body verbatim. The HTML half is the same paragraphs
 * with the addresses in them made pressable, because a reply that names the
 * site should not make the reader retype it.
 */

import { escapeHtml } from '../mail/frame.js'

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const INK = '#111111'
const TYPE = `font-family:${SANS};font-size:15px;line-height:1.6;color:${INK};`

/** A bare address in prose, for linking after everything else is escaped. */
const LINK = /https?:\/\/[^\s<]+/g

/** One paragraph, escaped, line breaks kept, addresses made pressable. */
function paragraph(text) {
  const escaped = escapeHtml(text)
    .replace(LINK, address => `<a href="${address}" style="color:${INK};">${address}</a>`)
    .replace(/\n/g, '<br>')
  return `<p style="margin:0 0 16px 0;${TYPE}">${escaped}</p>`
}

/**
 * Both halves of one lead letter.
 *
 * @param {{subject: string, body: string}} message The message as composed.
 * @returns {{subject: string, text: string, html: string}}
 */
export function leadLetter({ subject, body }) {
  const paragraphs = String(body || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<div style="max-width:560px;padding:20px 16px;">
${paragraphs.map(paragraph).join('\n')}
</div>
</body>
</html>`

  return { subject, text: String(body || ''), html }
}
