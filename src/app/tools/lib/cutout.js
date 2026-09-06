/**
 * Lifting a logo off its background.
 *
 * General background removal is a hard problem and the tools that do it well
 * run a segmentation model on somebody's server. A logo is not the general
 * problem: it arrives on flat ground, usually white, usually from a PDF or a
 * business card, and what stands between it and a clean transparent file is
 * arithmetic rather than judgement. So this runs in the browser, costs nothing,
 * and never sends anybody's artwork anywhere.
 *
 * Two things separate a usable result from the naive one.
 *
 * The first is the halo. A pixel on the edge of a letter is part ink and part
 * paper, and deleting every pixel near enough to white leaves the half-white
 * ones behind as a grey fringe that shows up the moment the logo is placed on
 * anything dark. Instead the distance from the background sets how opaque the
 * pixel is, and the background's own contribution is then taken back out of its
 * colour, which is what leaves an edge that sits on any ground.
 *
 * The second is what counts as background. A wordmark on white wants every
 * white pixel gone. A round badge with white lettering inside it wants the
 * white outside gone and the white inside kept, and no threshold can tell those
 * apart - only which side of the artwork a pixel is on can. So the reach is a
 * choice: everything that matches, or only what the outside can get to.
 */

/** How the background is decided. */
export const REACHES = [
  {
    id: 'outside',
    label: 'Around the Outside',
    hint: 'Keeps white inside the logo. Right for badges and seals.',
  },
  {
    id: 'everywhere',
    label: 'Everywhere It Appears',
    hint: 'Clears every matching pixel. Right for flat wordmarks.',
  },
]

const channels = (data, at) => [data[at], data[at + 1], data[at + 2]]

/**
 * How far apart two colours are, as a share of the furthest they could be.
 *
 * Straight-line distance through RGB, which is not how the eye reads colour but
 * is what a flat background actually differs by, and is the same measure the
 * tolerance a reader drags is expressed in.
 */
function apart([r1, g1, b1], [r2, g2, b2]) {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db) / 441.6729559300637
}

/**
 * The colour the artwork is sitting on, taken from its border.
 *
 * The commonest colour around the edge rather than the corner pixel alone: a
 * corner catches a stray mark or a rounded crop and answers with it, where the
 * border as a whole is the ground unless the logo runs off every side of the
 * image, in which case there is no background to find and any answer is wrong.
 */
