/**
 * Regenerates the three shots the home page's process band stands on, one per
 * palette: `public/home/step-*.webp` and `step-*-dark.webp`, plus the narrow
 * cut each one is served to a phone as.
 *
 * The band used to describe its three steps and show nothing, which is the same
 * mistake the capability cards above it exist to avoid: a sentence about a form
 * is a claim, and the form itself is not. So the first two steps now carry the
 * page they are talking about - the enquiry form you fill in and the prices you
 * are quoted against - captured off the live site, where a visitor can go and
 * check both of them. The third stands on a client's own site, which is already
 * committed under `public/portfolio/` and needs nothing taken here.
 *
 * `settle` is carried for a page that fills itself from a fetch, and no shot
 * needs it yet. The board would, and the board is not taken here: it paints
 * skeletons rather than rows to this renderer however long it is given, so a
 * shot of it is a picture of nothing working.
 *
 * Two palettes are taken because the shot stands on a plane that follows the
 * reader's light or dark setting, and a single light capture on a dark plane is
 * a white rectangle in the middle of a dark page.
 *
 *   npm run capture:process-shots                            the live site
 *   npm run capture:process-shots -- http://localhost:5173   a build not yet shipped
 *
 * The live site is the default because a committed shot is a claim about what a
 * visitor sees. Point it at a local build when the change being shipped is the
 * one the shot has to show.
 *
 * Each artefact is named by a selector rather than by an offset down the page,
 * so a shot follows its subject when the copy above it gains a line instead of
 * quietly sliding off it. `status-board-shot.swift` does the rendering, the
 * same engine the board's own shot is taken with, because the screenshot
 * service the portfolio uses never loads a lazily-loaded image.
 */
import { execFile } from 'node:child_process'
import { access, mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SOURCE = join(ROOT, 'scripts', 'home', 'status-board-shot.swift')
const BINARY = join(ROOT, 'scripts', 'home', '.status-board-shot')
const OUT_DIR = join(ROOT, 'public', 'home')

/**
 * The three artefacts, in the order the steps run.
 *
 * `selector` is the element the shot is framed on, `pad` the air left above it,
 * and `settle` how long the page is given to finish filling itself. All three
 * are facts about the page being captured, so they live beside the page rather
 * than inside the renderer.
 */
const SHOTS = [
  { name: 'step-enquiry', path: '/contact', selector: 'form', pad: 100 },
  { name: 'step-plan', path: '/pricing', selector: '#figures .edge', pad: 26 },
]

const PALETTES = ['light', 'dark']

const DEFAULT_ORIGIN = 'https://www.taylorurl.com'

// The page is laid out at the width the artefact is read at rather than at a
// desktop's, because the shot is drawn about a third the width of the page it
// came from and a full-width capture arrives at the reader too small to read.
// Narrow, the same panel reflows to one column and its type lands legible.
const WIDTH = 760
const HEIGHT = 475

// What the file is written at, which is twice the layout so a retina screen has
// something to spend, off a raster taken at three times it.
const COMMITTED = WIDTH * 2
const SCALE = 3

// The narrow cut, for a phone that would otherwise spend four times the bytes on
// a picture it draws at half the width.
const NARROW = WIDTH

/** What a palette's file is called. The light one carries no suffix. */
const fileFor = (name, palette) => `${name}${palette === 'dark' ? '-dark' : ''}.webp`

/** Whether the compiled renderer is present and newer than the source it came from. */
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
  const only = process.argv.slice(3)
  const wanted = only.length ? SHOTS.filter(shot => only.includes(shot.name)) : SHOTS
  if (!wanted.length) throw new Error(`no shot named ${only.join(', ')}`)

  for (const shot of wanted) {
    for (const palette of PALETTES) {
      const file = fileFor(shot.name, palette)
      const output = join(OUT_DIR, file)
      const narrow = join(OUT_DIR, file.replace(/\.webp$/, `-${NARROW}.webp`))
      const temp = join(tmpdir(), `${shot.name}-${palette}.png`)
      try {
        const { stdout } = await run(BINARY, [
          '--url',
          `${origin}${shot.path}`,
          '--out',
          temp,
          '--width',
          String(WIDTH),
          '--height',
          String(HEIGHT),
          '--scale',
          String(SCALE),
          '--selector',
          shot.selector,
          '--pad',
          String(shot.pad),
          ...(shot.settle ? ['--settle', String(shot.settle)] : []),
          '--theme',
          palette,
        ])
        // cwebp resizes rather than the renderer, so the detail the extra
        // density bought is spent on the committed pixels instead of thrown
        // away early. Both cuts come off the one capture for the same reason.
        for (const [target, width, height] of [
          [output, COMMITTED, COMMITTED * (HEIGHT / WIDTH)],
          [narrow, NARROW, Math.round((HEIGHT / WIDTH) * NARROW)],
        ]) {
          await run('cwebp', [
            '-q',
            '88',
            '-m',
            '6',
            '-resize',
            String(Math.round(width)),
            String(Math.round(height)),
            temp,
            '-o',
            target,
          ])
        }
        const [wide, small] = await Promise.all([stat(output), stat(narrow)])
        console.log(
          `captured ${origin}${shot.path} at ${shot.selector} in ${palette} at ${stdout.trim()}, ` +
            `written as ${file} (${wide.size} bytes) and its ${NARROW} cut (${small.size} bytes)`
        )
      } finally {
        await rm(temp, { force: true })
      }
    }
  }
}

await main()
