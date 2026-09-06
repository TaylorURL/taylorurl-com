/**
 * Regenerates the shots of the status board the home page shows, one per
 * palette: `public/home/status-board.webp` and `status-board-dark.webp`.
 *
 * Two are taken because the card sets the image on a plane that follows the
 * reader's light or dark setting, and a single light capture standing on a dark
 * plane is a white rectangle in the middle of a dark page.
 *
 * That image names sixteen clients and draws each one's mark, so it goes out of
 * date whenever the board gains a site, a client rebrands, or the console's own
 * chrome moves. It had no way to be regenerated until this existed, and drifted
 * far enough that it showed the board before it drew any client marks at all.
 *
 *   npm run capture:status-board                              the live board
 *   npm run capture:status-board -- http://localhost:4319     a build not yet shipped
 *
 * Capturing the live site is the default because the committed image is a claim
 * about what a visitor sees. Point it at a local build when the change being
 * shipped is the one the image has to show.
 *
 * thum.io renders the rest of the site's committed shots and cannot render this
 * one: it never loads a lazily-loaded image, and the client marks are sixteen of
 * those. `status-board-shot.swift` runs the page through WebKit instead, which
 * is compiled here on first use and left beside the source for later runs.
 */
import { execFile } from 'node:child_process'
import { access, mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'scripts', 'status-board-shot.swift')
const BINARY = join(ROOT, 'scripts', '.status-board-shot')
const OUT_DIR = join(ROOT, 'public', 'home')

/** The palettes captured, and the file each one is committed as. */
const SHOTS = [
  { theme: 'light', file: 'status-board.webp' },
  { theme: 'dark', file: 'status-board-dark.webp' },
]

const DEFAULT_ORIGIN = 'https://www.taylorurl.com'
const PATH = '/console/status'

// The size the home page declares for the image, at a density that survives
// being drawn on a retina screen at 128% of its card.
const WIDTH = 1200
const HEIGHT = 750
const SCALE = 3

/** Whether the compiled tool is present and newer than the source it came from. */
async function compiled() {
  try {
    const [binary, source] = await Promise.all([stat(BINARY), stat(SOURCE)])
    return binary.mtimeMs > source.mtimeMs
  } catch {
    return false
  }
}

async function build() {
  if (await compiled()) return
  try {
    await run('swiftc', ['-O', SOURCE, '-o', BINARY])
  } catch (error) {
    throw new Error(
      `swiftc could not build the capture tool — install the Xcode command line tools with \`xcode-select --install\`.\n${error.message}`
    )
  }
}

async function main() {
  try {
    await run('cwebp', ['-version'])
  } catch {
    throw new Error('cwebp not found on PATH — install it with `brew install webp`.')
  }
  await access(SOURCE)
  await build()
  await mkdir(OUT_DIR, { recursive: true })

  const origin = process.argv[2] ?? DEFAULT_ORIGIN

  for (const shot of SHOTS) {
    const output = join(OUT_DIR, shot.file)
    const temp = join(tmpdir(), `status-board-shot-${shot.theme}.png`)
    try {
      const { stdout } = await run(BINARY, [
        '--url',
        `${origin}${PATH}`,
        '--out',
        temp,
        '--width',
        String(WIDTH),
        '--height',
        String(HEIGHT),
        '--scale',
        String(SCALE),
        '--theme',
        shot.theme,
      ])
      // cwebp resizes rather than the renderer, so the detail the extra density
      // bought is spent on the committed pixels instead of thrown away early.
      await run('cwebp', [
        '-q',
        '88',
        '-m',
        '6',
        '-resize',
        String(WIDTH),
        String(HEIGHT),
        temp,
        '-o',
        output,
      ])
      const { size } = await stat(output)
      console.log(
        `captured ${origin}${PATH} in ${shot.theme} at ${stdout.trim()}, written to ${shot.file} as ${size} bytes`
      )
    } finally {
      await rm(temp, { force: true })
    }
  }
}

await main()
