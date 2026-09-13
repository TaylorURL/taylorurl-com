/**
 * The renderer the home page's committed shots are taken with.
 *
 * The screenshot service the rest of the site's shots come from never loads a
 * lazily-loaded image, so `status-board-shot.swift` runs each page through
 * WebKit instead. It is compiled on first use and the binary is left beside the
 * source, so a later run starts straight away and a run after the source has
 * changed compiles it again.
 */
import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

export const run = promisify(execFile)

const HERE = dirname(fileURLToPath(import.meta.url))
export const SOURCE = join(HERE, 'status-board-shot.swift')
export const BINARY = join(HERE, '.status-board-shot')

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
export async function build() {
  if (await compiled()) return
  try {
    await run('swiftc', ['-O', SOURCE, '-o', BINARY])
  } catch (error) {
    throw new Error(
      `swiftc could not build the capture tool — install the Xcode command line tools with \`xcode-select --install\`.\n${error.message}`
    )
  }
}
