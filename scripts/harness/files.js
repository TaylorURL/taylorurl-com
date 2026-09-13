/**
 * The walk a check takes when it sweeps a whole tree.
 *
 * A sweep is only as good as the files it reaches: one that skipped a folder
 * would pass every line it never read. So every sweep goes the same way -
 * depth first, into every folder, in the order the directory lists them - and
 * two checks sweeping the same tree are reading the same files.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Every file under `dir` whose name matches `pattern`, as a full path. */
export function filesUnder(dir, pattern) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return filesUnder(full, pattern)
    return pattern.test(entry) ? [full] : []
  })
}
