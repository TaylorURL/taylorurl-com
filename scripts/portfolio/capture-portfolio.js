/**
 * Regenerates the portfolio preview images in `public/portfolio/`.
 *
 * Screenshots are rendered by thum.io — the same service the Portfolio view
 * already trusts as its fallback — so nothing runs a browser on this machine.
 * Each entry in `PORTFOLIO_PROJECTS` is captured twice, a desktop view and a
 * phone view, then encoded to WebP with cwebp. Output paths come from
 * `portfolioPreviewSrc`, the same helper the Portfolio view reads from, so the
 * files land exactly where the page looks for them.
 *
 * Run it whenever a client site changes enough that its preview should too:
 *
 *   npm run capture:portfolio                      every entry
 *   npm run capture:portfolio -- tiretracker.app   only these display URLs
 *
 * One client rebranding does not make the other previews wrong, and a full run
 * rewrites every committed file, so naming the sites that moved keeps the diff
 * to the sites that moved.
 *
 * A per-run cache-busting query on the target URL forces thum.io to render
 * the current site rather than serve a shot cached from an earlier run.
 */
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  PORTFOLIO_PROJECTS,
  portfolioEmailPreviewSrc,
  portfolioPreviewSrc,
  portfolioScreenshotServiceUrl,
} from '../../src/app/data/portfolio.js'
import { wait } from '../../lib/time/wait.js'

const run = promisify(execFile)

const PUBLIC_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../public')
const DEVICES = ['desktop', 'phone']

// thum.io answers with a spinner GIF while a render is still queued, so each
// capture polls until the real image arrives.
const POLL_ATTEMPTS = 12
const POLL_DELAY_MS = 8000

// A shot taken before the page painted comes back as a valid but near-blank
// image a few KB in size, an order of magnitude under any real page shot.
// Undersized results are rejected and re-rendered under a fresh cache-buster;
// thum.io would serve the cached blank again under the same URL.
const MIN_IMAGE_BYTES = 10_000
const RENDER_ATTEMPTS = 3

const RUN_STAMP = Date.now()

// The desktop stage in the Portfolio view is 16:10, but thum.io's desktop
// render comes back taller. Cropping to the stage ratio at encode time keeps
// every shipped byte visible instead of hiding the overflow behind
// object-cover.
const DESKTOP_STAGE_RATIO = 10 / 16

// The email copy is drawn 542px wide, so twice that is sharp on a retina
// screen. The quality holds a screenshot's text legible while keeping three of
// them in one message under a quarter of a megabyte.
const EMAIL_JPEG_WIDTH = 1084
const EMAIL_JPEG_QUALITY = 62

const isSpinnerGif = bytes =>
  bytes.length >= 4 &&
  bytes[0] === 0x47 &&
  bytes[1] === 0x49 &&
  bytes[2] === 0x46 &&
  bytes[3] === 0x38

// Width and height from a PNG's IHDR chunk, which sits at a fixed offset
// after the 8-byte signature. Returns null for any other format.
function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

async function fetchScreenshot(project, device) {
  for (let render = 0; render < RENDER_ATTEMPTS; render++) {
    const url = `${portfolioScreenshotServiceUrl(project, device)}?_capture=${RUN_STAMP}-${render}`
    for (let poll = 0; poll < POLL_ATTEMPTS; poll++) {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`thum.io responded ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (isSpinnerGif(bytes)) {
        await wait(POLL_DELAY_MS)
        continue
      }
      if (bytes.length >= MIN_IMAGE_BYTES) return bytes
      break
    }
  }
  throw new Error('no usable render — every attempt was a spinner or a near-blank frame')
}

async function capture(project, device) {
  const bytes = await fetchScreenshot(project, device)
  const tempPath = join(tmpdir(), `portfolio-capture-${project.displayUrl}-${device}`)
  const outputPath = join(PUBLIC_DIR, portfolioPreviewSrc(project, device))

  const cwebpArgs = ['-q', '82', '-m', '6']
  let crop = null
  if (device === 'desktop') {
    const dimensions = pngDimensions(bytes)
    if (dimensions) {
      const cropHeight = Math.min(
        dimensions.height,
        Math.round(dimensions.width * DESKTOP_STAGE_RATIO)
      )
      crop = { width: dimensions.width, height: cropHeight }
      cwebpArgs.push('-crop', '0', '0', String(dimensions.width), String(cropHeight))
    }
  }

  try {
    await writeFile(tempPath, bytes)
    await run('cwebp', [...cwebpArgs, tempPath, '-o', outputPath])
    if (device === 'desktop') await captureForEmail(project, tempPath, crop)
  } finally {
    await rm(tempPath, { force: true })
  }
}

/**
 * The desktop capture again as a JPEG, which is the copy an outreach message
 * shows. Written in the same pass as the WebP from the same bytes, so the two
 * are one capture in two formats rather than two captures taken at different
 * times.
 *
 * `sips` ships with macOS and is what the crop and the encode both go through.
 * A machine without it leaves the JPEG untouched and says so, because a stale
 * proof band is worth a line of output and is not worth failing a capture over.
 */
async function captureForEmail(project, sourcePath, crop) {
  const outputPath = join(PUBLIC_DIR, portfolioEmailPreviewSrc(project))
  const arguments_ = ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(EMAIL_JPEG_QUALITY)]
  if (crop) arguments_.push('-c', String(crop.height), String(crop.width))
  arguments_.push('-Z', String(EMAIL_JPEG_WIDTH), sourcePath, '--out', outputPath)

  try {
    await run('sips', arguments_)
  } catch {
    console.warn(`  email JPEG not written for ${project.displayUrl} — sips is unavailable`)
  }
}

async function main() {
  try {
    await run('cwebp', ['-version'])
  } catch {
    throw new Error('cwebp not found on PATH — install it with `brew install webp`.')
  }

  await mkdir(join(PUBLIC_DIR, 'portfolio'), { recursive: true })
  await mkdir(join(PUBLIC_DIR, 'portfolio', 'email'), { recursive: true })

  const requested = new Set(process.argv.slice(2))
  const selected = PORTFOLIO_PROJECTS.filter(
    project => requested.size === 0 || requested.has(project.displayUrl)
  )
  const unknown = [...requested].filter(
    name => !PORTFOLIO_PROJECTS.some(project => project.displayUrl === name)
  )
  if (unknown.length > 0) {
    throw new Error(`no portfolio entry for: ${unknown.join(', ')}`)
  }

  const jobs = []
  for (const project of selected) {
    for (const device of DEVICES) {
      const label = `${project.displayUrl} (${device})`
      jobs.push(
        capture(project, device).then(
          () => {
            console.log(`captured ${label}`)
            return null
          },
          error => `${label}: ${error.message}`
        )
      )
    }
  }

  const failures = (await Promise.all(jobs)).filter(Boolean)
  if (failures.length > 0) {
    console.error(`\n${failures.length} capture(s) failed:`)
    for (const failure of failures) console.error(`  ${failure}`)
    process.exitCode = 1
  }
}

await main()