export function backgroundOf({ data, width, height }) {
  const tally = new Map()
  const count = (x, y) => {
    const at = (y * width + x) * 4
    if (data[at + 3] < 128) return
    // Binned, so a gradient or a scan's noise still lands in one bucket.
    const key =
      (Math.round(data[at] / 8) << 16) |
      (Math.round(data[at + 1] / 8) << 8) |
      Math.round(data[at + 2] / 8)
    tally.set(key, (tally.get(key) || 0) + 1)
  }

  for (let x = 0; x < width; x += 1) {
    count(x, 0)
    count(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    count(0, y)
    count(width - 1, y)
  }

  let best = null
  let seen = 0
  for (const [key, times] of tally) {
    if (times > seen) {
      seen = times
      best = key
    }
  }
  if (best === null) return [255, 255, 255]
  // Clamped on the way back out: the bins are rounded, so white lands in the
  // thirty-second of them and would otherwise be handed back as 256.
  const channel = bin => Math.min(255, bin * 8)
  return [channel((best >> 16) & 0xff), channel((best >> 8) & 0xff), channel(best & 0xff)]
}

/**
 * Which pixels the outside can reach, as a mask.
 *
 * A flood from every border pixel that matches, four-connected, over an
 * explicit stack rather than by recursion because a large image would otherwise
 * run the call stack out.
 */
function reachable({ data, width, height }, background, near) {
  const open = new Uint8Array(width * height)
  const stack = []

  const consider = index => {
    if (open[index]) return
    const at = index * 4
    if (!near(channels(data, at))) return
    open[index] = 1
    stack.push(index)
  }

  for (let x = 0; x < width; x += 1) {
    consider(x)
    consider((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    consider(y * width)
    consider(y * width + width - 1)
  }

  while (stack.length) {
    const index = stack.pop()
    const x = index % width
    const y = (index - x) / width
    if (x > 0) consider(index - 1)
    if (x < width - 1) consider(index + 1)
    if (y > 0) consider(index - width)
    if (y < height - 1) consider(index + width)
  }
  return open
}

/**
 * Lift the background out of an image.
 *
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} image
 * @param {object} [options]
 * @param {number[]} [options.background] - The colour to remove. Read off the
 *   border when it is not given.
 * @param {number} [options.tolerance] - How far from that colour still counts
 *   as background, 0 to 1.
 * @param {number} [options.softness] - How wide the band is between fully gone
 *   and fully kept, 0 to 1. The band is what carries an antialiased edge.
 * @param {string} [options.reach] - `outside` or `everywhere`.
 * @param {boolean} [options.unmix] - Take the background's own contribution
 *   back out of a part-covered pixel's colour, which is what removes the halo.
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }} A new image.
 */
export function cutout(image, options = {}) {
  const {
    background = backgroundOf(image),
    tolerance = 0.12,
    softness = 0.06,
    reach = 'outside',
    unmix = true,
  } = options

  const { data, width, height } = image
  const out = new Uint8ClampedArray(data)

  const gone = tolerance
  const kept = tolerance + Math.max(softness, 0.0001)
  const near = colour => apart(colour, background) <= kept

  const open = reach === 'outside' ? reachable(image, background, near) : null

  for (let index = 0; index < width * height; index += 1) {
    const at = index * 4
    if (open && !open[index]) continue

    const distance = apart(channels(data, at), background)
    if (distance >= kept) continue

    // Fully background below the tolerance, and a ramp across the soft band, so
    // an edge pixel keeps the share of itself that is actually ink.
    const alpha = distance <= gone ? 0 : (distance - gone) / (kept - gone)
    const existing = data[at + 3] / 255
    out[at + 3] = Math.round(alpha * existing * 255)

    // Taking the ground back out divides by the cover, so a barely-covered
    // pixel divides by almost nothing and its colour flies off to whatever the
    // rounding left. Those pixels are the faint outline a reader sees when a
    // cutout goes wrong, so below a real amount of cover the colour is left as
    // it was and only the transparency is written.
    if (unmix && alpha > 0.15) {
      for (let channel = 0; channel < 3; channel += 1) {
        out[at + channel] = Math.round(
          (data[at + channel] - (1 - alpha) * background[channel]) / alpha
        )
      }
    }
  }

  return { data: out, width, height }
}

/**
 * The same shape in one colour, which is what a logo needs to sit on a photo,
 * a dark header, or a single-colour print. The cover is kept, so the edges stay
 * as smooth as they were.
 */
export function monochrome({ data, width, height }, [r, g, b]) {
  const out = new Uint8ClampedArray(data)
  for (let at = 0; at < out.length; at += 4) {
    out[at] = r
    out[at + 1] = g
    out[at + 2] = b
  }
  return { data: out, width, height }
}

/** The image laid over a solid colour, for wherever transparency is refused. */
export function flatten({ data, width, height }, [r, g, b]) {
  const out = new Uint8ClampedArray(data)
  for (let at = 0; at < out.length; at += 4) {
    const alpha = data[at + 3] / 255
    out[at] = Math.round(data[at] * alpha + r * (1 - alpha))
    out[at + 1] = Math.round(data[at + 1] * alpha + g * (1 - alpha))
    out[at + 2] = Math.round(data[at + 2] * alpha + b * (1 - alpha))
    out[at + 3] = 255
  }
  return { data: out, width, height }
}

/**
 * The image cropped to what is actually drawn.
 *
 * A logo exported from a document usually arrives inside a page of margin, and
 * that margin is what makes it come out small when it is next placed in
 * something. Fully transparent rows and columns come off every side.
 */
export function trim({ data, width, height }, threshold = 8) {
  let top = height
  let left = width
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }

  if (bottom < 0) return { data: new Uint8ClampedArray(data), width, height }

  const cropWidth = right - left + 1
  const cropHeight = bottom - top + 1
  const out = new Uint8ClampedArray(cropWidth * cropHeight * 4)
  for (let y = 0; y < cropHeight; y += 1) {
    const from = ((top + y) * width + left) * 4
    out.set(data.subarray(from, from + cropWidth * 4), y * cropWidth * 4)
  }
  return { data: out, width: cropWidth, height: cropHeight }
}

/** What share of the image the cutout kept, which is what says it went wrong. */
export function coverage({ data }) {
  let kept = 0
  for (let at = 3; at < data.length; at += 4) if (data[at] > 8) kept += 1
  return kept / (data.length / 4)
}
