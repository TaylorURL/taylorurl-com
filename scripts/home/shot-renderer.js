/**
 * The renderer the home page's committed shots are taken with, and the steps
 * either capture script takes around it.
 *
 * The screenshot service the rest of the site's shots come from never loads a
 * lazily-loaded image, so `status-board-shot.swift` runs each page through
 * WebKit instead. It is compiled on first use and the binary is left beside the
 * source, so a later run starts straight away and a run after the source has
 * changed compiles it again.
 *
 * Every shot is written the same way once it is taken - encoded by cwebp into
 * the folder the home page reads from - so a run is readied and a shot encoded
 * here rather than in each script that takes one.
 */
import { execFile } from 'node:child_process'
import { access, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

export const run = promisify(execFile)

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = join(HERE, 'status-board-shot.swift')
export const BINARY = join(HERE, '.status-board-shot')

/** Where the home page's committed shots are written. */
export const OUT_DIR = join(HERE, '../..', 'public', 'home')

/** Whether the compiled renderer is present and newer than the source it came from. */
async function compiled() {
  try {
    const [binary, source] = await Promise.all([stat(BINARY), stat(SOURCE)])
    return binary.mtimeMs > source.mtimeMs
  } catch {
    return false
  }
}

/** Compiles the renderer, unless the binary beside the source is already current. */
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

/** Readies a run: the encoder is on the path, the renderer is built and the folder is there. */
export async function prepare() {
  try {
    await run('cwebp', ['-version'])
  } catch {
    throw new Error('cwebp not found on PATH — install it with `brew install webp`.')
  }
  await access(SOURCE)
  await build()
  await mkdir(OUT_DIR, { recursive: true })
}

/** Writes the raster at `temp` to `target` as a WebP, resized to `width` by `height`. */
export async function encode(temp, target, width, height) {
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
