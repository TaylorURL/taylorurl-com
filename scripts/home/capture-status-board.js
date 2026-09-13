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
import { rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BINARY, OUT_DIR, encode, prepare, run } from './shot-renderer.js'

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

async function main() {
  await prepare()

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
      await encode(temp, output, WIDTH, HEIGHT)
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
