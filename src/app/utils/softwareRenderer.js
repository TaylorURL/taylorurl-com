// A renderer with no GPU behind it names itself: Chrome's SwiftShader, Mesa's
// llvmpipe, a platform's software fallback. Any of them rasterises a shader on
// the same thread the page is laid out on.
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i

/**
 * Whether a WebGL context is being drawn in software.
 *
 * A decoration that animates on a GPU for nothing costs, on such a machine,
 * more per frame than the page paints in the same time, so what asks this
 * draws its one frame and holds it.
 *
 * @param {WebGLRenderingContext} gl
 * @returns {boolean}
 */
export function drawsInSoftware(gl) {
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER)
  return SOFTWARE_RENDERER.test(String(renderer || ''))
}

// Asked once per page and remembered. The answer cannot change inside a visit,
// and each asking costs a context on a budget the browser caps at around a
// dozen and a half.
let available

/**
 * Whether this browser will hand out a WebGL context at all.
 *
 * Drawing in software is slow; being refused outright is a different answer,
 * and a common one - hardware acceleration switched off, a driver on the
 * vendor's blocklist, a machine with too little to spare, an in-app browser
 * handing the page to the system one mid-load. A renderer built without asking
 * first wraps a context that is null, which is not a state it carries: it says
 * so on the console and then throws on the next line, in front of the reader,
 * taking the rest of the page's setup with it.
 *
 * The probe is its own throwaway canvas, so nothing is half-built when the
 * answer is no, and it gives the context straight back so that a page which
 * goes on to draw is no closer to the browser's ceiling for having asked.
 *
 * @returns {boolean}
 */
export function webglAvailable() {
  if (available !== undefined) return available
  if (typeof document === 'undefined') return false
  let gl = null
  try {
    const canvas = document.createElement('canvas')
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  } catch {
    gl = null
  }
  available = Boolean(gl)
  try {
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    // Nothing to release.
  }
  return available
}
