/**
 * The sheet every message the studio sends is drawn on: the ground, the ink,
 * the two faces, the head a client reads before it draws anything, and the
 * slab the message opens on.
 *
 * A confirmation, an issue of the newsletter and a notice to the studio's own
 * inbox are written by three different endpoints, and each one is free to
 * decide how it looks. An inbox holding all three is where that freedom is
 * read: three palettes arrive as three senders. The values are held here so a
 * message has nothing left to decide.
 *
 * Literal hex throughout, and a stack rather than a face. A mail client
 * resolves no custom property, so a colour written as a variable is a black
 * rule on a black ground; and it fetches no stylesheet, so a face that has to
 * be downloaded is a face nobody is shown. What is written out is the site's
 * own paper palette, because paper is the ground the studio is on.
 */

import { ANNOTATION, WORDMARK } from './identity.js'

/** Content column width, in pixels. 600 clears every client's clipping point. */
export const WIDTH = 600

export const PAGE = '#f6f6f5'
const CARD = '#ffffff'
export const INK = '#0a0a0a'
export const INK_SOFT = '#474747'
export const INK_FAINT = '#767676'
export const ACCENT = '#1a4ed8'
export const HAIRLINE = '#e3e3e1'
const SLAB = '#000000'
const SLAB_INK_MUTE = '#9a9a9a'

/**
 * The studio's faces, each named ahead of the stack a client already holds.
 *
 * Neither can be delivered with a message, so the fallback is what most
 * readers are shown; it is named in the order that keeps the setting at the
 * same width on every platform.
 */
export const SANS =
  "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
export const MONO = "'Geist Mono', Consolas, 'Courier New', Courier, monospace"

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

/**
 * The head, which is metadata and a title and nothing else.
 *
 * The two colour-scheme lines are what stops a client that inverts a message
 * for a dark reader from inverting this one. The palette is a light one drawn
 * on cells with their own ground, and a client that flips the type without
 * flipping the cell leaves white ink on white paper.
 */
function documentHead(title) {
  return `<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(title)}</title>
</head>`
}

/**
 * The line a client shows beside the subject before the message is opened.
 *
 * The invisible characters trailing it fill the rest of the preview, which
 * otherwise runs on into whatever the frame says first — the studio's own
 * address.
 */
function preheaderBand(text) {
  if (!text) return ''
  const padding = '&#847;&zwnj;&nbsp;'.repeat(60)
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};">${escapeHtml(text)}${padding}</div>`
}

/**
 * Who a message is from, in the seven things the masthead needs to draw one.
 *
 * The studio sends on behalf of the businesses it looks after as well as for
 * itself, and a notification about somebody's own trading desk that arrives
 * wearing this studio's mark is a message from the wrong company. So the
 * identity is an argument rather than an import: the values below are the
 * studio's own, they are the default everywhere, and a message that carries a
 * different brand carries the whole of it rather than a switch naming a client.
 *
 * `wordmark` says whether the picture already says the name. The studio's mark
 * is its name drawn out, so setting the name beside it would print it twice; a
 * client's mark is usually a badge, which says nothing on its own and needs the
 * name set next to it.
 */
export const STUDIO_BRAND = {
  name: 'TaylorURL',
  markUrl: WORDMARK.src,
  markWidth: WORDMARK.width,
  markHeight: WORDMARK.height,
  wordmark: true,
  annotation: ANNOTATION,
  ground: 'dark',
  accent: ACCENT,
}

/**
 * The mark, and the name beside it where the mark does not carry one.
 *
 * Most readers see a blocked image where the picture is, which is why the name
 * is set as text whenever the picture is the only thing that would have said
 * it.
 */
function lockup(brand, light) {
  const mark = brand.markUrl
    ? `<img src="${escapeHtml(brand.markUrl)}" alt="${escapeHtml(brand.name)}" width="${brand.markWidth}" height="${brand.markHeight}" style="display:block;width:${brand.markWidth}px;height:${brand.markHeight}px;border:0;outline:none;text-decoration:none;" />`
    : ''

  if (brand.wordmark && mark) {
    return `<td align="left" valign="middle" style="line-height:0;font-size:0;">${mark}</td>`
  }

  const named = `<td valign="middle" style="font-family:${MONO};font-size:15px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;line-height:1.3;color:${light ? INK : '#ffffff'};">${escapeHtml(brand.name)}</td>`
  if (!mark) {
    return `<td align="left" valign="middle" style="font-family:${MONO};font-size:15px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;line-height:1.3;color:${light ? INK : '#ffffff'};">${escapeHtml(brand.name)}</td>`
  }

  return `<td align="left" valign="middle"><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td valign="middle" style="line-height:0;font-size:0;">${mark}</td><td width="14" style="width:14px;font-size:1px;line-height:1px;">&nbsp;</td>${named}</tr></table></td>`
}

