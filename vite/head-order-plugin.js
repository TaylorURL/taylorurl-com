// The entry module and the chunks preloaded alongside it are written into the
// head by the bundler, after everything the document declares for itself, so
// the sheet lands behind both those and the faces it names.
const STYLESHEET = /<link\b[^>]*\brel="stylesheet"[^>]*>/g
const FONT_PRELOAD = /<link\b[^>]*\bas="font"[^>]*>/g
const FIRST_SUBRESOURCE =
  /<script\b[^>]*\btype="module"[^>]*>|<link\b[^>]*\brel="modulepreload"[^>]*>|<link\b[^>]*\bas="font"[^>]*>/

/**
 * Puts the stylesheet, and then the faces it names, ahead of every other
 * subresource the head asks for.
 *
 * A document paints when its stylesheet has arrived and not before, while the
 * modules are deferred by definition and paint nothing. Requested second, the
 * sheet is handed a link already carrying a few hundred kilobytes of script,
 * and on a phone that is the whole wait: the bytes ahead of it in the pipe
 * cannot be taken back once they are in flight, whatever priority the sheet is
 * given afterwards.
 *
 * The faces follow it and precede the modules for the same reason one step
 * down. The headline is the largest thing on the first screen, so it is the
 * paint the rating is taken from, and it is text: it is not finished until the
 * sans it is set in has landed. A module tag is deferred and paints nothing,
 * but it is a few hundred kilobytes asked for first, and on a phone the face
 * waits behind them in the pipe.
 *
 * Order only. Every tag the bundler wrote is emitted exactly as it was written,
 * and nothing is added or dropped.
 */
function stylesheetFirst(html) {
  const headEnd = html.indexOf('</head>')
  if (headEnd < 0) return html

  const head = html.slice(0, headEnd)
  const sheets = head.match(STYLESHEET)
  if (!sheets) return html

  const faces = head.match(FONT_PRELOAD) || []
  const stripped = head.replace(STYLESHEET, '').replace(FONT_PRELOAD, '')
  const anchor = stripped.match(FIRST_SUBRESOURCE)
  if (!anchor) return html

  const at = anchor.index
  const hoisted = sheets.join('') + faces.join('')
  return stripped.slice(0, at) + hoisted + stripped.slice(at) + html.slice(headEnd)
}

export default function headOrderPlugin() {
  return {
    name: 'taylorurl-head-order',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: stylesheetFirst,
    },
  }
}
