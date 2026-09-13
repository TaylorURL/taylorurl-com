/**
 * Drawing an encoded QR grid, as vector and as raster.
 *
 * The grid is a square of modules and nothing more, so both drawings are the
 * same decision made twice: how wide a module is, how much quiet margin runs
 * around it, and which two colours it is set in. The quiet zone is not
 * decoration - a code printed flush to a dark background is a code a scanner
 * cannot find an edge on, and four modules is the width the specification
 * names.
 */

/** Modules of clear ground the specification asks for on every side. */
const QUIET_MODULES = 4

/**
 * The SVG source for a grid.
 *
 * Every dark module is one rectangle in a single path rather than its own
 * element, because a version 40 code is 31,329 modules and a file with an
 * element for each is one no design tool will open.
 *
 * @param {{ size: number, modules: Uint8Array[] }} grid - From `encodeQr`.
 * @param {object} [options]
 * @param {number} [options.scale] - Pixels per module.
 * @param {number} [options.quiet] - Margin in modules.
 * @param {string} [options.dark] - Module colour.
 * @param {string} [options.light] - Ground colour, or 'none' for a clear one.
 * @returns {string} A standalone SVG document.
 */
export function qrSvg(
  grid,
  { scale = 8, quiet = QUIET_MODULES, dark = '#000000', light = '#ffffff' } = {}
) {
  const span = grid.size + quiet * 2
  const side = span * scale

  let path = ''
  for (let row = 0; row < grid.size; row += 1) {
    for (let column = 0; column < grid.size; column += 1) {
      if (grid.modules[row][column]) {
        path += `M${column + quiet} ${row + quiet}h1v1h-1z`
      }
    }
  }

  const ground = light === 'none' ? '' : `<rect width="${span}" height="${span}" fill="${light}"/>`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"`,
    ` viewBox="0 0 ${span} ${span}" shape-rendering="crispEdges">`,
    ground,
    `<path d="${path}" fill="${dark}"/>`,
    '</svg>',
  ].join('')
}

/**
 * The grid painted onto a canvas at a given pixel width.
 *
 * The module size is floored to a whole pixel and the drawing is centred in
 * what that leaves, because a fractional module puts a seam of half-covered
 * pixels down the code and a scanner reads those as neither colour.
 *
 * @param {{ size: number, modules: Uint8Array[] }} grid - From `encodeQr`.
 * @param {object} [options]
 * @param {number} [options.width] - Requested width in pixels.
 * @param {number} [options.quiet] - Margin in modules.
 * @param {string} [options.dark] - Module colour.
 * @param {string} [options.light] - Ground colour, or 'none' to leave it clear.
 * @returns {HTMLCanvasElement} A canvas holding the code.
 */
function qrCanvas(
  grid,
  { width = 1024, quiet = QUIET_MODULES, dark = '#000000', light = '#ffffff' } = {}
) {
  const span = grid.size + quiet * 2
  const module = Math.max(1, Math.floor(width / span))
  const side = module * span

  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side

  const context = canvas.getContext('2d')
  if (light !== 'none') {
    context.fillStyle = light
    context.fillRect(0, 0, side, side)
  }

  context.fillStyle = dark
  for (let row = 0; row < grid.size; row += 1) {
    for (let column = 0; column < grid.size; column += 1) {
      if (grid.modules[row][column]) {
        context.fillRect((column + quiet) * module, (row + quiet) * module, module, module)
      }
    }
  }
  return canvas
}

/** The canvas as a PNG blob, which is what a download is handed. */
export function qrPngBlob(grid, options) {
  return new Promise(resolve => qrCanvas(grid, options).toBlob(resolve, 'image/png'))
}

/** An SVG string as a blob, so both downloads are handed the same kind of thing. */
export function qrSvgBlob(grid, options) {
  return new Blob([qrSvg(grid, options)], { type: 'image/svg+xml' })
}
