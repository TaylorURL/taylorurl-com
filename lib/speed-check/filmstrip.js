/**
 * The reading's own test load, frame by frame.
 *
 * A score out of a hundred is a number somebody has to take on trust. The
 * frames are the thing the number is about: Lighthouse records the screen while
 * it loads the page and hands back a strip of captures, each stamped with how
 * far into the load it was taken, and a strip that stays white for two seconds
 * says what a score of 40 means without asking anybody to believe it.
 *
 * The strip is marked where the page became usable, and the mark is read off
 * the same report rather than off a threshold of our own. It has to be the
 * observed figure and not the one the reading quotes. PageSpeed loads the page
 * once over Google's own connection, records the frames from that load, and
 * then works out what the same load would take on a mid-range phone over a
 * mobile signal: the Largest Contentful Paint in the reading is that worked-out
 * figure, and on a heavy page it can be ten times the length of the strip. A
 * mark placed by it would land past the last frame, or on a frame that plainly
 * shows the page finished. The report carries the observed timings too, taken
 * on the trace the frames came from, so the mark sits on the strip's own clock
 * and the worked-out figure is quoted beside it for what it is.
 *
 * The frames are stored rather than carried in the row. Each is a capture a few
 * tens of kilobytes long, a heavy page's strip runs to a quarter of a megabyte,
 * and `speed_checks` is a table every request reads; so the bytes go to the
 * bucket the page's own capture already lives in, and the row keeps the times
 * and the addresses. Each frame is named by its contents. A page that sits
 * white for a second gives four identical frames and the blank screen is the
 * same blank screen on every site measured, so a frame already stored is the
 * same object rather than another copy of it.
 */

import { createHash } from 'node:crypto'

/** Where the frames live: beside the capture `lib/outreach/audit/shot.js` stores. */
const BUCKET = 'outreach-shots'

/** The folder inside it, so a frame never answers a search for a capture. */
const FOLDER = 'frames'

/** The kinds of picture the bucket takes, against the extension each is stored under. */
const KINDS = { 'image/jpeg': 'jpg', 'image/png': 'png' }

/** A frame is a small capture, and anything past this is not one. */
const FRAME_LIMIT_BYTES = 512 * 1024

/** More frames than Lighthouse has ever recorded, which is the most a strip may hold. */
const FRAME_LIMIT = 12

/** Named by contents, so a stored frame is served as long as anybody asks for it. */
const CACHE_SECONDS = String(365 * 24 * 60 * 60)

/**
 * What the strip is marked by, best first.
 *
 * `observed` is the report's own figure on the trace the frames came from;
 * `metric` is the name the reading stores the worked-out figure under, which is
 * the one quoted beside the strip. The Speed Index stands in only for a report
 * that recorded no Largest Contentful Paint at all.
 */
const MARKS = [
  { by: 'largest_contentful_paint', observed: 'observedLargestContentfulPaint' },
  { by: 'speed_index', observed: 'observedSpeedIndex' },
]

/** The space Lighthouse writes between a figure and its unit, so the two never part. */
const UNIT_SPACE = ' '

/** A whole number of milliseconds, or null for anything that is not a time. */
function millis(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null
}

/**
 * The bytes and kind of one frame, or null for anything that is not a picture
 * the bucket would take.
 */
function decoded(data) {
  if (typeof data !== 'string') return null
  const found = data.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/)
  if (!found || !KINDS[found[1]]) return null
  const bytes = Buffer.from(found[2], 'base64')
  if (!bytes.length || bytes.length > FRAME_LIMIT_BYTES) return null
  return { type: found[1], bytes }
}

/**
 * The width and height a frame was captured at, read off its own header.
 *
 * Every frame in a strip is the same size, and knowing it lets the page hold
 * the room for each before it arrives. A header this cannot read answers null
 * and the page lays the frame out by its width alone.
 *
 * @param {Buffer} bytes
 * @param {string} type
 * @returns {{width: number, height: number}|null}
 */
export function frameSize(bytes, type) {
  if (!Buffer.isBuffer(bytes)) return null
  if (type === 'image/png') {
    if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') return null
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  // Walk the segments to the frame header. Every segment after the start
  // marker carries its own length, so the walk never reads into image data.
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1]
    const length = bytes.readUInt16BE(at + 2)
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (isFrame) return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) }
    at += 2 + length
  }
  return null
}

/**
 * The strip a report recorded, or null where it recorded none.
 *
 * Nothing is stored and nothing is fetched: this reads the report as it
 * arrived, which is what lets a test hand it a report and check the answer.
 * A frame that is not a picture is left out rather than guessed at, and a
 * strip with none left is no strip.
 *
 * @param {object} report A PageSpeed Insights response.
 * @returns {{frames: Array<{at: number, type: string, bytes: Buffer}>,
 *   painted: number|null, usable: number|null, usable_by: string|null}|null}
 */
