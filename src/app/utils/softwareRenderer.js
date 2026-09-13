import { Renderer } from 'ogl'

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
function drawsInSoftware(gl) {
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
function webglAvailable() {
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

/**
 * An ogl renderer for a background, or null where there is nothing to draw it
 * with.
 *
 * A background is decoration over a ground that is already drawn, so where
 * there is no context to draw it in there is nothing to replace and nothing to
 * say: the section keeps the ground it had and the reader is none the wiser.
 * Asking first, and giving up quietly on a renderer that fails to build all the
 * same, is what turns a machine without WebGL into a plainer page rather than a
 * broken one.
 *
 * @param {object} options - What the renderer is built with.
 * @returns {(Renderer | null)}
 */
export function openRenderer(options) {
  if (!webglAvailable()) return null
  try {
    const renderer = new Renderer(options)
    return renderer.gl ? renderer : null
  } catch {
    return null
  }
}

/**
 * Draws a background frame after frame for as long as somebody can be watching
 * it, and hands back what stops it.
 *
 * A background that keeps drawing competes with every interaction for as long
 * as the visit lasts. It stops when the tab is hidden and when it has been
 * scrolled off, because nobody is reading it in either place, and it never
 * starts for a reader who has asked for less motion - who still gets the
 * background, drawn once and left still. Coming back to the tab, or scrolling
 * the background back into view, restarts it from wherever it left off, and a
 * reader who turns reduced motion off gets the movement without a reload.
 *
 * @param {Element} element - What the background is drawn in, watched onto and
 *   off the screen.
 * @param {WebGLRenderingContext} gl - The context it draws with.
 * @param {(time: number) => void} draw - One frame, given its timestamp.
 * @param {() => void} [onWake] - Run as a stopped background starts again,
 *   before its next frame is asked for, by one that keeps a clock of its own.
 * @returns {() => void} Stops the drawing and lets go of what it listens to.
 */
export function drawWhileWatched(element, gl, draw, onWake) {
  const software = drawsInSoftware(gl)
  const still = window.matchMedia('(prefers-reduced-motion: reduce)')
  let onScreen = true
  let frame = 0
  const running = () => !still.matches && !software && !document.hidden && onScreen
  const update = time => {
    if (running()) frame = requestAnimationFrame(update)
    else frame = 0
    draw(time)
  }
  frame = requestAnimationFrame(update)

  const wake = () => {
    if (!frame && running()) {
      onWake?.()
      frame = requestAnimationFrame(update)
    }
  }
  document.addEventListener('visibilitychange', wake)
  still.addEventListener('change', wake)

  const watcher =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
          onScreen = entry.isIntersecting
          wake()
        })
      : null
  watcher?.observe(element)

  return () => {
    cancelAnimationFrame(frame)
    watcher?.disconnect()
    document.removeEventListener('visibilitychange', wake)
    still.removeEventListener('change', wake)
  }
}
