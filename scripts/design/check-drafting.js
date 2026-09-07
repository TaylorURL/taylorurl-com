/**
 * Proves that the drafting ground still varies, on every page and between them.
 *
 * The field a section is drawn on is two decisions: the ground says what colour
 * it is, and the motif says what is drawn on it. Before they were separated the
 * motif was a pure function of the ground, so two sections on one ground were
 * always identical and a case study ran five of them in a row. Nothing about
 * that was visible in a diff, and nothing failed - the page simply went flat,
 * and stayed flat for as long as nobody scrolled it.
 *
 * That is what this catches. It reads the views rather than the rendered page,
 * because the assignment is a fact about the source: a section names a motif
 * beside the ground it already named, and the names are literals.
 *
 * Four things have to hold.
 *
 *   Every motif and seam named in a view is one the stylesheet defines. A
 *   typo here is silent: `DRAFTS[draft]` on a name that is not there
 *   interpolates `undefined` into a class list and the section draws the base
 *   field, which looks like a decision rather than a mistake.
 *
 *   No page draws the same motif twice running. This is the whole point, and
 *   it is read off the built pages rather than the source, because a file's
 *   line order is not a page's document order: a helper component is declared
 *   at the top of the view and rendered near the foot of it, and a scan that
 *   reads down the file calls those two neighbours when they are half a page
 *   apart. The colophon is not in a view at all. So the built HTML is the only
 *   place the order is the reader's order, and this half of the check runs
 *   only once `dist/` is there - it is skipped, loudly, when it is not.
 *
 *   No two pages carry the same module. Two pages on one sheet at one pitch
 *   are two pages a reader cannot tell apart, which is the other half of what
 *   was asked for.
 *
 *   The four grid utilities the field replaced are gone from the source. A
 *   call site still naming one draws nothing at all, because the stylesheet no
 *   longer defines it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const STYLESHEET = 'src/index.css'
const TABLE = 'src/app/constants/drafting.js'
const VIEWS = 'src/app/views'
const COMPONENTS = 'src/app/components'

// The motifs whose classes are only ever reached through a page's own rotation
// rather than named at a call site, so a scan of the views never sees them.
const RING_MOTIFS = ['plan', 'ledger', 'column', 'iso']

const failures = []

function fail(where, message) {
  failures.push(`${where}: ${message}`)
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (name.endsWith('.jsx')) out.push(rel)
  }
  return out
}

const css = read(STYLESHEET)
const table = read(TABLE)
const files = [...walk(VIEWS), ...walk(COMPONENTS)]

// ---------------------------------------------------------------- the names

const definedMotifs = new Set([...css.matchAll(/^ {2}\.draft-([a-z]+) \{/gm)].map(m => m[1]))
const draftsBlock = table.slice(
  table.indexOf('export const DRAFTS'),
  table.indexOf('export const SEAMS')
)
const namedMotifs = new Set(
  [...draftsBlock.matchAll(/^ {2}(\w+): 'draft-([a-z]+)',$/gm)].map(m => m[2])
)

for (const name of namedMotifs) {
  if (!definedMotifs.has(name)) {
    fail(TABLE, `names draft-${name}, which ${STYLESHEET} does not define`)
  }
}

const seamsBlock = table.slice(table.indexOf('export const SEAMS'), table.indexOf('const MODULES'))
const seamClasses = [...seamsBlock.matchAll(/^ {2}\w+: '([a-z- ]*)',$/gm)]
  .flatMap(m => m[1].split(' '))
  .filter(Boolean)
for (const cls of seamClasses) {
  if (!new RegExp(`^ {2}\\.${cls} \\{`, 'm').test(css)) {
    fail(TABLE, `names ${cls}, which ${STYLESHEET} does not define`)
  }
}

// A motif every call site has stopped naming is a motif that has quietly left
// the site, and the vocabulary is the variation.
const sourceAll = files.map(read).join('\n')
for (const name of namedMotifs) {
  const named = new RegExp(`draft="${name}"|DRAFTS\\.${name}\\b`).test(sourceAll)
  if (!named && !RING_MOTIFS.includes(name)) {
    fail(TABLE, `defines ${name}, and no view draws on it`)
  }
}

// ------------------------------------------------------------- the leftovers

for (const rel of files) {
  if (/grid-blueprint/.test(read(rel))) {
    fail(rel, 'still names a grid-blueprint utility, which no longer exists')
  }
}
if (/grid-blueprint/.test(css)) {
  fail(STYLESHEET, 'still defines a grid-blueprint utility')
}

// -------------------------------------------------------- twice in a row

const FIELD = /class="[^"]*\bdraft\b[^"]*"/g
const MOTIF = new RegExp(`draft-(${[...namedMotifs].join('|')})\\b`)

function builtPages(dir, out = []) {
  let entries
  try {
    entries = readdirSync(join(ROOT, dir))
  } catch {
    return out
  }
  for (const name of entries) {
    const rel = join(dir, name)
    if (statSync(join(ROOT, rel)).isDirectory()) builtPages(rel, out)
    else if (name === 'index.html') out.push(rel)
  }
  return out
}

// The console and the sign-in screens are app shell and draw no field.
const built = builtPages('dist').filter(rel => !/\/(console|login|signup)\b/.test(rel))
let audited = 0

for (const rel of built) {
  const html = read(rel)
  const order = []
  for (const cls of html.match(FIELD) || []) {
    const hit = MOTIF.exec(cls)
    if (!hit) {
      fail(rel, `draws a field carrying no motif: ${cls}`)
      order.push(null)
      continue
    }
    order.push(hit[1])
  }
  if (order.length === 0) continue
  audited += 1
  for (let i = 1; i < order.length; i += 1) {
    if (order[i] !== null && order[i] === order[i - 1]) {
      fail(rel, `draws ${order[i]} twice running: ${order.join(' > ')}`)
    }
  }
}

// ------------------------------------------------------------ the modules

const modules = [...table.matchAll(/^ {2}(\w+): '(\d+px)',$/gm)]
const byPage = new Map(modules.map(m => [m[1], m[2]]))
if (byPage.size < 20) {
  fail(TABLE, `holds only ${byPage.size} page modules; the site has more pages than that`)
}
const spread = new Set(byPage.values())
if (spread.size < 4) {
  fail(TABLE, `spends only ${spread.size} distinct modules, so most pages share a sheet`)
}

// ------------------------------------------------------------------ report

if (failures.length > 0) {
  console.error('drafting ground:')
  for (const line of failures) console.error(`  ${line}`)
  process.exit(1)
}

const held = `${namedMotifs.size} motifs and ${spread.size} modules across ${byPage.size} pages`
if (audited === 0) {
  console.log(`drafting ground: ${held}; run a build to check the order a reader reads them in`)
} else {
  console.log(`drafting ground: ${held}, and none of the ${audited} built pages repeats a motif`)
}
