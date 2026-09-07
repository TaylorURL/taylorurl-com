/**
 * Checks the portfolio data against the sites it claims to show.
 *
 *   npm run audit:portfolio
 *
 * A portfolio row is the only page on this site whose truth lives somewhere
 * else: a client can rebrand, move to another platform, or let a domain lapse
 * without a commit landing here, and the row keeps describing whatever was
 * true the day it was written. This reads the live sites and reports where the
 * two have come apart.
 *
 * Per entry it confirms the URL still answers, that both committed captures
 * exist and are large enough to be real shots rather than blank frames, and it
 * prints the live title and meta description so a rebrand shows up next to the
 * recorded copy. It also names captures under `public/portfolio/` that no entry
 * points at any more, the outreach email's JPEG alongside the device shots.
 *
 * `scripts/portfolio/portfolio-sites.json` holds the domains deliberately absent from the
 * portfolio, each with the reason. Finding a newly launched site that belongs
 * in the portfolio needs the repository list, which this script has no
 * credentials for; the daily maintenance routine does that half and reads this
 * file to tell a deliberate omission from an oversight.
 *
 * Exits non-zero when anything failed, so it can gate a run. It reaches the
 * open internet and is therefore not part of CI, where an unrelated client's
 * outage would stop the build.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PORTFOLIO_PROJECTS,
  portfolioEmailPreviewSrc,
  portfolioPreviewSrc,
} from '../../src/app/data/portfolio.js'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const PUBLIC_DIR = resolve(ROOT, 'public')
const DEVICES = ['desktop', 'phone']

// Every directory a retirement leaves files behind in, each with the extension
// its own captures carry: the device shots a row and a study draw, and the
// desktop JPEG the outreach email embeds. Sweeping only the first is what let a
// removed entry's email capture sit unnoticed through two retirements, so both
// are swept.
const CAPTURE_DIRS = [
  { dir: 'portfolio', ext: '.webp' },
  { dir: 'portfolio/email', ext: '.jpg' },
]

const REQUEST_TIMEOUT_MS = 30_000

// A blank frame carries almost no detail, which shows up as bytes per pixel
// rather than as bytes. The flat 10 KB floor belongs to the source PNG the
// capture script downloads; carried over to the encoded WebP it failed a phone
// shot of a dark landing page for compressing well rather than for being
// empty. A painted page lands above 0.02 bytes per pixel and a solid fill an
// order of magnitude below, so the threshold sits between them, with a flat
// floor for frames too small for the ratio to mean anything.
const MIN_BYTES_PER_PIXEL = 0.008
const MIN_CAPTURE_BYTES = 1500

// Canvas size from a WebP header. The simple lossy and lossless chunks each
// pack it their own way and VP8X carries it as three-byte minus-one fields;
// anything else returns null, leaving only the flat floor to apply.
function webpDimensions(bytes) {
  if (bytes.length < 30) return null
  const tag = String.fromCharCode(...bytes.subarray(0, 4), ...bytes.subarray(8, 12))
  if (tag !== 'RIFFWEBP') return null
  const chunk = String.fromCharCode(...bytes.subarray(12, 16))
  if (chunk === 'VP8 ') {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    }
  }
  if (chunk === 'VP8L') {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    return {
      width: (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1,
      height: (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1,
    }
  }
  return null
}

function blankFrameFloor(header) {
  const dimensions = webpDimensions(header)
  if (!dimensions) return MIN_CAPTURE_BYTES
  return Math.max(
    MIN_CAPTURE_BYTES,
    Math.round(dimensions.width * dimensions.height * MIN_BYTES_PER_PIXEL)
  )
}

const readTag = (html, pattern) => html.match(pattern)?.[1]?.trim().replace(/\s+/g, ' ')

async function readLiveSite(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const html = response.ok ? await response.text() : ''
  return {
    status: response.status,
    finalUrl: response.url,
    title: readTag(html, /<title[^>]*>([^<]*)<\/title>/i),
    description:
      readTag(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i) ??
      readTag(html, /<meta[^>]+content="([^"]*)"[^>]+name="description"/i),
  }
}

async function auditEntry(project) {
  const problems = []
  let live = null

  try {
    live = await readLiveSite(project.url)
    if (live.status !== 200) problems.push(`${project.url} answered ${live.status}`)
  } catch (error) {
    problems.push(`${project.url} did not answer: ${error.message}`)
  }

  for (const device of DEVICES) {
    const path = resolve(PUBLIC_DIR, `.${portfolioPreviewSrc(project, device)}`)
    try {
      const { size } = await stat(path)
      const floor = blankFrameFloor(await readFile(path))
      if (size < floor) {
        problems.push(`${device} capture is ${size} bytes, under the ${floor} floor`)
      }
    } catch {
      problems.push(`${device} capture is missing (${portfolioPreviewSrc(project, device)})`)
    }
  }

  return { project, live, problems }
}

async function orphanedCaptures() {
  const expected = new Set(
    PORTFOLIO_PROJECTS.flatMap(project => [
      ...DEVICES.map(device => portfolioPreviewSrc(project, device)),
      portfolioEmailPreviewSrc(project),
    ])
  )
  const found = await Promise.all(
    CAPTURE_DIRS.map(async ({ dir, ext }) => {
      // A directory that has lost its last capture is gone rather than empty,
      // which is an absence of orphans rather than a reason to stop the audit.
      const present = await readdir(resolve(PUBLIC_DIR, dir)).catch(() => [])
      return present.filter(file => file.endsWith(ext)).map(file => `/${dir}/${file}`)
    })
  )
  return found.flat().filter(src => !expected.has(src))
}

async function main() {
  const registry = JSON.parse(
    await readFile(resolve(ROOT, 'scripts/portfolio/portfolio-sites.json'), 'utf8')
  )
  const results = await Promise.all(PORTFOLIO_PROJECTS.map(auditEntry))
  const orphans = await orphanedCaptures()

  for (const { project, live, problems } of results) {
    console.log(`\n${project.name} — ${project.displayUrl}`)
    if (live) {
      console.log(`  live title: ${live.title ?? '(none)'}`)
      if (live.description) console.log(`  live description: ${live.description}`)
      if (live.finalUrl.replace(/\/$/, '') !== project.url.replace(/\/$/, '')) {
        console.log(`  redirects to: ${live.finalUrl}`)
      }
    }
    console.log(`  recorded: ${project.tagline}`)
    for (const problem of problems) console.log(`  FAIL ${problem}`)
  }

  console.log('\nDeliberately absent from the portfolio:')
  for (const { domain, reason } of registry.excluded) console.log(`  ${domain} — ${reason}`)

  if (orphans.length > 0) {
    console.log('\nCaptures no entry points at:')
    for (const file of orphans) console.log(`  ${file}`)
  }

  const failed = results.filter(result => result.problems.length > 0)
  console.log(
    `\n${results.length} entries checked, ${failed.length} with problems, ${orphans.length} orphaned capture(s).`
  )
  console.log(
    'Titles and descriptions are printed rather than judged — read them against the recorded copy and rewrite any row the site has outgrown.'
  )

  if (failed.length > 0 || orphans.length > 0) process.exitCode = 1
}

await main()