export function framesOf(report) {
  const audits = report?.lighthouseResult?.audits ?? {}
  const items = audits['screenshot-thumbnails']?.details?.items
  if (!Array.isArray(items)) return null

  const frames = []
  for (const item of items.slice(0, FRAME_LIMIT)) {
    const at = millis(item?.timing)
    const picture = decoded(item?.data)
    if (at === null || !picture) continue
    frames.push({ at, ...picture })
  }
  if (!frames.length) return null
  frames.sort((first, second) => first.at - second.at)

  const observed = audits.metrics?.details?.items?.[0] ?? {}
  const mark = MARKS.find(entry => millis(observed[entry.observed]) !== null)

  return {
    frames,
    painted: millis(observed.observedFirstContentfulPaint),
    usable: mark ? millis(observed[mark.observed]) : null,
    usable_by: mark ? mark.by : null,
  }
}

/** Where one frame is stored, named by what is in it. */
function framePath(frame) {
  const name = createHash('sha256').update(frame.bytes).digest('hex').slice(0, 40)
  return `${FOLDER}/${name}.${KINDS[frame.type]}`
}

/**
 * Stores a strip's frames and answers what the row keeps of it.
 *
 * All or nothing. A strip with a frame missing out of the middle is a load that
 * skipped a second it did not skip, so a refused upload leaves the whole strip
 * out, the same way a capture that will not render leaves the picture out.
 * Nothing raises: the reading is the answer and the frames are the evidence
 * beside it, and evidence that could not be kept is not a reason to lose the
 * answer.
 *
 * @param {object} db A service-role client.
 * @param {ReturnType<typeof framesOf>} strip
 * @returns {Promise<object|null>} The value for `speed_checks.filmstrip`.
 */
export async function keepFilmstrip(db, strip) {
  if (!db || !strip?.frames?.length) return null

  try {
    const bucket = db.storage.from(BUCKET)
    const paths = strip.frames.map(framePath)

    const unique = new Map()
    strip.frames.forEach((frame, index) => unique.set(paths[index], frame))
    const answers = await Promise.all(
      [...unique].map(([path, frame]) =>
        bucket.upload(path, frame.bytes, {
          contentType: frame.type,
          cacheControl: CACHE_SECONDS,
          upsert: true,
        })
      )
    )
    const refused = answers.find(answer => answer?.error)
    if (refused) {
      console.error('speed-check: storing frames: %s', refused.error.message)
      return null
    }

    const size = frameSize(strip.frames[0].bytes, strip.frames[0].type)
    return {
      frames: strip.frames.map((frame, index) => ({
        at: frame.at,
        src: bucket.getPublicUrl(paths[index]).data.publicUrl,
      })),
      width: size?.width ?? null,
      height: size?.height ?? null,
      painted: strip.painted ?? null,
      usable: strip.usable ?? null,
      usable_by: strip.usable_by ?? null,
    }
  } catch (cause) {
    console.error('speed-check: storing frames: %s', cause?.message)
    return null
  }
}

/** A time on the strip, written the way the report writes its own. */
export function frameTime(ms) {
  return `${(ms / 1000).toFixed(1)}${UNIT_SPACE}s`
}

/**
 * The strip as the page draws it, or null where the row holds none.
 *
 * Each frame says what it shows in a word the page can put into a sentence:
 * `blank` before anything was painted, `painting` once something was and before
 * the page was usable, `usable` from the marked frame on. A strip whose report
 * named no usable moment has nothing to tell the middle from the end, so its
 * painted frames are `painted` and nothing more is claimed for them.
 *
 * The first usable frame is the one marked. A frame is a capture of the screen
 * at the moment it is stamped with, so the first one stamped at or after the
 * observed time is the first that shows what that time names.
 *
 * `phoneAt` is the reading's own worked-out figure for the same moment, taken
 * from the metrics the reading already quotes, so the sentence beside the strip
 * and the line in the list below it are the same number.
 *
 * @param {object|null} stored The row's `filmstrip`.
 * @param {object} [metrics] The row's `audit_raw.metrics`.
 * @returns {object|null}
 */
export function filmstripFor(stored, metrics = {}) {
  const frames = Array.isArray(stored?.frames)
    ? stored.frames.filter(frame => millis(frame?.at) !== null && typeof frame?.src === 'string')
    : []
  if (!frames.length) return null

  const painted = millis(stored.painted)
  const usable = millis(stored.usable)
  const by = MARKS.some(entry => entry.by === stored.usable_by) ? stored.usable_by : null
  const marked = usable === null || !by ? -1 : frames.findIndex(frame => frame.at >= usable)

  const phaseOf = (frame, index) => {
    if (painted !== null && frame.at < painted) return 'blank'
    if (marked === -1) return 'painted'
    return index >= marked ? 'usable' : 'painting'
  }

  return {
    frames: frames.map((frame, index) => ({
      at: frame.at,
      time: frameTime(frame.at),
      src: frame.src,
      phase: phaseOf(frame, index),
      marked: index === marked,
    })),
    width: millis(stored.width) || null,
    height: millis(stored.height) || null,
    mark: marked === -1 ? null : by,
    phoneAt: marked === -1 ? null : (metrics?.[by]?.display ?? null),
  }
}