/**
 * The slab the message opens on, or the band that stands in for it.
 *
 * A black slab is the strongest thing on the sheet and it is drawn for the
 * studio because the studio's mark is cut to survive one. The fourteen client
 * marks the console holds are not: each was captured with the ground it reads
 * on recorded beside it, and half of them are dark artwork that disappears on
 * black. So a brand says which ground it needs, and one that needs a pale one
 * opens on the card itself with a hairline under it instead. The alternative is
 * a masthead that is empty for exactly the clients whose logo is dark ink.
 *
 * @param {object} [brand] Who the message is from. Defaults to the studio.
 */
function masthead(brand = STUDIO_BRAND) {
  const light = brand.ground === 'light'
  const ink = light ? INK_FAINT : SLAB_INK_MUTE
  const annotation = (brand.annotation || [])
    .map(
      line =>
        `<div style="font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.7;color:${ink};">${escapeHtml(line)}</div>`
    )
    .join('')

  const row = `<tr>
        ${lockup(brand, light)}
        <td align="right" valign="middle">${annotation}</td>
      </tr>`

  if (light) {
    return `<tr><td bgcolor="${CARD}" style="padding:28px 40px 0 40px;background-color:${CARD};">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">
      ${row}
    </table>
    ${rule('24px 0 0 0')}
  </td></tr>`
  }

  return `<tr><td bgcolor="${SLAB}" style="padding:26px 40px;background-color:${SLAB};">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">
      ${row}
    </table>
  </td></tr>`
}

/**
 * The two-sided section head the studio's mail opens a passage with: a short
 * accent rule, then the label in the mono face.
 *
 * The caller supplies the row it sits in, because a letter hangs a second
 * thing off the right of that row and a notice does not.
 *
 * @param {string} label What is speaking.
 * @param {string} [accent] The one colour the head is drawn in.
 * @returns {string} One table, with no row around it.
 */
export function eyebrowMark(label, accent = ACCENT) {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td width="32" valign="middle" style="width:32px;line-height:0;font-size:0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="32" style="border-collapse:collapse;width:32px;"><tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${accent};">&nbsp;</td></tr></table></td>
        <td width="12" style="width:12px;font-size:1px;line-height:1px;">&nbsp;</td>
        <td valign="middle" style="font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${accent};">// ${escapeHtml(label)}</td>
      </tr>
    </table>`
}

/**
 * A hairline across the content column, as a table rather than a border,
 * because Outlook draws a border on a cell at whatever width it likes.
 */
export function rule(margin = '0') {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;margin:${margin};">
      <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${HAIRLINE};">&nbsp;</td></tr>
    </table>`
}

/**
 * One whole message: the document, the ground, the centred card and the slab
 * at the top of it. The caller supplies the rows that go under the slab.
 *
 * Nested tables and inline styles all the way down, because Outlook on Windows
 * lays a message out with Word's engine, which understands table cells and
 * little else.
 *
 * @param {object} options
 * @param {string} options.title The document title.
 * @param {string} [options.preheader] The line shown beside the subject.
 * @param {string} options.content Table rows, drawn inside the card.
 * @param {object} [options.brand] Who the message is from. Defaults to the
 *   studio, so every sender that has only ever spoken for it passes nothing.
 * @returns {string} A complete HTML document.
 */
export function page({ title, preheader = '', content, brand = STUDIO_BRAND }) {
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
${documentHead(title)}
<body style="margin:0;padding:0;width:100%;background-color:${PAGE};">
${preheaderBand(preheader)}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background-color:${PAGE};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${WIDTH}" style="width:${WIDTH}px;max-width:100%;border-collapse:collapse;background-color:${CARD};border:1px solid ${HAIRLINE};">
      ${masthead(brand)}
      ${content}
    </table>
  </td></tr>
</table>
</body>
</html>`
}
