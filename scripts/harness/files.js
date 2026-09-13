/**
 * How a check reaches the files it reads.
 *
 * A path a check names is written from the repository's root rather than from
 * the folder the check sits in, so the same path means the same file in every
 * check, and one check's path can be read in another without working out where
 * it was written from.
 *
 * A sweep is only as good as the files it reaches: one that skipped a folder
 * would pass every line it never read. So every sweep goes the same way -
 * depth first, into every folder, in the order the directory lists them - and
 * two checks sweeping the same tree are reading the same files.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** A file's text, by its path from the root of the repository. */
export const read = path => readFileSync(join(ROOT, path), 'utf8')

/** Every file under `dir` whose name matches `pattern`, as a full path. */
export function filesUnder(dir, pattern) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return filesUnder(full, pattern)
    return pattern.test(entry) ? [full] : []
  })
}
