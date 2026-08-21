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
 *   npm run capture:portfolio
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
  portfolioPreviewSrc,
  portfolioScreenshotServiceUrl,
} from '../src/app/data/portfolio.js'

const run = promisify(execFile)

const PUBLIC_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../public')
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

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms))

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
        await sleep(POLL_DELAY_MS)
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
  if (device === 'desktop') {
    const dimensions = pngDimensions(bytes)
    if (dimensions) {
      const cropHeight = Math.min(
        dimensions.height,
        Math.round(dimensions.width * DESKTOP_STAGE_RATIO)
      )
      cwebpArgs.push('-crop', '0', '0', String(dimensions.width), String(cropHeight))
    }
  }

  try {
    await writeFile(tempPath, bytes)
    await run('cwebp', [...cwebpArgs, tempPath, '-o', outputPath])
  } finally {
    await rm(tempPath, { force: true })
  }
}

async function main() {
  try {
    await run('cwebp', ['-version'])
  } catch {
    throw new Error('cwebp not found on PATH — install it with `brew install webp`.')
  }

  await mkdir(join(PUBLIC_DIR, 'portfolio'), { recursive: true })

  const jobs = []
  for (const project of PORTFOLIO_PROJECTS) {
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
